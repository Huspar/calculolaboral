"""Fase 3: ilustraciones propias, blog con destacado y home sin receta repetida.

1. Guias: la imagen principal pasa a la portada ilustrada (assets/covers).
2. Blog: nota destacada + grilla con portadas ilustradas, categoria como
   metadato y el patrocinio fuera de la grilla de articulos.
3. Home: anuncios despues de las guias, encabezados alineados a la izquierda
   en catalogo y guias, y portadas en las tarjetas de guias.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

COVER_TITLES = {}
for m in re.finditer(r'"([a-z0-9-]+)": \(m_\w+, "([^"]+)"\)', (ROOT / "scripts" / "build_covers.py").read_text(encoding="utf-8")):
    COVER_TITLES[m.group(1)] = m.group(2)

GUIDE_COVERS = {
    "aguinaldo-fiestas-patrias-chile-2026.html": ("guia-aguinaldo-fiestas-patrias-cover.jpg", "aguinaldo"),
    "carta-de-despido-chile.html": ("guia-carta-de-despido-cover.jpg", "carta-despido"),
    "checklist-fiscalizacion-dt-pymes-chile.html": ("guia-fiscalizacion-dt-pymes-cover.png", "fiscalizacion-dt"),
    "como-calcular-finiquito-chile.html": ("guia-calculo-finiquito-chile-2026.png", "finiquito"),
    "como-calcular-sueldo-liquido-paso-a-paso.html": ("guia-sueldo-liquido-cover.png", "sueldo-liquido"),
    "como-leer-liquidacion-de-sueldo.html": ("guia-liquidacion-sueldo-cover.png", "liquidacion"),
    "despido-necesidades-empresa-articulo-161.html": ("guia-despido-necesidades-empresa-161.png", "despido-161"),
    "fondos-generacionales-afp-chile.html": ("guia-fondos-generacionales-afp-cover.png", "fondos-afp"),
    "guia-ley-21719-proteccion-datos-personales-chile.html": ("guia-ley-21719-datos-personales-chile-cover.jpg", "ley-21719-datos-personales"),
    "guia-vacaciones-proporcionales.html": ("guia-vacaciones-proporcionales-cover.png", "vacaciones"),
    "ley-40-horas-chile-2026.html": ("guia-ley-40-horas-chile-cover.png", "ley-40-horas"),
    "ley-equidad-genero-brecha-salarial-chile-2026.html": ("guia-equidad-genero-brecha-salarial-cover.jpg", "equidad-salarial"),
    "propuesta-indemnizacion-a-todo-evento-chile.html": ("guia-indemnizacion-todo-evento-chile.jpg", "indemnizacion-todo-evento"),
    "que-conductas-no-son-ley-karin-dt-chile.html": ("que-conductas-no-son-ley-karin-cover.jpg", "ley-karin"),
    "que-hacer-si-no-te-pagan-el-finiquito.html": ("guia-finiquito-no-pago-cover.png", "finiquito-no-pagado"),
    "reclamar-despido-injustificado-chile.html": ("guia-reclamar-despido-injustificado-cover.jpg", "reclamar-despido"),
    "sala-cuna-universal-articulo-203-codigo-del-trabajo-chile.html": ("guia-sala-cuna-universal-art-203-cover.jpg", "sala-cuna"),
    "mejores-cuentas-para-recibir-sueldo-chile-2026.html": ("guia-cuentas-sueldo-chile-cover.jpg", "cuentas-sueldo"),
}

BLOG_COVERS = {
    "guia-ley-21719-proteccion-datos-personales-chile": "ley-21719-datos-personales",
    "mejores-cuentas-para-recibir-sueldo-chile-2026": "cuentas-sueldo",
    "ley-equidad-genero-brecha-salarial-chile-2026": "equidad-salarial",
    "sala-cuna-universal-articulo-203-codigo-del-trabajo-chile": "sala-cuna",
    "que-conductas-no-son-ley-karin-dt-chile": "ley-karin",
    "aguinaldo-fiestas-patrias-chile-2026": "aguinaldo",
    "checklist-fiscalizacion-dt-pymes-chile": "fiscalizacion-dt",
    "propuesta-indemnizacion-a-todo-evento-chile": "indemnizacion-todo-evento",
    "fondos-generacionales-afp-chile": "fondos-afp",
    "como-calcular-sueldo-liquido-paso-a-paso": "sueldo-liquido",
    "calculadora-vacaciones": "vacaciones",
    "como-calcular-finiquito-chile": "finiquito",
    "como-leer-liquidacion-de-sueldo": "liquidacion",
    "despido-necesidades-empresa-articulo-161": "despido-161",
    "ley-40-horas-chile-2026": "ley-40-horas",
    "simulador-seguro-cesantia-afc": "seguro-cesantia",
    "que-hacer-si-no-te-pagan-el-finiquito": "finiquito-no-pagado",
}


def read(path):
    raw = path.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw


def write(path, text, crlf):
    path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))


def cover_img(name, eager=False, extra_class="cl-cover"):
    alt = html.escape(COVER_TITLES[name])
    loading = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    return f'<img src="/assets/covers/{name}.svg" alt="{alt}" width="800" height="450" class="{extra_class}" {loading} decoding="async">'


# ------------------------------------------------------------- 1. guias

def guide_hero(name, s):
    if name == "finiquito-por-renuncia-voluntaria.html":
        new, n = re.subn(
            r'<div class="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/20">\s*<!--[^>]*-->\s*'
            r'<div class="w-full bg-\[#00382E\] cl-forest-panel h-60 sm:h-80.*?</div>\s*</div>',
            f'<div class="cl-cover-frame">{cover_img("renuncia-voluntaria", eager=True)}</div>', s, count=1, flags=re.S)
        return new, n
    if name not in GUIDE_COVERS:
        return s, 0
    old, cover = GUIDE_COVERS[name]
    body_start = s.find("<body")
    head, body = s[:body_start], s[body_start:]
    m = re.search(r'<div class="[^"]*">\s*<img\b[^>]*src="/?assets/' + re.escape(old) + r'"[^>]*>\s*</div>', body)
    if not m:
        # imagen sin envoltorio
        m = re.search(r'<img\b[^>]*src="/?assets/' + re.escape(old) + r'"[^>]*>', body)
        if not m:
            return s, 0
        body = body[:m.start()] + f'<div class="cl-cover-frame">{cover_img(cover, eager=True)}</div>' + body[m.end():]
        return head + body, 1
    body = body[:m.start()] + f'<div class="cl-cover-frame">{cover_img(cover, eager=True)}</div>' + body[m.end():]
    return head + body, 1


# --------------------------------------------------------------- 2. blog

CARD_RE = re.compile(r'\s*<!--[^>]*-->\s*<a href="(?P<href>[^"]+)"(?P<attrs>[^>]*)>(?P<inner>.*?)</a>\n', re.S)


def strip(t):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t)).strip())


def parse_cards(grid):
    posts, sponsor = [], None
    for m in CARD_RE.finditer(grid):
        inner = m.group("inner")
        if m.group("href") == "/itau":
            sponsor = m.group(0)
            continue
        badge = re.search(r'<span class="absolute[^"]*">(.*?)</span>', inner, re.S)
        spans = re.findall(r'<span>(.*?)</span>', re.search(r'<div class="flex justify-between items-center[^"]*">(.*?)</div>', inner, re.S).group(1), re.S)
        posts.append({
            "href": m.group("href"),
            "badge": strip(badge.group(1)) if badge else "",
            "title": strip(re.search(r"<h2[^>]*>(.*?)</h2>", inner, re.S).group(1)),
            "excerpt": strip(re.search(r"<p[^>]*>(.*?)</p>", inner, re.S).group(1)),
            "date": strip(spans[0]) if spans else "",
            "read": strip(spans[1]) if len(spans) > 1 else "",
        })
    return posts, sponsor


def meta_line(p):
    parts = [p["badge"], p["date"], p["read"]]
    return " · ".join(html.escape(x, quote=False) for x in parts if x)


def post_card(p):
    return f'''        <a href="{p["href"]}" class="cl-post">
            <figure class="cl-post-cover">{cover_img(BLOG_COVERS[p["href"]])}</figure>
            <div class="cl-post-body">
                <p class="cl-post-meta">{meta_line(p)}</p>
                <h2 class="cl-post-title">{html.escape(p["title"], quote=False)}</h2>
                <p class="cl-post-excerpt">{html.escape(p["excerpt"], quote=False)}</p>
            </div>
        </a>
'''


def featured(p):
    return f'''    <a href="{p["href"]}" class="cl-feature">
        <figure class="cl-feature-cover">{cover_img(BLOG_COVERS[p["href"]], eager=True)}</figure>
        <div class="cl-feature-body">
            <p class="cl-post-meta">Lo más reciente · {meta_line(p)}</p>
            <h2 class="cl-feature-title">{html.escape(p["title"], quote=False)}</h2>
            <p class="cl-feature-excerpt">{html.escape(p["excerpt"], quote=False)}</p>
            <span class="cl-feature-cta">Leer la guía<span class="material-icons" aria-hidden="true">arrow_forward</span></span>
        </div>
    </a>
'''


SPONSOR_BLOG = '''    <aside class="cl-sponsor" aria-label="Contenido patrocinado">
        <div class="cl-sponsor-media"><a href="/itau" target="_blank" rel="sponsored nofollow noopener" data-partner="itau_cuenta_corriente" data-placement="blog_grid"><img src="/assets/itau-cuenta-corriente-app.jpg" alt="Banco Itaú Plan Cuenta Corriente $0 costo de mantención" width="300" height="250" loading="lazy" class="block w-full h-auto rounded-xl"></a></div>
        <div class="cl-sponsor-body">
            <p class="cl-sponsor-label">Publicidad · Banco Itaú Chile</p>
            <p class="text-base font-semibold text-slate-900">Abre tu Cuenta Corriente Itaú 100% online</p>
            <p class="text-sm text-slate-600 leading-relaxed mt-1">¿Dónde recibir tu sueldo mensual? Ábrela en minutos sin comisiones de mantención, con tarjeta de débito digital y transferencias sin costo.</p>
            <a href="/itau" target="_blank" rel="sponsored nofollow noopener" data-partner="itau_cuenta_corriente" data-placement="blog_grid_btn" class="btn-dark-pill !text-sm">Hazte cliente online<span class="material-icons text-sm" style="color:#ffffff !important;" aria-hidden="true">arrow_forward</span></a>
        </div>
    </aside>
'''


def rebuild_blog(s):
    start = s.find('<div class="w-full pt-4">')
    grid_start = s.find('<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">', start)
    end = s.find("\n    </main>", grid_start)
    block_end = s.rfind("</div>", grid_start, end)  # cierre de .w-full
    grid = s[grid_start:block_end]
    posts, sponsor = parse_cards(grid)
    assert len(posts) == 17 and sponsor, (len(posts), bool(sponsor))
    first, rest = posts[0], posts[1:]
    out = ['<div class="w-full pt-4">',
           '    <header class="cl-blog-head">',
           '        <h1>Blog Laboral Informativo</h1>',
           '        <p>Guías didácticas y actualizadas conforme al Código del Trabajo de Chile para comprender tus liquidaciones, finiquitos y derechos.</p>',
           '    </header>',
           featured(first).rstrip("\n"),
           '    <div class="cl-post-grid">']
    out += [post_card(p).rstrip("\n") for p in rest[:6]]
    out.append("    </div>")
    out.append(SPONSOR_BLOG.rstrip("\n"))
    out.append('    <div class="cl-post-grid">')
    out += [post_card(p).rstrip("\n") for p in rest[6:]]
    out.append("    </div>")
    out.append("")
    return s[:start] + "\n".join(out) + s[block_end:]


# --------------------------------------------------------------- 3. home

HOME_GUIDE_COVERS = {
    "reclamar-despido-injustificado-chile": "reclamar-despido",
    "carta-de-renuncia-chile": "renuncia-voluntaria",
    "despido-necesidades-empresa-articulo-161": "despido-161",
}


def rebuild_home(s):
    # a) anuncios despues de las guias (antes de las preguntas frecuentes)
    a = s.index("    <!-- SECTION 3: SOLUCIONES FINANCIERAS ALIADAS")
    b = s.index("    <!-- SECTION 4: DIRECTORY OF CALCULATORS")
    sponsored = s[a:b]
    s = s[:a] + s[b:]
    faq = s.index("    <!-- SECTION 5: FAQ ACCORDION -->")
    s = s[:faq] + sponsored + s[faq:]

    # b) encabezados alineados a la izquierda: catalogo y guias
    s = s.replace('<div class="reveal-on-scroll text-center max-w-2xl mx-auto mb-8">\n                <h2 style="color: var(--teal-forest);" class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">\n                    Todas nuestras calculadoras',
                  '<div class="cl-section-head mb-8">\n                <h2 style="color: var(--teal-forest);" class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">\n                    Todas nuestras calculadoras', 1)
    s = s.replace('<div class="mt-6 flex flex-wrap items-center justify-center gap-2">\n                    <button type="button" onclick="filterCatalog',
                  '<div class="mt-6 flex flex-wrap items-center justify-start gap-2">\n                    <button type="button" onclick="filterCatalog', 1)
    s = s.replace('<div class="reveal-on-scroll text-center max-w-2xl mx-auto mb-14">\n                <h2 style="color: var(--teal-forest);" class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">\n                    Lo que debes saber',
                  '<div class="cl-section-head mb-10">\n                <h2 style="color: var(--teal-forest);" class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">\n                    Lo que debes saber', 1)

    # c) tarjetas de guias: portada en lugar del icono, rotulo como referencia bajo el titulo
    card_re = re.compile(
        r'<div class="flex items-center justify-between mb-5">\s*<div class="w-11 h-11 rounded-2xl[^"]*">\s*<span class="material-icons[^"]*">\w+</span>\s*</div>\s*'
        r'<span class="[^"]*">\s*(?P<label>.*?)\s*</span>\s*</div>\s*(?P<h3><h3\b.*?</h3>)(?P<rest>.*?href="(?P<href>[a-z0-9-]+)")', re.S)

    def card(m):
        cover = HOME_GUIDE_COVERS.get(m.group("href"))
        if not cover:
            return m.group(0)
        return (f'<figure class="cl-card-cover">{cover_img(cover)}</figure>\n                        '
                f'{m.group("h3")}\n                        <p class="cl-meta">{m.group("label")}</p>{m.group("rest")}')

    s, n = card_re.subn(card, s)
    return s, n


def main():
    for path in sorted(ROOT.glob("*.html")):
        if path.name in ("_template.html", "home-v2.html"):
            continue
        src, crlf = read(path)
        out, n = guide_hero(path.name, src)
        if path.name == "blog.html":
            out = rebuild_blog(out)
            n = "blog"
        if path.name == "index.html":
            out, n = rebuild_home(out)
            n = f"home ({n} tarjetas)"
        out = re.sub(r"(assets/css/polish\.css)\?v=[\d.]+", r"\1?v=1.2.0", out)
        out = re.sub(r"(assets/css/style\.css)\?v=[\d.]+", r"\1?v=3.0.0", out)
        if out != src:
            write(path, out, crlf)
            print(path.name, n)


if __name__ == "__main__":
    main()
