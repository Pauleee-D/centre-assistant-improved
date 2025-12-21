import os
from pathlib import Path

# List all files in data/list
list_dir = Path('c:/Projects/centre2/data/list')
list_files = sorted([f.name for f in list_dir.glob('*.md') if f.name != 'New Centre Template.md'])

print("Files in data/list (OneNote):")
for f in list_files:
    print(f"  - {f}")

print(f"\nTotal OneNote files: {len(list_files)}")

# Current mapping
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
    'dalbyaquaticcentre': 'Dalby.md',
    'dannyfrawley': 'Danny Frawley Centre (Moorabbin).md',
    'dicksonpools': 'Dickson Pools.md',
    'eastfremantle': 'East Fremantle.md',
    'erindale': 'Erindale.md',
    'fernyhillswimmingpool': 'Ferny Hills.md',
    'greatlakes': 'Great Lakes.md',
    'gungahlin': 'Gungahlin.md',
    'gurriwanyarra': 'Gurriwanyarra.md',
    'gympie': 'Gympie.md',
    'jackhort': 'Jack Hort Memorial Community Pool.md',
    'keiloreastleisurecentre': 'Keilor East.md',
    'knoxleisureworks': 'Knox.md',
    'kurrikurri': 'Kurri Kurri.md',
    'lakeside': 'Lakeside.md',
    'loftus': 'Loftus.md',
    'manningmidcoasttaree': 'Manning (Mid Coast) Taree.md',
    'mansfieldswimmingpool': 'Mansfield.md',
    'michaelclarke': 'Michael Clarke Centre (Norwest).md',
    'michaelwenden': 'Michael Wenden.md',
    'millpark': 'Mill Park.md',
    'monbulk': 'Monbulk.md',
    'moree': 'Moree.md',
    'pelicanpark': 'Pelican Park.md',
    'portland': 'Portland.md',
    'queensparkpool': 'Queens Park.md',
    'swell': 'SWELL (Palmerston).md',
    'swirl': 'SWIRL (Clarence).md',
    'singleton': 'Singleton.md',
    'somerville': 'Somerville.md',
    'splashdevonport': 'Splash (Devonport).md',
    'stromlo': 'Stromlo.md',
    'summit': 'Summit.md',
    'swanhill': 'Swan Hill.md',
    'trac': 'TRAC.md',
    'tehiku': 'Tehiku.md',
    'tomaree': 'Tomaree.md',
    'watermarc': 'Watermarc.md',
    'whittleseaswimcentre': 'Whittlesea.md',
    'whitlamleisurecentre': 'Whitlam.md',
    'wollondilly': 'Wollondilly.md',
    'wulanda': 'Wulanda.md',
    'yawa': 'YAWA.md',
    'yarra': 'Yarra.md',
    'yarrambatparkgolfcourse': 'Yarrambat Park.md',
    'higherstatemelbairport': 'Higher State (Melb Airport).md',
    'inverellaquaticcentre': 'Inverell.md',
    'centrepointblayney': 'CentrePoint (Blayney).md',
    'robinvale': 'Robinvale.md',
}

print("\nChecking mapping issues:")
missing = []
for centre_id, filename in CENTRE_NAME_MAPPING.items():
    filepath = list_dir / filename
    if not filepath.exists():
        print(f"  MISSING: {centre_id} -> {filename}")
        missing.append((centre_id, filename))

print(f"\nTotal missing: {len(missing)}")

print("\nSuggested corrections based on actual files:")
corrections = {
    'albanycreek': 'No file - website only',
    'dalbyaquaticcentre': 'Dalby Aquatic Centre.md (not Dalby.md)',
    'dannyfrawley': 'Danny Frawley.md (not Danny Frawley Centre (Moorabbin).md)',
    'fernyhillswimmingpool': 'Ferny Hill Swimming Pool.md (not Ferny Hills.md)',
    'gurriwanyarra': 'Gurri Wanyarra.md (not Gurriwanyarra.md)',
    'jackhort': 'Jack Hort.md (not Jack Hort Memorial Community Pool.md)',
    'keiloreastleisurecentre': 'Keilor East Leisure Centre.md (not Keilor East.md)',
    'knoxleisureworks': 'Knox Leisureworks.md (not Knox.md)',
    'manningmidcoasttaree': 'Manning Midcoast (Taree).md (not Manning (Mid Coast) Taree.md)',
    'mansfieldswimmingpool': 'Mansfield Swimming Pool.md (not Mansfield.md)',
    'michaelclarke': 'Michael Clarke.md (not Michael Clarke Centre (Norwest).md)',
    'queensparkpool': 'Queens Park Pool.md (not Queens Park.md)',
    'swell': 'SWELL.md (not SWELL (Palmerston).md)',
    'swirl': 'SWIRL.md (not SWIRL (Clarence).md)',
    'splashdevonport': 'Splash Devonport.md (not Splash (Devonport).md)',
    'tehiku': 'Te Hiku.md (not Tehiku.md)',
    'watermarc': 'WaterMarc.md (not Watermarc.md)',
    'whittleseaswimcentre': 'Whittlesea Swim Centre.md (not Whittlesea.md)',
    'whitlamleisurecentre': 'Whitlam Leisure Centre.md (not Whitlam.md)',
    'yarrambatparkgolfcourse': 'Yarrambat Park Golf Course.md (not Yarrambat Park.md)',
    'higherstatemelbairport': 'Higher State Melb Airport.md (not Higher State (Melb Airport).md)',
    'inverellaquaticcentre': 'Inverell Aquatic Centre.md (not Inverell.md)',
}

for centre_id, correction in corrections.items():
    print(f"  {centre_id}: {correction}")
