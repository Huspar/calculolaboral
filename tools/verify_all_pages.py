import glob

# Comprobaciones estructurales comunes a todas las paginas publicadas.
# Cada una es (nombre, texto que debe aparecer en el HTML).
CHECKS = [
    ("max-width 1240px", "max-width: 1240px;"),
    ("logo bg #FFB703", 'style="background-color: #FFB703;"'),
    ("shrink-0", "shrink-0"),
    ("footer curvo (.teal-footer-curve)", "teal-footer-curve"),
    ("footer interior (.footer-inner-container)", "footer-inner-container"),
]

files = [f for f in sorted(glob.glob('*.html')) if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html']]
contents = {f: open(f, 'r', encoding='utf-8').read() for f in files}

print(f"Total files checked: {len(files)}")
for name, needle in CHECKS:
    ok = sum(1 for c in contents.values() if needle in c)
    print(f"Has {name}: {ok} / {len(files)}")

for f, c in contents.items():
    for name, needle in CHECKS:
        if needle not in c:
            print(f"MISSING {name}: {f}")