import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import html2text
from urllib.parse import urljoin, urlparse
import json

# Centre websites from app/page.tsx
CENTRE_WEBSITES = {
    'albanycreek': 'https://albanycreeklc.com.au',
    'ascotvale': 'https://www.movemv.com.au/ascot-vale-leisure-centre/',
    'auburnruth': 'https://www.auburnaquaticcentre.com.au/',
    'bathurstmanning': 'https://www.bathurstaquatic.com.au/',
    'bright': 'https://www.brightsportscentre.com.au/',
    'bundaberg': 'https://bundabergaquaticcentre.com.au/',
    'burpengary': 'https://www.burpengaryralc.com.au/',
    'canberraolympicpool': 'https://www.canberraolympicpool.com.au/',
    'chinchilla': 'https://chinchillaaquaticandfitnesscentre.com.au/',
    'civicreserve': 'https://www.civicreccentre.com.au/',
    'dalbyaquaticcentre': 'https://dalbyaquaticcentre.com.au/',
    'dannyfrawley': 'https://www.dannyfrawleycentre.com.au/',
    'dicksonpools': 'https://www.dicksonpool.com.au/',
    'eastfremantle': 'https://bactiveeastfremantle.com.au/',
    'erindale': 'https://erindaleleisurecentre.com.au/',
    'fernyhillswimmingpool': 'https://www.fernyhillspool.com.au/',
    'greatlakes': 'https://greatlakesalc.com.au/',
    'gungahlin': 'https://www.gungahlinleisurecentre.com.au/',
    'gurriwanyarra': 'https://www.gurriwanyarrawc.com.au/',
    'gympie': 'https://www.gympiearc.com.au/',
    'jackhort': 'https://www.jackhortmcp.com.au/',
    'keiloreastleisurecentre': 'https://www.movemv.com.au/keilor-east-leisure-centre/',
    'knoxleisureworks': 'https://www.knoxleisureworks.com.au/',
    'kurrikurri': 'https://www.kurrikurriafc.com.au/',
    'lakeside': 'https://www.lakesideleisure.com.au/',
    'loftus': 'https://www.loftusrecreationcentre.com.au/',
    'manningmidcoasttaree': 'https://manningalc.com.au/',
    'mansfieldswimmingpool': 'https://www.mansfieldswimmingpool.com.au/',
    'michaelclarke': 'https://www.michaelclarkecentre.com.au/',
    'michaelwenden': 'https://www.wendenpool.com.au/',
    'millpark': 'https://www.millparkleisure.com.au/',
    'monbulk': 'https://www.monbulkaquatic.com.au/',
    'moree': 'https://www.moreeartesianaquaticcentre.com.au/',
    'pelicanpark': 'https://www.pelicanparkrec.com.au/',
    'portland': 'https://www.portlandleisurecentre.com.au/',
    'queensparkpool': 'https://www.movemv.com.au/queens-park-swimming-pool/',
    'swell': 'https://www.swellpalmerston.com.au/',
    'swirl': 'https://www.swirltas.com.au/',
    'singleton': 'https://www.singletongymswim.com.au/',
    'somerville': 'https://www.somervillerecreationcentre.com.au/',
    'splashdevonport': 'https://www.splashdevonport.com.au/',
    'stromlo': 'https://www.stromloleisurecentre.com.au/',
    'summit': 'https://summitaquaticleisure.com.au/',
    'swanhill': 'https://www.swanhilllc.com.au/',
    'trac': 'https://www.trac.com.au/',
    'tehiku': 'https://tehikusportshub.co.nz/',
    'tomaree': 'https://www.tomareeac.com.au/',
    'watermarc': 'https://www.watermarcbanyule.com.au/',
    'whittleseaswimcentre': 'https://www.watermarcbanyule.com.au/',
    'whitlamleisurecentre': 'https://www.whitlamleisurecentre.com.au/',
    'wollondilly': 'https://www.wclc.com.au/',
    'wulanda': 'https://www.wulanda.com.au/',
    'yawa': 'https://www.yawa.com.au/',
    'yarra': 'https://www.yarracentre.com.au/',
    'yarrambatparkgolfcourse': 'https://www.yarrambatgolf.com.au/',
    'higherstatemelbairport': 'https://www.higherstate.com.au/',
    'inverellaquaticcentre': 'https://inverellaquaticcentre.com.au/',
    'centrepointblayney': 'http://www.centrepointblayney.com.au/',
    'robinvale': 'https://www.robinvalerac.com.au/',
}

# Keywords to identify relevant pages
RELEVANT_KEYWORDS = [
    'hours', 'opening', 'contact', 'about', 'facilities', 'facility',
    'membership', 'memberships', 'join', 'pricing', 'price', 'fees',
    'swim', 'pool', 'aquatic', 'gym', 'fitness', 'programs', 'program',
    'classes', 'learn', 'lessons', 'activities', 'timetable', 'schedule'
]

def is_relevant_link(url, text):
    """Check if a link is relevant based on URL and link text"""
    url_lower = url.lower()
    text_lower = text.lower() if text else ''

    # Check for relevant keywords in URL or link text
    for keyword in RELEVANT_KEYWORDS:
        if keyword in url_lower or keyword in text_lower:
            return True
    return False

def get_internal_links(soup, base_url):
    """Extract relevant internal links from a page"""
    domain = urlparse(base_url).netloc
    links = set()

    for link in soup.find_all('a', href=True):
        href = link['href']
        full_url = urljoin(base_url, href)
        link_domain = urlparse(full_url).netloc

        # Only include links from the same domain
        if link_domain == domain:
            # Remove fragments and query parameters for deduplication
            clean_url = full_url.split('#')[0].split('?')[0]

            # Check if link is relevant
            link_text = link.get_text(strip=True)
            if is_relevant_link(clean_url, link_text):
                links.add(clean_url)

    return links

def fetch_page(url):
    """Fetch a page and return BeautifulSoup object"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        return soup
    except Exception as e:
        print(f"    ERROR fetching {url}: {str(e)}")
        return None

def convert_to_markdown(soup):
    """Convert HTML to markdown"""
    # Remove script and style elements
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.decompose()

    # Convert to markdown
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True
    h.body_width = 0
    markdown = h.handle(str(soup))

    return markdown

def crawl_centre_deep(centre_id, base_url, output_dir, max_pages=10):
    """Deep crawl a centre website by following relevant internal links"""
    print(f"\nCrawling {centre_id}: {base_url}")

    visited_urls = set()
    to_visit = {base_url}
    pages_data = []

    while to_visit and len(visited_urls) < max_pages:
        url = to_visit.pop()

        if url in visited_urls:
            continue

        print(f"  Fetching: {url}")
        soup = fetch_page(url)

        if not soup:
            continue

        visited_urls.add(url)

        # Convert to markdown
        markdown = convert_to_markdown(soup)

        # Store page data
        pages_data.append({
            'url': url,
            'content': markdown,
            'length': len(markdown)
        })

        # Get internal links from homepage only (to avoid going too deep)
        if url == base_url:
            internal_links = get_internal_links(soup, base_url)
            to_visit.update(internal_links - visited_urls)
            print(f"  Found {len(internal_links)} relevant links")

        # Polite delay
        time.sleep(1)

    # Save all pages as a single combined markdown file
    if pages_data:
        output_file = output_dir / f"{centre_id}.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"# {centre_id}\n\n")
            f.write(f"Base URL: {base_url}\n\n")
            f.write(f"Total pages crawled: {len(pages_data)}\n\n")
            f.write("---\n\n")

            for i, page in enumerate(pages_data, 1):
                f.write(f"## Page {i}: {page['url']}\n\n")
                f.write(page['content'])
                f.write("\n\n---\n\n")

        # Also save metadata as JSON
        metadata_file = output_dir / f"{centre_id}_metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump({
                'centre_id': centre_id,
                'base_url': base_url,
                'pages': [{'url': p['url'], 'length': p['length']} for p in pages_data],
                'total_pages': len(pages_data),
                'total_chars': sum(p['length'] for p in pages_data)
            }, f, indent=2)

        print(f"  SUCCESS - Saved {len(pages_data)} pages ({sum(p['length'] for p in pages_data)} chars)")
        return True

    return False

def main():
    # Output directory
    output_dir = Path('c:/Projects/centre2/data/crawled-deep')
    output_dir.mkdir(exist_ok=True)

    print(f"Starting deep crawl of {len(CENTRE_WEBSITES)} centre websites...")
    print(f"Output directory: {output_dir}")
    print(f"Max pages per centre: 10\n")

    success_count = 0
    fail_count = 0

    for i, (centre_id, url) in enumerate(CENTRE_WEBSITES.items(), 1):
        print(f"\n[{i}/{len(CENTRE_WEBSITES)}] ", end="")
        success = crawl_centre_deep(centre_id, url, output_dir, max_pages=10)

        if success:
            success_count += 1
        else:
            fail_count += 1

        # Delay between centres
        if i < len(CENTRE_WEBSITES):
            time.sleep(2)

    print(f"\n\n{'='*60}")
    print(f"Deep crawl complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Total: {len(CENTRE_WEBSITES)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
