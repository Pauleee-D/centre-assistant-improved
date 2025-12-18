import { NextResponse } from 'next/server';
import { Index } from '@upstash/vector';
import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY!,
});

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

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

// Query expansion using LLM
async function expandQuery(originalQuery: string): Promise<string[]> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a query expansion assistant. Generate 2 alternative phrasings of the user query that maintain the same meaning but use different words. Return only the alternative queries, one per line, without numbering or explanations.',
        },
        {
          role: 'user',
          content: originalQuery,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const alternatives = completion.choices[0]?.message?.content
      ?.split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(0, 2) || [];

    return [originalQuery, ...alternatives];
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

    // Step 1: Query Expansion
    const expandedQueries = await expandQuery(question);
    console.log('🔍 Expanded queries:', expandedQueries);

    // Step 2: Multi-query Retrieval - search with all query variations
    const allResults = await Promise.all(
      expandedQueries.map((query) =>
        index.query({
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

        const rerank = await cohere.rerank({
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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful leisure centre assistant. Answer questions about facilities, memberships, classes, and policies in a friendly, professional manner. Use the provided context to give accurate, specific answers.',
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
      sources: rerankedResults.map((r: any) => r.metadata?.title).filter(Boolean),
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
