import os
import json
from pathlib import Path

# Mapping from crawled IDs to Docling file names
CENTRE_NAME_MAPPING = {
    'albanycreek': 'Albany Creek.md',
    'ascotvale': 'Ascot Vale.md',
    'auburnruth': 'Auburn Ruth.md',
    'bathurstmanning': 'Bathurst (Manning).md',
    'bright': 'Bright.md',
    'bundaberg': 'Bundaberg.md',
    'burpengary': 'Burpengary.md',
    'canberraolympicpool': 'Canberra Olympic Pool.md',
    'chinchilla': 'Chinchilla.md',
    'civicreserve': 'Civic Reserve.md',
    'dalbyaquaticcentre': 'Dalby Aquatic Centre.md',
    'dannyfrawley': 'Danny Frawley.md',
    'dicksonpools': 'Dickson Pools.md',
    'eastfremantle': 'East Fremantle.md',
    'erindale': 'Erindale.md',
    'fernyhillswimmingpool': 'Ferny Hill Swimming Pool.md',
    'greatlakes': 'Great Lakes.md',
    'gungahlin': 'Gungahlin.md',
    'gurriwanyarra': 'Gurri Wanyarra.md',
    'gympie': 'Gympie.md',
    'jackhort': 'Jack Hort.md',
    'keiloreastleisurecentre': 'Keilor East Leisure Centre.md',
    'knoxleisureworks': 'Knox Leisureworks.md',
    'kurrikurri': 'Kurri Kurri.md',
    'lakeside': 'Lakeside.md',
    'loftus': 'Loftus.md',
    'manningmidcoasttaree': 'Manning Midcoast (Taree).md',
    'mansfieldswimmingpool': 'Mansfield Swimming Pool.md',
    'michaelclarke': 'Michael Clarke.md',
    'michaelwenden': 'Michael Wenden.md',
    'millpark': 'Mill Park.md',
    'monbulk': 'Monbulk.md',
    'moree': 'Moree.md',
    'pelicanpark': 'Pelican Park.md',
    'portland': 'Portland.md',
    'queensparkpool': 'Queens Park Pool.md',
    'swell': 'SWELL.md',
    'swirl': 'SWIRL.md',
    'singleton': 'Singleton.md',
    'somerville': 'Somerville.md',
    'splashdevonport': 'Splash Devonport.md',
    'stromlo': 'Stromlo.md',
    'summit': 'Summit.md',
    'swanhill': 'Swan Hill.md',
    'trac': 'TRAC.md',
    'tehiku': 'Te Hiku.md',
    'tomaree': 'Tomaree.md',
    'watermarc': 'WaterMarc.md',
    'whittleseaswimcentre': 'Whittlesea Swim Centre.md',
    'whitlamleisurecentre': 'Whitlam Leisure Centre.md',
    'wollondilly': 'Wollondilly.md',
    'wulanda': 'Wulanda.md',
    'yawa': 'YAWA.md',
    'yarra': 'Yarra.md',
    'yarrambatparkgolfcourse': 'Yarrambat Park Golf Course.md',
    'higherstatemelbairport': 'Higher State Melb Airport.md',
    'inverellaquaticcentre': 'Inverell Aquatic Centre.md',
    'centrepointblayney': 'CentrePoint (Blayney).md',
    'robinvale': 'Robinvale.md',
}

def combine_centre_data(centre_id, docling_file, crawled_file, metadata_file, output_dir):
    """Combine Docling and crawled data for a single centre"""

    # Read metadata
    with open(metadata_file, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Read crawled content
    with open(crawled_file, 'r', encoding='utf-8') as f:
        crawled_content = f.read()

    # Read Docling content if it exists
    docling_content = ""
    if docling_file and docling_file.exists():
        with open(docling_file, 'r', encoding='utf-8') as f:
            docling_content = f.read()

    # Create combined markdown
    combined = []

    # Header
    combined.append(f"# {centre_id}")
    combined.append(f"\nBase URL: {metadata['base_url']}")
    combined.append(f"\nThis knowledge base combines official pricing/schedules from OneNote with current website content.")
    combined.append(f"\nLast updated: Auto-generated from multiple sources\n")
    combined.append("\n---\n")

    # Section 1: Official Pricing and Schedules (from Docling/OneNote)
    if docling_content.strip():
        combined.append("## Official Information (Pricing, Schedules, Contact)")
        combined.append("\n*Source: Internal OneNote documentation*\n")
        combined.append(docling_content)
        combined.append("\n\n---\n")

    # Section 2: Website Content (from web crawl)
    combined.append("## Website Content (Facilities, Programs, Current Information)")
    combined.append(f"\n*Source: Website crawl - {metadata['total_pages']} pages*\n")

    # Add page URLs for reference
    combined.append("### Available Pages:\n")
    for i, page in enumerate(metadata['pages'], 1):
        combined.append(f"{i}. {page['url']}\n")
    combined.append("\n")

    # Add the crawled content
    combined.append(crawled_content)

    # Write combined file
    output_file = output_dir / f"{centre_id}.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(combined))

    return True

def main():
    # Directories
    docling_dir = Path('c:/Projects/centre2/data/list')
    crawled_dir = Path('c:/Projects/centre2/data/crawled-deep')
    output_dir = Path('c:/Projects/centre2/data/combined')
    output_dir.mkdir(exist_ok=True)

    print(f"Combining knowledge sources...")
    print(f"  Docling (OneNote) source: {docling_dir}")
    print(f"  Crawled (Website) source: {crawled_dir}")
    print(f"  Output directory: {output_dir}\n")

    success_count = 0
    fail_count = 0
    missing_docling = 0

    for centre_id, docling_filename in CENTRE_NAME_MAPPING.items():
        print(f"Processing {centre_id}...")

        try:
            crawled_file = crawled_dir / f"{centre_id}.md"
            metadata_file = crawled_dir / f"{centre_id}_metadata.json"

            # Check if crawled files exist
            if not crawled_file.exists():
                print(f"  WARNING - No crawled data for {centre_id}")
                fail_count += 1
                continue

            if not metadata_file.exists():
                print(f"  WARNING - No metadata for {centre_id}")
                fail_count += 1
                continue

            # Handle OneNote file
            if docling_filename is None:
                print(f"  NOTE - No OneNote file for {centre_id}, using crawled only")
                docling_file = None
                missing_docling += 1
            else:
                docling_file = docling_dir / docling_filename
                if not docling_file.exists():
                    print(f"  WARNING - OneNote file missing: {docling_filename}")
                    docling_file = None
                    missing_docling += 1

            # Combine the data
            combine_centre_data(centre_id, docling_file, crawled_file, metadata_file, output_dir)

            print(f"  SUCCESS - Combined {centre_id}")
            success_count += 1

        except Exception as e:
            print(f"  ERROR - {centre_id}: {str(e)}")
            fail_count += 1

    print(f"\n{'='*60}")
    print(f"Combination complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Missing Docling data: {missing_docling}")
    print(f"  Total: {len(CENTRE_NAME_MAPPING)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
