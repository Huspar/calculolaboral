import glob, re

files = [f for f in sorted(glob.glob('*.html')) if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html', '_template.html']]

btn_sky = {}
card_sky = {}

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    b_matches = re.findall(r'<(?:button|a)\b[^>]*class="[^"]*(?:bg-sky-|bg-blue-)[^"]*"[^>]*>', c)
    if b_matches:
        btn_sky[f] = len(b_matches)
    
    c_matches = re.findall(r'<div\b[^>]*class="[^"]*(?:border-sky-|bg-sky-50|bg-sky-100)[^"]*"[^>]*>', c)
    if c_matches:
        card_sky[f] = len(c_matches)

print('=== Files with sky buttons/links ===')
for k, v in sorted(btn_sky.items(), key=lambda x: x[1], reverse=True):
    print(f'{k}: {v}')

print('\n=== Files with sky cards/divs ===')
for k, v in sorted(card_sky.items(), key=lambda x: x[1], reverse=True):
    print(f'{k}: {v}')
