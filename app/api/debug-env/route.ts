import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasGroqKey: !!process.env.GROQ_API_KEY,
    hasPineconeKey: !!process.env.PINECONE_API_KEY,
    hasCohereKey: !!process.env.COHERE_API_KEY,
    pineconeIndexName: process.env.PINECONE_INDEX_NAME,
    // Don't expose actual keys, just check if they exist
  });
}
