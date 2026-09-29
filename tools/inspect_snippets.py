import re

with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

b = re.findall(r'<(?:button|a)\b[^>]*class="[^"]*(?:bg-sky-|bg-blue-)[^"]*"[^>]*>[\s\S]*?</(?:button|a)>', c)
print(f"Buttons in index.html: {len(b)}")
for item in b:
    print("  ", item[:140])

d = re.findall(r'<div\b[^>]*class="[^"]*(?:border-sky-|bg-sky-50|bg-sky-100)[^"]*"[^>]*>', c)
print(f"Divs in index.html: {len(d)}")
for item in d:
    print("  ", item[:140])
