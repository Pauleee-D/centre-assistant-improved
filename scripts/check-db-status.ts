import { Index } from '@upstash/vector';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

async function checkStatus() {
  try {
    // Try a simple query to see if we get any results
    const results = await index.query({
      data: "opening hours pool",
      topK: 10,
      includeMetadata: true,
    });
    
    console.log(`Database has ${results.length} results for test query`);
    
    if (results.length > 0) {
      console.log('\nFirst 5 IDs:');
      results.slice(0, 5).forEach((r: any) => {
        console.log(`  - ${r.id}`);
      });
    } else {
      console.log('\n❌ Database is empty!');
      console.log('You need to wait for Upstash limit reset and run:');
      console.log('  npx tsx scripts/reset-vector-db.ts');
      console.log('  npm run add-knowledge-improved');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkStatus();
