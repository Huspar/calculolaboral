import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. REMOVE TAILWIND CDN AND INLINE CONFIG
    content = re.sub(r'<script src="https://cdn\.tailwindcss\.com.*?"></script>\s*', '', content, flags=re.DOTALL)
    content = re.sub(r'<script>\s*tailwind\.config\s*=\s*\{.*?\}\s*;\s*</script>\s*', '', content, flags=re.DOTALL)
    # Some files might have window.tailwind.config or similar, let's also try to remove any script block containing tailwind.config
    content = re.sub(r'<script>\s*tailwind\.config[\s\S]*?</script>\s*', '', content)
    
    # Insert new local CSS if it doesn't exist
    if 'style.css' not in content:
        content = content.replace('</head>', '    <link rel="stylesheet" href="/assets/css/style.css">\n</head>')

    # 2. URL CLEANUP
    # A. Canonicals 
    content = re.sub(r'<link rel="canonical" href="([^"]+?)\.html">', r'<link rel="canonical" href="\1">', content)

    # B. Internal anchor tags <a href="page.html"> -> <a href="/page">
    # Note: avoid matching external URLs with .html like https://www.dt.gob.cl/portal/...
    # Our internal links are typically href="index.html", href="sueldo_liquido.html", etc.
    def replace_internal_href(match):
        url = match.group(1)
        if url.startswith('http') or url.startswith('mailto:') or url.startswith('#'):
            return f'href="{url}.html"' # preserve as is
            
        if url == "index":
            return 'href="/"'
        
        # if it already has a leading slash, just remove .html
        if url.startswith('/'):
            return f'href="{url}"'
            
        return f'href="/{url}"'

    content = re.sub(r'href="([^"]+?)\.html"', replace_internal_href, content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Processed {len(html_files)} files.")
