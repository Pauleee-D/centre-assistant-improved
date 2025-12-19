import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';

// Lazy initialization to avoid build-time errors
let groq: Groq;
let pinecone: Pinecone;
let cohere: CohereClient;

function getGroq() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });
  }
  return groq;
}

function getPinecone() {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pinecone;
}

function getCohere() {
  if (!cohere) {
    cohere = new CohereClient({
      token: process.env.COHERE_API_KEY!,
    });
  }
  return cohere;
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 30; // requests per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_QUESTION_LENGTH = 500; // characters

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

    // Input length validation
    if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `Question must be a string with maximum ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Generate embedding for the question using Cohere
    const embeddingResponse = await getCohere().embed({
      texts: [question],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });

    const queryEmbedding = (embeddingResponse.embeddings as number[][])[0];

    // Query Pinecone
    const index = getPinecone().index(process.env.PINECONE_INDEX_NAME!);

    // Build filter for centre if specified
    const filter = centre && centre !== 'all'
      ? { centre: { $in: [centre, 'general'] } }
      : undefined;

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 50,
      includeMetadata: true,
      filter,
    });

    console.log('All results count:', queryResponse.matches?.length || 0);

    let filteredResults = queryResponse.matches || [];

    if (centre && centre !== 'all') {
      console.log('First 5 result IDs:', filteredResults.slice(0, 5).map((r: any) => r.id));

      // Create normalized version of centre name (remove all non-alphanumeric)
      const normalizedCentre = centre.toLowerCase().replace(/[^a-z0-9]/g, '');

      filteredResults = filteredResults.filter((r: any) => {
        const id = (r.id || '').toLowerCase();
        return id.startsWith(normalizedCentre + '-') ||
               id.startsWith('general-');
      });
      console.log(`Filtered to ${filteredResults.length} results for ${centre} (including general info)`);
    }

    // Take top 3 after filtering
    filteredResults = filteredResults.slice(0, 3);

    if (!filteredResults || filteredResults.length === 0) {
      return NextResponse.json({
        answer: centre && centre !== 'all'
          ? `I don't have specific information about that for ${centre}.`
          : "I don't have specific information about that topic.",
      });
    }

    // Extract relevant content from metadata
    const context = filteredResults
      .map((result: any) => {
        // In Pinecone, the text content is stored in metadata
        return result.metadata?.text || '';
      })
      .filter(Boolean)
      .join('\n\n');

    // Generate response with Groq
    const systemPrompt = `You are a helpful leisure centre assistant. Answer questions about facilities, memberships, classes, and policies in a friendly, professional manner. Use the provided context to give accurate, specific answers.

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

    return NextResponse.json({
      answer,
      sources: filteredResults.map((r: any) => {
        const meta = r.metadata || {};
        return meta.centre && meta.category ? `${meta.centre} - ${meta.category}` : null;
      }).filter(Boolean),
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}