"""Fase 2: plantillas unificadas (one-shot).

1. Etiquetas (eyebrows) sobre h1/h2: se eliminan las decorativas y las que
   citan normativa pasan a una linea de referencia sobria (.cl-meta).
2. Navegacion de calculadoras unica (.cl-calcnav) en las 10 calculadoras.
3. Anuncio de Itau fuera de la tarjeta de resultados en Horas Extras.
4. Guias y paginas legales: articulo abierto (sin tarjeta), medida de lectura
   acotada y sello DT sin tarjeta anidada.
5. Tipografia: piso de 12px, parrafos largos a 14px y sin mayusculas en
   botones o textos largos.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"_template.html", "home-v2.html"}
STYLE_VERSION = "2.9.0"
POLISH_VERSION = "1.1.0"

TAG_RE = re.compile(r"<!--.*?-->|<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?>", re.S)
ICON_SPAN_RE = re.compile(r'<span[^>]*class="[^"]*material-icons[^"]*"[^>]*>.*?</span>', re.S)
DOT_SPAN_RE = re.compile(r'<span[^>]*class="[^"]*(?:w-1\.5 h-1\.5|w-2 h-2)[^"]*rounded-full[^"]*"[^>]*>\s*</span>', re.S)

META_KEYWORDS = re.compile(r"(Art\.|Artículo|\bLey\b|Nº|N°|Hito|Edición|Vigencia|Cumplimiento|Jornada legal|Acceso Inmediato|Urgencia)")
SKIP_TEXT = ("Instrumento Jurídico Laboral",)
EYEBROW_TAGS = {"div", "span", "a", "p"}

CALCULATORS = [
    ("finiquito_calculator", "Finiquito"),
    ("simulador-despido-injustificado-chile", "Despido injustificado"),
    ("sueldo_liquido", "Sueldo líquido"),
    ("calculadora-horas-extras", "Horas extras"),
    ("calculadora-sueldo-part-time", "Part-time"),
    ("calculadora-vacaciones", "Vacaciones"),
    ("calculadora-despido-articulo-160", "Despido Art. 160"),
    ("simulador-seguro-cesantia-afc", "Seguro de cesantía"),
    ("calculadora-costo-empresa-chile", "Costo empresa"),
]
CALC_PAGES = {slug for slug, _ in CALCULATORS} | {"calculadora-vacaciones-proporcionales"}


def plain_text(html):
    html = ICON_SPAN_RE.sub("", html)
    html = DOT_SPAN_RE.sub("", html)
    text = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------- 1. eyebrows

def find_eyebrows(s):
    tags = [(m.start(), m.end(), m.group(1), (m.group(2) or "").lower(), m.group(0)) for m in TAG_RE.finditer(s)]
    found = []
    for i, (start, end, closing, name, raw) in enumerate(tags):
        if closing or name not in ("h1", "h2"):
            continue
        # etiqueta previa, saltando comentarios y espacios
        j = i - 1
        while j >= 0 and tags[j][4].startswith("<!--") and not s[tags[j][1]:tags[j + 1][0]].strip():
            j -= 1
        if j < 0 or s[tags[j][1]:start].strip():
            continue
        pstart, pend, pclosing, pname, _ = tags[j]
        if pclosing != "/" or pname not in EYEBROW_TAGS:
            continue
        depth, k = 0, j
        while k >= 0:
            _, _, c, n, _ = tags[k]
            if n == pname:
                depth += 1 if c == "/" else -1
                if depth == 0:
                    break
            k -= 1
        if k < 0:
            continue
        ostart, oend, _, _, oraw = tags[k]
        cls = re.search(r'class="([^"]*)"', oraw)
        cls = cls.group(1) if cls else ""
        if not ("uppercase" in cls or "rounded-full" in cls or "rounded-md" in cls):
            continue
        inner = s[oend:pstart]
        if re.search(r"<(h[1-6]|ul|ol|table|img|button|input)\b", inner):
            continue
        text = plain_text(inner)
        if not text or len(text) > 90 or text.isdigit() or text.startswith(SKIP_TEXT):
            continue
        if not re.search(r"text-(xs|\[\d+(\.\d+)?px\])", cls):
            continue
        found.append((ostart, pend, oraw, text))
    return found


def rewrite_eyebrows(s, log):
    for ostart, pend, oraw, text in reversed(find_eyebrows(s)):
        meta = None
        if META_KEYWORDS.search(text):
            href = re.search(r'href="([^"]*)"', oraw) if oraw.startswith("<a") else None
            if href:
                meta = (f'<a href="{href.group(1)}" class="cl-meta cl-meta-link">{text}'
                        f'<span class="material-icons" aria-hidden="true">arrow_forward</span></a>')
            else:
                meta = f'<p class="cl-meta">{text}</p>'
            log.append(f"    meta   | {text}")
        else:
            log.append(f"    borrar | {text}")
        # quita el elemento (con su sangria y salto de linea)
        line_start = s.rfind("\n", 0, ostart) + 1
        if not s[line_start:ostart].strip():
            ostart = line_start
        if s[pend:pend + 1] == "\n":
            pend += 1
        s = s[:ostart] + s[pend:]
        # la referencia normativa va debajo del titulo, como cita de documento
        if meta:
            close = re.compile(r"</h[12]>").search(s, ostart)
            indent = re.match(r"[ \t]*", s[ostart:]).group(0)
            s = s[:close.end()] + "\n" + indent + meta + s[close.end():]
    return s


# ------------------------------------------------------- 2. nav calculadoras

def calc_nav(current):
    items = []
    for slug, label in CALCULATORS:
        is_current = slug == current or (current == "calculadora-vacaciones-proporcionales" and slug == "calculadora-vacaciones")
        cur = ' aria-current="page"' if is_current else ""
        items.append(f'<a href="{slug}"{cur}>{label}</a>')
    return ('<nav class="cl-calcnav no-print" aria-label="Calculadoras">\n'
            '                <div class="cl-calcnav-track">' + "".join(items) + "</div>\n"
            "            </nav>")


PRODUCT_SWITCHER_RE = re.compile(
    r'(?:<!--[^>]*-->\s*)?<div class="[^"]*overflow-x-auto[^"]*">\s*<div class="segmented-control-container">'
    r'(?:(?!</?div\b).)*?</div>\s*</div>', re.S)
SEGMENTED_RE = re.compile(
    r'(?:<!--[^>]*-->\s*)?<div class="mt-6">\s*<div class="segmented-switcher-wrapper no-print">\s*<div class="segmented-switcher">'
    r'(?:(?!</?div\b).)*?</div>\s*</div>\s*</div>', re.S)


def apply_calc_nav(name, s, log):
    slug = name[:-5]
    if slug not in CALC_PAGES:
        return s
    nav = calc_nav(slug)
    if slug == "simulador-despido-injustificado-chile":
        # Conserva el selector empleador/trabajador; agrega la navegacion antes
        marker = "<!-- Mode Switcher (Emil Kowalski Segmented Control) -->"
        if marker in s and "cl-calcnav" not in s:
            s = s.replace(marker, nav + "\n\n            " + marker, 1)
            log.append("    nav insertada")
        return s
    s, n1 = SEGMENTED_RE.subn(nav, s, count=1)
    if not n1:
        s, n1 = PRODUCT_SWITCHER_RE.subn(nav, s, count=1)
    log.append(f"    nav reemplazada: {n1}")
    return s


# ----------------------------------------------- 3. anuncio fuera de resultados

def move_horas_extras_ad(name, s, log):
    if name != "calculadora-horas-extras.html":
        return s
    m = re.search(r'\n\s*<!-- Banner Patrocinado Itaú -->\s*<div class="mt-5 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xs no-print text-center">', s)
    if not m:
        log.append("    anuncio: no encontrado")
        return s
    # bloque balanceado de <div>
    start = s.find("<div", m.start())
    depth, pos = 0, start
    for t in re.finditer(r"<(/?)div\b[^>]*>", s[start:]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            pos = start + t.end()
            break
    block = s[start:pos]
    s = s[:m.start()] + s[pos:]
    img = re.search(r'<a href="/itau"[^>]*>\s*<img[^>]*>\s*</a>', block, re.S).group(0)
    img = re.sub(r'(<img[^>]*?)class="[^"]*"', r'\1class="block w-full h-auto rounded-xl"', img)
    btn = re.search(r'<a href="/itau"[^>]*data-placement="horas_extras_results_btn".*?</a>', block, re.S).group(0)
    band = f'''
        <!-- Patrocinado: fuera de la tarjeta de resultados -->
        <aside class="cl-sponsor no-print" aria-label="Contenido patrocinado">
            <div class="cl-sponsor-media">{img}</div>
            <div class="cl-sponsor-body">
                <p class="cl-sponsor-label">Publicidad · Banco Itaú Chile</p>
                <p class="text-sm text-slate-700 leading-relaxed">Recibe tu sueldo y horas extras en tu <strong>Cuenta Corriente Itaú con $0 costo de mantención</strong>.</p>
                {btn}
            </div>
        </aside>
'''
    anchor = "<!-- B2B Box: Anexo 40h & Kit Blindaje Pyme 2026 -->"
    s = s.replace(anchor, band.strip("\n") + "\n\n        " + anchor, 1)
    log.append("    anuncio movido")
    return s


# --------------------------------------------------------------- 4. guias

TRUST_BOX = 'class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-8 mt-2"'
TRUST_ICON = 'class="w-12 h-12 rounded-full bg-slate-100 text-[#00382E] flex items-center justify-center flex-shrink-0"'


def open_article(s, log):
    s2 = re.sub(r'<article class="sm:bg-white sm:border sm:border-slate-200 sm:rounded-3xl sm:shadow-sm p-0 sm:p-\d+(?: md:p-\d+)? mb-8 relative(?: overflow-hidden)?">',
                '<article class="cl-article mb-8 relative">', s)
    if s2 != s:
        s2 = s2.replace('<main class="site-container flex-grow flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">',
                        '<main class="site-container cl-reading flex-grow flex-1 mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">', 1)
        s2 = s2.replace(TRUST_BOX, 'class="cl-trust"').replace(TRUST_ICON, 'class="cl-trust-icon"')
        log.append("    articulo abierto")
    return s2


# ------------------------------------------------------------ 5. tipografia

TINY_RE = re.compile(r'(?<![\w-])((?:[a-z0-9]+:)*)text-\[(?:9|9\.5|10|10\.5|11|11\.5)px\](?![\w-])')


def typography(s):
    s = TINY_RE.sub(lambda m: f"{m.group(1)}text-xs", s)

    def long_para(m):
        attrs, inner = m.group(1), m.group(2)
        if len(plain_text(inner)) >= 110 and re.search(r'class="[^"]*\btext-xs\b', attrs):
            attrs = re.sub(r'(class="[^"]*?)\btext-xs\b', r"\1text-sm", attrs, count=1)
        return f"<p{attrs}>{inner}</p>"

    s = re.sub(r"<p\b([^>]*)>(.*?)</p>", long_para, s, flags=re.S)

    def no_caps(m):
        tag, attrs, inner = m.group(1), m.group(2), m.group(3)
        if 'class="' in attrs and "uppercase" in attrs:
            is_action = tag in ("a", "button")
            if is_action or len(plain_text(inner)) > 32:
                attrs = re.sub(r"\s*\buppercase\b", "", attrs)
                if is_action:
                    attrs = re.sub(r"\s*\btracking-(?:wider|widest)\b", "", attrs)
                attrs = attrs.replace('class=" ', 'class="')
        return f"<{tag}{attrs}>{inner}</{tag}>"

    s = re.sub(r"<(a|button|p|summary)\b([^>]*)>(.*?)</\1>", no_caps, s, flags=re.S)
    return s


# ------------------------------------------------------------------ main

def read(path):
    raw = path.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw


def write(path, text, crlf):
    path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))


def main():
    report = []
    changed_js = []
    for path in sorted((ROOT / "js").glob("*.js")):
        if "pdf" in path.name:
            continue
        src, crlf = read(path)
        out = TINY_RE.sub(lambda m: f"{m.group(1)}text-xs", src)
        if out != src:
            write(path, out, crlf)
            changed_js.append(path.name)
            report.append("js/" + path.name)

    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP:
            continue
        src, crlf = read(path)
        log = []
        out = rewrite_eyebrows(src, log)
        out = apply_calc_nav(path.name, out, log)
        out = move_horas_extras_ad(path.name, out, log)
        out = open_article(out, log)
        out = typography(out)
        out = re.sub(r"(assets/css/style\.css)\?v=[\d.]+", rf"\1?v={STYLE_VERSION}", out)
        out = re.sub(r"(assets/css/polish\.css)\?v=[\d.]+", rf"\1?v={POLISH_VERSION}", out)
        for js in changed_js:
            out = re.sub(rf"(js/{re.escape(js)})\?v=[\w.]+", rf"\1?v={STYLE_VERSION}", out)
        if out != src:
            write(path, out, crlf)
            report.append(path.name + ("\n" + "\n".join(log) if log else ""))

    print("\n".join(report))


if __name__ == "__main__":
    sys.exit(main())
