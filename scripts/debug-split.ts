import * as fs from 'fs';
import * as path from 'path';

const mdPath = path.join(process.cwd(), 'data', 'knowledge-base-clean.md');
const markdown = fs.readFileSync(mdPath, 'utf-8');

const sections = markdown.split(/\n\n---\n\n/);
console.log(`Total sections: ${sections.length}`);

sections.slice(0, 5).forEach((section, i) => {
  const match = section.match(/##\s+(.+)/);
  console.log(`\nSection ${i}:`);
  console.log(`  Has ##: ${!!match}`);
  console.log(`  Centre name: ${match ? match[1].trim() : 'N/A'}`);
  console.log(`  First 100 chars: ${section.substring(0, 100).replace(/\n/g, '\\n')}`);
});
