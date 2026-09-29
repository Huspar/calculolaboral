import glob
import re

files = [f for f in sorted(glob.glob('*.html')) if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html']]

print(f"Total files checked: {len(files)}")
has_8rem = sum(1 for f in files if 'padding-left: 8rem !important;' in open(f, 'r', encoding='utf-8').read())
has_4rem = sum(1 for f in files if 'padding-left: 4rem !important;' in open(f, 'r', encoding='utf-8').read())
has_maxw = sum(1 for f in files if 'max-width: 1240px;' in open(f, 'r', encoding='utf-8').read())
has_logo_bg = sum(1 for f in files if 'style="background-color: #FFB703;"' in open(f, 'r', encoding='utf-8').read())
has_shrink0 = sum(1 for f in files if 'shrink-0' in open(f, 'r', encoding='utf-8').read())

print(f"Has 8rem rule: {has_8rem} / {len(files)}")
print(f"Has 4rem rule: {has_4rem} / {len(files)}")
print(f"Has max-width 1240px: {has_maxw} / {len(files)}")
print(f"Has logo bg #FFB703: {has_logo_bg} / {len(files)}")
print(f"Has shrink-0: {has_shrink0} / {len(files)}")

for f in files:
    c = open(f, 'r', encoding='utf-8').read()
    if 'padding-left: 8rem !important;' not in c:
        print(f"MISSING 8rem: {f}")
    if 'max-width: 1240px;' not in c:
        print(f"MISSING max-w: {f}")
    if 'style="background-color: #FFB703;"' not in c:
        print(f"MISSING logo bg: {f}")
