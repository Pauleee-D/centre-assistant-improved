import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface Chunk {
  id: string;
  text: string;
  metadata: {
    centre: string;
    category: string;
    chunk_index: number;
    total_chunks: number;
  };
}

// Smart chunking function
function smartChunk(text: string, maxChunkSize: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if ((currentChunk + trimmedSentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Extract centre name from ## heading
function extractCentreName(line: string): string | null {
  const match = line.match(/^##\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// Extract category from ### heading
function extractCategory(line: string): string | null {
  const match = line.match(/^###\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// Normalize text for ID generation
function normalizeForId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function processKnowledgeBase() {
  console.log('🔍 Reading knowledge base...');
  const filePath = path.join(process.cwd(), 'data', 'knowledge-base-clean.md');
  const content = await readFile(filePath, 'utf-8');

  console.log(`📄 File size: ${content.length} characters`);

  const lines = content.split('\n');
  console.log(`📄 Total lines: ${lines.length}`);
  const chunks: Chunk[] = [];

  let currentCentre = '';
  let currentCategory = '';
  let currentContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for centre heading (##)
    const centreName = extractCentreName(line);
    if (centreName) {
      console.log(`🏢 Found centre: ${centreName}`);
      // Process any accumulated content before changing centre
      if (currentContent.trim() && currentCentre && currentCategory) {
        processContent(currentCentre, currentCategory, currentContent, chunks);
        currentContent = '';
      }
      currentCentre = centreName;
      currentCategory = '';
      continue;
    }

    // Check for category heading (###)
    const categoryName = extractCategory(line);
    if (categoryName) {
      console.log(`  📁 Found category: ${categoryName}`);
      // Process any accumulated content before changing category
      if (currentContent.trim() && currentCentre && currentCategory) {
        processContent(currentCentre, currentCategory, currentContent, chunks);
        currentContent = '';
      }
      currentCategory = categoryName;
      continue;
    }

    // Accumulate content
    if (currentCentre && currentCategory) {
      currentContent += line + ' ';
    }
  }

  // Process final content
  if (currentContent.trim() && currentCentre && currentCategory) {
    console.log(`✅ Processing final content for ${currentCentre} - ${currentCategory}`);
    processContent(currentCentre, currentCategory, currentContent, chunks);
  }

  console.log(`\n📊 Total chunks created: ${chunks.length}`);
  console.log(`\n🔄 Generating embeddings with Google and uploading to Pinecone...`);

  // Get the Pinecone index
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

  // Google's text-embedding-004 has a batch limit, process one at a time or in small batches
  const embeddingModel = googleAI.getGenerativeModel({ model: 'text-embedding-004' });

  // Process in small batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`\n📤 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    console.log(`   Chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)} of ${chunks.length}`);

    // Generate embeddings for the batch
    const vectors = [];
    for (const chunk of batch) {
      const embeddingResult = await embeddingModel.embedContent(chunk.text);
      const embedding = embeddingResult.embedding.values;

      vectors.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          ...chunk.metadata,
          text: chunk.text,
        },
      });

      // Small delay between individual embeddings to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Upsert to Pinecone
    await index.upsert(vectors);
    console.log(`   ✅ Uploaded ${vectors.length} vectors`);

    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Successfully uploaded ${chunks.length} chunks to Pinecone!`);
  console.log(`\n📊 Vector dimension: 768 (Google text-embedding-004)`);
}

function processContent(
  centre: string,
  category: string,
  content: string,
  chunks: Chunk[]
): void {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    console.log(`    ⚠️  Empty content for ${centre} - ${category}`);
    return;
  }

  // Create smaller chunks for better retrieval
  const textChunks = smartChunk(trimmedContent, 400);
  console.log(`    ✨ Creating ${textChunks.length} chunks for ${centre} - ${category}`);

  textChunks.forEach((chunkText, index) => {
    const centreId = normalizeForId(centre);
    const categoryId = normalizeForId(category);
    const chunkId = `${centreId}-${categoryId}-chunk-${index}`;

    // Add context to chunk text for better understanding
    const enhancedText = `${centre} ${category}: ${chunkText}`;

    chunks.push({
      id: chunkId,
      text: enhancedText,
      metadata: {
        centre: centreId,
        category: categoryId,
        chunk_index: index,
        total_chunks: textChunks.length,
      },
    });
  });
}

processKnowledgeBase().catch(console.error);
