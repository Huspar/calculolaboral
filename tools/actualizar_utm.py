"""Actualiza la UTM del mes en todo el sitio.

Uso:
    python tools/actualizar_utm.py 72151 octubre 2026

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
     <!-- TABLA-IUSC:INICIO/FIN --> y <!-- SUELDOS-IUSC:INICIO/FIN -->, y el mes del título.

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
TOPE_AFP_UF, TOPE_CES_UF = 89.9, 135.1
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


def leer_uf():
    m = re.search(r"UF:\s*([\d.]+)", (ROOT / "js/constants.js").read_text(encoding="utf-8"))
    return float(m.group(1))


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


def tabla_sueldos(utm, uf):
    filas = []
    for s in SUELDOS_EJEMPLO:
        base = min(s, TOPE_AFP_UF * uf)
        afp, salud, ces = rnd(base * AFP_MODELO), rnd(base * 0.07), rnd(min(s, TOPE_CES_UF * uf) * 0.006)
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


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    utm, mes, anio = int(sys.argv[1]), sys.argv[2].lower(), int(sys.argv[3])
    assert 50_000 < utm < 150_000, "UTM fuera de rango"
    assert mes in MESES, f"mes debe ser uno de {MESES}"
    uf = leer_uf()
    mes_txt = f"{mes} de {anio}"
    Mes = mes.capitalize()

    # 1. constants.js
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

    # 2 y 3. páginas
    cambios = 0
    for f in sorted(glob.glob(str(ROOT / "*.html"))):
        t = Path(f).read_text(encoding="utf-8")
        o = t
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
        if Path(f).name == "impuesto-unico-segunda-categoria.html":
            t = reemplazar_bloque(t, "TABLA-IUSC", tabla_tramos(utm))
            t = reemplazar_bloque(t, "SUELDOS-IUSC", tabla_sueldos(utm, uf))
            t = re.sub(r"Impuesto Único 20\d\d: Tabla (?:" + "|".join(m.capitalize() for m in MESES) + r") y Calculadora",
                       f"Impuesto Único {anio}: Tabla {Mes} y Calculadora", t)
            t = re.sub(r'data-utm-base="\d+"', f'data-utm-base="{utm}"', t)
        if t != o:
            Path(f).write_text(t, encoding="utf-8")
            cambios += 1
    print(f"UTM {pesos(utm)} ({mes_txt}) aplicada: constants.js y {cambios} páginas. "
          f"Tramo exento hasta {pesos(13.5 * utm, dec=True)}.")


if __name__ == "__main__":
    main()
