"""Fase 1 de limpieza visual (one-shot, idempotente).

- Remapea clases Tailwind fuera de paleta (sky/blue/indigo/violet/purple/cyan -> forest,
  orange -> amber/forest) en HTML y JS de UI.
- Remapea hex celestes y naranjas en <style> e inline styles.
- Unifica el fondo de pagina (canvas #F8FAF9) y quita clases selection: rotas.
- Corrige errores puntuales (markdown visible, badge E-E-A-T, placeholder degradado).
- Enlaza la capa compartida /assets/css/polish.css y /js/motion.js.
- Sube la version de cache de style.css.
"""
import glob
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"_template.html", "home-v2.html"}
STYLE_VERSION = "2.8.0"
POLISH_VERSION = "1.0.0"
MOTION_VERSION = "1.0.0"

COOL = "sky|blue|indigo|violet|purple|cyan"
PROPS = r"bg|text|border(?:-[trblxy])?|from|to|via|ring|ring-offset|fill|stroke|shadow|decoration|accent|outline|divide|placeholder|caret"

COOL_RE = re.compile(rf"(?<![\w\[#-])((?:[a-z0-9-]+:)*)({PROPS})-(?:{COOL})-(\d{{2,3}})(?![\w-])")
ORANGE_RE = re.compile(rf"(?<![\w\[#-])((?:[a-z0-9-]+:)*)({PROPS})-orange-(\d{{2,3}})(?![\w-])")

HEX_MAP = {
    "#0ea5e9": "#0F5E4F",  # sky-500  -> forest-600
    "#0284c7": "#0F5E4F",  # sky-600  -> forest-600
    "#0369a1": "#064A3E",  # sky-700  -> forest-700
    "#e0f2fe": "#D6EBE4",  # sky-100  -> forest-100
    "#f0f9ff": "#EEF6F3",  # sky-50   -> forest-50
    "#bae6fd": "#ADD6C9",  # sky-200  -> forest-200
    "#ea580c": "#00382E",  # orange-600 (CTA patrocinado) -> forest
}
RGBA_MAP = {
    r"rgba\(\s*14\s*,\s*165\s*,\s*233": "rgba(15, 94, 79",
    r"rgba\(\s*2\s*,\s*132\s*,\s*199": "rgba(15, 94, 79",
    r"rgba\(\s*234\s*,\s*88\s*,\s*12": "rgba(0, 56, 46",
}


def remap_orange(m):
    prefix, prop, shade = m.group(1), m.group(2), int(m.group(3))
    if prop == "bg" and shade >= 500:
        return f"{prefix}bg-forest-{ {500: 700, 600: 800, 700: 900}.get(shade, 900) }"
    if prop == "text" and shade >= 500:
        return f"{prefix}text-amber-{min(shade + 100, 950)}"
    return f"{prefix}{prop}-amber-{shade}"


def remap_colors(s):
    s = COOL_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}-forest-{m.group(3)}", s)
    s = ORANGE_RE.sub(remap_orange, s)
    for old, new in HEX_MAP.items():
        s = re.sub(re.escape(old) + r"(?![0-9a-fA-F])", new, s, flags=re.I)
    for old, new in RGBA_MAP.items():
        s = re.sub(old, new, s)
    return s


def fix_body(s):
    def body_tag(m):
        tag = m.group(0)
        tag = re.sub(r"\s*selection:[^\s\"]+", "", tag)
        tag = re.sub(r"\bbg-(slate-50|warm-surface)\b", "bg-canvas", tag)
        return tag

    s = re.sub(r"<body[^>]*>", body_tag, s, count=1)

    # Primer bloque `body { ... font-family: 'Geist' ... }` (no el de @media print)
    def body_rule(m):
        rule = m.group(0)
        return re.sub(r"background-color:\s*(#[0-9A-Fa-f]{6}|var\(--teal-cream\))\s*;",
                      "background-color: #F8FAF9;", rule, count=1)

    s = re.sub(r"(?<![\w-])body\s*\{[^}]*font-family:\s*'Geist'[^}]*\}", body_rule, s, count=1)
    return s


def link_shared_layer(s):
    s = re.sub(r"(assets/css/style\.css)\?v=[\d.]+", rf"\1?v={STYLE_VERSION}", s)
    if "polish.css" not in s:
        s = s.replace("</head>",
                      f'    <link rel="stylesheet" href="/assets/css/polish.css?v={POLISH_VERSION}">\n</head>', 1)
    if "/js/motion.js" not in s:
        s = s.replace("</body>",
                      f'    <script src="/js/motion.js?v={MOTION_VERSION}" defer></script>\n</body>', 1)
    return s


def page_specific(name, s):
    if name in ("reclamar-despido-injustificado-chile.html", "seguro-de-cesantia-chile-como-cobrar.html"):
        # Solo en texto visible: fuera de <script>
        parts = re.split(r"(<script\b.*?</script>)", s, flags=re.S)
        parts = [p if p.startswith("<script") else re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", p)
                 for p in parts]
        s = "".join(parts)

    if name == "sobre-nosotros.html":
        s = s.replace("Transparencia, Metodología E-E-A-T &amp; Soluciones Pyme",
                      "Transparencia, metodología y soluciones pyme")
        s = s.replace("Transparencia, Metodología E-E-A-T & Soluciones Pyme",
                      "Transparencia, metodología y soluciones pyme")

    if name == "index.html":
        s = s.replace('<span class="block text-amber-500 mt-1">y previsional en Chile.</span>',
                      '<span class="block mt-1"><span class="cl-mark">y previsional en Chile.</span></span>')
        # Gutter lateral del hero en movil
        s = s.replace('<section class="hero-py text-center">\n        <div class="site-container">',
                      '<section class="hero-py text-center">\n        <div class="site-container px-4 sm:px-6">')

    if name == "carta-de-renuncia-chile.html":
        s = s.replace("bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white",
                      "bg-[#00382E] cl-forest-panel text-white")

    if name == "finiquito-por-renuncia-voluntaria.html":
        s = s.replace(
            'bg-gradient-to-br from-sky-400 to-indigo-600 h-60 sm:h-80 flex flex-col items-center justify-center text-slate-800 px-6 text-center">\n<span class="material-icons text-6xl mb-4">description</span>\n<div class="text-2xl font-bold">Renuncia Voluntaria en Chile&gt;</div>\n<p class="text-sm opacity-90 max-w-md mt-1">',
            'bg-[#00382E] cl-forest-panel h-60 sm:h-80 flex flex-col items-center justify-center text-white px-6 text-center">\n<span class="material-icons text-6xl mb-4" style="color: #FFB703;">description</span>\n<div class="text-2xl font-bold" style="color: #ffffff;">Renuncia Voluntaria en Chile</div>\n<p class="text-sm max-w-md mt-1" style="color: rgba(255,255,255,0.82);">')

    if name == "mejores-cuentas-para-recibir-sueldo-chile-2026.html":
        s = s.replace("bg-gradient-to-br from-sky-500 to-sky-600 text-white",
                      "bg-[#00382E] cl-forest-panel text-white")

    if name == "ley-40-horas-chile-2026.html":
        s = s.replace("bg-gradient-to-r from-blue-600 to-blue-400", "bg-[#00382E]")

    if name == "kit-cumplimiento-ley-datos-personales-chile.html":
        s = s.replace("bg-gradient-to-br from-white to-purple-50/70 border border-purple-200",
                      "bg-white border border-slate-200")

    if name == "guia-ley-21719-proteccion-datos-personales-chile.html":
        s = s.replace("bg-gradient-to-br from-sky-50 to-indigo-50 border border-slate-200",
                      "bg-[#EEF6F3] border border-[#D6EBE4]")

    if name == "compra-exitosa.html":
        s = s.replace("family=Plus+Jakarta+Sans:wght@400;500;600;700;800",
                      "family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700")
        s = s.replace("'Plus Jakarta Sans'", "'Geist'").replace('"Plus Jakarta Sans"', '"Geist"')

    # Boton primario rojo (color de riesgo) -> verde de marca
    s = re.sub(r'(class="[^"]*)\bbtn-rose-pill\b', r"\1btn-dark-pill", s)

    # Articulo de guias: sin doble gutter en movil (la tarjeta aparece desde sm)
    s = re.sub(
        r'<article class="bg-white border border-slate-200 (rounded-2xl sm:rounded-3xl|rounded-3xl) shadow-sm p-(\d+) sm:p-(\d+)',
        lambda m: f'<article class="sm:bg-white sm:border sm:border-slate-200 sm:rounded-3xl sm:shadow-sm p-0 sm:p-{m.group(3)}',
        s)
    return s


def read(path):
    raw = path.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw


def write(path, text, crlf):
    path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))


def main():
    changed = []
    changed_js = []
    for path in sorted((ROOT / "js").glob("*.js")):
        src, crlf = read(path)
        out = remap_colors(src)
        if out != src:
            write(path, out, crlf)
            changed_js.append(path.name)
            changed.append("js/" + path.name)

    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP:
            continue
        src, crlf = read(path)
        # Los reemplazos puntuales buscan las clases originales: van antes del remapeo
        out = page_specific(path.name, src)
        out = remap_colors(out)
        out = fix_body(out)
        out = link_shared_layer(out)
        # Cache-busting de los JS de UI que cambiaron de color
        for js in changed_js:
            out = re.sub(rf"(js/{re.escape(js)})\?v=[\w.]+", rf"\1?v={STYLE_VERSION}", out)
        if out != src:
            write(path, out, crlf)
            changed.append(path.name)

    print(f"{len(changed)} archivos modificados")
    for c in changed:
        print(" ", c)


if __name__ == "__main__":
    main()
