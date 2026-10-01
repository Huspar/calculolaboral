"""Genera las portadas ilustradas de guias y blog (assets/covers/*.svg).

Un solo lenguaje visual para todo el sitio: papel de libro contable en
forest-50, linea de margen ambar, y un motivo dibujado con el mismo trazo
redondeado del isotipo de la balanza (verde bosque #00382E, acentos #FFB703).
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "covers"

FOREST = "#00382E"
AMBER = "#FFB703"
PAPER = "#FFFFFF"
TINT = "#ADD6C9"      # forest-200: sombra desplazada
RULE = "#D6EBE4"      # forest-100: renglones
BG = "#EEF6F3"        # forest-50
SW = 7                # grosor de trazo base


def frame(body, title):
    rules = "".join(f'<line x1="0" y1="{y}" x2="800" y2="{y}"/>' for y in range(54, 450, 36))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-labelledby="t">
<title id="t">{title}</title>
<rect width="800" height="450" fill="{BG}"/>
<g stroke="{RULE}" stroke-width="2">{rules}</g>
<line x1="112" y1="0" x2="112" y2="450" stroke="{AMBER}" stroke-width="2.5" opacity=".55"/>
<g fill="none" stroke="{FOREST}" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round">
{body}
</g>
</svg>
'''


# ------------------------------------------------------------- primitivas

def shadow_rect(x, y, w, h, r=16, d=16):
    return f'<rect x="{x + d}" y="{y + d}" width="{w}" height="{h}" rx="{r}" fill="{TINT}" stroke="none"/>'


def paper(x, y, w, h, r=16, fill=PAPER):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"/>'


def line(x1, y1, x2, y2, w=None, color=None, op=None):
    extra = ""
    if w:
        extra += f' stroke-width="{w}"'
    if color:
        extra += f' stroke="{color}"'
    if op:
        extra += f' opacity="{op}"'
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{extra}/>'


def mark(x, y, w, h=18):
    """Trazo de resaltador ambar (el mismo gesto del titular de la home)."""
    return f'<rect x="{x}" y="{y - h / 2}" width="{w}" height="{h}" rx="4" fill="{AMBER}" stroke="none" opacity=".85"/>'


def text_lines(x, y0, widths, gap=34, w=6, highlight=None):
    out = []
    for i, lw in enumerate(widths):
        y = y0 + i * gap
        if highlight is not None and i == highlight:
            out.append(mark(x - 6, y, lw + 12))
        out.append(line(x, y, x + lw, y, w=w))
    return "".join(out)


def star(cx, cy, r, fill=AMBER):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke-width="4"/>'


def coin_stack(cx, base, n, rx=58, ry=17, h=24):
    out = []
    for i in range(n):
        y = base - i * h
        top = AMBER if i == n - 1 else PAPER
        out.append(f'<path d="M{cx - rx} {y} v{h - 6} a{rx} {ry} 0 0 0 {2 * rx} 0 v-{h - 6}" fill="{PAPER}"/>')
        out.append(f'<ellipse cx="{cx}" cy="{y}" rx="{rx}" ry="{ry}" fill="{top}"/>')
    return "".join(out)


def check(cx, cy, s=1.0, w=7):
    return f'<path d="M{cx - 12 * s} {cy} l{9 * s} {9 * s} l{16 * s} -{18 * s}" stroke-width="{w}"/>'


def cross(cx, cy, s=1.0, w=7):
    d = 11 * s
    return f'<path d="M{cx - d} {cy - d} L{cx + d} {cy + d} M{cx + d} {cy - d} L{cx - d} {cy + d}" stroke-width="{w}"/>'


def magnifier(cx, cy, r, inner=""):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{PAPER}" fill-opacity=".92"/>{inner}'
            f'<circle cx="{cx}" cy="{cy}" r="{r}"/>'
            f'{line(cx + r * 0.7, cy + r * 0.7, cx + r * 1.35, cy + r * 1.35, w=12)}')


def document(x, y, w, h, widths, highlight=None, header=True, signature=False):
    out = [shadow_rect(x, y, w, h), paper(x, y, w, h)]
    lx = x + 32
    y0 = y + 46
    if header:
        out.append(line(lx, y0, lx + w * 0.45, y0, w=10))
        y0 += 46
    out.append(text_lines(lx, y0, widths, highlight=highlight))
    if signature:
        sy = y + h - 40
        out.append(f'<path d="M{lx} {sy} c14 -22 26 -22 30 0 s18 18 30 -6 s16 -12 26 4" stroke-width="5"/>')
    return "".join(out)


# ----------------------------------------------------------------- motivos

def m_datos():
    doc = document(236, 92, 230, 276, [150, 120, 160, 100, 140], highlight=1)
    shield = (f'<path d="M548 132 L632 162 V240 C632 300 596 338 548 360 C500 338 464 300 464 240 V162 Z" fill="{PAPER}"/>'
              f'<rect x="518" y="236" width="60" height="50" rx="9" fill="{AMBER}"/>'
              f'<path d="M530 236 v-16 a18 18 0 0 1 36 0 v16"/>'
              f'<circle cx="548" cy="258" r="5" fill="{FOREST}" stroke="none"/>')
    return doc + shield


def m_cuentas():
    card = (shadow_rect(214, 132, 300, 190, r=24) + paper(214, 132, 300, 190, r=24)
            + line(214, 182, 514, 182, w=16)
            + f'<rect x="248" y="214" width="54" height="40" rx="8" fill="{AMBER}"/>'
            + line(248, 288, 362, 288) + line(382, 288, 450, 288))
    return card + coin_stack(588, 352, 4)


def m_equidad():
    base = line(232, 362, 576, 362)
    bars = [(262, 190, PAPER), (332, 236, PAPER), (430, 176, AMBER), (500, 176, AMBER)]
    out = [base]
    for x, top, fill in bars:
        out.append(f'<rect x="{x}" y="{top}" width="52" height="{362 - top}" rx="10" fill="{fill}"/>')
    out.append(line(428, 132, 554, 132, w=8) + line(428, 152, 554, 152, w=8))
    out.append(line(258, 150, 316, 150, w=6, op=".35") + line(330, 150, 388, 150, w=6, op=".35"))
    return "".join(out)


def m_sala_cuna():
    out = [f'<rect x="246" y="196" width="308" height="126" rx="10" fill="{PAPER}" stroke="none"/>']
    out.append(line(246, 196, 554, 196) + line(246, 322, 554, 322))
    out.append(line(246, 160, 246, 378, w=10) + line(554, 160, 554, 378, w=10))
    for x in range(290, 520, 44):
        out.append(line(x, 196, x, 322, w=6))
    out.append(line(400, 62, 400, 98) + line(326, 98, 474, 98))
    out.append(line(338, 98, 338, 124, w=4) + line(400, 98, 400, 132, w=4) + line(462, 98, 462, 120, w=4))
    out.append(star(338, 142, 20))
    out.append(f'<path d="M412 150 a22 22 0 1 1 -16 -18 a16 16 0 1 0 16 18 Z" fill="{AMBER}" stroke-width="4"/>')
    out.append(f'<circle cx="462" cy="134" r="13" fill="{AMBER}" stroke-width="4"/>')
    return "".join(out)


def m_karin():
    b1 = (shadow_rect(222, 104, 262, 132, r=28) + paper(222, 104, 262, 132, r=28)
          + f'<path d="M268 236 l-10 34 l40 -34" fill="{PAPER}"/>'
          + text_lines(256, 150, [150, 110], gap=38))
    b2 = (shadow_rect(330, 226, 262, 124, r=28) + paper(330, 226, 262, 124, r=28)
          + f'<path d="M546 350 l12 32 l-42 -32" fill="{PAPER}"/>'
          + text_lines(364, 270, [160, 96], gap=38))
    marks = (f'<circle cx="482" cy="112" r="30" fill="{AMBER}"/>' + check(482, 112)
             + f'<circle cx="592" cy="232" r="30" fill="{PAPER}"/>' + cross(592, 232))
    return b1 + b2 + marks


def m_aguinaldo():
    out = [shadow_rect(286, 206, 228, 156, r=12), paper(286, 206, 228, 156, r=12),
           paper(266, 166, 268, 54, r=12),
           f'<rect x="384" y="166" width="32" height="196" fill="{AMBER}" stroke-width="5"/>',
           f'<path d="M400 166 C370 120 330 128 346 154 C356 170 386 168 400 166 Z" fill="{PAPER}"/>',
           f'<path d="M400 166 C430 120 470 128 454 154 C444 170 414 168 400 166 Z" fill="{PAPER}"/>',
           star(584, 118, 30)]
    return "".join(out)


def m_checklist():
    out = [shadow_rect(262, 86, 240, 304, r=18), paper(262, 86, 240, 304, r=18),
           f'<rect x="342" y="66" width="80" height="42" rx="10" fill="{AMBER}"/>']
    for i, y in enumerate((150, 212, 274)):
        out.append(f'<rect x="294" y="{y - 17}" width="34" height="34" rx="7" fill="{PAPER}" stroke-width="5"/>')
        if i < 2:
            out.append(check(311, y, 0.85, 6))
        out.append(line(350, y, 350 + (120 if i != 1 else 96), y, w=6))
    out.append(magnifier(512, 318, 48))
    return "".join(out)


def m_todo_evento():
    canopy = (f'<path d="M232 228 Q400 60 568 228 Q526 200 484 228 Q442 200 400 228 Q358 200 316 228 Q274 200 232 228 Z" fill="{PAPER}"/>'
              f'<path d="M400 228 Q378 120 400 82 Q422 120 400 228" fill="{AMBER}" stroke-width="5"/>')
    handle = f'<path d="M400 228 V344 a20 20 0 0 1 -40 0"/>'
    return canopy + handle + coin_stack(520, 372, 3, rx=46, ry=14, h=22)


def m_fondos():
    out = [line(232, 96, 232, 362), line(232, 362, 572, 362)]
    out.append(f'<path d="M232 136 C330 140 420 220 568 300" stroke-width="7"/>')
    out.append(f'<path d="M232 186 C330 190 420 250 568 318" stroke-width="6" opacity=".55"/>')
    out.append(f'<path d="M232 236 C330 240 420 282 568 336" stroke-width="5" opacity=".3"/>')
    for x, y in ((316, 150), (428, 214)):
        out.append(f'<circle cx="{x}" cy="{y}" r="14" fill="{PAPER}"/>')
    out.append(f'<circle cx="530" cy="276" r="18" fill="{AMBER}"/>')
    return "".join(out)


def m_sueldo_liquido():
    x, y, w, h = 262, 76, 250, 300
    doc = shadow_rect(x, y, w, h) + paper(x, y, w, h) + line(294, 122, 406, 122, w=10)
    gross = line(294, 170, 470, 170, w=6)
    rows = "".join(line(294, ry, 310, ry, w=6) + line(328, ry, 328 + rw, ry, w=6)
                   for ry, rw in ((210, 120), (244, 96), (278, 132)))
    total = mark(288, 330, 194, 26) + line(294, 330, 470, 330, w=9)
    return doc + gross + rows + total + coin_stack(560, 380, 2, rx=44, ry=13, h=20)


def m_vacaciones():
    out = [shadow_rect(254, 112, 288, 256, r=18), paper(254, 112, 288, 256, r=18),
           f'<path d="M254 172 V130 a18 18 0 0 1 18 -18 H524 a18 18 0 0 1 18 18 V172 Z" fill="{FOREST}"/>',
           line(316, 92, 316, 132, w=10) + line(480, 92, 480, 132, w=10)]
    amber_days = {(1, 2), (1, 3), (1, 4), (2, 0), (2, 1)}
    for r in range(3):
        for c in range(5):
            cx, cy = 300 + c * 50, 214 + r * 48
            fill = AMBER if (r, c) in amber_days else PAPER
            out.append(f'<rect x="{cx - 16}" y="{cy - 14}" width="32" height="28" rx="7" fill="{fill}" stroke-width="5"/>')
    rays = "".join(line(592 + 50 * math.cos(a), 112 + 50 * math.sin(a), 592 + 64 * math.cos(a), 112 + 64 * math.sin(a), w=6)
                   for a in [i * math.pi / 4 for i in range(8)])
    out.append(rays + f'<circle cx="592" cy="112" r="34" fill="{AMBER}"/>')
    return "".join(out)


def m_finiquito():
    doc = document(222, 88, 214, 286, [130, 110, 150, 90], highlight=2, signature=True)
    calc = [shadow_rect(424, 148, 156, 226, r=20), paper(424, 148, 156, 226, r=20),
            f'<rect x="446" y="170" width="112" height="44" rx="8" fill="{AMBER}" stroke-width="5"/>']
    for r in range(3):
        for c in range(3):
            calc.append(f'<rect x="{446 + c * 40}" y="{232 + r * 42}" width="30" height="28" rx="6" fill="{PAPER}" stroke-width="5"/>')
    return doc + "".join(calc)


def m_liquidacion():
    doc = document(234, 74, 250, 304, [170, 120, 150, 100, 160])
    lens_inner = mark(452, 262, 120, 22) + line(458, 262, 566, 262, w=8)
    return doc + magnifier(500, 262, 72, lens_inner)


def m_necesidades():
    out = [shadow_rect(246, 110, 186, 260, r=10), paper(246, 110, 186, 260, r=10)]
    for r in range(4):
        for c in range(3):
            out.append(f'<rect x="{272 + c * 50}" y="{138 + r * 48}" width="30" height="28" rx="5" fill="{BG}" stroke-width="5"/>')
    out.append(f'<rect x="318" y="320" width="42" height="50" rx="4" fill="{AMBER}" stroke-width="5"/>')
    env = (shadow_rect(420, 230, 176, 120, r=12) + paper(420, 230, 176, 120, r=12)
           + f'<path d="M420 242 L508 300 L596 242" stroke-width="6"/>'
           + f'<circle cx="508" cy="300" r="18" fill="{AMBER}" stroke-width="5"/>')
    return "".join(out) + env


def m_40_horas():
    cx, cy, r = 400, 236, 134
    out = [f'<circle cx="{cx + 14}" cy="{cy + 14}" r="{r}" fill="{TINT}" stroke="none"/>',
           f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{PAPER}"/>']
    a1, a2 = -math.pi / 2, -math.pi / 2 + math.radians(60)
    x1, y1 = cx + (r - 18) * math.cos(a1), cy + (r - 18) * math.sin(a1)
    x2, y2 = cx + (r - 18) * math.cos(a2), cy + (r - 18) * math.sin(a2)
    out.append(f'<path d="M{cx} {cy} L{x1:.1f} {y1:.1f} A{r - 18} {r - 18} 0 0 1 {x2:.1f} {y2:.1f} Z" fill="{AMBER}" stroke="none" opacity=".8"/>')
    for i in range(12):
        a = i * math.pi / 6
        inner = r - (30 if i % 3 == 0 else 20)
        out.append(line(f"{cx + inner * math.cos(a):.1f}", f"{cy + inner * math.sin(a):.1f}",
                        f"{cx + (r - 8) * math.cos(a):.1f}", f"{cy + (r - 8) * math.sin(a):.1f}", w=6 if i % 3 == 0 else 4))
    out.append(line(cx, cy, cx, cy - 78, w=10) + line(cx, cy, cx + 58, cy + 34, w=8))
    out.append(f'<circle cx="{cx}" cy="{cy}" r="10" fill="{FOREST}"/>')
    return "".join(out)


def m_cesantia():
    cx, cy = 400, 222
    out = [f'<circle cx="{cx + 14}" cy="{cy + 14}" r="128" fill="{TINT}" stroke="none"/>',
           f'<circle cx="{cx}" cy="{cy}" r="128" fill="{PAPER}"/>',
           f'<circle cx="{cx}" cy="{cy}" r="58" fill="{BG}"/>']
    for k in range(4):
        a0 = math.radians(-20 + k * 90)
        a1 = math.radians(20 + k * 90)
        rm = 93
        out.append(f'<path d="M{cx + rm * math.cos(a0):.1f} {cy + rm * math.sin(a0):.1f} A{rm} {rm} 0 0 1 {cx + rm * math.cos(a1):.1f} {cy + rm * math.sin(a1):.1f}" stroke="{AMBER}" stroke-width="58" stroke-linecap="butt"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="128"/><circle cx="{cx}" cy="{cy}" r="58"/>')
    out.append('<path d="M214 392 q24 -18 48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0" stroke-width="6" opacity=".6"/>')
    return "".join(out)


def m_no_pagan():
    doc = document(214, 150, 150, 196, [80, 96, 64], header=False)
    glass = (f'<path d="M340 92 C340 188 396 206 396 236 C396 266 340 284 340 380 H476 C476 284 420 266 420 236 C420 206 476 188 476 92 Z" fill="{PAPER}"/>'
             f'<path d="M368 140 H448 C440 176 418 196 408 210 C398 196 376 176 368 140 Z" fill="{AMBER}" stroke-width="4"/>'
             f'<path d="M352 372 C362 330 390 318 408 316 C426 318 454 330 464 372 Z" fill="{AMBER}" stroke-width="4"/>'
             + line(316, 92, 500, 92, w=12) + line(316, 380, 500, 380, w=12)
             + line(408, 236, 408, 300, w=4, op=".7"))
    return doc + glass


def m_reclamar():
    base = line(350, 384, 450, 384, w=10) + line(372, 366, 428, 366)
    pillar = line(400, 112, 400, 366)
    beam = '<path d="M262 160 C300 128 350 120 400 120 S500 128 538 160"/>'
    pans = ""
    for px, fill in ((262, PAPER), (538, AMBER)):
        pans += (f'<path d="M{px} 160 L{px - 40} 250 H{px + 40} Z" stroke-width="4" opacity=".7"/>'
                 f'<path d="M{px - 52} 250 c0 18 22 30 52 30 s52 -12 52 -30 Z" fill="{fill}"/>')
    tip = f'<circle cx="400" cy="104" r="12" fill="{AMBER}"/>'
    gavel = (f'<g transform="rotate(-35 590 330)"><rect x="548" y="300" width="84" height="40" rx="10" fill="{PAPER}"/>'
             f'{line(590, 340, 590, 410, w=12)}</g>')
    return base + pillar + beam + pans + tip + gavel


def m_renuncia():
    door = (shadow_rect(270, 86, 190, 296, r=10) + paper(270, 86, 190, 296, r=10)
            + f'<path d="M300 116 H430 V382" stroke-width="5" opacity=".35"/>'
            + f'<circle cx="430" cy="244" r="12" fill="{AMBER}"/>')
    arrow = f'<path d="M478 244 H592 M560 212 L594 244 L560 276" stroke-width="10"/>'
    note = (f'<rect x="196" y="250" width="120" height="150" rx="10" fill="{PAPER}"/>'
            + text_lines(220, 290, [72, 54, 64], gap=30, w=5, highlight=0))
    return door + arrow + note


def m_carta_despido():
    letter = paper(276, 92, 248, 170, r=10) + text_lines(306, 132, [150, 120, 170], gap=34, highlight=1)
    env = (shadow_rect(236, 186, 328, 196, r=14)
           + f'<path d="M236 200 a14 14 0 0 1 14 -14 H550 a14 14 0 0 1 14 14 V368 a14 14 0 0 1 -14 14 H250 a14 14 0 0 1 -14 -14 Z" fill="{PAPER}"/>'
           + '<path d="M236 200 L400 296 L564 200" stroke-width="6"/>'
           + '<path d="M236 382 L360 280 M564 382 L440 280" stroke-width="5" opacity=".4"/>'
           + f'<circle cx="400" cy="296" r="22" fill="{AMBER}" stroke-width="5"/>')
    return letter + env


COVERS = {
    "ley-21719-datos-personales": (m_datos, "Escudo de protección sobre un documento con datos personales"),
    "cuentas-sueldo": (m_cuentas, "Tarjeta bancaria y monedas"),
    "equidad-salarial": (m_equidad, "Gráfico de barras que compara remuneraciones"),
    "sala-cuna": (m_sala_cuna, "Cuna con móvil de estrellas"),
    "ley-karin": (m_karin, "Dos globos de conversación, uno aceptado y otro descartado"),
    "aguinaldo": (m_aguinaldo, "Regalo con cinta y estrella de Fiestas Patrias"),
    "fiscalizacion-dt": (m_checklist, "Lista de verificación con lupa"),
    "indemnizacion-todo-evento": (m_todo_evento, "Paraguas que protege monedas"),
    "fondos-afp": (m_fondos, "Curvas de los fondos generacionales según la edad"),
    "sueldo-liquido": (m_sueldo_liquido, "Liquidación de sueldo con descuentos y total resaltado"),
    "vacaciones": (m_vacaciones, "Calendario con días de vacaciones marcados y sol"),
    "finiquito": (m_finiquito, "Documento de finiquito firmado junto a una calculadora"),
    "liquidacion": (m_liquidacion, "Liquidación de sueldo revisada con lupa"),
    "despido-161": (m_necesidades, "Edificio de empresa y carta de despido sellada"),
    "ley-40-horas": (m_40_horas, "Reloj con la reducción de jornada resaltada"),
    "seguro-cesantia": (m_cesantia, "Salvavidas sobre olas"),
    "finiquito-no-pagado": (m_no_pagan, "Reloj de arena junto a un documento pendiente"),
    "reclamar-despido": (m_reclamar, "Balanza de la justicia y mazo"),
    "renuncia-voluntaria": (m_renuncia, "Puerta de salida con carta de renuncia"),
    "carta-despido": (m_carta_despido, "Carta de despido dentro de un sobre sellado"),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (fn, title) in COVERS.items():
        (OUT / f"{name}.svg").write_text(frame(fn(), title), encoding="utf-8")
    print(f"{len(COVERS)} portadas en {OUT}")


if __name__ == "__main__":
    main()
