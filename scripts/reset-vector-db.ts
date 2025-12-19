import { Index } from '@upstash/vector';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

async function resetDatabase() {
  console.log('🗑️  Resetting vector database...');
  
  try {
    await index.reset();
    console.log('✅ Vector database has been reset successfully!');
    console.log('💡 Now run: npm run add-knowledge-improved');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  }
}

resetDatabase();
