from pinecone import Pinecone
from dotenv import load_dotenv
import os

load_dotenv('.env.local')

# Initialize Pinecone
pc = Pinecone(api_key=os.environ.get('PINECONE_API_KEY'))
index = pc.Index('centre2', host='centre2-te9sgjq.svc.aped-4627-b74a.pinecone.io')

# List of all centres
ALL_CENTRES = [
    'albanycreek', 'ascotvale', 'auburnruth', 'bathurstmanning', 'bright',
    'bundaberg', 'burpengary', 'canberraolympicpool', 'centrepointblayney',
    'chinchilla', 'civicreserve', 'dalbyaquaticcentre', 'dannyfrawley',
    'dicksonpools', 'eastfremantle', 'erindale', 'fernyhillswimmingpool',
    'greatlakes', 'gungahlin', 'gurriwanyarra', 'gympie', 'higherstatemelbairport',
    'inverellaquaticcentre', 'jackhort', 'keiloreastleisurecentre', 'knoxleisureworks',
    'kurrikurri', 'lakeside', 'loftus', 'manningmidcoasttaree', 'mansfieldswimmingpool',
    'michaelclarke', 'michaelwenden', 'millpark', 'monbulk', 'moree',
    'pelicanpark', 'portland', 'queensparkpool', 'robinvale', 'singleton',
    'somerville', 'splashdevonport', 'stromlo', 'summit', 'swanhill',
    'swell', 'swirl', 'tehiku', 'tomaree', 'trac', 'watermarc',
    'whitlamleisurecentre', 'whittleseaswimcentre', 'wollondilly', 'wulanda',
    'yarra', 'yarrambatparkgolfcourse', 'yawa'
]

print("="*80)
print("CHECKING PINECONE INDEX FOR CENTRE VECTORS")
print("="*80)
print()

centres_with_vectors = []
centres_without_vectors = []

for centre in ALL_CENTRES:
    # Try to fetch one vector for this centre
    try:
        results = index.query(
            vector=[0.0] * 1024,  # Dummy vector
            filter={'centre': centre},
            top_k=1,
            include_metadata=True
        )

        if results.matches and len(results.matches) > 0:
            centres_with_vectors.append(centre)
            print(f"[+] {centre:<35} HAS VECTORS")
        else:
            centres_without_vectors.append(centre)
            print(f"[ ] {centre:<35} NO VECTORS FOUND")
    except Exception as e:
        centres_without_vectors.append(centre)
        print(f"[X] {centre:<35} ERROR: {str(e)[:50]}")

print()
print("="*80)
print("SUMMARY")
print("="*80)
print(f"Centres with vectors: {len(centres_with_vectors)}/59")
print(f"Centres without vectors: {len(centres_without_vectors)}/59")
print()

if centres_without_vectors:
    print("Centres missing from Pinecone:")
    for centre in centres_without_vectors:
        print(f"  - {centre}")
