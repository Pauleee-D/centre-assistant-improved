import * as cheerio from 'cheerio';

// Test scraping on a few sample centres
const testCentres = [
  { name: 'Whitlam Leisure Centre', url: 'https://whitlamleisurecentre.com.au/' },
  { name: 'Bright', url: 'https://www.brightsportscentre.com.au/' },
  { name: 'TRAC', url: 'https://www.trac.com.au/' },
];

async function scrapeWebsite(url: string): Promise<string> {
  try {
    console.log(`  Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Extract main content
    let content = '';

    // Try to find main content area
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '#main-content',
      '.content',
      '#content',
      'article',
      '.entry-content',
    ];

    for (const selector of mainSelectors) {
      const mainContent = $(selector).first();
      if (mainContent.length > 0) {
        content = mainContent.text();
        break;
      }
    }

    // If no main content found, get body text
    if (!content) {
      content = $('body').text();
    }

    // Clean up text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return content.substring(0, 2000);

  } catch (error) {
    console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return '';
  }
}

async function testScrape() {
  console.log('Testing web scraping on sample centres...\n');

  for (const centre of testCentres) {
    console.log(`\n=== ${centre.name} ===`);
    const content = await scrapeWebsite(centre.url);

    if (content) {
      console.log(`✓ Scraped ${content.length} characters`);
      console.log('\nPreview:');
      console.log(content.substring(0, 500) + '...\n');
    } else {
      console.log('✗ Failed to scrape\n');
    }

    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testScrape().catch(console.error);
