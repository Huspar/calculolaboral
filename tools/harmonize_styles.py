import os
import re
import glob

def harmonize_content(content, filename):
    orig = content

    # 1. Container Margins harmonization:
    # Replace max-w-[1200px] with max-w-[1240px]
    # In main tags or main containers: ensure px-4 sm:px-6 lg:px-8
    content = content.replace('max-w-[1200px]', 'max-w-[1240px]')
    content = content.replace('px-4 sm:px-6 py-6 sm:py-8', 'px-4 sm:px-6 lg:px-8 py-6 sm:py-8')
    content = content.replace('px-4 sm:px-6 py-8 sm:py-12', 'px-4 sm:px-6 lg:px-8 py-8 sm:py-12')
    content = content.replace('px-4 sm:px-6 py-6 sm:py-10', 'px-4 sm:px-6 lg:px-8 py-6 sm:py-10')

    # Ensure overflow-x: hidden on body if not already present
    if 'overflow-x: hidden;' not in content and '</head>' in content:
        head_end = content.find('</head>')
        last_style = content[:head_end].rfind('</style>')
        if last_style != -1:
            content = content[:last_style] + '\n        body { overflow-x: hidden; }\n' + content[last_style:]

    # 2. Buttons:
    # Replace raw bg-sky-500 / bg-sky-600 / bg-blue-600 on <a> or <button>
    # Common pattern: class="cta-btn inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-600 !text-white ... font-bold rounded-xl ..."
    # We replace them with .btn-yellow-pill or .btn-dark-pill
    def replace_button_class(match):
        full_tag = match.group(0)
        cls_attr = match.group(1)
        
        # Don't modify if already a pill
        if 'btn-yellow-pill' in cls_attr or 'btn-dark-pill' in cls_attr or 'btn-outline-pill' in cls_attr:
            return full_tag
            
        # Determine whether it should be yellow pill or dark pill
        # If it's a purchase, calculator, or main primary CTA -> yellow pill
        # Otherwise if it's secondary -> dark pill
        is_yellow = any(keyword in full_tag.lower() for keyword in [
            'finiquito', 'calcular', 'generar', 'comprar', 'descargar', 'simular', 'pack', 'obtener kit', 'webpay', 'flow'
        ])
        
        new_btn_cls = 'btn-yellow-pill' if is_yellow else 'btn-dark-pill'
        
        # Remove legacy color/padding/radius classes that clash with the pill
        cleaned_cls = cls_attr
        cleaned_cls = re.sub(r'\b(?:bg-sky-\d+|bg-blue-\d+|hover:bg-sky-\d+|hover:bg-blue-\d+)\b', '', cleaned_cls)
        cleaned_cls = re.sub(r'\b(?:px-\d+|py-[\d\.]+|rounded-[a-z0-9]+|shadow-[a-z0-9]+)\b', '', cleaned_cls)
        cleaned_cls = re.sub(r'\b(?:cta-btn|cta-lead-btn)\b', '', cleaned_cls)
        cleaned_cls = re.sub(r'\s+', ' ', cleaned_cls).strip()
        
        final_cls = f"{new_btn_cls} {cleaned_cls}".strip()
        return full_tag.replace(f'class="{cls_attr}"', f'class="{final_cls}"')

    content = re.sub(r'<(?:a|button)\b[^>]*class="([^"]*(?:bg-sky-|bg-blue-|cta-btn)[^"]*)"[^>]*>', replace_button_class, content)

    # 3. Cards & Containers with generic AI blue gradients or harsh blue borders:
    # Replace bg-gradient-to-br from-sky-50 to-blue-50 with warm clean surface
    content = content.replace('bg-gradient-to-br from-sky-50 to-blue-50', 'bg-[#F8FAF9]')
    content = content.replace('bg-gradient-to-r from-sky-50 to-blue-50', 'bg-[#F8FAF9]')
    content = content.replace('from-white via-sky-50/40 to-slate-50', 'from-white via-slate-50/60 to-slate-50')
    content = content.replace('from-slate-50 via-white to-sky-50/40', 'from-slate-50 via-white to-slate-50')

    # Replace blue cards:
    content = content.replace('border-sky-500 bg-sky-50/50', 'border-2 border-[#00382E] bg-white')
    content = content.replace('border-sky-300', 'border-slate-300')
    content = content.replace('border-sky-200', 'border-slate-200')
    content = content.replace('border-sky-100', 'border-slate-200')
    content = content.replace('bg-sky-50/70', 'bg-[#F8FAF9]')
    content = content.replace('bg-sky-50/50', 'bg-[#F8FAF9]')
    content = content.replace('bg-sky-50/40', 'bg-[#F8FAF9]')
    content = content.replace('bg-sky-50/30', 'bg-[#F8FAF9]')
    content = content.replace('bg-sky-50/20', 'bg-[#F8FAF9]')
    
    # Hover states on cards:
    content = content.replace('hover:border-sky-400', 'hover:border-slate-300')
    content = content.replace('hover:border-sky-500', 'hover:border-slate-400')
    content = content.replace('hover:border-sky-300', 'hover:border-slate-300')
    content = content.replace('hover:bg-sky-50/50', 'hover:bg-slate-50')
    content = content.replace('hover:bg-sky-50/40', 'hover:bg-slate-50')
    content = content.replace('hover:bg-sky-50', 'hover:bg-slate-50')

    # Badges & Icon containers:
    content = content.replace('bg-sky-50 text-sky-700', 'bg-emerald-50 text-emerald-800')
    content = content.replace('bg-sky-50 text-sky-600', 'bg-emerald-50 text-emerald-800')
    content = content.replace('bg-sky-50 text-sky-800', 'bg-slate-100 text-slate-800')
    content = content.replace('bg-sky-100 text-sky-800', 'bg-slate-100 text-slate-800')
    content = content.replace('bg-sky-100 text-sky-700', 'bg-slate-100 text-slate-800')
    content = content.replace('bg-sky-500 text-white', 'bg-[#00382E] text-[#FFB703]')
    content = content.replace('bg-sky-500 !text-white', 'bg-[#00382E] !text-[#FFB703]')
    content = content.replace('bg-sky-100 flex items-center justify-center', 'bg-slate-100 text-[#00382E] flex items-center justify-center')
    content = content.replace('bg-sky-50 rounded-2xl', 'bg-[#F8FAF9] rounded-2xl')
    content = content.replace('bg-sky-50/90', 'bg-[#F8FAF9]')
    content = content.replace('bg-sky-50', 'bg-[#F8FAF9]')
    content = content.replace('border-l-4 border-sky-500', 'border-l-4 border-[#00382E]')
    content = content.replace('border-l-4 border-sky-600', 'border-l-4 border-[#00382E]')

    # Inputs & focus:
    content = content.replace('focus:ring-sky-500', 'focus:ring-[#00382E]')
    content = content.replace('text-sky-600 focus:ring-sky-500', 'text-[#00382E] focus:ring-[#00382E]')
    content = content.replace('accent-sky-600', 'accent-[#00382E]')

    return content

def process_all():
    files = [f for f in sorted(glob.glob('*.html')) if f not in ['index.html', 'home-v2.html', 'ejemplo-informe-ejecutivo.html', '_template.html']]
    modified = 0
    for f in files:
        with open(f, 'r', encoding='utf-8') as fp:
            c = fp.read()
        new_c = harmonize_content(c, f)
        if new_c != c:
            with open(f, 'w', encoding='utf-8') as fp:
                fp.write(new_c)
            print(f'Harmonized: {f}')
            modified += 1
        else:
            print(f'Unchanged: {f}')
    print(f'Total harmonized: {modified} / {len(files)}')

if __name__ == '__main__':
    process_all()
