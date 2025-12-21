import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lazy initialization to avoid build-time errors
let groq: Groq;

function getGroq() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });
  }
  return groq;
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

// Load centre data from combined markdown files
function loadCentreData(centreId: string): { content: string; metadata: any } | null {
  try {
    const dataDir = join(process.cwd(), 'data', 'combined');
    const filePath = join(dataDir, `${centreId}.md`);
    const content = readFileSync(filePath, 'utf-8');

    // Also load metadata if exists
    const metadataPath = join(process.cwd(), 'data', 'crawled-deep', `${centreId}_metadata.json`);
    let metadata: any = { pages: [] };
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    } catch {
      // Metadata file doesn't exist, that's okay
    }

    return { content, metadata };
  } catch (error) {
    console.error(`Error loading data for ${centreId}:`, error);
    return null;
  }
}

// Extract relevant sections from markdown based on question keywords
function extractRelevantSections(content: string, question: string): string {
  const questionLower = question.toLowerCase();
  const keywords = [
    'opening', 'hours', 'membership', 'price', 'cost', 'fee', 'facility', 'facilities',
    'pool', 'gym', 'class', 'program', 'lesson', 'contact', 'phone', 'email',
    'casual', 'visit', 'pass', 'concession', 'squad', 'aqua', 'fitness'
  ];

  // Check which keywords are in the question
  const relevantKeywords = keywords.filter(k => questionLower.includes(k));

  // Split content into sections
  const sections = content.split(/^##\s+/m);

  // If question has specific keywords, try to find relevant sections
  if (relevantKeywords.length > 0) {
    const relevantSections = sections.filter(section => {
      const sectionLower = section.toLowerCase();
      return relevantKeywords.some(keyword => sectionLower.includes(keyword));
    });

    if (relevantSections.length > 0) {
      // Return relevant sections plus the header
      return sections[0] + '\n\n## ' + relevantSections.slice(0, 3).join('\n\n## ');
    }
  }

  // Otherwise return first ~4000 characters (enough for context)
  return content.substring(0, 4000);
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

    // Check if a specific centre is selected
    if (!centre || centre === 'all') {
      return NextResponse.json({
        answer: 'Please select a specific centre to get accurate information.',
        sources: []
      });
    }

    // Load centre data
    const centreData = loadCentreData(centre);

    if (!centreData) {
      return NextResponse.json({
        answer: `Sorry, I couldn't find information for the selected centre.`,
        sources: []
      });
    }

    // Extract relevant sections
    const context = extractRelevantSections(centreData.content, question);

    // Generate response with Groq
    const systemPrompt = `You are a helpful leisure centre assistant. Answer questions about facilities, memberships, classes, and policies in a friendly, professional manner. Use the provided context to give accurate, specific answers.

When answering:
1. Be specific and include actual prices, times, and details from the context
2. Use bullet points and clear formatting
3. If information isn't in the context, say so - don't make up information
4. Keep responses concise but complete
5. Always be helpful and friendly

IMPORTANT: The context includes both official pricing/schedules and current website information. Prioritize official pricing tables when they're available.`;

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Based on the following information from the leisure centre knowledge base, answer the question.\n\nKnowledge Base Information:\n${context}\n\nQuestion: ${question}\n\nProvide a helpful, professional response:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = completion.choices[0]?.message?.content || 'No response generated';

    // Build sources list with URLs from metadata
    const sources = centreData.metadata.pages?.map((page: any) => ({
      url: page.url,
      title: page.url.split('/').filter(Boolean).pop() || 'Home'
    })) || [];

    // Add base URL as a source
    if (centreData.metadata.base_url) {
      sources.unshift({
        url: centreData.metadata.base_url,
        title: 'Home'
      });
    }

    return NextResponse.json({
      answer,
      sources: sources.slice(0, 5), // Limit to 5 most relevant sources
    });
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
