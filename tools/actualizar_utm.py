"""Actualiza la UTM del mes en todo el sitio.

Uso:
    python tools/actualizar_utm.py 72151 octubre 2026
    python tools/actualizar_utm.py 72151 octubre 2026 --solo impuesto-unico-segunda-categoria.html

Con --solo se actualiza únicamente esa página (no toca js/ ni el resto del sitio).

Qué cambia:
  1. js/constants.js: UTM y la tabla estática del impuesto único (TAX_BRACKETS).
  2. Todas las páginas: el valor de respaldo de la UTM en la barra superior (.utm-value).
  3. Montos marcados en el HTML:
       data-utm-x="13.5"     -> el $monto del elemento pasa a 13,5 x UTM
       data-utm-x="1 2"      -> varios $montos en orden: 1 x UTM y 2 x UTM
       data-iusc="1781120"   -> impuesto único de esa renta tributable (con signo menos si ya lo tenía)
       data-iusc-neto="N"    -> renta tributable menos su impuesto (sueldo líquido sin no imponibles)
       data-utm-mes          -> el texto pasa a "<mes> de <año>"
       data-iu-bruto-exento  -> sueldo bruto desde el que se paga impuesto (AFP Modelo, Fonasa)
       data-l2b="N tipo"     -> sueldo base para recibir N líquido (gratificación none o legal_tope; usa node)
  4. impuesto-unico-segunda-categoria.html: las tablas entre los marcadores
     <!-- TABLA-IUSC:INICIO/FIN --> y <!-- SUELDOS-IUSC:INICIO/FIN -->, el mes del título y el
     texto del JSON-LD "13,5 UTM ($monto en <mes> de <año>)".

La UF y los topes imponibles (TOPE_IMPONIBLE_AFP y TOPE_IMPONIBLE_CESANTIA, en UF) se leen
de js/constants.js, igual que la calculadora de la página.

Fuente de la UTM: tabla mensual del SII (sii.cl/valores_y_fechas/utm/). El impuesto se
calcula con los tramos del artículo 43 de la Ley de la Renta, expresados en UTM.
"""
import glob
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
# (desde UTM, hasta UTM, factor, rebaja UTM)
TRAMOS = [(0, 13.5, 0, 0), (13.5, 30, .04, .54), (30, 50, .08, 1.74), (50, 70, .135, 4.49),
          (70, 90, .23, 11.14), (90, 120, .304, 17.8), (120, 310, .35, 23.32), (310, None, .40, 38.82)]
AFP_MODELO = 0.1058
SUELDOS_EJEMPLO = [1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000, 7_000_000]


def rnd(x):
    return int(x + 0.5)


def pesos(n, dec=False):
    if dec:
        ent, frac = f"{n:.2f}".split(".")
        return "$" + f"{int(ent):,}".replace(",", ".") + "," + frac
    return "$" + f"{rnd(n):,}".replace(",", ".")


def pct(x):
    return f"{x * 100:.2f}".rstrip("0").rstrip(".").replace(".", ",") + "%"


def impuesto(rli, utm):
    for lo, hi, f, r in TRAMOS:
        if hi is None or rli <= hi * utm:
            return max(0, rli * f - r * utm)
    return 0


def tramo_de(rli, utm):
    for i, (lo, hi, f, r) in enumerate(TRAMOS):
        if hi is None or rli <= hi * utm:
            return i
    return len(TRAMOS) - 1


def liquido_a_bruto(neto, gratificacion):
    """Sueldo base para un líquido dado, con el motor del sitio (js/salary_logic.js) y la UTM ya aplicada."""
    js = (
        "global.CONSTANTS=require('./js/constants.js');"
        "const {ForensicSalaryCalculator:F}=require('./js/salary_logic.js');"
        f"process.stdout.write(String(F.solveBaseForNet({{afpName:'Modelo',healthSystem:'fonasa',"
        f"contractType:'indefinido',gratificationType:'{gratificacion}'}},{neto})));"
    )
    return int(subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def leer_constante(nombre):
    """Valor numérico de CONSTANTS.<nombre> en js/constants.js."""
    m = re.search(rf"\b{nombre}:\s*([\d.]+)", (ROOT / "js/constants.js").read_text(encoding="utf-8"))
    assert m, f"{nombre} no encontrado en js/constants.js"
    return float(m.group(1))


def leer_uf():
    return leer_constante("UF")


def leer_topes():
    """Topes imponibles en UF: (AFP y salud, seguro de cesantía)."""
    return leer_constante("TOPE_IMPONIBLE_AFP"), leer_constante("TOPE_IMPONIBLE_CESANTIA")


def tabla_tramos(utm):
    filas = []
    for i, (lo, hi, f, r) in enumerate(TRAMOS):
        desde = "—" if lo == 0 else pesos(lo * utm + 0.01, dec=True)
        hasta = pesos(hi * utm, dec=True) if hi else "y más"
        efectiva = "Exento" if f == 0 else (pct((hi * f - r) / hi) if hi else "Más de " + pct((310 * .35 - 23.32) / 310))
        cls = ' class="iu-row-exento"' if f == 0 else ""
        filas.append(
            f'                            <tr{cls}>'
            f'<td>{desde}</td><td>{hasta}</td><td>{"Exento" if f == 0 else pct(f)}</td>'
            f'<td>{"—" if r == 0 else pesos(r * utm, dec=True)}</td><td>{efectiva}</td></tr>'
        )
    return "\n".join(filas)


def tabla_sueldos(utm, uf, topes=None):
    tope_afp_uf, tope_ces_uf = topes or leer_topes()
    filas = []
    for s in SUELDOS_EJEMPLO:
        base = min(s, tope_afp_uf * uf)
        afp, salud, ces = rnd(base * AFP_MODELO), rnd(base * 0.07), rnd(min(s, tope_ces_uf * uf) * 0.006)
        rli = s - afp - salud - ces
        imp = rnd(impuesto(rli, utm))
        tasa = imp / s
        filas.append(
            f"                            <tr><td>{pesos(s)}</td><td>{pesos(rli)}</td>"
            f"<td><strong>{pesos(imp)}</strong></td><td>{pct(tasa) if imp else '0%'}</td>"
            f"<td>{pesos(rli - imp)}</td></tr>"
        )
    return "\n".join(filas)


def reemplazar_bloque(texto, marca, contenido):
    patron = re.compile(rf"(<!-- {marca}:INICIO -->).*?\n([ \t]*<!-- {marca}:FIN -->)", re.S)
    nuevo, n = patron.subn(lambda m: m.group(1) + "\n" + contenido + "\n" + m.group(2), texto)
    assert n == 1, f"marcador {marca} no encontrado"
    return nuevo


def actualizar_js(utm, mes, anio):
    """1. js/constants.js (UTM y TAX_BRACKETS) y los respaldos de UTM en otros JS."""
    Mes = mes.capitalize()
    p = ROOT / "js/constants.js"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"UTM: \d+,", f"UTM: {utm},", s, count=1)
    brackets = []
    for lo, hi, f, r in TRAMOS:
        lim = f"{hi * utm:.2f}" if hi else "Infinity"
        brackets.append(f"        {{ limit: {lim}, factor: {f}, rebate: {r * utm:.2f} }}")
    s = re.sub(r"// Income Tax Brackets[^\n]*\n    TAX_BRACKETS: \[\n.*?\n    \],",
               f"// Income Tax Brackets (Impuesto Segunda Categoría) - {Mes} {anio} (Base UTM {pesos(utm)})\n"
               f"    TAX_BRACKETS: [\n" + ",\n".join(brackets) + "\n    ],", s, count=1, flags=re.S)
    p.write_text(s, encoding="utf-8")

    # respaldos en JS: historial de indicators.js y valor por defecto de costo empresa
    p = ROOT / "js/indicators.js"
    s = p.read_text(encoding="utf-8")
    fecha = f"{anio}-{MESES.index(mes) + 1:02d}-01"
    if f'"fecha": "{fecha}"' not in s.split("utm: [", 1)[1][:200]:
        s = s.replace("utm: [\n", f'utm: [\n            {{"fecha": "{fecha}", "valor": {utm}.0}},\n', 1)
        p.write_text(s, encoding="utf-8")
    p = ROOT / "js/costo_empresa_calculator.js"
    s = p.read_text(encoding="utf-8")
    p.write_text(re.sub(r"CONSTANTS\.UTM : \d+;", f"CONSTANTS.UTM : {utm};", s), encoding="utf-8")


def actualizar_pagina(t, nombre, utm, mes, anio, uf, topes=None):
    """Aplica la UTM a un HTML (texto) y devuelve el texto nuevo. No escribe archivos."""
    mes_txt = f"{mes} de {anio}"
    Mes = mes.capitalize()
    t = re.sub(r'(class="utm-value[^"]*">)\$[\d.]+(<)', rf"\g<1>{pesos(utm)}\2", t)

    def by_x(m):
        factores = iter(float(x) for x in m.group(3).split())
        inner = re.sub(r"\$[\d.]+", lambda _: pesos(next(factores, 0) * utm), m.group(4))
        return m.group(1) + inner + m.group(5)
    t = re.sub(r'(<(\w+)[^>]*\bdata-utm-x="([\d. ]+)"[^>]*>)(.*?)(</\2>)', by_x, t, flags=re.S)

    def by_iusc(m):
        imp = pesos(impuesto(float(m.group(3)), utm))
        return m.group(1) + re.sub(r"\$[\d.]+", imp, m.group(4), count=1) + m.group(5)
    t = re.sub(r'(<(\w+)[^>]*\bdata-iusc="([\d.]+)"[^>]*>)(.*?)(</\2>)', by_iusc, t, flags=re.S)

    def by_neto(m):
        rli = float(m.group(3))
        neto = pesos(rli - rnd(impuesto(rli, utm)))
        return m.group(1) + re.sub(r"\$[\d.]+", neto, m.group(4), count=1) + m.group(5)
    t = re.sub(r'(<(\w+)[^>]*\bdata-iusc-neto="([\d.]+)"[^>]*>)(.*?)(</\2>)', by_neto, t, flags=re.S)
    t = re.sub(r'(<(\w+)[^>]*\bdata-utm-mes\b[^>]*>).*?(</\2>)', rf"\g<1>{mes_txt}\3", t, flags=re.S)
    # sueldo bruto desde el que se paga impuesto (AFP Modelo, Fonasa, indefinido), redondeado a miles
    bruto_exento = pesos(round(13.5 * utm / (1 - AFP_MODELO - 0.07 - 0.006), -3))
    t = re.sub(r'(<(\w+)[^>]*\bdata-iu-bruto-exento\b[^>]*>)\$[\d.]+(</\2>)', rf"\g<1>{bruto_exento}\3", t)

    if 'data-l2b="' in t:
        t = re.sub(r'(<(\w+)[^>]*\bdata-l2b="(\d+) (\w+)"[^>]*>)\$[\d.]+(</\2>)',
                   lambda m: m.group(1) + pesos(liquido_a_bruto(int(m.group(3)), m.group(4))) + m.group(5), t)
    if nombre == "impuesto-unico-segunda-categoria.html":
        t = reemplazar_bloque(t, "TABLA-IUSC", tabla_tramos(utm))
        t = reemplazar_bloque(t, "SUELDOS-IUSC", tabla_sueldos(utm, uf, topes))
        t = re.sub(r"Impuesto Único 20\d\d: Tabla (?:" + "|".join(m.capitalize() for m in MESES) + r") y Calculadora",
                   f"Impuesto Único {anio}: Tabla {Mes} y Calculadora", t)
        t = re.sub(r'data-utm-base="\d+"', f'data-utm-base="{utm}"', t)
        t = re.sub(r"13,5 UTM \(\$[\d.]+ en [a-záéíóú]+ de \d{4}\)", f"13,5 UTM ({pesos(13.5 * utm)} en {mes_txt})", t)
        t = re.sub(r"(eso es un sueldo bruto de unos )\$[\d.]+(\.\")", rf"\g<1>{bruto_exento}\2", t)
    return t


def main():
    args = sys.argv[1:]
    solo = None
    if "--solo" in args:
        i = args.index("--solo")
        assert i + 1 < len(args), "--solo requiere el nombre de una página"
        solo = args[i + 1]
        del args[i:i + 2]
    if len(args) != 3:
        sys.exit(__doc__)
    utm, mes, anio = int(args[0]), args[1].lower(), int(args[2])
    assert 50_000 < utm < 150_000, "UTM fuera de rango"
    assert mes in MESES, f"mes debe ser uno de {MESES}"
    uf = leer_uf()
    mes_txt = f"{mes} de {anio}"

    if solo:
        archivos = [str(ROOT / solo)]
        assert Path(archivos[0]).is_file(), f"no existe {solo}"
    else:
        archivos = sorted(glob.glob(str(ROOT / "*.html")))
        actualizar_js(utm, mes, anio)

    # 2 y 3. páginas
    cambios = 0
    for f in archivos:
        t = Path(f).read_text(encoding="utf-8")
        o = t
        t = actualizar_pagina(t, Path(f).name, utm, mes, anio, uf)
        if t != o:
            Path(f).write_text(t, encoding="utf-8")
            cambios += 1
    print(f"UTM {pesos(utm)} ({mes_txt}) aplicada: {'solo ' + solo if solo else 'constants.js y'} {cambios} página(s). "
          f"Tramo exento hasta {pesos(13.5 * utm, dec=True)}.")


if __name__ == "__main__":
    main()
