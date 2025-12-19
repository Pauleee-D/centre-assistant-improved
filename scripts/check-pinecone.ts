import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkPinecone() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  console.log('🔍 Checking Pinecone connection...\n');

  try {
    // List all indexes
    const indexes = await pinecone.listIndexes();
    console.log('📋 Available indexes:');
    console.log(indexes);

    const indexName = process.env.PINECONE_INDEX_NAME!;
    console.log(`\n🔎 Looking for index: "${indexName}"`);

    // Check if our index exists
    const indexExists = indexes.indexes?.some((idx: any) => idx.name === indexName);

    if (indexExists) {
      console.log(`✅ Index "${indexName}" found!`);

      // Get index stats
      const index = pinecone.index(indexName);
      const stats = await index.describeIndexStats();
      console.log('\n📊 Index stats:');
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(`❌ Index "${indexName}" not found!`);
      console.log('\n💡 You need to create the index in Pinecone console with:');
      console.log('   - Name: centre2');
      console.log('   - Dimensions: 1024');
      console.log('   - Metric: cosine');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPinecone();
