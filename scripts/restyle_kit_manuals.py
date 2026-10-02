"""Aplica la identidad vigente a los manuales HTML de los kits (fuente de los PDF).

- Logo oficial: caja verde bosque con isotipo ambar (reemplaza el "CL" de texto
  y la caja celeste).
- Celeste de la marca antigua -> verde bosque; encabezados de tabla -> verde.
- Tipografia Geist (Google Fonts) en lugar de la fuente del sistema.
- Sin emojis decorativos; sin numeracion duplicada de paginas.
- "Formato Word .doc" -> ".docx" (los archivos entregados son .docx).

Uso: python scripts/restyle_kit_manuals.py   (luego exportar a PDF con Playwright)
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANUALS = [
    ROOT / 'api' / 'assets' / 'kit_datos_files' / '0_Manual_Instrucciones_Paso_a_Paso_Ley_21719.html',
    ROOT / 'api' / 'assets' / 'kit_pyme_files' / '00_Manual_Instrucciones_Blindaje_Laboral_Pyme.html',
]

ISOTIPO = (
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" '
    'stroke-linejoin="round"><path d="M30 84h40M38 79h24"></path><path d="M50 22v57"></path>'
    '<path d="M50 14l-2 4h4l-2-4v8"></path><path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>'
    '<path d="M18 36l-8 18h16Z"></path><path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>'
    '<path d="M82 36l-8 18h16Z"></path><path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>'
    '<path d="M41 43.5a10 10 0 1 0 0 20h6"></path><path d="M58 43.5v20h10"></path></svg>'
)

LOGO_CSS = """
        /* Logo oficial (AGENTS.md 1.A): caja verde bosque, isotipo ambar */
        .brand-logo, .brand-logo-svg {
            width: 32px; height: 32px; border-radius: 9px;
            background-color: #00382E !important;
            display: flex; align-items: center; justify-content: center;
            box-shadow: none !important;
        }
        .brand-logo svg, .brand-logo-svg svg { width: 20px; height: 20px; color: #FFB703 !important; }
        .brand-text span { color: #00382E !important; }
"""

COLOR_MAP = {
    '#0284c7': '#00382E', '#0ea5e9': '#00382E', '#0369a1': '#064A3E',
    '#e0f2fe': '#D6EBE4', '#f0f9ff': '#EEF6F3', '#bae6fd': '#ADD6C9',
}
RGBA_MAP = {r'rgba\(\s*2\s*,\s*132\s*,\s*199': 'rgba(0, 56, 46', r'rgba\(\s*14\s*,\s*165\s*,\s*233': 'rgba(0, 56, 46'}

# Excluye los vistos buenos (U+2713, U+2714): en las listas de control si comunican algo
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-✒✕-➿️⭐✅❌]\\s?')
VERSION_MARK = 'Versión 2026.10'
TEXT_FIXES = [
    ('<span class="step-badge step-badge-green">Cumplimiento Pleno</span>',
     '<span class="step-badge step-badge-green">Carpeta al día</span>'),
    ('Mantener las carpetas firmadas evita el inicio de procesos sancionatorios.',
     'Mantener las carpetas firmadas reduce el riesgo de que se inicie un proceso sancionatorio.'),
    ('asegurando cumplimiento total ante la DT.', 'para mantener la documentación al día ante la DT.'),
    ('tu empresa se encuentra en estándar de <strong>cumplimiento pleno para prevenir sanciones</strong> de la Inspección del Trabajo.',
     'tendrás en orden la <strong>documentación base que suele revisar</strong> la Inspección del Trabajo.'),
    ('<strong>Respaldo Normativo y Validez Legal (Art. 528 C.O.T.):</strong>',
     '<strong>Alcance de estos modelos (' + VERSION_MARK + ', octubre de 2026):</strong>'),
    ('confeccionados en conformidad estricta con el Código del Trabajo', 'basados en el Código del Trabajo'),
    ('reservada a abogados colegiados y habilitados conforme al artículo 528 del Código Orgánico de Tribunales de Chile.',
     'reservada por la ley chilena a abogados habilitados. Si tu caso tiene particularidades, revisa los documentos con un abogado antes de firmarlos.'),
    ('<span class="tag tag-green">100% Plug & Play</span>', '<span class="tag tag-green">Uso casi directo</span>'),
]
# Linea de vigencia, solo para el manual del Kit Ley 21.719
DATOS_VERSION = ('<p style="margin:12px 0 0;font-size:7pt;line-height:1.4;color:#64748b">' + VERSION_MARK + ' (octubre de 2026) · La Ley 21.719 rige desde el 1 de diciembre de 2026. '
                 'Si la Agencia de Protección de Datos dicta normas que cambien estos documentos antes del 31 de diciembre de 2027, '
                 'te enviamos la versión actualizada sin costo al correo de compra.</p>')
FONT_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800'
             '&family=Geist+Mono:wght@400;600&display=swap" rel="stylesheet">')


def restyle(html, ley_21719=False):
    for old, new in COLOR_MAP.items():
        html = re.sub(re.escape(old), new, html, flags=re.I)
    for old, new in RGBA_MAP.items():
        html = re.sub(old, new, html)
    # Encabezados de tabla oscuros -> verde bosque (el texto #0f172a se mantiene)
    html = re.sub(r'(background(?:-color)?:\s*)#0f172a', r'\1#00382E', html, flags=re.I)
    # Tipografia
    html = re.sub(r'font-family:\s*-apple-system[^;]*;',
                  "font-family: 'Geist', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;", html)
    if 'family=Geist' not in html:
        html = html.replace('<style>', FONT_LINK + '\n    <style>', 1)
    # Numeracion duplicada: el pie de cada hoja ya dice "Pagina X de N"
    html = re.sub(r'\s*@bottom-right\s*\{[^}]*\}', '', html)
    # Logo
    html = html.replace('<div class="brand-logo">CL</div>', f'<div class="brand-logo">{ISOTIPO}</div>')
    if 'Logo oficial (AGENTS.md' not in html:
        html = html.replace('</style>', LOGO_CSS + '    </style>', 1)
    # Emojis decorativos fuera de <style>/<script>
    parts = re.split(r'(<style\b.*?</style>|<script\b.*?</script>)', html, flags=re.S)
    html = ''.join(p if p.startswith(('<style', '<script')) else EMOJI.sub('', p) for p in parts)
    # Lineas para escribir a mano: con Geist son mas anchas, se acortan para no saltar de linea
    html = re.sub(r'_{30,}', '_' * 26, html)
    # Formato real de los archivos
    html = html.replace('(Formato Word .doc)', '(Formato Word .docx)')
    # Promesas que un modelo no puede asegurar y cita de articulo dudosa
    for old, new in TEXT_FIXES:
        html = html.replace(old, new)
    if ley_21719 and 'rige desde el 1 de diciembre' not in html:
        # La hoja 3 va llena: la linea cierra la hoja 2, antes del segundo salto de pagina
        breaks = [m.start() for m in re.finditer(r'[ \t]*<div class="page-break"></div>', html)]
        at = breaks[1]
        html = html[:at] + '    ' + DATOS_VERSION + '\n' + html[at:]
    return html


if __name__ == '__main__':
    for path in MANUALS:
        src = path.read_text(encoding='utf-8')
        out = restyle(src, ley_21719='21719' in path.name)
        path.write_text(out, encoding='utf-8')
        print('restyled', path.name, 'cambios' if out != src else 'sin cambios')
