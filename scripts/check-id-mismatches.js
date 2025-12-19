const fs = require('fs');
const path = require('path');

const centres = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'centres-list.json'), 'utf-8'));
const kbCentres = [
  'Albany Creek', 'Ascot Vale', 'Auburn Ruth', 'Bathurst (Manning)', 'Bright',
  'Bundaberg (coming soon)', 'Burpengary', 'Canberra Olympic Pool', 'CentrePoint (Blayney)',
  'Chinchilla', 'Civic Reserve', 'Dalby Aquatic Centre', 'Danny Frawley', 'Dickson Pools',
  'East Fremantle', 'Erindale', 'Ferny Hill Swimming Pool', 'Great Lakes', 'Gungahlin',
  'Gurri Wanyarra', 'Gympie', 'Higher State Melb Airport', 'Inverell Aquatic Centre',
  'Jack Hort', 'Keilor East Leisure Centre', 'Knox Leisureworks', 'Kurri Kurri', 'Lakeside',
  'Loftus', 'Manning Midcoast (Taree)', 'Mansfield Swimming Pool', 'Michael Clarke',
  'Michael Wenden', 'Mill Park', 'Monbulk', 'Moree', 'Pelican Park', 'Portland',
  'Queens Park Pool', 'Robinvale', 'SWELL', 'SWIRL', 'Singleton', 'Somerville',
  'Splash Devonport', 'Stromlo', 'Summit', 'Swan Hill', 'TRAC', 'Te Hiku', 'Tomaree',
  'WaterMarc', 'Whitlam Leisure Centre', 'Whittlesea Swim Centre', 'Wollondilly',
  'Wulanda', 'YAWA', 'Yarra', 'Yarrambat Park Golf Course'
];

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

console.log('CHECKING ID MISMATCHES:\n');
let mismatches = 0;

centres.forEach(c => {
  const match = kbCentres.find(kb => normalize(kb) === c.id);
  if (!match) {
    mismatches++;
    const possible = kbCentres.find(kb => {
      const kbNorm = normalize(kb);
      const cNorm = normalize(c.name);
      return kbNorm.includes(cNorm) || cNorm.includes(kbNorm);
    });
    console.log(`MISMATCH: ${c.id} (${c.name})`);
    console.log(`  Expected KB normalized: ${c.id}`);
    if (possible) {
      console.log(`  Actual KB heading: "${possible}"`);
      console.log(`  Actual KB normalized: ${normalize(possible)}`);
    } else {
      console.log(`  NOT FOUND in knowledge base`);
    }
    console.log('');
  }
});

console.log(`\nTotal mismatches: ${mismatches}/${centres.length}`);
