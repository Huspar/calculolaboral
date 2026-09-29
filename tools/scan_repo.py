import glob, re

files = [f for f in glob.glob('*.html') if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html', '_template.html']]

results = {}
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    sky_btns = re.findall(r'class="[^"]*(?:bg-sky-|bg-blue-)[^"]*"', c)
    if sky_btns:
        results[f] = len(sky_btns)

print(f"Total files with bg-sky or bg-blue: {len(results)}")
for k, v in sorted(results.items(), key=lambda x: x[1], reverse=True):
    print(f"{k}: {v} matches")
