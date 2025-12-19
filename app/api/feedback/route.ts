import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface FeedbackEntry {
  id: string;
  timestamp: string;
  question: string;
  answer: string;
  rating: 'positive' | 'negative';
  comment?: string;
  system: 'original' | 'improved';
}

const FEEDBACK_DIR = path.join(process.cwd(), 'data', 'feedback');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback.json');

async function ensureFeedbackFile() {
  if (!existsSync(FEEDBACK_DIR)) {
    await mkdir(FEEDBACK_DIR, { recursive: true });
  }
  if (!existsSync(FEEDBACK_FILE)) {
    await writeFile(FEEDBACK_FILE, JSON.stringify([], null, 2));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, rating, comment, system } = body;

    if (!question || !answer || !rating || !system) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await ensureFeedbackFile();

    // Read existing feedback
    const feedbackData = await readFile(FEEDBACK_FILE, 'utf-8');
    const feedback: FeedbackEntry[] = JSON.parse(feedbackData);

    // Create new feedback entry
    const newFeedback: FeedbackEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      question,
      answer,
      rating,
      comment,
      system,
    };

    // Add to feedback array
    feedback.push(newFeedback);

    // Write back to file
    await writeFile(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));

    return NextResponse.json({ success: true, id: newFeedback.id });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureFeedbackFile();
    const feedbackData = await readFile(FEEDBACK_FILE, 'utf-8');
    const feedback: FeedbackEntry[] = JSON.parse(feedbackData);

    // Return summary statistics
    const stats = {
      total: feedback.length,
      positive: feedback.filter((f) => f.rating === 'positive').length,
      negative: feedback.filter((f) => f.rating === 'negative').length,
      bySystem: {
        original: {
          total: feedback.filter((f) => f.system === 'original').length,
          positive: feedback.filter(
            (f) => f.system === 'original' && f.rating === 'positive'
          ).length,
          negative: feedback.filter(
            (f) => f.system === 'original' && f.rating === 'negative'
          ).length,
        },
        improved: {
          total: feedback.filter((f) => f.system === 'improved').length,
          positive: feedback.filter(
            (f) => f.system === 'improved' && f.rating === 'positive'
          ).length,
          negative: feedback.filter(
            (f) => f.system === 'improved' && f.rating === 'negative'
          ).length,
        },
      },
      recentFeedback: feedback.slice(-10).reverse(), // Last 10 entries
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error reading feedback:', error);
    return NextResponse.json(
      { error: 'Failed to read feedback' },
      { status: 500 }
    );
  }
}
