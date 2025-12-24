import os
import json
from pathlib import Path
from pinecone import Pinecone, ServerlessSpec
import cohere
import time
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Initialize clients
pinecone = Pinecone(api_key=os.environ.get('PINECONE_API_KEY'))
cohere_client = cohere.ClientV2(api_key=os.environ.get('COHERE_API_KEY'))

# Configuration
INDEX_NAME = 'centre2'
DIMENSION = 1024  # Cohere embed-english-v3.0 dimension
BATCH_SIZE = 25  # Process in batches (rate limit is 100k tokens/min)

def chunk_text(text, max_chunk_size=1000, overlap=200):
    """Split text into overlapping chunks"""
    chunks = []
    lines = text.split('\n')

    current_chunk = []
    current_size = 0

    for line in lines:
        line_size = len(line)

        if current_size + line_size > max_chunk_size and current_chunk:
            # Save current chunk
            chunks.append('\n'.join(current_chunk))

            # Start new chunk with overlap
            overlap_lines = []
            overlap_size = 0
            for prev_line in reversed(current_chunk):
                if overlap_size + len(prev_line) <= overlap:
                    overlap_lines.insert(0, prev_line)
                    overlap_size += len(prev_line)
                else:
                    break

            current_chunk = overlap_lines
            current_size = overlap_size

        current_chunk.append(line)
        current_size += line_size

    # Add the last chunk
    if current_chunk:
        chunks.append('\n'.join(current_chunk))

    return chunks

def extract_category_from_chunk(chunk_text):
    """Try to extract category from chunk headers"""
    lines = chunk_text.split('\n')
    for line in lines[:5]:  # Check first 5 lines
        if line.startswith('##'):
            category = line.replace('#', '').strip()
            # Simplify category names
            if 'official' in category.lower() or 'pricing' in category.lower():
                return 'pricing-schedules'
            elif 'website' in category.lower() or 'facilities' in category.lower():
                return 'facilities-programs'
            elif 'opening' in category.lower() or 'hours' in category.lower():
                return 'hours'
            elif 'contact' in category.lower():
                return 'contact'
            else:
                return category.lower()[:50]  # Limit length
    return 'general'

def process_centre_file(centre_id, file_path, metadata_path):
    """Process a single centre's combined file into chunks"""
    print(f"Processing {centre_id}...")

    # Read the combined markdown
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Read metadata for URLs
    metadata = {'pages': []}
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        except:
            pass

    # Chunk the content
    chunks = chunk_text(content)
    print(f"  Created {len(chunks)} chunks")

    # Prepare vectors with metadata
    vectors = []
    for i, chunk in enumerate(chunks):
        category = extract_category_from_chunk(chunk)

        vector_data = {
            'id': f"{centre_id}-{i}",
            'text': chunk,
            'metadata': {
                'centre': centre_id,
                'category': category,
                'chunk_index': i,
                'text': chunk[:1000]  # Store first 1000 chars in metadata
            }
        }
        vectors.append(vector_data)

    return vectors

def upload_to_pinecone(vectors_batch):
    """Upload a batch of vectors to Pinecone"""
    # Generate embeddings for all texts
    texts = [v['text'] for v in vectors_batch]

    print(f"  Generating embeddings for {len(texts)} chunks...")
    response = cohere_client.embed(
        texts=texts,
        model='embed-english-v3.0',
        input_type='search_document'
    )

    embeddings = response.embeddings.float_

    # Prepare upsert data
    upsert_data = []
    for i, vector_data in enumerate(vectors_batch):
        upsert_data.append({
            'id': vector_data['id'],
            'values': embeddings[i],
            'metadata': vector_data['metadata']
        })

    # Upsert to Pinecone
    index_host = 'centre2-te9sgjq.svc.aped-4627-b74a.pinecone.io'
    index = pinecone.Index(INDEX_NAME, host=index_host)

    print(f"  Uploading {len(upsert_data)} vectors to Pinecone...")
    index.upsert(vectors=upsert_data)

    return len(upsert_data)

def main():
    combined_dir = Path('c:/Projects/centre2/data/combined')
    metadata_dir = Path('c:/Projects/centre2/data/crawled-deep')

    print("="*60)
    print("Uploading Combined Knowledge Base to Pinecone")
    print("="*60)
    print(f"Source: {combined_dir}")
    print(f"Index: {INDEX_NAME}")
    print(f"Embedding model: Cohere embed-english-v3.0")
    print()

    # Get all combined markdown files
    md_files = sorted(combined_dir.glob('*.md'))
    print(f"Found {len(md_files)} centre files\n")

    all_vectors = []
    total_chunks = 0

    # Process each centre
    for md_file in md_files:
        centre_id = md_file.stem
        metadata_path = metadata_dir / f"{centre_id}_metadata.json"

        vectors = process_centre_file(centre_id, md_file, metadata_path)
        all_vectors.extend(vectors)
        total_chunks += len(vectors)

    print(f"\nTotal chunks to upload: {total_chunks}")
    print(f"Processing in batches of {BATCH_SIZE}...")

    # Upload in batches
    uploaded_count = 0
    for i in range(0, len(all_vectors), BATCH_SIZE):
        batch = all_vectors[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(all_vectors) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"\nBatch {batch_num}/{total_batches}:")
        count = upload_to_pinecone(batch)
        uploaded_count += count

        # Rate limiting - wait between batches to stay under 100k tokens/min
        if i + BATCH_SIZE < len(all_vectors):
            print("  Waiting 10 seconds...")
            time.sleep(10)

    print("\n" + "="*60)
    print(f"Upload Complete!")
    print(f"  Total vectors uploaded: {uploaded_count}")
    print(f"  Centres processed: {len(md_files)}")
    print("="*60)

if __name__ == '__main__':
    main()
