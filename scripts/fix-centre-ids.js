const fs = require('fs');
const path = require('path');

const centresPath = path.join(__dirname, '..', 'data', 'centres-list.json');
const centres = JSON.parse(fs.readFileSync(centresPath, 'utf-8'));

// Knowledge base centre names (from the ## headings)
const kbMapping = {
  'stromloleisurecentre': 'stromlo',
  'lakesideleisurecentre': 'lakeside',
  'gungahlinleisurecentre': 'gungahlin',
  'canberraolympicpcw': 'canberraolympicpool',
  'dicksonpoolsseasonal': 'dicksonpools',
  'michaelclarkereccentre': 'michaelclarke',
  'greatlakesleisurecentre': 'greatlakes',
  'michaelwendenaquaticleisure': 'michaelwenden',
  'moreeartisanaquatic': 'moree',
  'singletonswimandgym': 'singleton',
  'tomareeseasonal': 'tomaree',
  'kurrikurriaquaticandfitnesscentre': 'kurrikurri',
  'swellpalmersonpool': 'swell',
  'fernyhillswimmingpcw': 'fernyhillswimmingpool',
  'dalby': 'dalbyaquaticcentre',
  'gympieaquaticcentre': 'gympie',
  'bundaberg': 'bundabergcomingsoon',
  'wulandarecandconcentre': 'wulanda',
  'swirlsmithton': 'swirl',
  'tracthomastownreccentre': 'trac',
  'whittleseaswimcentreseasonal': 'whittleseaswimcentre',
  'yarracentre': 'yarra',
  'somervillereccentre': 'somerville',
  'jackhortmemorialpool': 'jackhort',
  'robinvalerecandaquaticseasonal': 'robinvale',
  'portlandleisureandaquatic': 'portland',
  'pelicanparkreccentre': 'pelicanpark',
  'millparkleisure': 'millpark',
  'monbulkaquaticcentre': 'monbulk',
  'gurriwanyarrawellbeingcentre': 'gurriwanyarra',
  'eastfremantlebactive': 'eastfremantle',
  'loftusreccentre': 'loftus',
  'queensparkpool': 'queensparkpool', // Add Queens Park Pool mapping
  'inverellaquaticcentre': 'inverellaquaticcentre',
};

let updated = 0;

centres.forEach(centre => {
  if (kbMapping[centre.id]) {
    console.log(`Updating: ${centre.id} -> ${kbMapping[centre.id]}`);
    centre.id = kbMapping[centre.id];
    updated++;
  }
});

// Write the updated centres list
fs.writeFileSync(centresPath, JSON.stringify(centres, null, 2));

console.log(`\n✅ Updated ${updated} centre IDs`);
console.log(`📝 Updated file: ${centresPath}`);
