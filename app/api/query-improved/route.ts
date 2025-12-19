import { NextResponse } from 'next/server';
import { Index } from '@upstash/vector';
import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';

// Lazy initialization to avoid build-time errors
let groq: Groq;
let cohere: CohereClient;
let index: Index;

function getGroq() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });
  }
  return groq;
}

function getCohere() {
  if (!cohere) {
    cohere = new CohereClient({
      token: process.env.COHERE_API_KEY!,
    });
  }
  return cohere;
}

function getIndex() {
  if (!index) {
    index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });
  }
  return index;
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60000;
const MAX_QUESTION_LENGTH = 500;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Detect temporal context in query
function detectTemporalContext(query: string): { day: string | null; isTomorrow: boolean } {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const hasToday = /\b(today|now|currently|right now|at the moment)\b/i.test(query);
  const hasTomorrow = /\btomorrow\b/i.test(query);

  if (hasToday) {
    return { day: days[now.getDay()], isTomorrow: false };
  }

  if (hasTomorrow) {
    return { day: days[(now.getDay() + 1) % 7], isTomorrow: true };
  }

  return { day: null, isTomorrow: false };
}

// Normalize temporal query for better retrieval
function normalizeTemporalQuery(query: string): string {
  // Remove temporal keywords for better vector search
  // "opening hours today" → "opening hours"
  // This prevents diluting the search with day-specific terms
  return query
    .replace(/\b(today|now|currently|right now|at the moment)\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .trim()
    .replace(/\s+/g, ' '); // normalize whitespace
}

// Query expansion using LLM
async function expandQuery(originalQuery: string): Promise<string[]> {
  try {
    // Normalize query by removing temporal keywords for better retrieval
    const normalizedQuery = normalizeTemporalQuery(originalQuery);
    console.log(`📅 Normalized query: "${originalQuery}" → "${normalizedQuery}"`);

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a query expansion assistant. Generate 2 alternative phrasings of the user query that maintain the same meaning but use different words. Return only the alternative queries, one per line, without numbering or explanations.',
        },
        {
          role: 'user',
          content: normalizedQuery,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const alternatives = completion.choices[0]?.message?.content
      ?.split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(0, 2) || [];

    return [normalizedQuery, ...alternatives];
  } catch (error) {
    console.error('Query expansion error:', error);
    return [originalQuery];
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { question, centre } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `Question must be a string with maximum ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 }
      );
    }

    console.log('📝 Original query:', question);

    // Step 1: Detect temporal context
    const temporalContext = detectTemporalContext(question);
    if (temporalContext.day) {
      console.log(`📅 Detected temporal context: ${temporalContext.isTomorrow ? 'tomorrow' : 'today'} = ${temporalContext.day}`);
    }

    // Step 2: Query Expansion (with normalized query for better retrieval)
    const expandedQueries = await expandQuery(question);
    console.log('🔍 Expanded queries:', expandedQueries);

    // Step 2: Multi-query Retrieval - search with all query variations
    const allResults = await Promise.all(
      expandedQueries.map((query) =>
        getIndex().query({
          data: query,
          topK: 15, // Get more results initially
          includeMetadata: true,
        })
      )
    );

    // Combine and deduplicate results
    const seenIds = new Set<string>();
    const combinedResults = allResults
      .flat()
      .filter((result: any) => {
        if (seenIds.has(result.id)) {
          return false;
        }
        seenIds.add(result.id);
        return true;
      });

    console.log('📊 Combined results count:', combinedResults.length);

    // Step 3: Filter by centre
    let filteredResults = combinedResults;
    if (centre && centre !== 'all') {
      console.log('First 10 result IDs:', combinedResults.slice(0, 10).map((r: any) => r.id));
      filteredResults = combinedResults.filter((r: any) =>
        r.id?.startsWith(`${centre}-`) || r.id?.startsWith('general-')
      );
      console.log(`✅ Filtered to ${filteredResults.length} results for ${centre}`);
    }

    if (!filteredResults || filteredResults.length === 0) {
      return NextResponse.json({
        answer: centre && centre !== 'all'
          ? `I don't have specific information about that for ${centre}.`
          : "I don't have specific information about that topic.",
      });
    }

    // Step 4: Rerank with Cohere (if API key is available)
    let rerankedResults = filteredResults;
    if (process.env.COHERE_API_KEY) {
      try {
        const documents = filteredResults.map((result: any) => {
          const metadata = result.metadata || {};
          const title = metadata.title || '';
          const content = metadata.content || '';
          return `${title}: ${content}`;
        });

        const rerank = await getCohere().rerank({
          query: question,
          documents: documents,
          topN: 5,
          model: 'rerank-english-v3.0',
        });

        // Reorder results based on reranking
        rerankedResults = rerank.results.map((result) => filteredResults[result.index]);
        console.log('🎯 Reranked to top 5 results');
      } catch (error) {
        console.error('Reranking error (falling back to vector similarity):', error);
        rerankedResults = filteredResults.slice(0, 5);
      }
    } else {
      // No reranking, just take top 5
      rerankedResults = filteredResults.slice(0, 5);
      console.log('⚠️  No COHERE_API_KEY - skipping reranking');
    }

    // Step 5: Extract context from top results
    const context = rerankedResults
      .map((result: any) => {
        const metadata = result.metadata || {};
        const title = metadata.title || 'Information';
        const content = metadata.content || '';
        return `${title}: ${content}`;
      })
      .join('\n\n');

    // Step 6: Generate response with Groq
    // Build system prompt with temporal context
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[now.getDay()];
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;

    let systemPrompt = `You are a helpful leisure centre assistant. Answer questions about facilities, memberships, classes, and policies in a friendly, professional manner. Use the provided context to give accurate, specific answers.

EXAMPLE INTERACTIONS (follow this style and format):

Q: What are the opening hours?
A: [Centre Name] opening hours:
- Monday to Friday: 5:00 AM - 9:30 PM
- Saturday and Sunday: 7:00 AM - 6:30 PM

Note: Pool areas close 15 minutes before facility closing time.

Q: How much is a membership?
A: [Centre Name] membership options:
- Full Access: $21.05/week (includes gym, pool, classes)
- Concession: $18.00/week
- Gold (Over 50s): $12.70/week
- Joining fee: $99

All memberships include 3 free personal training consultations.

Q: Do you have a pool?
A: Yes, [Centre Name] has:
- Indoor heated pool (year-round)
- Outdoor pool (seasonal)
- Family fun pool with ramp access

Would you like to know the pool hours or temperatures?

Q: What classes do you offer?
A: [Centre Name] offers a wide range of group fitness classes:

Cardio & HIIT:
- BodyCombat, BodyAttack, HIIT Zone

Mind & Body:
- Yoga, Pilates, BodyBalance

Strength:
- BodyPump, Pin-Loaded Circuit

Aqua:
- Aqua Aerobics (all levels)

Classes are included with Full Access and Health Club memberships. Check our timetable for specific times.

Q: Do you offer childcare?
A: Yes, [Centre Name] has childcare facilities:
- Ages: 6 weeks to 5 years
- Hours: Monday-Friday, 9am-1pm (session times vary)
- Cost: $4.90 per session
- Booking required: Call ahead to secure a spot

All staff are first aid trained and have working with children checks.

Q: Can I get a casual visit?
A: Yes, casual visits are available:

Pool Entry:
- Adult: $9.00
- Child (under 18): $6.90
- Family (2 adults + 2 kids): $27.30

Gym/Classes:
- Adult: $24.50
- Concession: $13.00

We also offer 10-visit passes if you plan to visit regularly.

Q: Do you offer concessions?
A: Yes, concession rates are available for:
- Seniors Card holders
- Health Care Card holders
- Student Card holders
- DVA Card holders

You'll need to present your valid concession card when signing up or visiting.`;

    // Add temporal context if detected
    if (temporalContext.day) {
      systemPrompt += `\n\nIMPORTANT: The user is asking about ${temporalContext.isTomorrow ? 'TOMORROW' : 'TODAY'}. Today is ${currentDay}, so ${temporalContext.isTomorrow ? 'tomorrow' : 'today'} is ${temporalContext.day}${temporalContext.day === 'Saturday' || temporalContext.day === 'Sunday' ? ' (weekend)' : ' (weekday)'}. When answering about opening hours or schedules, provide information specific to ${temporalContext.day}.`;
    } else {
      systemPrompt += `\n\nCurrent context: Today is ${currentDay}${isWeekend ? ' (weekend)' : ' (weekday)'}.`;
    }

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Based on the following information from our leisure centre knowledge base, answer the question.\n\nKnowledge Base Information:\n${context}\n\nQuestion: ${question}\n\nProvide a helpful, professional response:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = completion.choices[0]?.message?.content || 'No response generated';

    // Step 7: Extract relevant citations (quotes from source documents)
    const citations = rerankedResults.map((result: any, index: number) => {
      const content = result.metadata?.content || '';
      const title = result.metadata?.title || `Source ${index + 1}`;

      // Extract a relevant snippet (first 150 characters of content)
      const snippet = content.length > 150
        ? content.substring(0, 150).trim() + '...'
        : content;

      return {
        source: title,
        quote: snippet,
        relevance: result.score || 0,
      };
    });

    return NextResponse.json({
      answer,
      sources: rerankedResults.map((r: any) => r.metadata?.title).filter(Boolean),
      citations, // NEW: Include specific quotes from sources
      debug: {
        queryExpansion: expandedQueries.length > 1,
        reranking: !!process.env.COHERE_API_KEY,
        totalResults: combinedResults.length,
        filteredResults: filteredResults.length,
        finalResults: rerankedResults.length,
      },
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
