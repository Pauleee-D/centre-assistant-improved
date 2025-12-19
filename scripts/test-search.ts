import { Index } from '@upstash/vector';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

async function testSearch() {
  const queries = [
    'opening hours today Friday',
    'opening hours Friday',
    'Whitlam opening hours',
    'Whitlam hours Friday',
  ];

  for (const query of queries) {
    console.log(`\n=== Testing query: "${query}" ===`);
    const results = await index.query({
      data: query,
      topK: 5,
      includeMetadata: true,
    });

    console.log(`Found ${results.length} results:`);
    results.forEach((result, i) => {
      console.log(`\n${i + 1}. ID: ${result.id}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Title: ${result.metadata?.title || 'N/A'}`);
      console.log(`   Content preview: ${result.metadata?.content?.substring(0, 100) || 'N/A'}...`);
    });
  }
}

testSearch().catch(console.error);
