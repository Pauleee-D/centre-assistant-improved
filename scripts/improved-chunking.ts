import { Index } from '@upstash/vector';
import { readFile } from 'fs/promises';
import path from 'path';

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

interface Chunk {
  id: string;
  text: string;
  metadata: {
    centre: string;
    category: string;
    subcategory?: string;
    chunk_index: number;
    total_chunks: number;
  };
}

// Split text into smaller, meaningful chunks
function smartChunk(text: string, maxChunkSize: number = 500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // If adding this sentence would exceed max size, save current chunk
    if (currentChunk.length + trimmed.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed + ' ';
    } else {
      currentChunk += trimmed + ' ';
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Extract centre name from markdown heading
function extractCentreName(line: string): string | null {
  const match = line.match(/^##\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// Extract category from markdown heading
function extractCategory(line: string): string | null {
  const match = line.match(/^###\s+(.+)$/);
  return match ? match[1].trim() : null;
}

// Normalize text for ID generation
function normalizeForId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function processKnowledgeBase() {
  console.log('🔍 Reading knowledge base...');
  const filePath = path.join(process.cwd(), 'data', 'knowledge-base-clean.md');
  const content = await readFile(filePath, 'utf-8');

  const lines = content.split('\n');
  const chunks: Chunk[] = [];

  let currentCentre = '';
  let currentCategory = '';
  let currentContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for centre heading (##)
    const centreName = extractCentreName(line);
    if (centreName) {
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
      // Process any accumulated content before changing category
      if (currentContent.trim() && currentCentre && currentCategory) {
        processContent(currentCentre, currentCategory, currentContent, chunks);
        currentContent = '';
      }
      currentCategory = categoryName;
      continue;
    }

    // Skip empty lines and main title
    if (!line.trim() || line.startsWith('# ') || line.startsWith('---')) {
      continue;
    }

    // Accumulate content
    if (currentCentre && currentCategory) {
      currentContent += line + ' ';
    }
  }

  // Process final content
  if (currentContent.trim() && currentCentre && currentCategory) {
    processContent(currentCentre, currentCategory, currentContent, chunks);
  }

  console.log(`\n📊 Total chunks created: ${chunks.length}`);
  console.log(`\n🔄 Uploading to Upstash Vector...`);

  // Upload in batches
  const batchSize = 50;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const upserts = batch.map((chunk) => ({
      id: chunk.id,
      data: chunk.text,
      metadata: chunk.metadata,
    }));

    await index.upsert(upserts);
    console.log(`  Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
  }

  console.log('\n✅ Knowledge base uploaded successfully!');
  console.log(`\nSample chunks:`);
  chunks.slice(0, 3).forEach((chunk) => {
    console.log(`\n  ID: ${chunk.id}`);
    console.log(`  Centre: ${chunk.metadata.centre}`);
    console.log(`  Category: ${chunk.metadata.category}`);
    console.log(`  Text (first 100 chars): ${chunk.text.substring(0, 100)}...`);
  });
}

function processContent(
  centre: string,
  category: string,
  content: string,
  chunks: Chunk[]
): void {
  const trimmedContent = content.trim();
  if (!trimmedContent) return;

  // Create smaller chunks for better retrieval
  const textChunks = smartChunk(trimmedContent, 400);

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
