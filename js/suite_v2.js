/* Suite Contadores v2 — Arquitectura Dual + Workbench 70/30 conectada a motores reales
 * Motores conectados (sin modificar lógica legal):
 *   - CLContadoresF29 (js/contadores_f29.js): lectura RCV SII y determinación F29
 *   - CLLiquidacionEngine + CLLiquidacionParametros: cálculo legal liquidaciones y costo empleador
 *   - CLPrevired (js/previred_generador.js): generación y validación archivo Previred 105 campos
 *   - CLLre (js/lre_generador.js + lre_tablas.js): generación LRE Mi DT 147 columnas ANSI
 */
(() => {
  'use strict';

  const PERIODS = [
    { label: 'Septiembre 2026', iso: '2026-09' },
    { label: 'Octubre 2026', iso: '2026-10' },
    { label: 'Noviembre 2026', iso: '2026-11' },
    { label: 'Diciembre 2026', iso: '2026-12' }
  ];

  // Helper Módulo 11 para garantizar RUTs válidos en datos de ejemplo
  function rutConDv(cuerpoNum) {
    const s = String(cuerpoNum);
    let suma = 0, mult = 2;
    for (let i = s.length - 1; i >= 0; i--) {
      suma += Number(s[i]) * mult;
      mult = mult === 7 ? 2 : mult + 1;
    }
    const r = 11 - (suma % 11);
    const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r);
    return Number(s).toLocaleString('es-CL') + '-' + dv;
  }

  function valoresMesActual(iso) {
    const P = window.CLLiquidacionParametros;
    const vig = (P && P.vigenciaDe && P.vigenciaDe(iso)) || {
      imm: 539000, topeAfpUF: 90, topeAfcUF: 135.2, jornadaMaxima: 42,
      afp: { Capital: 0.1144, Cuprum: 0.1144, Habitat: 0.1127, Modelo: 0.1058, Planvital: 0.1116, Provida: 0.1145, Uno: 0.1046 },
      empleador: { afp: 0.001, seguroSocial: 0.0161, sis: 0.0179 }
    };
    const resp = (P && P.RESPALDO && (P.RESPALDO[iso] || P.RESPALDO['2026-09'])) || { uf: 39741.89, utm: 69542 };
    return Object.assign({}, vig, { uf: resp.uf, utm: resp.utm });
  }

  function calcularWorkerReal(w, iso) {
    const E = window.CLLiquidacionEngine;
    const tipo = w.tipoRegimen || 'dependiente';
    const mesVals = valoresMesActual(iso);

    if (!E) {
      return {
        imponible: w.base + 180000,
        liquido: Math.round((w.base + 180000) * 0.81),
        impUnico: 0,
        costoEmpleador: Math.round((w.base + 180000) * 0.068),
        detalle: null
      };
    }

    // 1) Socio con Sueldo Empresarial (Art. 31 N°6 LIR): sin aportes patronales ni cotizaciones obligatorias; tributa IUSC (F29 Cód. 48)
    if (tipo === 'socio') {
      const sueldo = Math.max(0, Number(w.base) || 0);
      const imp = E.impuestoUnico(sueldo, mesVals.utm);
      const liquido = Math.max(0, sueldo - imp.monto);
      const res = {
        haberesImponibles: [{ concepto: 'Sueldo empresarial (LRE 2161)', monto: sueldo }],
        descuentosLegales: [{ concepto: 'Impuesto único (F29 Cód. 48)', monto: imp.monto }],
        totalImponible: sueldo,
        totalHaberes: sueldo,
        totalDescuentos: imp.monto,
        liquido,
        montos: { afp: 0, salud: 0, afc: 0, impuesto: imp.monto, apv: 0, creditoCCAF: 0 },
        empleador: { lineas: [], total: 0, costoTotal: sueldo }
      };
      return { imponible: sueldo, liquido, impUnico: imp.monto, costoEmpleador: 0, detalle: res };
    }

    const datos = {
      periodo: iso,
      trabajador: {
        nombre: w.name,
        rut: w.rut,
        sueldoBase: w.base,
        afp: w.afp,
        salud: 'fonasa',
        contrato: 'indefinido',
        jornadaHoras: 42,
        fechaIngreso: w.ingreso || '2023-03-01'
      },
      mes: { diasTrabajados: 30, gratificacion: 'legal' }
    };
    const res = E.calcular(datos, mesVals);

    // 2) Trabajador Pensionado por Vejez (Arts. 16, 69 y 85 D.L. 3.500; Ley 19.728; Ley 21.735)
    if (tipo === 'pensionado') {
      const imponible = res.totalImponible || 0;
      const tope90 = Math.round(90.0 * mesVals.uf);
      const pensionMensual = Math.max(0, Number(w.pensionMensual) || 0);
      const tasaAfp = (mesVals.afp && mesVals.afp[w.afp]) || 0.1127;
      const afp = w.cotizaAfpVoluntaria ? Math.round(Math.min(imponible, tope90) * tasaAfp) : 0;
      const topeSaludEfectivo = Math.max(0, tope90 - pensionMensual);
      const baseSalud = Math.min(imponible, topeSaludEfectivo);
      const salud = Math.round(baseSalud * 0.07);
      const baseTrib = Math.max(0, imponible - afp - salud);
      const imp = E.impuestoUnico(baseTrib, mesVals.utm);
      // Mutual Ley 16.744 (0,90%) + SANNA (0,03%) = 0,93% sobre imponible tope 90 UF; AFC, SIS y Ley 21.735 = $0
      const mutual = Math.round(Math.min(imponible, tope90) * 0.0093);
      const totalDesc = afp + salud + imp.monto;
      const liquido = Math.max(0, imponible - totalDesc);
      const descLegales = [];
      if (afp > 0) descLegales.push({ concepto: `AFP ${w.afp} (voluntaria)`, monto: afp });
      descLegales.push({ concepto: 'Salud Fonasa 7% (tope 90 UF − pensión)', monto: salud });
      descLegales.push({ concepto: 'Impuesto único', monto: imp.monto });
      const emp = {
        lineas: [{ clave: 'mutual', concepto: 'Mutual + SANNA (0,93%)', monto: mutual }],
        total: mutual,
        costoTotal: imponible + mutual
      };
      const det = {
        haberesImponibles: res.haberesImponibles || [],
        descuentosLegales: descLegales,
        totalImponible: imponible,
        totalHaberes: imponible,
        totalDescuentos: totalDesc,
        liquido,
        bases: { baseAfp: Math.min(imponible, tope90), baseSalud, baseAfc: 0 },
        montos: { afp, salud, afc: 0, impuesto: imp.monto, apv: 0, creditoCCAF: 0 },
        empleador: emp
      };
      return { imponible, liquido, impUnico: imp.monto, costoEmpleador: mutual, detalle: det };
    }

    // 3) Dependiente estándar
    const emp = E.aportesEmpleador(res, datos, mesVals);
    res.empleador = emp;
    const impUnicoLine = (res.descuentosLegales || []).find((l) => /impuesto/i.test(l.concepto));
    return {
      imponible: res.totalImponible || 0,
      liquido: res.liquido || 0,
      impUnico: impUnicoLine ? impUnicoLine.monto : 0,
      costoEmpleador: emp ? emp.total : 0,
      detalle: res
    };
  }

  function generarPreviredReal(c, iso) {
    if (!window.CLPrevired || !c.workers.length) return null;
    const elegibles = c.workers.filter((w) => (w.tipoRegimen || 'dependiente') !== 'socio');
    const excluidosSocio = c.workers.length - elegibles.length;
    if (!elegibles.length) {
      return { salida: { texto: '', filas: [], errores: [] }, totales: { afp: 0, sis: 0, salud: 0, mutual: 0, afcTrabajador: 0, afcEmpleador: 0, total: 0, lineas: 0 }, excluidosSocio };
    }
    const resultados = elegibles.map((w) => {
      const calc = calcularWorkerReal(w, iso);
      const tipo = w.tipoRegimen || 'dependiente';
      return {
        record: {
          rut: w.rut,
          nombre: w.name,
          sexo: w.sexo || 'F',
          nacionalidad: '0',
          tipoTrabajador: tipo === 'pensionado' ? (w.cotizaAfpVoluntaria ? '1' : '2') : '0',
          afp: (tipo === 'pensionado' && !w.cotizaAfpVoluntaria) ? '00' : w.afp,
          salud: 'fonasa',
          dias: 30,
          jornada: 42,
          contrato: 'indefinido',
          movimiento: '0'
        },
        detalle: calc.detalle
      };
    });
    const salida = window.CLPrevired.desdeLiquidaciones(resultados, { periodo: iso, mutual: 'ACHS', ccaf: '' });
    const totales = salida && salida.filas ? window.CLPrevired.totales(salida.filas) : null;
    return { salida, totales, excluidosSocio };
  }

  function generarLreReal(c, iso) {
    if (!window.CLLre || !c.workers.length) return null;
    const trabajadores = c.workers.map((w) => {
      const calc = calcularWorkerReal(w, iso);
      const tipo = w.tipoRegimen || 'dependiente';
      const d = calc.detalle || {};
      const findDesc = (re) => {
        const l = (d.descuentosLegales || []).find((x) => re.test(x.concepto));
        return l ? l.monto : 0;
      };
      const findEmp = (k) => {
        const l = ((d.empleador && d.empleador.lineas) || []).find((x) => x.clave === k);
        return l ? l.monto : 0;
      };
      const gratLine = (d.haberesImponibles || []).find((x) => /gratific/i.test(x.concepto));
      return {
        rut: w.rut,
        nombre: w.name,
        fechaIngreso: w.ingreso || '2023-03-01',
        afp: w.afp,
        salud: 'fonasa',
        jornadaHoras: 42,
        dias: 30,
        pension: tipo === 'pensionado' ? 'vejez' : '',
        v: {
          '2101': tipo === 'socio' ? 0 : w.base,
          '2105': tipo === 'socio' ? 0 : (gratLine ? gratLine.monto : 0),
          '2161': tipo === 'socio' ? w.base : 0,
          '3110': findDesc(/^afp/i),
          '3141': findDesc(/^salud/i),
          '3151': findDesc(/cesant/i),
          '3161': findDesc(/impuesto/i),
          '4110': findEmp('sis'),
          '4161': findEmp('afc'),
          '4155': findEmp('mutual'),
          '5201': calc.imponible,
          '5210': calc.imponible,
          '5301': d.totalHaberes || calc.imponible,
          '5410': d.totalDescuentos || 0,
          '5501': calc.liquido
        }
      };
    });
    return window.CLLre.generar({
      periodo: iso,
      empleador: { rut: c.rut, mutual: 'ACHS', ccaf: '', comuna: 'Santiago' },
      trabajadores
    });
  }

  const INITIAL_CLIENTS = () => ([
    {
      id: 'san-isidro',
      name: 'Panadería San Isidro SpA',
      rut: rutConDv(76543210),
      regime: '14 D3',
      status: 'critico',
      rcv: { state: 'alerta', label: '2 acuses < 48h', pendingAcuses: 2, ventasNeto: 18400000, comprasNeto: 10361579 },
      nomina: { state: 'ok', label: '6 liq · LRE listo', count: 6, previredOk: true, leyBustos: false },
      bancos: { state: 'pendiente', label: '68% match', matched: 34, total: 50 },
      f29: { state: 'revisar', folio: '', postergar: false, debito: 3496000, credito: 1968700, ppm: 24125, retenciones: 727679, history: [1890, 2040, 1760, 2110, 1950, 2280, 2190, 2410, 2080, 2150, 2279, 2279] },
      cierre: 'En revisión',
      workers: [
        { id: 'w1', name: 'Camila Rojas Fuentes', rut: rutConDv(19876543), sexo: 'F', ingreso: '2021-04-01', cargo: 'Jefa de Producción', base: 1450000, afp: 'Habitat', estado: 'Listo' },
        { id: 'w2', name: 'María González Pérez', rut: rutConDv(12345678), sexo: 'F', ingreso: '2020-08-15', cargo: 'Maestra Panadera', base: 1180000, afp: 'Cuprum', estado: 'Listo' },
        { id: 'w3', name: 'Pedro Soto Ramírez', rut: rutConDv(15876543), sexo: 'M', ingreso: '2023-02-01', cargo: 'Repartidor', base: 850000, afp: 'Modelo', estado: 'Sin contrato', sinContrato: true },
        { id: 'w4', name: 'Andrés Muñoz Tapia', rut: rutConDv(16543210), sexo: 'M', ingreso: '2019-06-01', cargo: 'Socio Administrador', base: 2400000, afp: 'Capital', estado: 'Listo', tipoRegimen: 'socio' },
        { id: 'w5', name: 'Valentina Castro León', rut: rutConDv(20111222), sexo: 'F', ingreso: '2024-01-10', cargo: 'Cajera', base: 700000, afp: 'Uno', estado: 'Sin plan Isapre', sinPlanIsapre: true },
        { id: 'w6', name: 'Jorge Vergara Salas', rut: rutConDv(10999888), sexo: 'M', ingreso: '2018-11-01', cargo: 'Encargado Bodega', base: 1050000, afp: 'Provida', estado: 'Listo', tipoRegimen: 'pensionado', pensionMensual: 650000, cotizaAfpVoluntaria: false }
      ],
      bankTx: [
        {
          id: 'b1', date: '24/11', desc: 'Abono Transbank Ventas POS', amount: 1840500, status: 'Por conciliar',
          match: '1 abono → 2 docs (Boletas POS + comisión)',
          confidence: 'Alta',
          account: '11050 · Clientes / Ventas POS',
          rulePattern: 'Transbank',
          checks: [
            { ok: true, label: 'Monto neto POS cuadra al peso (incluye comisión)' },
            { ok: true, label: 'Liquidación dentro de 2 días hábiles' },
            { ok: true, label: 'Glosa "Transbank" reconocida en historial' }
          ],
          docs: [
            { title: 'Boletas electrónicas POS #412–439', sub: 'DTE 39 · Ventas 22–23/11', amount: 1858905 },
            { title: 'Comisión Transbank (1,0% aprox.)', sub: 'Cuenta 43020 · Gastos bancarios', amount: -18405 }
          ]
        },
        {
          id: 'b2', date: '22/11', desc: 'Pago Molinos del Sur S.A.', amount: -945000, status: 'Por conciliar',
          match: 'Factura #88412 ($945.000)',
          confidence: 'Alta',
          account: '21010 · Proveedores nacionales',
          rulePattern: 'Molinos del Sur',
          checks: [
            { ok: true, label: 'Monto exacto ($945.000)' },
            { ok: true, label: '4 días desde emisión en RCV' },
            { ok: true, label: 'Razón social coincide con RUT emisor' }
          ],
          docs: [
            { title: 'Factura afecta #88412 · Molinos del Sur', sub: 'RCV Compras · Neto $794.118 + IVA $150.882', amount: -945000 }
          ]
        },
        {
          id: 'b3', date: '19/11', desc: 'Cargo Supermercado Jumbo', amount: -180000, status: 'Por conciliar',
          match: 'Cód. 761 · Pedir justificación giro',
          confidence: 'Revisar',
          account: '41090 · Gastos por clasificar (Cód. 761)',
          rulePattern: 'Supermercado Jumbo',
          checks: [
            { ok: true, label: 'Monto exacto ($180.000)' },
            { ok: true, label: 'Fecha coincide con compra (19/11)' },
            { ok: false, label: 'Supermercado Cód. 761: verificar relación con el giro' }
          ],
          docs: [
            { title: 'Boleta / Factura #77104 · Supermercado Jumbo', sub: 'RCV Cód. 761 · Requiere respaldo de giro', amount: -180000 }
          ]
        },
        {
          id: 'b4', date: '15/11', desc: 'Pago Previred Octubre', amount: -1482000, status: 'Conciliado',
          match: 'Planilla #904122',
          confidence: 'Alta',
          account: '21035 · Cotizaciones por pagar',
          rulePattern: 'Previred',
          checks: [
            { ok: true, label: 'Monto exacto ($1.482.000)' },
            { ok: true, label: 'Pagado dentro de plazo legal' },
            { ok: true, label: 'Glosa "Previred" coincide con planilla' }
          ],
          docs: [
            { title: 'Planilla PreviRed #904122 (Octubre)', sub: 'AFP + Salud + AFC + Mutual · 6 trabajadores', amount: -1482000 }
          ]
        }
      ]
    },
    {
      id: 'andes-sur',
      name: 'Constructora Andes Sur Ltda.',
      rut: rutConDv(77128450),
      regime: '14 A',
      status: 'critico',
      rcv: { state: 'ok', label: 'RCV cuadrado', pendingAcuses: 0, ventasNeto: 42100000, comprasNeto: 28900000 },
      nomina: { state: 'alerta', label: 'Mora Previred · Ley Bustos', count: 2, previredOk: false, leyBustos: true },
      bancos: { state: 'ok', label: '96% match', matched: 48, total: 50 },
      f29: { state: 'revisar', folio: '', postergar: false, debito: 7999000, credito: 5491000, ppm: 421000, retenciones: 615000, history: [2900, 3120, 3400, 2980, 3650, 3490, 3100, 3890, 3220, 3410, 3544, 3544] },
      cierre: 'Bloqueado · Bustos',
      workers: [
        { id: 'a1', name: 'Carlos Méndez Pino', rut: rutConDv(14221334), sexo: 'M', ingreso: '2020-01-15', cargo: 'Jefe de Obra', base: 2100000, afp: 'Habitat', estado: 'Finiquito abierto' },
        { id: 'a2', name: 'Luis Herrera Soto', rut: rutConDv(15887412), sexo: 'M', ingreso: '2022-05-01', cargo: 'Carpintero', base: 980000, afp: 'Provida', estado: 'Listo' }
      ],
      bankTx: [
        {
          id: 'ab1', date: '23/11', desc: 'Estado de Pago Obra Temuco', amount: 15200000, status: 'Conciliado',
          match: '1 pago → 2 facturas (#1104 y #1108)',
          confidence: 'Alta',
          account: '11050 · Clientes nacionales',
          rulePattern: 'Obra Temuco',
          checks: [
            { ok: true, label: 'Suma de 2 facturas coincide exacto ($15.200.000)' },
            { ok: true, label: '6 días desde emisión de estado de pago' },
            { ok: true, label: 'Referencia de obra en glosa bancaria' }
          ],
          docs: [
            { title: 'Factura afecta #1104 · Avance Obra Temuco', sub: 'DTE 33 · Emitida 17/11', amount: 10400000 },
            { title: 'Factura afecta #1108 · Adicional Hormigón', sub: 'DTE 33 · Emitida 19/11', amount: 4800000 }
          ]
        }
      ]
    },
    {
      id: 'dental-prov',
      name: 'Clínica Dental Providencia SpA',
      rut: rutConDv(76901332),
      regime: '14 D3',
      status: 'esperando',
      rcv: { state: 'ok', label: 'Sin acuses pendientes', pendingAcuses: 0, ventasNeto: 14200000, comprasNeto: 4850000 },
      nomina: { state: 'ok', label: '1 liq · Previred OK', count: 1, previredOk: true, leyBustos: false },
      bancos: { state: 'esperando', label: 'Falta cartola BCI', matched: 0, total: 32 },
      f29: { state: 'listo', folio: '', postergar: false, debito: 0, credito: 0, ppm: 142000, retenciones: 498000, history: [580, 610, 595, 620, 640, 615, 630, 650, 625, 635, 640, 640] },
      cierre: 'Esperando cliente',
      workers: [
        { id: 'd1', name: 'Sofía Larraín Vidal', rut: rutConDv(17445901), sexo: 'F', ingreso: '2021-03-01', cargo: 'Directora Clínica', base: 2900000, afp: 'Cuprum', estado: 'Listo' }
      ],
      bankTx: []
    },
    {
      id: 'ruta-5',
      name: 'Logística Ruta 5 SpA',
      rut: rutConDv(77812094),
      regime: '14 D3',
      status: 'revisar',
      rcv: { state: 'ok', label: 'RCV 100% cuadrado', pendingAcuses: 0, ventasNeto: 29600000, comprasNeto: 18400000 },
      nomina: { state: 'ok', label: '1 liq · LRE listo', count: 1, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '100% match', matched: 64, total: 64 },
      f29: { state: 'listo', folio: '', postergar: false, debito: 5624000, credito: 3496000, ppm: 296000, retenciones: 184000, history: [2200, 2350, 2180, 2410, 2500, 2490, 2610, 2550, 2480, 2590, 2608, 2608] },
      cierre: 'Listo p/ aprobar',
      workers: [
        { id: 'r1', name: 'Mauricio Díaz Vera', rut: rutConDv(13998112), sexo: 'M', ingreso: '2022-07-01', cargo: 'Conductor Clase A4', base: 1250000, afp: 'Habitat', estado: 'Listo' }
      ],
      bankTx: []
    },
    {
      id: 'barrio-italia',
      name: 'Cafetería Barrio Italia EIRL',
      rut: rutConDv(76224819),
      regime: '14 D8',
      status: 'esperando',
      rcv: { state: 'alerta', label: '1 acuse < 24h', pendingAcuses: 1, ventasNeto: 6800000, comprasNeto: 3950000 },
      nomina: { state: 'esperando', label: 'Faltan novedades', count: 1, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '91% match', matched: 21, total: 23 },
      f29: { state: 'revisar', folio: '', postergar: true, debito: 1292000, credito: 750500, ppm: 68000, retenciones: 95000, history: [610, 640, 590, 680, 710, 695, 670, 720, 685, 700, 704, 704] },
      cierre: 'Esperando cliente',
      workers: [
        { id: 'c1', name: 'Javiera Núñez Paz', rut: rutConDv(19442108), sexo: 'F', ingreso: '2024-03-01', cargo: 'Barista', base: 680000, afp: 'Modelo', estado: 'Licencia sin tipo', licenciaSinTipo: true }
      ],
      bankTx: []
    },
    {
      id: 'pacifico',
      name: 'Importadora Pacífico SpA',
      rut: rutConDv(76778102),
      regime: '14 A',
      status: 'cerrado',
      rcv: { state: 'ok', label: 'Cerrado SII', pendingAcuses: 0, ventasNeto: 54000000, comprasNeto: 39200000 },
      nomina: { state: 'ok', label: '1 liq · Pagado', count: 1, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '100% match', matched: 41, total: 41 },
      f29: { state: 'declarado', folio: '84920144', postergar: false, debito: 10260000, credito: 7448000, ppm: 540000, retenciones: 310000, history: [3400, 3550, 3620, 3480, 3710, 3590, 3640, 3700, 3610, 3680, 3662, 3662] },
      cierre: 'Cerrado',
      workers: [
        { id: 'p1', name: 'Rodrigo Castro Araya', rut: rutConDv(12665430), sexo: 'M', ingreso: '2020-02-01', cargo: 'Comercio Exterior', base: 1950000, afp: 'Capital', estado: 'Pagado' }
      ],
      bankTx: []
    }
  ]);

  const INITIAL_INBOX = () => ([
    { id: 'in1', clientId: 'san-isidro', client: 'Panadería San Isidro SpA', title: 'Cartola BancoEstado Noviembre.xlsx', type: 'Cartola bancaria', age: 'Hace 18 min', state: 'Por revisar', actionLabel: 'Abrir en Bancos', targetArea: 'bancos' },
    { id: 'in2', clientId: 'barrio-italia', client: 'Cafetería Barrio Italia EIRL', title: 'Licencia médica Javiera Núñez.pdf', type: 'Novedad nómina', age: 'Hace 1 h', state: 'Por revisar', actionLabel: 'Aplicar en Nómina', targetArea: 'remuneraciones' },
    { id: 'in3', clientId: 'san-isidro', client: 'Panadería San Isidro SpA', title: 'Boleta Jumbo $180.000 (cód. 761)', type: 'Respaldo IVA', age: 'Hace 2 h', state: 'Por revisar', actionLabel: 'Revisar en F29', targetArea: 'impuestos' },
    { id: 'in4', clientId: 'pacifico', client: 'Importadora Pacífico SpA', title: 'Comprobante pago F29 Folio 84920144.pdf', type: 'Tributario', age: 'Ayer', state: 'Resuelto', actionLabel: 'Ver Impuestos', targetArea: 'impuestos' }
  ]);

  const state = {
    level: 'studio',
    studioView: 'hoy',
    olaTab: 'acuses',
    inboxTab: 'pendientes',
    selectedInboxId: 'in1',
    clientId: 'san-isidro',
    clientArea: 'impuestos',
    clientSub: 'f29',
    periodIdx: 2,
    filter: 'todos',
    query: '',
    selectedWorkerId: null,
    selectedBankId: null,
    selectedF29Code: '538',
    selectedRcvId: null,
    workerFilter: 'todos',
    reopenPromptOpen: false,
    reopenError: '',
    bankRules: {},
    supplierRules: {},
    finiquitoCause: '161',
    balanceScope: 'acumulado',
    studioName: 'Asesorías Pérez Ltda.',
    sidebarCollapsed: false,
    selectedIds: new Set(),
    clients: INITIAL_CLIENTS(),
    inbox: INITIAL_INBOX()
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL');
  };
  const currentPeriod = () => PERIODS[state.periodIdx];

  function f29Total(c) {
    const iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
    const ivaPagar = c.f29.postergar ? 0 : iva;
    return ivaPagar + (c.f29.ppm || 0) + (c.f29.retenciones || 0);
  }

  function downloadFile(content, filename, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Uint8Array ? new Blob([content], { type: mime }) : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function toast(msg) {
    const el = $('v2-toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3400);
  }

  function getClient() {
    return state.clients.find((c) => c.id === state.clientId) || state.clients[0];
  }

  function enterClient(clientId, area = 'impuestos', sub = null) {
    state.level = 'client';
    state.clientId = clientId;
    state.clientArea = area;
    const defaultSubs = { resumen: 'estado', impuestos: 'f29', remuneraciones: 'nomina', bancos: 'match', contabilidad: 'balance' };
    state.clientSub = sub || defaultSubs[area];
    const c = getClient();
    state.selectedWorkerId = c.workers[0]?.id || null;
    state.selectedBankId = c.bankTx[0]?.id || null;
    state.selectedIds.clear();
    closeMobileSidebar();
    render();
  }

  function enterStudio(view = 'hoy') {
    state.level = 'studio';
    state.studioView = view;
    state.selectedIds.clear();
    closeMobileSidebar();
    render();
  }

  function closeMobileSidebar() {
    $('v2-sidebar').classList.remove('is-open');
    const bd = $('v2-sidebar-backdrop');
    if (bd) bd.hidden = true;
  }
  function toggleMobileSidebar() {
    const open = $('v2-sidebar').classList.toggle('is-open');
    const bd = $('v2-sidebar-backdrop');
    if (bd) bd.hidden = !open;
  }
  function f29StateLabel(st) {
    if (st === 'pagado') return 'Pagado';
    if (st === 'declarado') return 'Declarado';
    if (st === 'contabilizado') return 'Contabilizado';
    if (st === 'listo') return 'Listo para declarar';
    return 'En revisión';
  }
  function isPeriodClosed(c) {
    if (typeof c.periodClosed === 'boolean') return c.periodClosed;
    return c.f29.state === 'declarado' || c.f29.state === 'pagado';
  }
  function getWorkerMissing(w) {
    const out = [];
    if (w.sinContrato) out.push({ key: 'sinContrato', label: 'Sin contrato', fixLabel: 'Registrar contrato vigente' });
    if (w.sinPlanIsapre) out.push({ key: 'sinPlanIsapre', label: 'Sin plan Isapre', fixLabel: 'Asignar plan Salud (Fonasa 7%)' });
    if (w.licenciaSinTipo) out.push({ key: 'licenciaSinTipo', label: 'Licencia sin tipo', fixLabel: 'Definir tipo de licencia médica' });
    return out;
  }
  function getClientPayrollBlockers(c) {
    return (c.workers || [])
      .map((w) => ({ w, missing: getWorkerMissing(w) }))
      .filter((x) => x.missing.length > 0);
  }

  /* ==================== SIDEBAR + TOPBAR ==================== */
  function renderSidebar() {
    const wsBox = $('v2-ws-box');
    const nav = $('v2-nav');
    const mob = $('v2-mobile-nav');

    if (state.level === 'studio') {
      const pendingInbox = state.inbox.filter((i) => i.state === 'Por revisar').length;
      const urgentCount = state.clients.filter((c) => c.status === 'critico').length;
      wsBox.innerHTML = `
        <div class="v2-ws-title">Espacio Estudio</div>
        <div class="v2-ws-meta">
          <span id="v2-studio-name-ws">${state.studioName}</span>
          <span class="tag tag--in">En línea</span>
        </div>
      `;
      const items = [
        { id: 'hoy', label: 'Hoy · Cierre', count: urgentCount ? `${urgentCount} urg.` : '' },
        { id: 'olas', label: 'Olas del Mes', count: 'Lotes' },
        { id: 'bandeja', label: 'Bandeja', count: pendingInbox || '' },
        { id: 'empresas', label: 'Empresas', count: state.clients.length }
      ];
      nav.innerHTML = `<div class="v2-nav-group-label">Estudio</div>` + items.map((it) => `
        <button type="button" class="v2-nav-btn" data-studio-nav="${it.id}" ${state.studioView === it.id ? 'aria-current="page"' : ''}>
          <span class="v2-nav-left">${it.label}</span>
          ${it.count !== '' ? `<span class="v2-nav-count">${it.count}</span>` : ''}
        </button>
      `).join('');

      mob.innerHTML = items.map((it) => `
        <button type="button" data-studio-nav="${it.id}" ${state.studioView === it.id ? 'aria-current="page"' : ''}>
          <span>${it.label.split(' · ')[0]}</span>
        </button>
      `).join('');
    } else {
      const c = getClient();
      wsBox.innerHTML = `
        <button type="button" class="v2-ws-back" id="btn-back-studio">← Volver al Estudio</button>
        <div class="v2-ws-title">${c.name}</div>
        <div class="v2-ws-meta">
          <span class="mono">${c.rut}</span>
          <span class="tag tag--out">${c.regime}</span>
        </div>
        <button type="button" class="v2-ws-switch" id="btn-switch-client">
          <span>Cambiar empresa</span><span class="mono">⌘K</span>
        </button>
      `;
      const areas = [
        { id: 'resumen', label: 'Resumen y PDF', count: '' },
        { id: 'impuestos', label: 'Impuestos', count: c.rcv.pendingAcuses ? `${c.rcv.pendingAcuses}!` : 'F29' },
        { id: 'remuneraciones', label: 'Remuneraciones', count: c.workers.length },
        { id: 'bancos', label: 'Bancos y Caja', count: c.bancos.total ? `${Math.round((c.bancos.matched / c.bancos.total) * 100)}%` : '0%' },
        { id: 'contabilidad', label: 'Contabilidad', count: '8 Col.' }
      ];
      nav.innerHTML = `<div class="v2-nav-group-label">Operación del cliente</div>` + areas.map((ar) => `
        <button type="button" class="v2-nav-btn" data-client-area="${ar.id}" ${state.clientArea === ar.id ? 'aria-current="page"' : ''}>
          <span class="v2-nav-left">${ar.label}</span>
          ${ar.count !== '' ? `<span class="v2-nav-count">${ar.count}</span>` : ''}
        </button>
      `).join('');

      mob.innerHTML = [
        { id: '_back', label: 'Estudio' },
        { id: 'impuestos', label: 'Impuestos' },
        { id: 'remuneraciones', label: 'Nómina' },
        { id: 'bancos', label: 'Bancos' }
      ].map((ar) => `
        <button type="button" ${ar.id === '_back' ? 'data-back-studio="1"' : `data-client-area="${ar.id}"`} ${state.clientArea === ar.id ? 'aria-current="page"' : ''}>
          <span>${ar.label}</span>
        </button>
      `).join('');
    }
  }

  function renderTopbar() {
    $('v2-period-label').textContent = currentPeriod().label;
    const titleEl = $('v2-page-title');
    const tabsEl = $('v2-subtabs');
    const ctaEl = $('v2-primary-cta');

    if (state.level === 'studio') {
      const titles = { hoy: 'Mesa de Cierre', olas: 'Olas del Mes', bandeja: 'Bandeja', empresas: 'Empresas' };
      titleEl.textContent = titles[state.studioView];
      if (state.studioView === 'olas') {
        const tabs = [
          { id: 'acuses', label: 'Acuses 8 días' },
          { id: 'lre', label: 'LRE y PreviRed' },
          { id: 'f29', label: 'Lote F29' }
        ];
        tabsEl.innerHTML = tabs.map((t) => `<button type="button" class="v2-subtab" role="tab" data-ola-tab="${t.id}" aria-selected="${state.olaTab === t.id}">${t.label}</button>`).join('');
        ctaEl.textContent = state.olaTab === 'acuses' ? 'Aceptar acuses al día' : state.olaTab === 'lre' ? 'Exportar LRE en lote' : 'Aprobar F29 listos';
      } else if (state.studioView === 'bandeja') {
        tabsEl.innerHTML = [
          { id: 'pendientes', label: 'Por revisar' },
          { id: 'resueltos', label: 'Resueltos' }
        ].map((t) => `<button type="button" class="v2-subtab" role="tab" data-inbox-tab="${t.id}" aria-selected="${state.inboxTab === t.id}">${t.label}</button>`).join('');
        ctaEl.textContent = 'Pedir documento';
      } else if (state.studioView === 'empresas') {
        tabsEl.innerHTML = '';
        ctaEl.textContent = '+ Nueva empresa';
      } else {
        tabsEl.innerHTML = '';
        ctaEl.textContent = 'Aprobar F29 listos';
      }
    } else {
      const c = getClient();
      const map = {
        resumen: { title: 'Resumen', cta: 'Emitir Paquete PDF', tabs: [{ id: 'estado', label: 'Cierre del mes' }] },
        impuestos: {
          title: 'Impuestos',
          cta: c.f29.state === 'pagado' ? 'Descargar resumen F29' : c.f29.state === 'declarado' ? 'Registrar pago TGR' : c.f29.state === 'contabilizado' ? 'Declarar F29' : 'Contabilizar F29',
          tabs: [
            { id: 'f29', label: 'Hoja F29' },
            { id: 'rcv', label: 'Compras y Acuses' },
            { id: 'renta', label: `Renta (${c.regime})` }
          ]
        },
        remuneraciones: {
          title: 'Remuneraciones',
          cta: state.clientSub === 'previred' ? 'Descargar LRE 147 CSV' : state.clientSub === 'finiquitos' ? 'Exportar lote CSV' : 'Descargar Previred 105',
          tabs: [
            { id: 'nomina', label: 'Nómina del mes' },
            { id: 'finiquitos', label: 'Finiquitos' },
            { id: 'previred', label: 'Previred y LRE' }
          ]
        },
        bancos: {
          title: 'Bancos',
          cta: 'Auto-conciliar',
          tabs: [
            { id: 'match', label: 'Conciliación' },
            { id: 'cxc', label: 'Por Cobrar / Pagar' }
          ]
        },
        contabilidad: {
          title: 'Contabilidad',
          cta: 'Exportar Balance CSV',
          tabs: [
            { id: 'balance', label: 'Balance 8 Col.' },
            { id: 'diario', label: 'Libro Diario' }
          ]
        }
      };
      const cfg = map[state.clientArea];
      titleEl.textContent = cfg.title;
      ctaEl.textContent = cfg.cta;
      tabsEl.innerHTML = cfg.tabs.map((t) => `<button type="button" class="v2-subtab" role="tab" data-client-sub="${t.id}" aria-selected="${state.clientSub === t.id}">${t.label}</button>`).join('');
    }
  }

  /* ==================== NIVEL 1: ESPACIO ESTUDIO ==================== */
  function studioHoyFiltered() {
    const q = state.query.trim().toLowerCase();
    return state.clients.filter((c) => {
      if (state.filter === 'critico' && c.status !== 'critico') return false;
      if (state.filter === 'esperando' && c.status !== 'esperando') return false;
      if (state.filter === 'revisar' && c.f29.state === 'declarado') return false;
      if (state.filter === 'cerrado' && c.status !== 'cerrado') return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q) || c.regime.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function studioHoyRowsHtml(rows) {
    if (!rows.length) {
      return `<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">Sin empresas que coincidan con el filtro actual.</td></tr>`;
    }
    return rows.map((c) => {
      const rcvTag = c.rcv.state === 'alerta' ? 'tag--danger' : 'tag--in';
      const nomTag = c.nomina.state === 'alerta' ? 'tag--danger' : c.nomina.state === 'esperando' ? 'tag--out' : 'tag--in';
      const bcoTag = c.bancos.state === 'ok' ? 'tag--in' : 'tag--out';
      const cierreTag = c.status === 'cerrado' ? 'tag--in' : c.status === 'critico' ? 'tag--danger' : 'tag--out';
      return `
        <tr>
          <td>
            <button type="button" class="v2-cell-btn" data-open-client="${c.id}" data-open-area="impuestos">
              <span>${c.name}</span>
            </button>
            <span class="v2-cell-sub mono">${c.rut} · ${c.regime}</span>
          </td>
          <td>
            <button type="button" class="v2-cell-btn" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="rcv">
              <span class="tag ${rcvTag}">${c.rcv.label}</span>
            </button>
          </td>
          <td>
            <button type="button" class="v2-cell-btn" data-open-client="${c.id}" data-open-area="remuneraciones">
              <span class="tag ${nomTag}">${c.nomina.label}</span>
            </button>
          </td>
          <td>
            <button type="button" class="v2-cell-btn" data-open-client="${c.id}" data-open-area="bancos">
              <span class="tag ${bcoTag}">${c.bancos.label}</span>
            </button>
          </td>
          <td class="num">
            <button type="button" class="v2-cell-btn mono" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="f29">
              ${fmt(f29Total(c))}
            </button>
          </td>
          <td><span class="tag ${cierreTag}">${c.cierre}</span></td>
        </tr>
      `;
    }).join('');
  }

  function updateStudioHoyRows() {
    const tbody = $('v2-hoy-tbody');
    const tfoot = $('v2-hoy-tfoot');
    if (!tbody || !tfoot) { renderStudioHoy(); return; }
    const rows = studioHoyFiltered();
    const totalF29Cartera = rows.reduce((acc, c) => acc + f29Total(c), 0);
    const cerrados = state.clients.filter((c) => c.status === 'cerrado').length;
    tbody.innerHTML = studioHoyRowsHtml(rows);
    tfoot.innerHTML = `
      <tr>
        <td colspan="4">${rows.length} empresas en vista · ${currentPeriod().label}</td>
        <td class="num">${fmt(totalF29Cartera)}</td>
        <td class="mono">${cerrados}/${state.clients.length} OK</td>
      </tr>
    `;
  }

  function renderStudioHoy() {
    const counts = {
      todos: state.clients.length,
      critico: state.clients.filter((c) => c.status === 'critico').length,
      esperando: state.clients.filter((c) => c.status === 'esperando').length,
      revisar: state.clients.filter((c) => c.f29.state === 'revisar' || c.f29.state === 'listo').length,
      cerrado: state.clients.filter((c) => c.status === 'cerrado').length
    };
    const q = state.query.trim().toLowerCase();
    const rows = state.clients.filter((c) => {
      if (state.filter === 'critico' && c.status !== 'critico') return false;
      if (state.filter === 'esperando' && c.status !== 'esperando') return false;
      if (state.filter === 'revisar' && !(c.f29.state === 'revisar' || c.f29.state === 'listo')) return false;
      if (state.filter === 'cerrado' && c.status !== 'cerrado') return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q) || c.regime.toLowerCase().includes(q))) return false;
      return true;
    });
    const totalF29Cartera = rows.reduce((acc, c) => acc + f29Total(c), 0);

    $('v2-canvas').innerHTML = `
      <div class="v2-legal-strip" role="status">
        <strong>Calendario legal · ${currentPeriod().label}:</strong>
        <button type="button" class="v2-legal-link is-urgent" data-jump-ola="acuses">Acuses 8d (3 por vencer)</button>
        <span>·</span>
        <button type="button" class="v2-legal-link" data-jump-ola="previred">PreviRed día 13 (5/6 al día)</button>
        <span>·</span>
        <button type="button" class="v2-legal-link" data-jump-ola="previred">LRE día 15 (4/6)</button>
        <span>·</span>
        <button type="button" class="v2-legal-link" data-jump-ola="f29">F29 día 20 (${counts.cerrado}/${counts.todos} cerrados)</button>
      </div>
      <div class="v2-pulse-bar">
        <div class="v2-filter-pills" role="group" aria-label="Filtrar cartera">
          ${[
            ['todos', 'Todos', counts.todos],
            ['critico', 'Requieren decisión', counts.critico],
            ['esperando', 'Esperando cliente', counts.esperando],
            ['revisar', 'F29 por revisar', counts.revisar],
            ['cerrado', 'Cerrados', counts.cerrado]
          ].map(([k, lbl, n]) => `
            <button type="button" class="v2-pill-btn" data-filter="${k}" aria-pressed="${state.filter === k}">
              <span>${lbl}</span><span class="mono">${n}</span>
            </button>
          `).join('')}
        </div>
        <input type="search" class="v2-search-inline" id="v2-matrix-search" value="${state.query}" placeholder="Filtrar cliente o RUT…">
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr>
              <th>Empresa / Régimen</th>
              <th>RCV y Acuses</th>
              <th>Nómina / LRE</th>
              <th>Bancos</th>
              <th class="num">F29 (Cód. 91)</th>
              <th>Cierre</th>
            </tr>
          </thead>
          <tbody id="v2-hoy-tbody">
            ${studioHoyRowsHtml(rows)}
          </tbody>
          <tfoot id="v2-hoy-tfoot">
            <tr>
              <td colspan="4">${rows.length} empresas en vista · ${currentPeriod().label}</td>
              <td class="num">${fmt(totalF29Cartera)}</td>
              <td class="mono">${counts.cerrado}/${counts.todos} OK</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const pendingDocs = state.inbox.filter((i) => i.state === 'Por revisar');
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Olas legales del mes</h2>
          <span class="mono muted">${currentPeriod().iso}</span>
        </div>
        <div class="v2-ins-list">
          <button type="button" class="v2-ins-row-btn" data-jump-ola="acuses">
            <span><strong>Día 8</strong> · Acuses Ley 19.983</span>
            <span class="tag tag--danger">3 por vencer</span>
          </button>
          <button type="button" class="v2-ins-row-btn" data-jump-ola="lre">
            <span><strong>Día 13</strong> · PreviRed</span>
            <span class="tag tag--out">5/6 al día</span>
          </button>
          <button type="button" class="v2-ins-row-btn" data-jump-ola="lre">
            <span><strong>Día 15</strong> · LRE Mi DT</span>
            <span class="tag tag--in">4/6 listos</span>
          </button>
          <button type="button" class="v2-ins-row-btn" data-jump-ola="f29">
            <span><strong>Día 20</strong> · Declaración F29</span>
            <span class="tag tag--out">${counts.cerrado}/${counts.todos} cerrados</span>
          </button>
        </div>
      </div>

      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Requieren tu decisión hoy</h2>
          <span class="mono muted">${counts.critico}</span>
        </div>
        <div class="v2-ins-list">
          <div class="v2-ins-row">
            <div>
              <strong>Constructora Andes Sur</strong>
              <div class="muted">Riesgo Ley Bustos (Art. 162 CT): finiquito abierto con Previred impago.</div>
            </div>
            <button type="button" class="btn btn--sm" data-open-client="andes-sur" data-open-area="remuneraciones">Revisar</button>
          </div>
          <div class="v2-ins-row">
            <div>
              <strong>Panadería San Isidro</strong>
              <div class="muted">2 facturas a crédito vencen plazo 8 días en SII.</div>
            </div>
            <button type="button" class="btn btn--sm" data-open-client="san-isidro" data-open-area="impuestos" data-open-sub="rcv">Acusar</button>
          </div>
        </div>
      </div>

      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Recién llegado del Portal</h2>
          <span class="mono muted">${pendingDocs.length}</span>
        </div>
        <div class="v2-ins-list">
          ${pendingDocs.slice(0, 3).map((d) => `
            <div class="v2-ins-row">
              <div>
                <strong>${d.client}</strong>
                <div class="muted">${d.title} · ${d.age}</div>
              </div>
              <button type="button" class="btn btn--sm" data-open-client="${d.clientId}" data-open-area="${d.targetArea}">Abrir</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderStudioOlas() {
    const tab = state.olaTab;
    let headCols = '';
    let rowsHtml = '';

    if (tab === 'acuses') {
      const items = [
        { id: 'ac1', client: 'Panadería San Isidro SpA', doc: 'Fact. #88412 · Molinos del Sur', monto: 945000, vence: 'En 18 h' },
        { id: 'ac2', client: 'Panadería San Isidro SpA', doc: 'Fact. #20491 · Envases Chile', monto: 412000, vence: 'En 36 h' },
        { id: 'ac3', client: 'Cafetería Barrio Italia EIRL', doc: 'Fact. #9920 · Tostaduría Sur', monto: 318500, vence: 'En 22 h' }
      ];
      headCols = `<tr><th style="width:32px"></th><th>Empresa</th><th>Documento SII</th><th class="num">Monto</th><th>Plazo Ley 19.983</th><th>Acción</th></tr>`;
      rowsHtml = items.map((it) => `
        <tr>
          <td><input type="checkbox" data-batch-id="${it.id}" ${state.selectedIds.has(it.id) ? 'checked' : ''} aria-label="Seleccionar ${it.doc}"></td>
          <td><strong>${it.client}</strong></td>
          <td class="mono">${it.doc}</td>
          <td class="num">${fmt(it.monto)}</td>
          <td><span class="tag tag--on">${it.vence}</span></td>
          <td><button type="button" class="btn btn--sm" data-quick-ok="Acuse aceptado para ${it.doc}">Aceptar</button></td>
        </tr>
      `).join('');
    } else if (tab === 'lre') {
      headCols = `<tr><th style="width:32px"></th><th>Empresa</th><th class="num">Dotación</th><th>PreviRed (105 campos)</th><th>LRE Mi DT (147 cols)</th><th>Acción</th></tr>`;
      rowsHtml = state.clients.map((c) => `
        <tr>
          <td><input type="checkbox" data-batch-id="${c.id}" ${state.selectedIds.has(c.id) ? 'checked' : ''} aria-label="Seleccionar ${c.name}"></td>
          <td><strong>${c.name}</strong><span class="v2-cell-sub mono">${c.rut}</span></td>
          <td class="num">${c.workers.length}</td>
          <td><span class="tag ${c.nomina.previredOk ? 'tag--in' : 'tag--on'}">${c.nomina.previredOk ? 'Validado' : 'Mora · Ley Bustos'}</span></td>
          <td><span class="tag ${c.nomina.state === 'ok' ? 'tag--in' : 'tag--out'}">${c.nomina.label}</span></td>
          <td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="remuneraciones" data-open-sub="previred">Exportar</button></td>
        </tr>
      `).join('');
    } else {
      headCols = `<tr><th style="width:32px"></th><th>Empresa</th><th>Régimen</th><th class="num">IVA Det.</th><th class="num">Total Cód. 91</th><th>Estado F29</th></tr>`;
      rowsHtml = state.clients.map((c) => {
        const iva = Math.max(0, c.f29.debito - c.f29.credito);
        const tag = c.f29.state === 'declarado' || c.f29.state === 'listo' ? 'tag--in' : 'tag--out';
        return `
          <tr>
            <td><input type="checkbox" data-batch-id="${c.id}" ${state.selectedIds.has(c.id) ? 'checked' : ''} aria-label="Seleccionar ${c.name}"></td>
            <td><strong>${c.name}</strong><span class="v2-cell-sub mono">${c.rut}</span></td>
            <td class="mono">${c.regime}</td>
            <td class="num">${fmt(iva)}</td>
            <td class="num"><strong>${fmt(f29Total(c))}</strong></td>
            <td><span class="tag ${tag}">${c.f29.state}</span></td>
          </tr>
        `;
      }).join('');
    }

    $('v2-canvas').innerHTML = `<div class="v2-table-wrap"><table class="v2-table"><thead>${headCols}</thead><tbody>${rowsHtml}</tbody></table></div>`;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Operación en lote</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Marca varias empresas para aprobar lotes limpios sin abrir empresa por empresa.</p>
        <dl class="v2-ins-kv" style="margin:6px 0 0">
          <dt>Cartera activa</dt><dd>${state.clients.length} empresas</dd>
          <dt>Motores conectados</dt><dd>F29 · Previred · LRE</dd>
        </dl>
      </div>
    `;
  }

  function renderStudioBandeja() {
    const list = state.inbox.filter((i) => state.inboxTab === 'pendientes' ? i.state === 'Por revisar' : i.state === 'Resuelto');
    const active = list.find((i) => i.id === state.selectedInboxId) || list[0] || null;
    if (active) state.selectedInboxId = active.id;

    $('v2-canvas').innerHTML = `
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Documento / Solicitud</th><th>Empresa</th><th>Tipo</th><th>Recibido</th><th>Estado</th></tr></thead>
          <tbody>
            ${list.length ? list.map((it) => `
              <tr class="${active && active.id === it.id ? 'is-selected' : ''}" data-select-inbox="${it.id}" style="cursor:pointer">
                <td><strong>${it.title}</strong></td>
                <td>${it.client}</td>
                <td>${it.type}</td>
                <td class="mono muted">${it.age}</td>
                <td><span class="tag ${it.state === 'Resuelto' ? 'tag--in' : 'tag--out'}">${it.state}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="muted" style="padding:24px;text-align:center">Bandeja al día.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    $('v2-inspector').innerHTML = active ? `
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">${active.title}</h2>
          <span class="tag ${active.state === 'Resuelto' ? 'tag--in' : 'tag--out'}">${active.state}</span>
        </div>
        <dl class="v2-ins-kv">
          <dt>Empresa</dt><dd>${active.client}</dd>
          <dt>Categoría</dt><dd>${active.type}</dd>
          <dt>Recibido</dt><dd>${active.age}</dd>
        </dl>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
          <button type="button" class="btn btn--primary" data-open-client="${active.clientId}" data-open-area="${active.targetArea}">${active.actionLabel}</button>
          ${active.state !== 'Resuelto' ? `<button type="button" class="btn" data-resolve-inbox="${active.id}">Marcar como resuelto</button>` : ''}
        </div>
      </div>
    ` : `<div class="v2-ins-block"><h2 class="v2-ins-title">Sin selección</h2></div>`;
  }

  function renderStudioEmpresas() {
    $('v2-canvas').innerHTML = `
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Razón social</th><th>RUT</th><th>Régimen</th><th class="num">Dotación</th><th>Estado mes</th><th></th></tr></thead>
          <tbody>
            ${state.clients.map((c) => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td class="mono">${c.rut}</td>
                <td><span class="tag tag--out">${c.regime}</span></td>
                <td class="num">${c.workers.length}</td>
                <td><span class="tag ${c.status === 'cerrado' ? 'tag--in' : c.status === 'critico' ? 'tag--on' : 'tag--out'}">${c.cierre}</span></td>
                <td class="num"><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="impuestos">Entrar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Resumen de cartera</h2>
        <dl class="v2-ins-kv">
          <dt>Total empresas</dt><dd>${state.clients.length}</dd>
          <dt>Régimen 14 D3</dt><dd>${state.clients.filter((c) => c.regime === '14 D3').length}</dd>
          <dt>Régimen 14 A</dt><dd>${state.clients.filter((c) => c.regime === '14 A').length}</dd>
          <dt>Régimen 14 D8</dt><dd>${state.clients.filter((c) => c.regime === '14 D8').length}</dd>
        </dl>
      </div>
      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Marca de tu estudio</h2>
          <span class="tag tag--in">PDF y reportes</span>
        </div>
        <p class="muted" style="margin:0;font-size:12.5px">Tu logo y nombre del estudio van en el PDF del F29 y en los informes que envías a tus clientes.</p>
        <div class="v2-field" style="margin-top:6px">
          <label for="inp-studio-name">Nombre visible en entregables</label>
          <input type="text" id="inp-studio-name" value="${state.studioName}">
        </div>
      </div>
    `;
  }

  /* ==================== NIVEL 2: ESPACIO CLIENTE ==================== */
  function sparklineSvg(arr) {
    const meses = ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'];
    const max = Math.max(...arr, 1);
    const min = Math.min(...arr, 0);
    const span = Math.max(max - min, 1);
    const coords = arr.map((v, i) => ({
      x: Number(((i / Math.max(arr.length - 1, 1)) * 288 + 6).toFixed(1)),
      y: Number((60 - ((v - min) / span) * 48).toFixed(1)),
      v,
      m: meses[i] || `M${i + 1}`
    }));
    const pts = coords.map((p) => `${p.x},${p.y}`).join(' ');
    const area = `6,64 ${pts} 294,64`;
    const dots = coords.map((p, i) => `
      <circle cx="${p.x}" cy="${p.y}" r="${i === coords.length - 1 ? 3.4 : 2.2}" fill="${i === coords.length - 1 ? 'var(--ink-accent)' : 'var(--ink-paper)'}" stroke="var(--ink-accent)" stroke-width="1.6">
        <title>${p.m}: ${fmt(p.v * 1000)}</title>
      </circle>
    `).join('');
    return `
      <svg class="v2-spark" viewBox="0 0 300 68" preserveAspectRatio="none" role="img" aria-label="Tendencia F29 últimos 12 meses">
        <polygon fill="var(--ink-accent-soft)" opacity="0.55" points="${area}" />
        <polyline fill="none" stroke="var(--ink-accent)" stroke-width="2" points="${pts}" />
        ${dots}
      </svg>
      <div class="v2-spark-axis mono"><span>${meses[0]}</span><span>Mín ${fmt(min * 1000)}</span><span>Máx ${fmt(max * 1000)}</span><span>${meses[meses.length - 1]}</span></div>
    `;
  }

  function buildF29Explanation(c, code) {
    const iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
    const isProPyme = c.regime === '14 D3' || c.regime === '14 D8';
    const iso = currentPeriod().iso;

    if (code === '538') {
      const deb = c.f29.debito || 0;
      const factIva = Math.round(deb * 0.62);
      const bolIva = Math.max(0, deb - factIva);
      return {
        code: '538',
        title: 'Débito fiscal IVA',
        amount: deb,
        source: 'RCV Ventas SII',
        docs: deb > 0 ? [
          { title: 'Facturas electrónicas afectas (DTE 33)', sub: 'Resumen RCV ventas · tasa 19%', amount: factIva },
          { title: 'Boletas electrónicas POS (DTE 39)', sub: 'Cierre diario ventas con boleta', amount: bolIva }
        ] : [
          { title: 'Sin ventas afectas a IVA en el período', sub: 'Giro exento o sin movimiento afecto', amount: 0 }
        ],
        note: null,
        cta: { label: 'Abrir documentos en RCV', attr: 'data-client-sub="rcv"' }
      };
    }
    if (code === '537') {
      const cred = c.f29.credito || 0;
      const docs = [];
      if (cred > 0) {
        if (c.id === 'san-isidro') {
          const d1 = 150882, d2 = 65782, d3 = 28739;
          const resto = Math.max(0, cred - d1 - d2 - d3);
          docs.push(
            { title: 'Factura #88412 · Molinos del Sur S.A.', sub: 'Insumos del giro · Acuse pendiente', amount: d1 },
            { title: 'Factura #20491 · Envases Chile SpA', sub: 'Empaques · Acuse pendiente', amount: d2 },
            { title: 'Boleta #77104 · Supermercado Jumbo', sub: 'Cód. 761 · Verificar relación con el giro', amount: d3 },
            { title: 'Otras facturas del giro (RCV Compras)', sub: 'Documentos aceptados del período', amount: resto }
          );
        } else {
          const d1 = Math.round(cred * 0.54);
          const d2 = Math.max(0, cred - d1);
          docs.push(
            { title: 'Proveedores principales del giro (DTE 33)', sub: 'RCV Compras con derecho a crédito', amount: d1 },
            { title: 'Servicios y suministros afectos', sub: 'RCV Compras aceptadas', amount: d2 }
          );
        }
      } else {
        docs.push({ title: 'Sin crédito fiscal registrado', sub: 'Sin compras afectas con derecho a crédito', amount: 0 });
      }
      return {
        code: '537',
        title: 'Crédito fiscal IVA',
        amount: cred,
        source: 'RCV Compras SII',
        docs,
        note: c.rcv.pendingAcuses ? { warn: true, text: `Hay ${c.rcv.pendingAcuses} documento(s) con acuse de recibo pendiente dentro del plazo de 8 días.` } : null,
        cta: { label: 'Revisar facturas en RCV', attr: 'data-client-sub="rcv"' }
      };
    }
    if (code === '089') {
      const rem = Math.max(0, (c.f29.credito || 0) - (c.f29.debito || 0));
      return {
        code: '089',
        title: 'IVA determinado del período',
        amount: iva,
        source: 'Cálculo Cód. 538 − 537',
        docs: [
          { title: 'Cód. 538 · Débito fiscal IVA', sub: 'Ventas afectas del mes', amount: c.f29.debito || 0 },
          { title: 'Cód. 537 · Crédito fiscal IVA', sub: 'Compras con derecho a crédito', amount: -(c.f29.credito || 0) }
        ],
        note: rem > 0
          ? { warn: false, text: `Crédito supera al débito: se genera remanente de crédito fiscal por ${fmt(rem)} para el mes siguiente.` }
          : { warn: false, text: `IVA neto determinado del período: ${fmt(iva)}.` },
        cta: null
      };
    }
    if (code === '755') {
      return {
        code: '755',
        title: 'Postergación IVA (Art. 64)',
        amount: c.f29.postergar ? iva : 0,
        source: `Régimen ${c.regime}`,
        docs: [
          { title: 'IVA determinado (Cód. 089)', sub: c.f29.postergar ? 'Postergado a mes +2' : 'No postergado', amount: iva },
          { title: 'Monto postergado en Cód. 755', sub: 'Ajustable en Semáforo Pre-SII', amount: c.f29.postergar ? iva : 0 }
        ],
        note: { warn: false, text: c.f29.postergar ? 'Postergación activa: el IVA se traslada al vencimiento de mes +2 y el F29 actual paga solo PPM y retenciones.' : 'Puedes activar o desactivar la postergación en el bloque Semáforo Pre-SII.' },
        cta: null
      };
    }
    if (code === '062') {
      const ppm = c.f29.ppm || 0;
      const base = c.rcv.ventasNeto || 0;
      const tasa = base > 0 ? ((ppm / base) * 100).toFixed(2) : '0.00';
      return {
        code: '062',
        title: 'PPM obligatorio mensual',
        amount: ppm,
        source: `Base neta · ${tasa}%`,
        docs: [
          { title: 'Ingresos netos del período (RCV)', sub: `Régimen ${c.regime}`, amount: base },
          { title: `PPM calculado (tasa ref. ${tasa}%)`, sub: 'Línea Cód. 062 Formulario 29', amount: ppm }
        ],
        note: isProPyme
          ? { warn: true, text: `Alerta ProPyme (${c.regime}): la base PPM considera ingresos efectivamente percibidos. Verifica si hay facturas a crédito aún no cobradas en Bancos.` }
          : { warn: false, text: `Régimen ${c.regime}: base PPM sobre ingresos brutos devengados del período.` },
        cta: isProPyme ? { label: 'Verificar cobros en Bancos', attr: `data-open-client="${c.id}" data-open-area="bancos"` } : null
      };
    }
    // 048: Impuesto Único + Retenciones BHE (151)
    const ret = c.f29.retenciones || 0;
    const computed = c.workers.map((w) => ({ w, calc: calcularWorkerReal(w, iso) }));
    const impUnicoTotal = computed.reduce((s, x) => s + (x.calc.impUnico || 0), 0);
    const bheRet = Math.max(0, ret - impUnicoTotal);
    const docs = [];
    if (impUnicoTotal > 0) {
      const conImp = computed.filter((x) => (x.calc.impUnico || 0) > 0);
      docs.push({
        title: `Impuesto Único 2ª Cat. (${conImp.length} trab.)`,
        sub: conImp.map((x) => x.w.name.split(' ')[0]).join(', '),
        amount: impUnicoTotal
      });
    }
    docs.push({
      title: 'Retenciones BHE (Cód. 151 · 15,25%)',
      sub: 'Boletas de honorarios 2026 (Ley 21.133)',
      amount: bheRet
    });
    return {
      code: '048',
      title: 'Impuesto Único y Retenciones (151)',
      amount: ret,
      source: 'Nómina (incl. Socio) + BHE 15,25%',
      docs,
      note: { warn: false, text: 'Retención BHE vigente 2026: 15,25% (Ley 21.133 · F29 Cód. 151; próximo tramo: 16% en 2027). Incluye IUSC de dependientes y sueldo empresarial.' },
      cta: { label: 'Abrir nómina del período', attr: `data-open-client="${c.id}" data-open-area="remuneraciones"` }
    };
  }

  const RCV_ACCOUNTS = [
    { code: '41010', label: '41010 · Costo de ventas / Insumos' },
    { code: '41020', label: '41020 · Envases y empaques' },
    { code: '41030', label: '41030 · Arriendos y gastos básicos' },
    { code: '41040', label: '41040 · Fletes y despacho' },
    { code: '41050', label: '41050 · Mantención y reparaciones' },
    { code: '41090', label: '41090 · Gastos generales (revisar giro)' },
    { code: '12010', label: '12010 · Activo fijo / Maquinaria' }
  ];

  function accountShortLabel(code) {
    const found = RCV_ACCOUNTS.find((a) => a.code === code);
    return found ? found.label : code;
  }

  function ensureRcvDocs(c) {
    if (Array.isArray(c.rcvDocs) && c.rcvDocs.length) return c.rcvDocs;
    if (c.id === 'san-isidro') {
      c.rcvDocs = [
        { id: 'rcv1', folio: '88412', rut: '76.112.400-5', supplier: 'Molinos del Sur S.A.', neto: 794118, iva: 150882, account: '41010', plazo: 'Vence en 18 h', plazoTag: 'tag--on', action: 'Aceptar', actionMsg: 'Acuse aceptado en SII para folio 88412', closed: false },
        { id: 'rcv2', folio: '88519', rut: '76.112.400-5', supplier: 'Molinos del Sur S.A.', neto: 412605, iva: 78395, account: '41090', plazo: 'Aceptado', plazoTag: 'tag--in', action: 'Verificado', actionMsg: 'Documento 88519 ya aceptado en SII', closed: false },
        { id: 'rcv3', folio: '20491', rut: '77.409.118-2', supplier: 'Envases Chile SpA', neto: 346218, iva: 65782, account: '41020', plazo: 'Vence en 36 h', plazoTag: 'tag--out', action: 'Aceptar', actionMsg: 'Acuse aceptado en SII para folio 20491', closed: false },
        { id: 'rcv4', folio: '77104', rut: '81.201.000-K', supplier: 'Supermercado Jumbo (Cód. 761)', neto: 151261, iva: 28739, account: '41090', plazo: 'Contado', plazoTag: 'tag--in', action: 'Pedir respaldo', actionMsg: 'Solicitud de respaldo enviada al cliente', closed: false }
      ];
    } else {
      const closed = c.f29.state === 'declarado';
      const baseNeto = Math.max(120000, Math.round((c.rcv.comprasNeto || 1000000) * 0.22));
      const baseIva = Math.round(baseNeto * 0.19);
      const secNeto = Math.round(baseNeto * 0.55);
      const secIva = Math.round(secNeto * 0.19);
      c.rcvDocs = [
        { id: `${c.id}-r1`, folio: '50114', rut: '76.889.210-1', supplier: 'Distribuidora Central Ltda.', neto: baseNeto, iva: baseIva, account: '41010', plazo: closed ? 'Cerrado SII' : 'Aceptado', plazoTag: 'tag--in', action: closed ? 'Cerrado' : 'Aceptar', actionMsg: 'Acuse confirmado en SII', closed },
        { id: `${c.id}-r2`, folio: '50208', rut: '76.889.210-1', supplier: 'Distribuidora Central Ltda.', neto: secNeto, iva: secIva, account: '41090', plazo: closed ? 'Cerrado SII' : 'Aceptado', plazoTag: 'tag--in', action: closed ? 'Cerrado' : 'Aceptar', actionMsg: 'Acuse confirmado en SII', closed },
        { id: `${c.id}-r3`, folio: '11902', rut: '96.512.330-4', supplier: 'Servicios Eléctricos y Gas S.A.', neto: 210084, iva: 39916, account: '41030', plazo: 'Contado', plazoTag: 'tag--in', action: 'Verificado', actionMsg: 'Servicio básico verificado', closed }
      ];
    }
    return c.rcvDocs;
  }

  function renderRcvExplainBlock(c) {
    const docs = ensureRcvDocs(c);
    const sel = docs.find((d) => d.id === state.selectedRcvId) || docs[0];
    if (!sel) return '';
    state.selectedRcvId = sel.id;
    const isClosedPeriod = isPeriodClosed(c) || sel.closed;
    const ruleKey = `${c.id}::${sel.rut}`;
    const savedRule = state.supplierRules[ruleKey];
    const sameOpen = docs.filter((d) => d.rut === sel.rut && !d.closed && !isPeriodClosed(c));
    const othersCount = Math.max(0, sameOpen.length - 1);

    return `
      <div class="v2-ins-block" id="v2-rcv-supplier-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Cuenta por proveedor</h2>
          <span class="tag ${savedRule ? 'tag--in' : 'tag--out'} mono">Folio ${sel.folio}</span>
        </div>
        <dl class="v2-ins-kv">
          <dt>Proveedor</dt><dd style="font-family:var(--font-sans);font-weight:600">${sel.supplier}</dd>
          <dt>RUT emisor</dt><dd>${sel.rut}</dd>
          <dt>Monto neto</dt><dd>${fmt(sel.neto)}</dd>
        </dl>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label for="sel-rcv-account" class="muted" style="font-size:11.5px">Cuenta contable de gasto / activo</label>
          <select id="sel-rcv-account" class="v2-ins-select" ${isClosedPeriod ? 'disabled' : ''}>
            ${RCV_ACCOUNTS.map((a) => `<option value="${a.code}" ${sel.account === a.code ? 'selected' : ''}>${a.label}</option>`).join('')}
          </select>
        </div>
        <label class="v2-ins-check">
          <input type="checkbox" id="chk-rcv-remember" checked>
          <span>Recordar esta cuenta por defecto para <strong>${sel.supplier}</strong> en próximos meses.</span>
        </label>
        ${!isClosedPeriod && othersCount > 0 ? `
          <label class="v2-ins-check">
            <input type="checkbox" id="chk-rcv-apply-open" checked>
            <span>Aplicar también a los otros <strong>${othersCount}</strong> documento(s) abierto(s) de este proveedor en el mes.</span>
          </label>
        ` : ''}
        ${isClosedPeriod ? `
          <div class="v2-ins-note is-warn">Período cerrado/declarado: los documentos históricos están protegidos y no se reescriben. Puedes guardar la regla solo para meses futuros.</div>
        ` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px">
          <button type="button" class="btn btn--primary" data-apply-rcv-account="${sel.id}">${isClosedPeriod ? 'Guardar regla para meses futuros' : 'Guardar y aplicar cuenta'}</button>
          ${savedRule ? `<button type="button" class="btn btn--sm" data-clear-supplier-rule="${ruleKey}">Quitar regla guardada (${savedRule.account})</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderF29ExplainBlock(c) {
    const exp = buildF29Explanation(c, state.selectedF29Code || '538');
    return `
      <div class="v2-ins-block" id="v2-f29-explain-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Cód. ${exp.code} · ${exp.title}</h2>
          <span class="tag tag--in mono">${fmt(exp.amount)}</span>
        </div>
        <div class="muted" style="font-size:11.5px;margin-top:-6px">Origen: ${exp.source}</div>
        <div class="v2-doc-list">
          ${exp.docs.map((d) => `
            <div class="v2-doc-row">
              <div class="v2-doc-row__meta">
                <span class="v2-doc-row__title" title="${d.title}">${d.title}</span>
                <span class="v2-doc-row__sub">${d.sub}</span>
              </div>
              <span class="v2-doc-row__amt">${fmt(d.amount)}</span>
            </div>
          `).join('')}
        </div>
        ${exp.note ? `<div class="v2-ins-note ${exp.note.warn ? 'is-warn' : ''}">${exp.note.text}</div>` : ''}
        ${exp.cta ? `<button type="button" class="btn btn--sm" ${exp.cta.attr}>${exp.cta.label}</button>` : ''}
      </div>
    `;
  }

  function renderClientImpuestos(c) {
    const iva = Math.max(0, c.f29.debito - c.f29.credito);
    const total = f29Total(c);
    if (!state.selectedF29Code) state.selectedF29Code = '538';

    if (state.clientSub === 'f29') {
      const lines = [
        { code: '538', glosa: 'Débito fiscal IVA (ventas afectas RCV)', field: 'debito', val: c.f29.debito, editable: true },
        { code: '537', glosa: 'Crédito fiscal IVA (compras con derecho a crédito)', field: 'credito', val: c.f29.credito, editable: true },
        { code: '089', glosa: 'IVA determinado del período (cód. 538 − cód. 537)', field: null, val: iva, editable: false },
        { code: '755', glosa: 'Postergación pago IVA Art. 64 D.L. 825 (mes +2)', field: null, val: c.f29.postergar ? iva : 0, editable: false },
        { code: '062', glosa: 'PPM obligatorio mensual', field: 'ppm', val: c.f29.ppm, editable: true },
        { code: '048', glosa: 'Impuesto Único 2ª Categoría + Retenciones BHE (151)', field: 'retenciones', val: c.f29.retenciones, editable: true }
      ];
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Débito (538)</span><span class="v2-tape-val" data-f29-tape="debito">${fmt(c.f29.debito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Crédito (537)</span><span class="v2-tape-val" data-f29-tape="credito">${fmt(c.f29.credito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">IVA neto (089)</span><span class="v2-tape-val" data-f29-tape="iva">${fmt(iva)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Total F29 (091)</span><span class="v2-tape-val is-in" data-f29-tape="total">${fmt(total)}</span></div>
        </div>
        <div class="v2-f29-hint">
          <span>${isPeriodClosed(c) ? 'Período cerrado (solo lectura). Usa «Reabrir mes» en el Inspector dejando motivo si necesitas ajustar.' : 'Haz clic en cualquier código del F29 para ver en el Inspector los documentos exactos que lo componen.'}</span>
          <span class="mono">${isPeriodClosed(c) ? 'Cerrado · ' : ''}Régimen ${c.regime}</span>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th style="width:78px">Código</th><th>Glosa oficial Formulario 29</th><th class="num" style="width:160px">Monto ($)</th></tr></thead>
            <tbody>
              ${lines.map((l) => `
                <tr class="${l.editable ? '' : 'is-calc-row'}${state.selectedF29Code === l.code ? ' is-selected' : ''}" data-select-f29="${l.code}">
                  <td class="mono"><strong>${l.code}</strong></td>
                  <td>${l.glosa}</td>
                  <td class="num">
                    ${l.editable
                      ? `<input type="number" class="v2-inline-input" data-f29-field="${l.field}" data-f29-code="${l.code}" value="${l.val}" aria-label="Código ${l.code}"${isPeriodClosed(c) ? ' disabled' : ''}>`
                      : `<span class="mono" data-f29-code-val="${l.code}">${fmt(l.val)}</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot><tr><td class="mono">091</td><td>Total a pagar dentro de plazo legal</td><td class="num" data-f29-total>${fmt(total)}</td></tr></tfoot>
          </table>
        </div>
      `;
    } else if (state.clientSub === 'rcv') {
      const rcvDocs = ensureRcvDocs(c);
      const selRcv = rcvDocs.find((d) => d.id === state.selectedRcvId) || rcvDocs[0];
      if (selRcv) state.selectedRcvId = selRcv.id;
      $('v2-canvas').innerHTML = `
        <div class="v2-pulse-bar">
          <span class="muted">Registro Compras y Ventas · Haz clic en un documento para reclasificar proveedor</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="btn btn--sm">Importar CSV Ventas SII<input type="file" accept=".csv,.txt" id="v2-csv-ventas" class="sr-only"></label>
            <label class="btn btn--sm">Importar CSV Compras SII<input type="file" accept=".csv,.txt" id="v2-csv-compras" class="sr-only"></label>
            <button type="button" class="btn btn--sm" id="btn-run-rcv-sample">Recalcular con RCV oficial</button>
          </div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Folio</th><th>Proveedor</th><th>Cuenta</th><th class="num">Neto</th><th class="num">IVA</th><th>Plazo 8 días</th><th>Acción</th></tr></thead>
            <tbody>
              ${rcvDocs.map((d) => {
                const hasRule = !!state.supplierRules[`${c.id}::${d.rut}`];
                return `
                  <tr class="${selRcv && selRcv.id === d.id ? 'is-selected' : ''}" data-select-rcv="${d.id}">
                    <td class="mono">${d.folio}</td>
                    <td><strong>${d.supplier}</strong></td>
                    <td><span class="mono" style="font-size:11.5px">${d.account}</span>${hasRule ? ' <span class="tag tag--in">Regla</span>' : ''}</td>
                    <td class="num">${fmt(d.neto)}</td>
                    <td class="num">${fmt(d.iva)}</td>
                    <td><span class="tag ${d.plazoTag}">${d.plazo}</span></td>
                    <td><button type="button" class="btn btn--sm" data-quick-ok="${d.actionMsg}">${d.action}</button></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      const ddjj = c.regime === '14 D3'
        ? [['DJ 1948', 'Retiros y dividendos', 'Obligatoria 14 D3'], ['DJ 1887', 'Sueldos y retenciones', 'Obligatoria'], ['DJ 1879', 'Honorarios BHE', 'Obligatoria']]
        : c.regime === '14 D8'
          ? [['DJ 1947', 'Base imponible transparente', 'Obligatoria 14 D8'], ['DJ 1887', 'Sueldos y retenciones', 'Obligatoria']]
          : [['DJ 1847', 'Balance 8 Columnas', 'Obligatoria 14 A'], ['DJ 1926', 'Renta Líquida Imponible', 'Obligatoria 14 A'], ['DJ 1948', 'Retiros y dividendos', 'Obligatoria']];
      $('v2-canvas').innerHTML = `
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Declaración</th><th>Descripción</th><th>Aplicabilidad (${c.regime})</th><th>Estado AT 2027</th></tr></thead>
            <tbody>
              ${ddjj.map(([cod, desc, apl]) => {
                const is1887 = cod === 'DJ 1887' && c.lreHistory && c.lreHistory.imports > 0;
                const stText = is1887 ? `${c.lreHistory.imports} LRE · Renta ${fmt(c.lreHistory.rentaNetaAnual)} · IUSC ${fmt(c.lreHistory.iuscRetenidoAnual)}` : 'Borrador listo';
                return `<tr><td class="mono"><strong>${cod}</strong></td><td>${desc}</td><td><span class="tag tag--in">${apl}</span></td><td><span class="tag ${is1887 ? 'tag--in' : 'tag--out'}">${stText}</span></td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    $('v2-inspector').innerHTML = `
      ${state.clientSub === 'f29' ? renderF29ExplainBlock(c) : state.clientSub === 'rcv' ? renderRcvExplainBlock(c) : ''}
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Semáforo Pre-SII</h2>
          <span class="tag ${c.rcv.pendingAcuses ? 'tag--on' : 'tag--in'}">${c.rcv.pendingAcuses ? `${c.rcv.pendingAcuses} alertas` : 'Sin reparos'}</span>
        </div>
        <div class="v2-ins-list">
          <div class="v2-ins-row"><span>RCV compras sin IVA castigado</span><span class="tag tag--in">OK</span></div>
          <div class="v2-ins-row"><span>Supermercados cód. 761</span><span class="tag tag--out">Revisar</span></div>
          <div class="v2-ins-row"><span>Postergación IVA (cód. 755)</span>
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="chk-postergar" ${c.f29.postergar ? 'checked' : ''}> <span class="mono">${c.f29.postergar ? 'Sí' : 'No'}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="v2-ins-block v2-ins-block--soft" id="v2-f29-workflow-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Flujo F29 y cierre mensual</h2>
          <span class="tag ${isPeriodClosed(c) ? 'tag--in' : 'tag--out'}">${isPeriodClosed(c) ? 'Mes cerrado' : 'Mes abierto'}</span>
        </div>
        ${(() => {
          const closed = isPeriodClosed(c);
          const isContab = !!c.f29.contabilizado || c.f29.state === 'contabilizado' || c.f29.state === 'declarado' || c.f29.state === 'pagado';
          const isDecl = c.f29.state === 'declarado' || c.f29.state === 'pagado';
          const isPag = c.f29.state === 'pagado';
          const lastReopen = Array.isArray(c.f29.reopenLog) && c.f29.reopenLog.length ? c.f29.reopenLog[c.f29.reopenLog.length - 1] : null;
          return `
            <div class="v2-step-rail" aria-label="Etapas F29">
              <span class="v2-step-chip ${isContab ? 'is-done' : ''}">1. Contab.</span>
              <span class="v2-step-chip ${isDecl ? 'is-done' : ''}">2. Decl.</span>
              <span class="v2-step-chip ${isPag ? 'is-done' : ''}">3. Pagado</span>
              <span class="v2-step-chip ${closed ? 'is-done' : ''}">4. Cierre</span>
            </div>
            <dl class="v2-ins-kv">
              <dt>Estado F29</dt><dd>${f29StateLabel(c.f29.state)}</dd>
              <dt>Folio SII</dt><dd>${c.f29.folio || 'Sin declarar'}</dd>
              <dt>Pago TGR</dt><dd>${isPag ? (c.f29.paidDate || 'Registrado') : 'Pendiente'}</dd>
            </dl>
            ${lastReopen ? `<div class="v2-ins-note">Última reapertura (${lastReopen.at}): «${lastReopen.reason}»</div>` : ''}
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px">
              ${!isContab ? `<button type="button" class="btn btn--primary btn--sm" data-f29-step="contabilizar">1. Contabilizar IVA y PPM</button>` : ''}
              ${isContab && !isDecl ? `
                <input type="text" id="inp-f29-folio" class="v2-ins-select mono" placeholder="Folio SII (ej. 84920311)" value="${c.f29.folio || ''}" aria-label="Folio SII F29">
                <button type="button" class="btn btn--primary btn--sm" data-f29-step="declarar">2. Marcar declarado (SII)</button>
              ` : ''}
              ${isDecl && !isPag ? `<button type="button" class="btn btn--primary btn--sm" data-f29-step="pagar">3. Registrar pago TGR</button>` : ''}
              ${!closed ? `<button type="button" class="btn btn--sm" data-f29-step="cerrar">Cerrar mes</button>` : ''}
              ${closed && !state.reopenPromptOpen ? `<button type="button" class="btn btn--sm" data-f29-step="reopen-prompt">Reabrir mes (requiere motivo)</button>` : ''}
              ${closed && state.reopenPromptOpen ? `
                <div class="v2-reopen-box">
                  <label for="inp-reopen-reason" class="muted" style="font-size:11.5px">Motivo obligatorio para auditar la reapertura</label>
                  <input type="text" id="inp-reopen-reason" class="v2-ins-select" placeholder="Ej. Nota de crédito recibida fuera de plazo">
                  ${state.reopenError ? `<div style="font-size:11.5px;color:var(--ink-danger)">${state.reopenError}</div>` : ''}
                  <div style="display:flex;gap:6px">
                    <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-f29-step="reopen-confirm">Confirmar reapertura</button>
                    <button type="button" class="btn btn--sm" data-f29-step="reopen-cancel">Cancelar</button>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        })()}
      </div>

      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head"><h2 class="v2-ins-title">Tendencia F29 (12 meses)</h2><span class="mono muted">M$</span></div>
        ${sparklineSvg(c.f29.history)}
      </div>
    `;
  }

  function renderClientRemuneraciones(c) {
    const iso = currentPeriod().iso;
    const computed = c.workers.map((w) => ({ w, calc: calcularWorkerReal(w, iso) }));
    const selectedObj = computed.find((x) => x.w.id === state.selectedWorkerId) || computed[0];
    if (selectedObj) state.selectedWorkerId = selectedObj.w.id;

    const totalImp = computed.reduce((s, x) => s + x.calc.imponible, 0);
    const totalLiquido = computed.reduce((s, x) => s + x.calc.liquido, 0);
    const totalEmp = computed.reduce((s, x) => s + x.calc.costoEmpleador, 0);

    if (state.clientSub === 'finiquitos') {
      const mesVals = valoresMesActual(iso);
      const FinCalc = window.FiniquitoCalculator;
      const finRows = computed.map(({ w, calc }) => {
        const isSocio = (w.tipoRegimen || 'dependiente') === 'socio';
        const gratLine = (calc.detalle && calc.detalle.haberesImponibles || []).find((h) => /gratific/i.test(h.concepto));
        const gratMonto = gratLine ? gratLine.monto : 0;
        let fRes = null;
        if (FinCalc && !isSocio) {
          try {
            fRes = new FinCalc({
              startDate: w.ingreso || '2022-03-01',
              endDate: iso + '-30',
              baseSalary: w.base,
              gratification: gratMonto,
              cause: state.finiquitoCause,
              ufValue: mesVals.uf,
              vacationDaysPending: 7.5
            }).calculate();
          } catch (_) { fRes = null; }
        }
        return { w, fRes };
      });
      const selFin = finRows.find((x) => x.w.id === state.selectedWorkerId) || finRows[0];
      const totFin = finRows.reduce((s, x) => s + (x.fRes ? x.fRes.total : 0), 0);
      const totIas = finRows.reduce((s, x) => s + (x.fRes ? x.fRes.indemnities.yearsOfService.total : 0), 0);
      const totVac = finRows.reduce((s, x) => s + (x.fRes ? x.fRes.indemnities.vacation.total : 0), 0);

      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Lote finiquitos</span><span class="v2-tape-val">${finRows.length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">IAS (tope 90 UF)</span><span class="v2-tape-val">${fmt(totIas)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Feriado prop.</span><span class="v2-tape-val">${fmt(totVac)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Total lote</span><span class="v2-tape-val is-in">${fmt(totFin)}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Trabajador</th><th>Ingreso</th><th class="num">Años</th><th class="num">IAS</th><th class="num">Aviso previo</th><th class="num">Vacaciones</th><th class="num">Total finiquito</th></tr></thead>
            <tbody>
              ${finRows.map(({ w, fRes }) => {
                const isSocio = (w.tipoRegimen || 'dependiente') === 'socio';
                return `
                  <tr class="${selFin && selFin.w.id === w.id ? 'is-selected' : ''}" data-select-worker="${w.id}" style="cursor:pointer">
                    <td><strong>${w.name}</strong><span class="v2-cell-sub mono">${w.rut}${isSocio ? ' · Socio empresarial' : ''}</span></td>
                    <td class="mono">${w.ingreso || '2022-03-01'}</td>
                    <td class="num">${isSocio ? '—' : (fRes ? fRes.serviceTime.years : 0)}</td>
                    <td class="num">${isSocio ? '—' : fmt(fRes ? fRes.indemnities.yearsOfService.total : 0)}</td>
                    <td class="num">${isSocio ? '—' : fmt(fRes ? fRes.indemnities.notice.total : 0)}</td>
                    <td class="num">${isSocio ? '—' : fmt(fRes ? fRes.indemnities.vacation.total : 0)}</td>
                    <td class="num">${isSocio ? '<span class="tag tag--out">Bloqueado (Socio)</span>' : `<strong>${fmt(fRes ? fRes.total : 0)}</strong>`}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot><tr><td colspan="6">Finiquitos Art. ${state.finiquitoCause} CT · UF ${fmt(mesVals.uf)}</td><td class="num">${fmt(totFin)}</td></tr></tfoot>
          </table>
        </div>
      `;

      const sf = selFin && selFin.fRes;
      const selIsSocio = selFin && (selFin.w.tipoRegimen || 'dependiente') === 'socio';
      $('v2-inspector').innerHTML = selFin ? `
        <div class="v2-ins-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">${selFin.w.name}</h2>
            <span class="tag ${selIsSocio ? 'tag--danger' : sf && sf.economics.isCapped ? 'tag--on' : 'tag--in'}">${selIsSocio ? 'Finiquito bloqueado' : sf && sf.economics.isCapped ? 'Tope 90 UF' : `Art. ${state.finiquitoCause}`}</span>
          </div>
          ${selIsSocio ? `
            <div class="v2-ins-note is-warn">Sueldo empresarial (Art. 31 N° 6 LIR / Art. 7° CT): el socio con administración carece de subordinación laboral, por lo que no corresponde cálculo de finiquito estándar (IAS, aviso previo ni feriado proporcional).</div>
          ` : ''}
          <div class="v2-ins-row">
            <span>Causal legal</span>
            <select id="sel-fin-cause" style="height:28px;border:1px solid var(--ink-rule);border-radius:6px;padding:0 6px;background:var(--ink-paper)">
              <option value="161" ${state.finiquitoCause === '161' ? 'selected' : ''}>Art. 161 · Necesidades</option>
              <option value="159" ${state.finiquitoCause === '159' ? 'selected' : ''}>Art. 159 · Renuncia / Mutuo</option>
              <option value="160" ${state.finiquitoCause === '160' ? 'selected' : ''}>Art. 160 · Sin indemnización</option>
            </select>
          </div>
          ${sf ? `
            <dl class="v2-ins-kv">
              <dt>Base Art. 172</dt><dd>${fmt(sf.economics.cappedSalary)}</dd>
              <dt>Años servicio</dt><dd>${fmt(sf.indemnities.yearsOfService.total)}</dd>
              <dt>Aviso previo</dt><dd>${fmt(sf.indemnities.notice.total)}</dd>
              <dt>Feriado proporcional</dt><dd>${fmt(sf.indemnities.vacation.total)}</dd>
              <dt>Rem. pendiente</dt><dd>${fmt(sf.pendingRemuneration ? sf.pendingRemuneration.total : 0)}</dd>
              <dt>Desc. aporte AFC</dt><dd>−${fmt(sf.afc && sf.afc.applied ? sf.afc.total : 0)}</dd>
              <dt><strong>Total a pagar</strong></dt><dd><strong>${fmt(sf.total)}</strong></dd>
            </dl>
          ` : ''}
          ${c.nomina.leyBustos ? `<div class="tag tag--on" style="justify-content:center">Bloqueo Ley Bustos Art. 162 CT</div>` : ''}
        </div>
      ` : '';
      return;
    }

    if (state.clientSub === 'previred') {
      const prev = generarPreviredReal(c, iso);
      const lre = generarLreReal(c, iso);
      const prevErr = prev && prev.salida ? prev.salida.errores : [];
      const lreErr = lre ? lre.errores : [];
      const blockers = getClientPayrollBlockers(c);
      const totalBlockCount = prevErr.length + blockers.length;
      const tot = prev && prev.totales ? prev.totales : { afp: 0, sis: 0, salud: 0, mutual: 0, afcTrabajador: 0, afcEmpleador: 0, total: 0, lineas: 0 };

      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Líneas Previred (105)</span><span class="v2-tape-val">${tot.lineas}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Total cotizaciones</span><span class="v2-tape-val is-in">${fmt(tot.total)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Bloqueos PreviRed</span><span class="v2-tape-val ${totalBlockCount ? 'is-danger' : ''}">${totalBlockCount}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Columnas LRE Mi DT</span><span class="v2-tape-val">${lre && lre.columnas ? lre.columnas.length : 147}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Entregable oficial</th><th>Especificación</th><th>Validación motor real</th><th class="num">Acción</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>Archivo Nómina Previred (.txt)</strong></td>
                <td class="mono">105 campos · sep ";" · v100</td>
                <td><span class="tag ${totalBlockCount ? 'tag--danger' : 'tag--in'}">${blockers.length ? `Bloqueado: ${blockers.length} ficha(s) incompleta(s)` : prevErr.length ? prevErr[0] : `${tot.lineas} filas${prev && prev.excluidosSocio ? ` · ${prev.excluidosSocio} socio excl.` : ''} · 0 errores`}</span></td>
                <td class="num">${blockers.length ? `<button type="button" class="btn btn--sm" data-go-incomplete="1">Completar fichas (${blockers.length})</button>` : `<button type="button" class="btn btn--primary btn--sm" id="btn-dl-previred">Descargar TXT</button>`}</td>
              </tr>
              <tr>
                <td><strong>Libro Remuneraciones Electrónico (LRE)</strong></td>
                <td class="mono">147 cols · ANSI Win-1252 · ${lre ? lre.nombreArchivo : ''}</td>
                <td><span class="tag ${lreErr.length ? 'tag--on' : 'tag--in'}">${lreErr.length ? lreErr[0] : `${c.workers.length} filas · 0 errores`}</span></td>
                <td class="num"><button type="button" class="btn btn--sm" id="btn-dl-lre">Descargar CSV</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <h2 class="v2-ins-title">Cuadre Previred (105 campos)</h2>
          <dl class="v2-ins-kv">
            <dt>AFP trabajador</dt><dd>${fmt(tot.afp)}</dd>
            <dt>SIS empleador</dt><dd>${fmt(tot.sis)}</dd>
            <dt>Salud (Fonasa/Isapre)</dt><dd>${fmt(tot.salud)}</dd>
            <dt>Mutual / ISL</dt><dd>${fmt(tot.mutual)}</dd>
            <dt>AFC trabajador + emp.</dt><dd>${fmt(tot.afcTrabajador + tot.afcEmpleador)}</dd>
            <dt><strong>Total planilla</strong></dt><dd><strong>${fmt(tot.total)}</strong></dd>
          </dl>
        </div>
      `;
      return;
    }

    const blockers = getClientPayrollBlockers(c);
    const incompleteCount = blockers.length;
    if (state.workerFilter === 'incompletas' && incompleteCount === 0) state.workerFilter = 'todos';
    const visibleComputed = state.workerFilter === 'incompletas'
      ? computed.filter(({ w }) => getWorkerMissing(w).length > 0)
      : computed;
    const activeSel = visibleComputed.find((x) => x.w.id === state.selectedWorkerId) || visibleComputed[0] || selectedObj;
    if (activeSel) state.selectedWorkerId = activeSel.w.id;

    $('v2-canvas').innerHTML = `
      <div class="v2-tape">
        <div class="v2-tape-cell"><span class="v2-tape-label">Dotación</span><span class="v2-tape-val">${c.workers.length}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Total imponible</span><span class="v2-tape-val" data-nom-tape="imponible">${fmt(totalImp)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Líquido a pagar</span><span class="v2-tape-val is-in" data-nom-tape="liquido">${fmt(totalLiquido)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Costo empleador</span><span class="v2-tape-val" data-nom-tape="empleador">${fmt(totalEmp)}</span></div>
      </div>
      <div class="v2-pulse-bar">
        <div class="v2-filter-pills" role="group" aria-label="Filtrar fichas de trabajadores">
          <button type="button" class="v2-pill-btn" data-worker-filter="todos" aria-pressed="${state.workerFilter === 'todos'}">Todos <span class="mono">${c.workers.length}</span></button>
          <button type="button" class="v2-pill-btn" data-worker-filter="incompletas" aria-pressed="${state.workerFilter === 'incompletas'}">Fichas incompletas <span class="mono">${incompleteCount}</span></button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="tag ${incompleteCount ? 'tag--danger' : 'tag--in'}">${incompleteCount ? `PreviRed bloqueado · ${incompleteCount} ficha(s)` : 'Fichas completas · PreviRed listo'}</span>
          <label class="btn btn--sm">Importar LRE CSV<input type="file" accept=".csv,.txt" id="v2-csv-lre" class="sr-only"></label>
          <button type="button" class="btn btn--sm" id="btn-sample-lre">Migrar LRE ejemplo</button>
        </div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr class="v2-superhead">
              <th colspan="4">Se ingresa este mes</th>
              <th colspan="3" class="v2-th-calc">Calculado</th>
            </tr>
            <tr class="v2-subhead">
              <th style="width:32px"></th><th>Trabajador</th><th>RUT</th><th>AFP</th>
              <th class="num v2-col-calc v2-col-calc-start">Imponible</th>
              <th class="num v2-col-calc">Líquido</th>
              <th class="v2-col-calc">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${visibleComputed.map(({ w, calc }) => {
              const missing = getWorkerMissing(w);
              const badgeText = missing.length ? missing.map((m) => m.label).join(' · ') : w.estado;
              const isOk = !missing.length && (w.estado === 'Listo' || w.estado === 'Pagado');
              return `
                <tr class="${activeSel && activeSel.w.id === w.id ? 'is-selected' : ''}" data-select-worker="${w.id}" style="cursor:pointer">
                  <td><input type="checkbox" data-batch-id="${w.id}" ${state.selectedIds.has(w.id) ? 'checked' : ''} aria-label="Seleccionar ${w.name}"></td>
                  <td><strong>${w.name}</strong><span class="v2-cell-sub">${w.cargo}${w.tipoRegimen === 'socio' ? ' · Socio empresarial' : w.tipoRegimen === 'pensionado' ? ' · Pensionado vejez' : ''}</span></td>
                  <td class="mono">${w.rut}</td>
                  <td>${w.afp}</td>
                  <td class="num v2-col-calc v2-col-calc-start" data-row-imp="${w.id}">${fmt(calc.imponible)}</td>
                  <td class="num v2-col-calc" data-row-liq="${w.id}"><strong>${fmt(calc.liquido)}</strong></td>
                  <td class="v2-col-calc"><span class="tag ${isOk ? 'tag--in' : 'tag--danger'}">${badgeText}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">Liquidaciones · ${iso}</td>
              <td class="num" data-nom-foot="imponible">${fmt(totalImp)}</td>
              <td class="num" data-nom-foot="liquido">${fmt(totalLiquido)}</td>
              <td class="mono">LRE 147</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    if (activeSel) {
      const { w, calc } = activeSel;
      const d = calc.detalle || {};
      const wMissing = getWorkerMissing(w);
      $('v2-inspector').innerHTML = `
        ${wMissing.length ? `
          <div class="v2-ins-block" id="v2-worker-blockers">
            <div class="v2-ins-head">
              <h2 class="v2-ins-title">Bloqueo PreviRed</h2>
              <span class="tag tag--danger">${wMissing.length} faltante(s)</span>
            </div>
            <p class="muted" style="margin:0;font-size:12px;line-height:1.4">Completa los datos obligatorios antes de exportar el archivo PreviRed (105 campos).</p>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${wMissing.map((m) => `
                <div class="v2-ins-row" style="padding:6px 0">
                  <span><strong>${m.label}</strong></span>
                  <button type="button" class="btn btn--primary btn--sm" data-fix-worker-flag="${w.id}:${m.key}">Completar</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="v2-ins-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">${w.name}</h2>
            <span class="tag ${!wMissing.length && (w.estado === 'Listo' || w.estado === 'Pagado') ? 'tag--in' : 'tag--danger'}">${wMissing.length ? wMissing[0].label : w.estado}</span>
          </div>
          <div class="muted" style="font-size:12px">${w.cargo} · <span class="mono">${w.rut}</span></div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:2px">
            <label for="sel-worker-regimen" class="muted" style="font-size:11.5px">Régimen previsional / tributario</label>
            <select id="sel-worker-regimen" class="v2-ins-select">
              <option value="dependiente" ${(w.tipoRegimen || 'dependiente') === 'dependiente' ? 'selected' : ''}>Dependiente (Código del Trabajo)</option>
              <option value="socio" ${w.tipoRegimen === 'socio' ? 'selected' : ''}>Socio con sueldo empresarial (Art. 31 N°6)</option>
              <option value="pensionado" ${w.tipoRegimen === 'pensionado' ? 'selected' : ''}>Pensionado por vejez (Art. 69 D.L. 3.500)</option>
            </select>
          </div>
          ${w.tipoRegimen === 'pensionado' ? `
            <div class="v2-ins-row">
              <span>Pensión mensual ($)</span>
              <input type="number" class="v2-inline-input" id="inp-worker-pension" value="${w.pensionMensual || 0}" aria-label="Pensión mensual de ${w.name}">
            </div>
            <label class="v2-ins-check">
              <input type="checkbox" id="chk-worker-afp-vol" ${w.cotizaAfpVoluntaria ? 'checked' : ''}>
              <span>Cotiza AFP voluntariamente (PreviRed Tipo 1; por defecto Tipo 2 exento).</span>
            </label>
          ` : ''}
          <div class="v2-ins-row">
            <span>${w.tipoRegimen === 'socio' ? 'Sueldo empresarial ($)' : 'Sueldo base ($)'}</span>
            <input type="number" class="v2-inline-input" id="inp-worker-base" value="${w.base}" aria-label="Sueldo base de ${w.name}">
          </div>
          ${w.tipoRegimen === 'socio' ? `
            <div class="v2-ins-note">Sueldo empresarial (Art. 31 N° 6 LIR): sin aportes patronales ni finiquito laboral. Excluido de PreviRed (LRE 2161/3161). Colación/movilización tributan IUSC (F29 Cód. 48).</div>
          ` : w.tipoRegimen === 'pensionado' ? `
            <div class="v2-ins-note">Pensionado por vejez (Art. 69 y 16 D.L. 3.500): exento de AFP, AFC, SIS y Ley 21.735; mantiene Salud (tope 90 UF menos pensión) y Mutual/SANNA.</div>
          ` : ''}
          <dl class="v2-ins-kv" id="v2-worker-kv" style="margin-top:4px">
            ${(d.haberesImponibles || []).map((h) => `<dt>${h.concepto}</dt><dd>${fmt(h.monto)}</dd>`).join('')}
            ${(d.descuentosLegales || []).map((x) => `<dt>${x.concepto}</dt><dd>−${fmt(x.monto)}</dd>`).join('')}
            <dt><strong>Líquido a pagar</strong></dt><dd><strong>${fmt(calc.liquido)}</strong></dd>
            <dt>Aportes empleador</dt><dd>${fmt(calc.costoEmpleador)}</dd>
          </dl>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn--primary btn--sm" style="flex:1" id="btn-dl-previred">${incompleteCount ? `Previred bloqueado (${incompleteCount})` : 'Previred 105'}</button>
            <button type="button" class="btn btn--sm" id="btn-dl-lre">LRE 147</button>
          </div>
        </div>
        ${c.nomina.leyBustos ? `
          <div class="v2-ins-block v2-ins-block--soft">
            <h2 class="v2-ins-title">Alerta Ley Bustos (Art. 162 CT)</h2>
            <p class="muted" style="margin:0;font-size:12.5px">Cotizaciones impagas con finiquito abierto. Regulariza PreviRed antes de ratificar el despido.</p>
          </div>
        ` : ''}
      `;
    }
  }

  function renderClientBancos(c) {
    const selected = c.bankTx.find((b) => b.id === state.selectedBankId) || c.bankTx[0] || null;
    if (selected) state.selectedBankId = selected.id;
    const conc = c.bankTx.filter((t) => t.status === 'Conciliado').length;
    const pend = c.bankTx.length - conc;
    $('v2-canvas').innerHTML = `
      <div class="v2-pulse-bar">
        <span class="muted">Conciliación bancaria (${conc}/${c.bankTx.length} cuadrados)</span>
        <label class="btn btn--sm">
          Importar cartola CSV
          <input type="file" accept=".csv,.txt" id="v2-csv-cartola" class="sr-only">
        </label>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Fecha</th><th>Movimiento bancario</th><th class="num">Monto</th><th>Sugerencia</th><th>Estado</th></tr></thead>
          <tbody>
            ${c.bankTx.length ? c.bankTx.map((tx) => `
              <tr class="${selected && selected.id === tx.id ? 'is-selected' : ''}" data-select-bank="${tx.id}" style="cursor:pointer">
                <td class="mono">${tx.date}</td>
                <td><strong>${tx.desc}</strong></td>
                <td class="num">${fmt(tx.amount)}</td>
                <td class="muted">${tx.match}</td>
                <td><span class="tag ${tx.status === 'Conciliado' ? 'tag--in' : 'tag--out'}">${tx.status}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="padding:24px;text-align:center" class="muted">Sin cartola cargada para ${currentPeriod().label}. Sube una cartola CSV arriba o pídela al cliente.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    if (selected) {
      const checks = selected.checks || [
        { ok: true, label: `Monto en cartola: ${fmt(selected.amount)}` },
        { ok: true, label: `Fecha movimiento: ${selected.date}` },
        { ok: false, label: 'Sin documento RCV vinculado automáticamente' }
      ];
      const docs = selected.docs || [
        { title: selected.match || 'Sin documento asociado', sub: 'Clasificación manual / cartola CSV', amount: selected.amount }
      ];
      const docsSum = docs.reduce((s, d) => s + d.amount, 0);
      const diff = selected.amount - docsSum;
      const multiLabel = docs.length > 1 ? `1 pago → ${docs.length} docs` : '1 pago → 1 doc';
      const conf = selected.confidence || (selected.status === 'Conciliado' ? 'Alta' : 'Revisar');
      const rulePattern = selected.rulePattern || selected.desc.split(' ').slice(0, 2).join(' ');
      const ruleAccount = selected.account || (selected.amount >= 0 ? '11050 · Clientes nacionales' : '21010 · Proveedores nacionales');
      const ruleKey = `${c.id}::${rulePattern.toLowerCase()}`;
      const ruleSaved = !!state.bankRules[ruleKey];

      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">Evidencia del calce</h2>
            <span class="tag ${selected.status === 'Conciliado' ? 'tag--in' : conf === 'Alta' ? 'tag--in' : 'tag--out'}">${selected.status === 'Conciliado' ? 'Conciliado' : `Confianza ${conf}`}</span>
          </div>
          <div class="v2-ev-list">
            ${checks.map((ch) => `
              <div class="v2-ev-item">
                <span class="v2-ev-mark ${ch.ok ? 'is-ok' : 'is-warn'}" aria-hidden="true">${ch.ok ? '✓' : '✗'}</span>
                <span>${ch.label}</span>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;margin-top:4px">
            <span class="muted">Documentos vinculados</span>
            <span class="mono muted">${multiLabel}</span>
          </div>
          <div class="v2-doc-list">
            ${docs.map((d) => `
              <div class="v2-doc-row">
                <div class="v2-doc-row__meta">
                  <span class="v2-doc-row__title" title="${d.title}">${d.title}</span>
                  <span class="v2-doc-row__sub">${d.sub}</span>
                </div>
                <span class="v2-doc-row__amt">${fmt(d.amount)}</span>
              </div>
            `).join('')}
          </div>
          <dl class="v2-ins-kv">
            <dt>Monto banco</dt><dd>${fmt(selected.amount)}</dd>
            <dt>Diferencia calce</dt><dd>${fmt(diff)}</dd>
            <dt>Cuenta asiento</dt><dd style="font-family:var(--font-sans);font-size:12px">${ruleAccount}</dd>
          </dl>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
            ${selected.status !== 'Conciliado'
              ? `<button type="button" class="btn btn--primary" data-match-tx="${selected.id}">Confirmar calce y contabilizar</button>`
              : `<button type="button" class="btn" data-unmatch-tx="${selected.id}">Desvincular calce</button>`}
            <button type="button" class="btn" data-quick-ok="Micro-solicitud sin clave enviada por ${selected.desc}">Pedir respaldo al cliente</button>
          </div>
        </div>

        <div class="v2-ins-block v2-ins-block--soft">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">Regla recurrente de glosa</h2>
            ${ruleSaved ? '<span class="tag tag--in">Activa</span>' : '<span class="muted" style="font-size:11.5px">Opcional</span>'}
          </div>
          <p class="muted" style="margin:0;font-size:12px;line-height:1.4">
            Si la glosa contiene <strong style="color:var(--ink)">«${rulePattern}»</strong> → asignar a <span class="mono">${ruleAccount}</span>.
          </p>
          <button type="button" class="btn btn--sm" data-save-bank-rule="${ruleKey}" data-rule-pattern="${rulePattern}" data-rule-account="${ruleAccount}">
            ${ruleSaved ? 'Regla guardada (quitar)' : 'Guardar regla para próximos meses'}
          </button>
        </div>
      `;
    } else {
      $('v2-inspector').innerHTML = `<div class="v2-ins-block"><h2 class="v2-ins-title">Cartola pendiente</h2><p class="muted" style="margin:0;font-size:12.5px">Pendientes por conciliar: ${pend}</p><button type="button" class="btn btn--primary" data-quick-ok="Enlace sin clave enviado a ${c.name}">Pedir cartola al cliente</button></div>`;
    }
  }

  function buildAccountingReal(c) {
    const C = window.CLContabilidad;
    if (!C) return { asientos: [], mayor: [], bal: { filas: [], totales: {} } };
    const iso = currentPeriod().iso;
    const fecha = iso + '-30';
    const asientos = [];
    const vNeto = c.rcv.ventasNeto || 0;
    const vIva = c.f29.debito || 0;
    if (vNeto + vIva > 0) {
      asientos.push(C.crearAsiento('AS-VTA', fecha, 'Centralización ventas del mes (RCV)', 'f29', [
        { cuenta: '11050', debe: vNeto + vIva, haber: 0 },
        { cuenta: '51010', debe: 0, haber: vNeto },
        { cuenta: '21050', debe: 0, haber: vIva }
      ]));
    }
    const cNeto = c.rcv.comprasNeto || 0;
    const cIva = c.f29.credito || 0;
    if (cNeto + cIva > 0) {
      asientos.push(C.crearAsiento('AS-CMP', fecha, 'Centralización compras e insumos (RCV)', 'f29', [
        { cuenta: '41010', debe: cNeto, haber: 0 },
        { cuenta: '11080', debe: cIva, haber: 0 },
        { cuenta: '21010', debe: 0, haber: cNeto + cIva }
      ]));
    }
    const computed = c.workers.map((w) => calcularWorkerReal(w, iso));
    const totImp = computed.reduce((s, x) => s + x.imponible, 0);
    const totLiq = computed.reduce((s, x) => s + x.liquido, 0);
    const totEmp = computed.reduce((s, x) => s + x.costoEmpleador, 0);
    if (c.f29.contabilizado || c.f29.state === 'contabilizado' || c.f29.state === 'declarado' || c.f29.state === 'pagado') {
      const f29Iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
      const f29Ppm = c.f29.ppm || 0;
      if (f29Iva + f29Ppm > 0) {
        const lineasF29 = [];
        if (f29Iva > 0) {
          lineasF29.push({ cuenta: '21050', debe: f29Iva, haber: 0 });
          lineasF29.push({ cuenta: '21055', debe: 0, haber: f29Iva });
        }
        if (f29Ppm > 0) {
          lineasF29.push({ cuenta: '11090', debe: f29Ppm, haber: 0 });
          lineasF29.push({ cuenta: '21055', debe: 0, haber: f29Ppm });
        }
        asientos.push(C.crearAsiento('AS-F29', fecha, 'Liquidación IVA y provisión PPM (F29)', 'f29', lineasF29));
      }
    }
    const totImpUnico = computed.reduce((s, x) => s + x.impUnico, 0);
    const cotizTrab = Math.max(0, totImp - totLiq - totImpUnico);
    if (totImp > 0) {
      asientos.push(C.crearAsiento('AS-NOM', fecha, `Centralización remuneraciones (${c.workers.length} trab.)`, 'nomina', [
        { cuenta: '42010', debe: totImp, haber: 0 },
        { cuenta: '42015', debe: totEmp, haber: 0 },
        { cuenta: '21030', debe: 0, haber: totLiq },
        { cuenta: '21035', debe: 0, haber: cotizTrab + totEmp },
        { cuenta: '21040', debe: 0, haber: totImpUnico }
      ]));
    }
    if (c.f29.ppm > 0) {
      asientos.push(C.crearAsiento('AS-PPM', fecha, 'Provisión PPM mensual F29 cód. 62', 'f29', [
        { cuenta: '11090', debe: c.f29.ppm, haber: 0 },
        { cuenta: '21070', debe: 0, haber: c.f29.ppm }
      ]));
    }
    const valid = asientos.filter(Boolean);
    const mayor = C.calcularMayor(valid);
    const bal = C.calcularBalance8Columnas(mayor);
    return { asientos: valid, mayor, bal };
  }

  function renderClientContabilidad(c) {
    const { asientos, bal } = buildAccountingReal(c);
    const t = bal.totales || {};
    const cuadra = t.debito === t.credito;

    if (state.clientSub === 'diario') {
      $('v2-canvas').innerHTML = `
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Asiento</th><th>Fecha</th><th>Cuenta y glosa</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
            <tbody>
              ${asientos.flatMap((a) => a.lineas.map((l, idx) => `
                <tr>
                  <td class="mono">${idx === 0 ? a.id : ''}</td>
                  <td class="mono">${idx === 0 ? a.fecha : ''}</td>
                  <td><span class="mono muted">${l.cuenta}</span> ${idx === 0 ? `<strong>${a.glosa}</strong>` : (window.CLContabilidad ? window.CLContabilidad.cuentaInfo(l.cuenta).nombre : '')}</td>
                  <td class="num">${l.debe ? fmt(l.debe) : '—'}</td>
                  <td class="num">${l.haber ? fmt(l.haber) : '—'}</td>
                </tr>
              `)).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Total Débitos</span><span class="v2-tape-val">${fmt(t.debito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Total Créditos</span><span class="v2-tape-val">${fmt(t.credito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Resultado período</span><span class="v2-tape-val ${((t.ganancia || 0) - (t.perdida || 0)) < 0 ? 'is-danger' : 'is-in'}">${fmt((t.ganancia || 0) - (t.perdida || 0))}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Partida doble</span><span class="v2-tape-val">${cuadra ? 'Cuadrado' : 'Revisar'}</span></div>
        </div>
        <div class="v2-scope-bar">
          <div class="v2-seg" role="group" aria-label="Alcance del balance">
            <button type="button" data-bal-scope="acumulado" aria-pressed="${state.balanceScope === 'acumulado'}">Acumulado</button>
            <button type="button" data-bal-scope="mes" aria-pressed="${state.balanceScope === 'mes'}">Movimientos del mes</button>
          </div>
          <details class="v2-export-menu">
            <summary class="btn btn--sm">Exportar ▾</summary>
            <div class="v2-export-pop">
              <button type="button" data-export-bal="csv">Balance 8 Columnas (CSV)</button>
              <button type="button" data-export-bal="diario">Libro Diario (CSV)</button>
            </div>
          </details>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead>
              <tr><th style="width:66px">Cta.</th><th>Nombre cuenta · ${state.balanceScope === 'mes' ? currentPeriod().label : 'Acumulado año'}</th><th class="num">Deudor</th><th class="num">Acreedor</th><th class="num">Activo</th><th class="num">Pasivo</th><th class="num">Pérdida</th><th class="num">Ganancia</th></tr>
            </thead>
            <tbody>
              ${(bal.filas || []).map((f) => `
                <tr>
                  <td class="mono">${f.codigo}</td>
                  <td><strong>${f.nombre}</strong></td>
                  <td class="num">${f.deudor ? fmt(f.deudor) : '—'}</td>
                  <td class="num">${f.acreedor ? fmt(f.acreedor) : '—'}</td>
                  <td class="num">${f.activo ? fmt(f.activo) : '—'}</td>
                  <td class="num">${f.pasivo ? fmt(f.pasivo) : '—'}</td>
                  <td class="num">${f.perdida ? fmt(f.perdida) : '—'}</td>
                  <td class="num">${f.ganancia ? fmt(f.ganancia) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">${asientos.length} asientos centralizados</td>
                <td class="num">${fmt(t.deudor)}</td>
                <td class="num">${fmt(t.acreedor)}</td>
                <td class="num">${fmt(t.activo)}</td>
                <td class="num">${fmt(t.pasivo)}</td>
                <td class="num">${fmt(t.perdida)}</td>
                <td class="num">${fmt(t.ganancia)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <div class="v2-ins-head"><h2 class="v2-ins-title">Salud contable · ${c.regime}</h2><span class="tag ${cuadra ? 'tag--in' : 'tag--on'}">${cuadra ? 'Debe = Haber' : 'Descuadre'}</span></div>
        <dl class="v2-ins-kv">
          <dt>Asientos centralizados</dt><dd>${asientos.length}</dd>
          <dt>Cuentas con movimiento</dt><dd>${(bal.filas || []).length}</dd>
          <dt>Total Activo</dt><dd>${fmt(t.activo)}</dd>
          <dt>Total Pasivo</dt><dd>${fmt(t.pasivo)}</dd>
          <dt>Utilidad / Pérdida</dt><dd>${fmt((t.ganancia || 0) - (t.perdida || 0))}</dd>
        </dl>
      </div>
    `;
  }

  function renderClientResumen(c) {
    $('v2-canvas').innerHTML = `
      <div class="v2-tape">
        <div class="v2-tape-cell"><span class="v2-tape-label">Ventas netas</span><span class="v2-tape-val">${fmt(c.rcv.ventasNeto)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Compras netas</span><span class="v2-tape-val">${fmt(c.rcv.comprasNeto)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">F29 estimado</span><span class="v2-tape-val is-in">${fmt(f29Total(c))}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Dotación</span><span class="v2-tape-val">${c.workers.length}</span></div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Hito de cierre mensual</th><th>Estado actual</th><th>Acceso directo</th></tr></thead>
          <tbody>
            <tr><td>1. Registro Compras y Ventas (RCV) + Acuses 8d</td><td><span class="tag ${c.rcv.state === 'alerta' ? 'tag--danger' : 'tag--in'}">${c.rcv.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="rcv">Abrir RCV</button></td></tr>
            <tr><td>2. Remuneraciones, PreviRed (105) y LRE (147)</td><td><span class="tag ${c.nomina.state === 'ok' ? 'tag--in' : 'tag--danger'}">${c.nomina.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="remuneraciones">Abrir Nómina</button></td></tr>
            <tr><td>3. Conciliación Bancaria</td><td><span class="tag ${c.bancos.state === 'ok' ? 'tag--in' : 'tag--out'}">${c.bancos.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="bancos">Abrir Bancos</button></td></tr>
            <tr><td>4. Declaración F29 (Cód. 91)</td><td><span class="tag ${c.f29.state === 'declarado' || c.f29.state === 'listo' ? 'tag--in' : 'tag--out'}">${fmt(f29Total(c))} · ${f29StateLabel(c.f29.state)}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="f29">Abrir F29</button></td></tr>
          </tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Paquete Mensual para el dueño</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Envía en 1 clic el resumen ejecutivo del mes (F29, nómina y caja) con membrete del estudio.</p>
        <button type="button" class="btn btn--primary" data-quick-ok="Paquete Mensual generado para ${c.name}">Emitir Paquete PDF</button>
        <button type="button" class="btn" data-quick-ok="Enlace de Portal sin clave copiado para ${c.name}">Copiar enlace Portal sin clave</button>
      </div>
    `;
  }

  function renderBatchBar() {
    const bar = $('v2-batch-bar');
    const n = state.selectedIds.size;
    bar.hidden = n === 0;
    if (n > 0) $('v2-batch-count').textContent = `${n} seleccionados en lote`;
  }

  function render() {
    renderSidebar();
    renderTopbar();
    renderBatchBar();
    if (state.level === 'studio') {
      if (state.studioView === 'hoy') renderStudioHoy();
      else if (state.studioView === 'olas') renderStudioOlas();
      else if (state.studioView === 'bandeja') renderStudioBandeja();
      else renderStudioEmpresas();
    } else {
      const c = getClient();
      if (state.clientArea === 'resumen') renderClientResumen(c);
      else if (state.clientArea === 'impuestos') renderClientImpuestos(c);
      else if (state.clientArea === 'remuneraciones') renderClientRemuneraciones(c);
      else if (state.clientArea === 'bancos') renderClientBancos(c);
      else renderClientContabilidad(c);
    }
  }

  /* ==================== EXPORTADORES REALES ==================== */
  function triggerPreviredDownload(c) {
    const blockers = getClientPayrollBlockers(c);
    if (blockers.length) {
      state.clientSub = 'nomina';
      state.workerFilter = 'incompletas';
      state.selectedWorkerId = blockers[0].w.id;
      toast(`PreviRed bloqueado: completa ${blockers.length} ficha(s) incompleta(s) antes de exportar`);
      render();
      return;
    }
    const res = generarPreviredReal(c, currentPeriod().iso);
    if (!res || !res.salida) { toast('Motor Previred no disponible o sin trabajadores'); return; }
    if (res.salida.errores && res.salida.errores.length) {
      toast('Previred rechazado: ' + res.salida.errores[0]);
      return;
    }
    downloadFile(res.salida.texto, `previred_105_${c.id}_${currentPeriod().iso}.txt`, 'text/plain;charset=utf-8');
    toast(`Previred 105 campos descargado (${res.totales.lineas} trab. · ${fmt(res.totales.total)})`);
  }

  function triggerLreDownload(c) {
    const lre = generarLreReal(c, currentPeriod().iso);
    if (!lre) { toast('Motor LRE no disponible o sin trabajadores'); return; }
    if (lre.errores && lre.errores.length) {
      toast('LRE con error: ' + lre.errores[0]);
      return;
    }
    const bytes = window.CLLre.bytesAnsi(lre.texto);
    downloadFile(bytes, lre.nombreArchivo || `lre_${c.id}.csv`, 'text/csv;charset=windows-1252');
    toast(`LRE Mi DT (147 cols ANSI) descargado: ${lre.nombreArchivo}`);
  }

  function applyRcvToClient(c, ventasCsv, comprasCsv) {
    const F = window.CLContadoresF29;
    if (!F) return;
    const v = ventasCsv ? F.parsearRcv(ventasCsv, 'ventas') : null;
    const comp = comprasCsv ? F.parsearRcv(comprasCsv, 'compras') : null;
    const impUnicoSum = c.workers.reduce((s, w) => s + calcularWorkerReal(w, currentPeriod().iso).impUnico, 0);
    const res = F.calcularF29({
      ventas: v || undefined,
      compras: comp || undefined,
      regimen: c.regime.replace(/\s+/g, ''),
      periodo: currentPeriod().iso,
      impuestoUnico48: impUnicoSum
    });
    if (v) c.f29.debito = res.cod538;
    if (comp) c.f29.credito = res.cod537;
    if (res.cod62) c.f29.ppm = res.cod62;
    c.f29.retenciones = (res.cod48 || 0) + (res.cod151 || 0);
    c.rcv.state = 'ok';
    c.rcv.label = 'RCV procesado (SII)';
    toast(`F29 recalculado desde RCV · Total Cód. 91: ${fmt(f29Total(c))}`);
    state.clientSub = 'f29';
    render();
  }

  const LRE_AFP_BY_CODE = { '3': 'Cuprum', '03': 'Cuprum', '5': 'Habitat', '05': 'Habitat', '8': 'Provida', '08': 'Provida', '29': 'Planvital', '33': 'Capital', '34': 'Modelo', '35': 'Uno' };

  function parseLreDate(str) {
    const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(String(str || '').trim());
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(str || '').trim())) return String(str).trim();
    return '';
  }

  function formatRutDots(raw) {
    const clean = String(raw || '').replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length < 2) return String(raw || '').trim();
    const cuerpo = clean.slice(0, -1).replace(/^0+/, '');
    const dv = clean.slice(-1);
    return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
  }

  function parseLreCsv(csvText) {
    const lines = String(csvText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { workers: [], rentaAnual: 0, iuscAnual: 0, error: 'El archivo LRE debe tener encabezado y al menos 1 trabajador.' };
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map((h) => h.trim());
    const idxOf = (code) => headers.findIndex((h) => h === code || h.includes(`(${code})`) || new RegExp(`\\b${code}\\b`).test(h));
    const idxNombre = headers.findIndex((h) => /nombre/i.test(h));

    const cRut = idxOf('1101');
    if (cRut === -1) return { workers: [], rentaAnual: 0, iuscAnual: 0, error: 'No se encontró la columna RUT trabajador (1101) en el LRE.' };
    const cIngreso = idxOf('1102');
    const cPens = idxOf('1109');
    const cAfp = idxOf('1141');
    const cBase = idxOf('2101');
    const cSocio = idxOf('2161');
    const cIusc = idxOf('3161');
    const cTrib = idxOf('5210') !== -1 ? idxOf('5210') : idxOf('5201');

    const num = (cols, idx) => (idx >= 0 && cols[idx] !== undefined ? Math.max(0, Math.round(Number(String(cols[idx]).replace(/[^0-9.-]/g, '')) || 0)) : 0);
    const workers = [];
    let rentaAnual = 0;
    let iuscAnual = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((x) => x.trim());
      const rutRaw = cols[cRut];
      if (!rutRaw) continue;
      const rut = formatRutDots(rutRaw);
      const ingreso = cIngreso >= 0 ? parseLreDate(cols[cIngreso]) : '';
      const isPens = cPens >= 0 && String(cols[cPens]) === '1';
      const afpCode = cAfp >= 0 ? String(cols[cAfp]).replace(/^0+/, '') : '';
      const afp = LRE_AFP_BY_CODE[afpCode] || LRE_AFP_BY_CODE[cAfp >= 0 ? cols[cAfp] : ''] || 'Habitat';
      const valBase = num(cols, cBase);
      const valSocio = num(cols, cSocio);
      const valIusc = num(cols, cIusc);
      const valTrib = num(cols, cTrib) || (valSocio > 0 ? valSocio : valBase);
      const tipoRegimen = valSocio > 0 ? 'socio' : isPens ? 'pensionado' : 'dependiente';
      const base = valSocio > 0 ? valSocio : (valBase || 650000);
      const nombre = (idxNombre >= 0 && cols[idxNombre]) ? cols[idxNombre] : `Trabajador ${rut}`;
      const sinContrato = !ingreso;
      workers.push({
        rut,
        name: nombre,
        ingreso: ingreso || '2025-01-01',
        sinContrato,
        afp,
        base,
        tipoRegimen,
        pensionMensual: tipoRegimen === 'pensionado' ? 550000 : 0,
        cotizaAfpVoluntaria: false,
        cargo: tipoRegimen === 'socio' ? 'Socio (migrado LRE)' : tipoRegimen === 'pensionado' ? 'Pensionado (migrado LRE)' : 'Migrado desde LRE',
        estado: sinContrato ? 'Sin contrato' : 'Listo'
      });
      rentaAnual += valTrib;
      iuscAnual += valIusc;
    }
    if (!workers.length) return { workers: [], rentaAnual: 0, iuscAnual: 0, error: 'No se encontraron filas válidas de trabajadores en el LRE.' };
    return { workers, rentaAnual, iuscAnual, error: null };
  }

  function applyLreCsvToClient(c, csvText, filename) {
    const parsed = parseLreCsv(csvText);
    if (parsed.error) { toast(parsed.error); return; }
    let added = 0, updated = 0, socios = 0, pens = 0;
    parsed.workers.forEach((nw, idx) => {
      if (nw.tipoRegimen === 'socio') socios++;
      if (nw.tipoRegimen === 'pensionado') pens++;
      const normRut = nw.rut.replace(/[^0-9K]/gi, '').toUpperCase();
      const existing = c.workers.find((w) => w.rut.replace(/[^0-9K]/gi, '').toUpperCase() === normRut);
      if (existing) {
        existing.base = nw.base;
        existing.tipoRegimen = nw.tipoRegimen;
        existing.afp = nw.afp;
        if (!nw.sinContrato) { existing.ingreso = nw.ingreso; existing.sinContrato = false; }
        updated++;
      } else {
        c.workers.push({
          id: `lre-${Date.now()}-${idx}`,
          name: nw.name,
          rut: nw.rut,
          sexo: 'F',
          ingreso: nw.ingreso,
          cargo: nw.cargo,
          base: nw.base,
          afp: nw.afp,
          estado: nw.estado,
          sinContrato: nw.sinContrato,
          tipoRegimen: nw.tipoRegimen,
          pensionMensual: nw.pensionMensual,
          cotizaAfpVoluntaria: false
        });
        added++;
      }
    });
    if (!c.lreHistory) c.lreHistory = { imports: 0, rentaNetaAnual: 0, iuscRetenidoAnual: 0, lastFile: '' };
    c.lreHistory.imports += 1;
    c.lreHistory.rentaNetaAnual += parsed.rentaAnual;
    c.lreHistory.iuscRetenidoAnual += parsed.iuscAnual;
    c.lreHistory.lastFile = filename || 'LRE_importado.csv';
    c.nomina.count = c.workers.length;
    c.nomina.label = `${c.workers.length} liq · LRE migrado`;
    const parts = [];
    if (added) parts.push(`${added} nuevo(s)`);
    if (updated) parts.push(`${updated} actualizado(s)`);
    if (socios) parts.push(`${socios} socio`);
    if (pens) parts.push(`${pens} pensionado`);
    toast(`LRE migrado (${parts.join(' · ')}) · DJ 1887 actualizada`);
    state.workerFilter = 'todos';
    render();
  }

  /* ==================== COMMAND PALETTE ⌘K & DRAWER ==================== */
  function openCmdk() {
    $('v2-cmdk-backdrop').hidden = false;
    const inp = $('v2-cmdk-input');
    inp.value = '';
    state.cmdkIdx = 0;
    renderCmdk('');
    inp.focus();
  }
  function closeCmdk() { $('v2-cmdk-backdrop').hidden = true; }
  function updateCmdkActive() {
    const list = $('v2-cmdk-list');
    const items = list.querySelectorAll('.v2-cmdk-item');
    items.forEach((el, idx) => {
      const active = idx === state.cmdkIdx;
      el.classList.toggle('is-active', active);
      if (active) el.scrollIntoView({ block: 'nearest' });
    });
  }
  function renderCmdk(q) {
    const term = q.trim().toLowerCase();
    const entries = [
      { label: 'Volver a Mesa de Cierre (Estudio)', meta: 'Estudio', run: () => enterStudio('hoy') },
      { label: 'Ir a Olas del Mes (Lotes)', meta: 'Estudio', run: () => enterStudio('olas') },
      { label: '+ Agregar nueva empresa', meta: 'Acción', run: () => openDrawer() },
      ...state.clients.flatMap((c) => ([
        { label: `${c.name} · Hoja F29`, meta: c.rut, run: () => enterClient(c.id, 'impuestos', 'f29') },
        { label: `${c.name} · Nómina`, meta: `${c.workers.length} trab.`, run: () => enterClient(c.id, 'remuneraciones', 'nomina') },
        { label: `${c.name} · Previred 105 / LRE 147`, meta: 'Exportar', run: () => enterClient(c.id, 'remuneraciones', 'previred') },
        { label: `${c.name} · Bancos`, meta: c.bancos.label, run: () => enterClient(c.id, 'bancos', 'match') }
      ]))
    ].filter((e) => !term || e.label.toLowerCase().includes(term) || e.meta.toLowerCase().includes(term));

    state.cmdkIdx = 0;
    const list = $('v2-cmdk-list');
    list.innerHTML = entries.slice(0, 10).map((e, idx) => `
      <button type="button" class="v2-cmdk-item ${idx === 0 ? 'is-active' : ''}" data-cmdk-idx="${idx}">
        <span>${e.label}</span><span class="mono muted">${e.meta}</span>
      </button>
    `).join('');
    list._entries = entries.slice(0, 10);
  }
  function openDrawer() { $('v2-drawer-wrap').hidden = false; $('nc-name').focus(); }
  function closeDrawer() { $('v2-drawer-wrap').hidden = true; }

  /* ==================== EVENTS ==================== */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-select-worker], [data-select-bank], [data-select-f29], [data-select-rcv], [data-select-inbox]');
    if (!t) return;

    if (t.id === 'btn-open-cmdk' || t.id === 'btn-switch-client') { openCmdk(); return; }
    if (t.id === 'btn-back-studio' || t.dataset.backStudio) { enterStudio('hoy'); return; }
    if (t.id === 'btn-new-client' || t.id === 'btn-ins-new-client') { openDrawer(); return; }
    if (t.id === 'btn-close-drawer' || t.id === 'btn-cancel-drawer') { closeDrawer(); return; }
    if (t.id === 'btn-mobile-menu') { toggleMobileSidebar(); return; }
    if (t.id === 'btn-toggle-sidebar') {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      $('v2-app').classList.toggle('is-sidebar-collapsed', state.sidebarCollapsed);
      t.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
      return;
    }
    if (t.dataset.balScope) {
      state.balanceScope = t.dataset.balScope;
      renderClientContabilidad(getClient());
      return;
    }
    if (t.dataset.exportBal) {
      const det = t.closest('details');
      if (det) det.open = false;
      if (t.dataset.exportBal === 'csv') { $('v2-primary-cta')?.click(); }
      else { toast(`Libro Diario exportado (${state.studioName})`); }
      return;
    }
    if (t.id === 'btn-period-prev') { state.periodIdx = Math.max(0, state.periodIdx - 1); render(); return; }
    if (t.id === 'btn-period-next') { state.periodIdx = Math.min(PERIODS.length - 1, state.periodIdx + 1); render(); return; }
    if (t.id === 'btn-reset-demo') { state.clients = INITIAL_CLIENTS(); state.inbox = INITIAL_INBOX(); toast('Datos restablecidos'); render(); return; }
    if (t.id === 'btn-batch-clear') { state.selectedIds.clear(); render(); return; }
    if (t.id === 'btn-batch-action') { toast(`Lote procesado (${state.selectedIds.size} elementos)`); state.selectedIds.clear(); render(); return; }
    if (t.id === 'btn-dl-previred') { triggerPreviredDownload(getClient()); return; }
    if (t.id === 'btn-dl-lre') { triggerLreDownload(getClient()); return; }
    if (t.id === 'btn-sample-lre') {
      const sampleLre = [
        'Rut trabajador(1101);Nombre;Fecha inicio contrato(1102);Pensionado vejez(1109);AFP(1141);Sueldo(2101);Sueldo empresarial(2161);Impuesto retenido(3161);Total tributable(5210)',
        `${rutConDv(18334512)};Claudia Morales Díaz;15/03/2024;0;05;980000;0;12400;1180000`,
        `${rutConDv(11223344)};Roberto Araya Soto;01/06/2021;0;33;0;2100000;51800;2100000`,
        `${rutConDv(9445566)};Elena Fuenzalida Vera;10/08/2023;1;08;890000;0;0;1070000`
      ].join('\n');
      applyLreCsvToClient(getClient(), sampleLre, 'LRE_ejemplo_3trab.csv');
      return;
    }
    if (t.id === 'btn-run-rcv-sample') {
      const F = window.CLContadoresF29;
      if (F) applyRcvToClient(getClient(), F.ejemploRcvVentasCsv(), F.ejemploRcvComprasCsv());
      return;
    }

    if (t.id === 'v2-primary-cta') {
      if (state.level === 'studio' && state.studioView === 'empresas') { openDrawer(); return; }
      if (state.level === 'studio' && state.studioView === 'hoy') {
        let ok = 0;
        state.clients.forEach((c) => { if (c.f29.state === 'listo') { c.f29.state = 'declarado'; c.f29.folio = String(84920200 + ok); c.status = 'cerrado'; c.cierre = 'Cerrado'; ok++; } });
        toast(ok ? `${ok} declaraciones F29 aprobadas en lote` : 'No hay F29 pendientes en estado listo');
        render(); return;
      }
      if (state.level === 'client' && state.clientArea === 'impuestos') {
        const c = getClient();
        if (c.f29.state === 'pagado') {
          const resumen = `F29 ${c.name} (${c.rut}) - ${currentPeriod().label}\nEstado: Pagado\nFolio SII: ${c.f29.folio}\nTotal Cód. 091: ${fmt(f29Total(c))}\n`;
          downloadFile(resumen, `resumen_f29_${c.id}_${currentPeriod().iso}.txt`, 'text/plain;charset=utf-8');
          toast('Resumen F29 descargado');
        } else if (c.f29.state === 'declarado') {
          c.f29.state = 'pagado';
          c.f29.paidDate = '12/12/2026';
          c.periodClosed = true;
          c.status = 'cerrado';
          c.cierre = 'Pagado y cerrado';
          toast(`Pago TGR registrado para Folio ${c.f29.folio}`);
        } else if (c.f29.state === 'contabilizado') {
          const folioVal = ($('inp-f29-folio') && $('inp-f29-folio').value.trim()) || c.f29.folio || '84920311';
          c.f29.state = 'declarado';
          c.f29.folio = folioVal;
          c.f29.contabilizado = true;
          c.periodClosed = true;
          c.status = 'cerrado';
          c.cierre = 'Cerrado';
          toast(`F29 declarado · Folio SII ${c.f29.folio}`);
        } else {
          c.f29.contabilizado = true;
          c.f29.state = 'contabilizado';
          c.cierre = 'Contabilizado';
          toast('Asiento F29 (IVA + PPM) contabilizado');
        }
        render(); return;
      }
      if (state.level === 'client' && state.clientArea === 'remuneraciones') {
        if (state.clientSub === 'previred') triggerLreDownload(getClient());
        else if (state.clientSub === 'finiquitos') {
          const c = getClient();
          const csv = 'RUT;Trabajador;Causal\n' + c.workers.map((w) => `${w.rut};${w.name};Art.${state.finiquitoCause}`).join('\n');
          downloadFile(csv, `finiquitos_${c.id}_${currentPeriod().iso}.csv`, 'text/csv;charset=utf-8');
          toast('Lote de finiquitos exportado a CSV');
        }
        else triggerPreviredDownload(getClient());
        return;
      }
      if (state.level === 'client' && state.clientArea === 'bancos') {
        const c = getClient();
        let n = 0;
        c.bankTx.forEach((tx) => { if (tx.status !== 'Conciliado') { tx.status = 'Conciliado'; n++; } });
        c.bancos.matched = c.bancos.total || c.bankTx.length;
        c.bancos.state = 'ok';
        c.bancos.label = '100% match';
        toast(n ? `${n} movimientos auto-conciliados` : 'Cartola ya está 100% cuadrada');
        render(); return;
      }
      if (state.level === 'client' && state.clientArea === 'contabilidad') {
        const c = getClient();
        const { bal } = buildAccountingReal(c);
        const csv = 'Codigo;Cuenta;Deudor;Acreedor;Activo;Pasivo;Perdida;Ganancia\n' +
          (bal.filas || []).map((f) => `${f.codigo};${f.nombre};${f.deudor};${f.acreedor};${f.activo};${f.pasivo};${f.perdida};${f.ganancia}`).join('\n');
        downloadFile(csv, `balance_8col_${c.id}_${currentPeriod().iso}.csv`, 'text/csv;charset=utf-8');
        toast('Balance 8 Columnas exportado a CSV');
        return;
      }
      toast(`${t.textContent} ejecutado`);
      return;
    }

    if (t.dataset.studioNav) { enterStudio(t.dataset.studioNav); return; }
    if (t.dataset.clientArea) { enterClient(state.clientId, t.dataset.clientArea); return; }
    if (t.dataset.clientSub) { state.clientSub = t.dataset.clientSub; render(); return; }
    if (t.dataset.olaTab) { state.olaTab = t.dataset.olaTab; state.selectedIds.clear(); render(); return; }
    if (t.dataset.inboxTab) { state.inboxTab = t.dataset.inboxTab; render(); return; }
    if (t.dataset.filter) { state.filter = t.dataset.filter; render(); return; }
    if (t.dataset.workerFilter) { state.workerFilter = t.dataset.workerFilter; render(); return; }
    if (t.dataset.goIncomplete) {
      const blockers = getClientPayrollBlockers(getClient());
      state.clientSub = 'nomina';
      state.workerFilter = 'incompletas';
      if (blockers.length) state.selectedWorkerId = blockers[0].w.id;
      render();
      return;
    }
    if (t.dataset.fixWorkerFlag) {
      const [wId, flag] = t.dataset.fixWorkerFlag.split(':');
      const c = getClient();
      const w = (c.workers || []).find((x) => x.id === wId);
      if (w && flag) {
        w[flag] = false;
        const rem = getWorkerMissing(w);
        if (rem.length === 0) w.estado = 'Listo';
        else w.estado = rem[0].label;
        const left = getClientPayrollBlockers(c).length;
        toast(left === 0 ? 'Todas las fichas completas · PreviRed desbloqueado' : `Ficha de ${w.name} actualizada (${left} pendiente)`);
        render();
      }
      return;
    }
    if (t.dataset.jumpOla) { state.olaTab = t.dataset.jumpOla; enterStudio('olas'); return; }
    if (t.dataset.openClient) { enterClient(t.dataset.openClient, t.dataset.openArea || 'impuestos', t.dataset.openSub || null); return; }
    if (t.dataset.selectWorker) { state.selectedWorkerId = t.dataset.selectWorker; render(); return; }
    if (t.dataset.selectF29 && !e.target.closest('input')) { state.selectedF29Code = t.dataset.selectF29; render(); return; }
    if (t.dataset.selectRcv && !e.target.closest('button')) { state.selectedRcvId = t.dataset.selectRcv; render(); return; }
    if (t.dataset.selectBank) { state.selectedBankId = t.dataset.selectBank; render(); return; }
    if (t.dataset.selectInbox) { state.selectedInboxId = t.dataset.selectInbox; render(); return; }
    if (t.dataset.resolveInbox) {
      const it = state.inbox.find((x) => x.id === t.dataset.resolveInbox);
      if (it) { it.state = 'Resuelto'; toast('Marcado como resuelto'); render(); }
      return;
    }
    if (t.dataset.matchTx) {
      const c = getClient();
      const tx = c.bankTx.find((x) => x.id === t.dataset.matchTx);
      if (tx) {
        tx.status = 'Conciliado';
        c.bancos.matched = Math.min(c.bancos.total || c.bankTx.length, c.bancos.matched + 1);
        toast('Calce confirmado y contabilizado');
        render();
      }
      return;
    }
    if (t.dataset.unmatchTx) {
      const c = getClient();
      const tx = c.bankTx.find((x) => x.id === t.dataset.unmatchTx);
      if (tx && tx.status === 'Conciliado') {
        tx.status = 'Por conciliar';
        c.bancos.matched = Math.max(0, c.bancos.matched - 1);
        toast('Movimiento vuelto a pendiente');
        render();
      }
      return;
    }
    if (t.dataset.f29Step) {
      const c = getClient();
      const step = t.dataset.f29Step;
      if (step === 'contabilizar') {
        c.f29.contabilizado = true;
        c.f29.state = 'contabilizado';
        c.cierre = 'Contabilizado';
        toast('Asiento F29 (IVA + PPM) contabilizado en Contabilidad');
      } else if (step === 'declarar') {
        const folioVal = ($('inp-f29-folio') && $('inp-f29-folio').value.trim()) || c.f29.folio || '84920311';
        c.f29.contabilizado = true;
        c.f29.state = 'declarado';
        c.f29.folio = folioVal;
        c.periodClosed = true;
        c.status = 'cerrado';
        c.cierre = 'Cerrado';
        toast(`F29 marcado declarado · Folio SII ${folioVal}`);
      } else if (step === 'pagar') {
        c.f29.state = 'pagado';
        c.f29.paidDate = '12/12/2026';
        c.periodClosed = true;
        c.status = 'cerrado';
        c.cierre = 'Pagado y cerrado';
        toast('Pago TGR registrado');
      } else if (step === 'cerrar') {
        c.periodClosed = true;
        c.status = 'cerrado';
        c.cierre = 'Cerrado';
        state.reopenPromptOpen = false;
        state.reopenError = '';
        toast(`Período ${currentPeriod().label} cerrado (solo lectura)`);
      } else if (step === 'reopen-prompt') {
        state.reopenPromptOpen = true;
        state.reopenError = '';
      } else if (step === 'reopen-cancel') {
        state.reopenPromptOpen = false;
        state.reopenError = '';
      } else if (step === 'reopen-confirm') {
        const reasonEl = $('inp-reopen-reason');
        const reason = reasonEl ? reasonEl.value.trim() : '';
        if (reason.length < 4) {
          state.reopenError = 'Ingresa un motivo breve (mín. 4 caracteres) para auditar la reapertura.';
          render();
          const inp = $('inp-reopen-reason');
          if (inp) inp.focus();
          return;
        }
        c.periodClosed = false;
        if (c.f29.state === 'declarado' || c.f29.state === 'pagado') {
          c.f29.state = 'contabilizado';
        }
        c.status = 'revisar';
        c.cierre = 'Reabierto';
        if (!Array.isArray(c.f29.reopenLog)) c.f29.reopenLog = [];
        c.f29.reopenLog.push({ at: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), reason });
        state.reopenPromptOpen = false;
        state.reopenError = '';
        toast(`Período reabierto · Motivo registrado`);
      }
      render();
      return;
    }
    if (t.dataset.applyRcvAccount) {
      const c = getClient();
      const docs = ensureRcvDocs(c);
      const doc = docs.find((d) => d.id === t.dataset.applyRcvAccount);
      const selEl = $('sel-rcv-account');
      if (doc && selEl) {
        const newAcc = selEl.value;
        const remember = $('chk-rcv-remember') ? $('chk-rcv-remember').checked : false;
        const applyOpen = $('chk-rcv-apply-open') ? $('chk-rcv-apply-open').checked : false;
        const isClosedPeriod = isPeriodClosed(c) || doc.closed;
        let updated = 0;
        if (!isClosedPeriod) {
          doc.account = newAcc;
          updated = 1;
          if (applyOpen) {
            docs.forEach((other) => {
              if (other.id !== doc.id && other.rut === doc.rut && !other.closed) {
                other.account = newAcc;
                updated++;
              }
            });
          }
        }
        const ruleKey = `${c.id}::${doc.rut}`;
        if (remember) {
          state.supplierRules[ruleKey] = { supplier: doc.supplier, account: newAcc };
        }
        const accLabel = accountShortLabel(newAcc);
        if (isClosedPeriod) {
          toast(remember ? `Regla guardada para ${doc.supplier} (${accLabel}) en próximos meses` : 'Período cerrado: sin cambios en documentos');
        } else {
          toast(`${updated} doc(s) de ${doc.supplier} → ${newAcc}${remember ? ' · regla guardada' : ''}`);
        }
        render();
      }
      return;
    }
    if (t.dataset.clearSupplierRule) {
      delete state.supplierRules[t.dataset.clearSupplierRule];
      toast('Regla de proveedor eliminada');
      render();
      return;
    }
    if (t.dataset.saveBankRule) {
      const key = t.dataset.saveBankRule;
      if (state.bankRules[key]) {
        delete state.bankRules[key];
        toast('Regla de glosa eliminada');
      } else {
        state.bankRules[key] = { pattern: t.dataset.rulePattern, account: t.dataset.ruleAccount };
        toast(`Regla guardada: «${t.dataset.rulePattern}»`);
      }
      render();
      return;
    }
    if (t.dataset.quickOk) { toast(t.dataset.quickOk); return; }
    if (t.dataset.cmdkIdx !== undefined) {
      const list = $('v2-cmdk-list');
      const entry = list._entries && list._entries[Number(t.dataset.cmdkIdx)];
      closeCmdk();
      if (entry) entry.run();
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'v2-matrix-search') {
      state.query = e.target.value;
      updateStudioHoyRows();
      return;
    }
    if (e.target.id === 'v2-cmdk-input') { renderCmdk(e.target.value); return; }
    if (e.target.id === 'inp-studio-name') {
      state.studioName = e.target.value.trim() || 'Mi Estudio Contable';
      const foot = $('v2-studio-name-foot');
      if (foot) foot.textContent = state.studioName;
      const ws = $('v2-studio-name-ws');
      if (ws) ws.textContent = state.studioName;
      return;
    }
    if (e.target.id === 'inp-worker-pension') {
      const c = getClient();
      const w = (c.workers || []).find((x) => x.id === state.selectedWorkerId);
      if (w) {
        w.pensionMensual = Math.max(0, Number(e.target.value) || 0);
        render();
        const el = $('inp-worker-pension');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }
      return;
    }
    if (e.target.id === 'inp-worker-base') {
      const c = getClient();
      const w = c.workers.find((x) => x.id === state.selectedWorkerId);
      if (w) {
        w.base = Math.max(0, Number(e.target.value) || 0);
        const iso = currentPeriod().iso;
        const computed = c.workers.map((wk) => ({ w: wk, calc: calcularWorkerReal(wk, iso) }));
        const totalImp = computed.reduce((s, x) => s + x.calc.imponible, 0);
        const totalLiq = computed.reduce((s, x) => s + x.calc.liquido, 0);
        const totalEmp = computed.reduce((s, x) => s + x.calc.costoEmpleador, 0);
        const sel = computed.find((x) => x.w.id === w.id);
        const setTxt = (q, val) => { const el = document.querySelector(q); if (el) el.textContent = val; };
        setTxt('[data-nom-tape="imponible"]', fmt(totalImp));
        setTxt('[data-nom-tape="liquido"]', fmt(totalLiq));
        setTxt('[data-nom-tape="empleador"]', fmt(totalEmp));
        setTxt('[data-nom-foot="imponible"]', fmt(totalImp));
        setTxt('[data-nom-foot="liquido"]', fmt(totalLiq));
        if (sel) {
          setTxt(`[data-row-imp="${w.id}"]`, fmt(sel.calc.imponible));
          const liqCell = document.querySelector(`[data-row-liq="${w.id}"]`);
          if (liqCell) liqCell.innerHTML = `<strong>${fmt(sel.calc.liquido)}</strong>`;
          const kv = $('v2-worker-kv');
          const d = sel.calc.detalle || {};
          if (kv) {
            kv.innerHTML = `
              ${(d.haberesImponibles || []).map((h) => `<dt>${h.concepto}</dt><dd>${fmt(h.monto)}</dd>`).join('')}
              ${(d.descuentosLegales || []).map((x) => `<dt>${x.concepto}</dt><dd>−${fmt(x.monto)}</dd>`).join('')}
              <dt><strong>Líquido a pagar</strong></dt><dd><strong>${fmt(sel.calc.liquido)}</strong></dd>
              <dt>Aportes empleador</dt><dd>${fmt(sel.calc.costoEmpleador)}</dd>
            `;
          }
        }
      }
      return;
    }
    if (e.target.dataset.f29Field) {
      const c = getClient();
      c.f29[e.target.dataset.f29Field] = Math.max(0, Number(e.target.value) || 0);
      const iva = Math.max(0, c.f29.debito - c.f29.credito);
      const total = f29Total(c);
      const setTxt = (q, val) => { const el = document.querySelector(q); if (el) el.textContent = val; };
      setTxt('[data-f29-tape="debito"]', fmt(c.f29.debito));
      setTxt('[data-f29-tape="credito"]', fmt(c.f29.credito));
      setTxt('[data-f29-tape="iva"]', fmt(iva));
      setTxt('[data-f29-tape="total"]', fmt(total));
      setTxt('[data-f29-code-val="089"]', fmt(iva));
      setTxt('[data-f29-code-val="755"]', fmt(c.f29.postergar ? iva : 0));
      setTxt('[data-f29-total]', fmt(total));
      if (e.target.dataset.f29Code) state.selectedF29Code = e.target.dataset.f29Code;
      const box = $('v2-f29-explain-block');
      if (box) box.outerHTML = renderF29ExplainBlock(c);
    }
  });

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.f29Code) {
      const code = e.target.dataset.f29Code;
      if (state.selectedF29Code !== code) {
        state.selectedF29Code = code;
        document.querySelectorAll('tr[data-select-f29]').forEach((tr) => {
          tr.classList.toggle('is-selected', tr.dataset.selectF29 === code);
        });
        const box = $('v2-f29-explain-block');
        if (box) box.outerHTML = renderF29ExplainBlock(getClient());
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'chk-postergar') { getClient().f29.postergar = e.target.checked; render(); return; }
    if (e.target.id === 'sel-fin-cause') { state.finiquitoCause = e.target.value; render(); return; }
    if (e.target.id === 'sel-worker-regimen') {
      const c = getClient();
      const w = (c.workers || []).find((x) => x.id === state.selectedWorkerId);
      if (w) {
        w.tipoRegimen = e.target.value;
        if (w.tipoRegimen === 'pensionado' && !w.pensionMensual) w.pensionMensual = 500000;
        toast(`Régimen actualizado: ${w.tipoRegimen === 'socio' ? 'Socio sueldo empresarial' : w.tipoRegimen === 'pensionado' ? 'Pensionado por vejez' : 'Dependiente'}`);
        render();
      }
      return;
    }
    if (e.target.id === 'chk-worker-afp-vol') {
      const c = getClient();
      const w = (c.workers || []).find((x) => x.id === state.selectedWorkerId);
      if (w) {
        w.cotizaAfpVoluntaria = e.target.checked;
        toast(w.cotizaAfpVoluntaria ? 'Cotización AFP voluntaria activada (PreviRed Tipo 1)' : 'Exento de AFP (PreviRed Tipo 2)');
        render();
      }
      return;
    }
    if (e.target.id === 'v2-csv-lre') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { applyLreCsvToClient(getClient(), String(reader.result || ''), file.name); };
      reader.readAsText(file, 'windows-1252');
      e.target.value = '';
      return;
    }
    if (e.target.id === 'v2-csv-cartola') {
      const file = e.target.files && e.target.files[0];
      if (!file || !window.CLImportadores) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = window.CLImportadores.parsearCartola(String(reader.result), { periodo: currentPeriod().iso });
        if (!parsed || !parsed.ok) { toast(parsed?.error || 'No pudimos leer la cartola'); return; }
        const c = getClient();
        c.bankTx = parsed.movimientos.map((m, i) => ({
          id: 'imp-' + i,
          date: m.fecha || '',
          desc: m.glosa || 'Movimiento',
          amount: (m.abono || 0) - (m.cargo || 0),
          status: 'Por conciliar',
          match: 'Sugerencia automática'
        }));
        c.bancos.total = c.bankTx.length;
        c.bancos.matched = 0;
        toast(`Cartola importada: ${c.bankTx.length} movimientos`);
        render();
      };
      reader.readAsText(file, 'ISO-8859-1');
      return;
    }
    if (e.target.id === 'v2-csv-ventas' || e.target.id === 'v2-csv-compras') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const isVentas = e.target.id === 'v2-csv-ventas';
      const reader = new FileReader();
      reader.onload = () => applyRcvToClient(getClient(), isVentas ? String(reader.result) : null, isVentas ? null : String(reader.result));
      reader.readAsText(file, 'ISO-8859-1');
      return;
    }
    if (e.target.dataset.batchId) {
      const id = e.target.dataset.batchId;
      if (e.target.checked) state.selectedIds.add(id); else state.selectedIds.delete(id);
      renderBatchBar();
    }
  });

  $('v2-cmdk-backdrop').addEventListener('click', (e) => { if (e.target.id === 'v2-cmdk-backdrop') closeCmdk(); });
  $('v2-drawer-wrap').addEventListener('click', (e) => { if (e.target.id === 'v2-drawer-wrap') closeDrawer(); });
  $('v2-sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);
  $('v2-brand-home').addEventListener('click', (e) => { e.preventDefault(); enterStudio('hoy'); });

  $('form-new-client').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nc-name').value.trim();
    const rut = $('nc-rut').value.trim();
    const regime = $('nc-regime').value;
    if (!name || !rut) return;
    const id = 'cli-' + Date.now();
    state.clients.unshift({
      id, name, rut, regime, status: 'revisar',
      rcv: { state: 'ok', label: 'Sin movimientos', pendingAcuses: 0, ventasNeto: 0, comprasNeto: 0 },
      nomina: { state: 'ok', label: '0 trab.', count: 0, previredOk: true, leyBustos: false },
      bancos: { state: 'esperando', label: 'Sin cartola', matched: 0, total: 0 },
      f29: { state: 'revisar', folio: '', postergar: false, debito: 0, credito: 0, ppm: 0, retenciones: 0, history: [0,0,0,0,0,0,0,0,0,0,0,0] },
      cierre: 'Recién creada',
      workers: [], bankTx: []
    });
    e.target.reset();
    closeDrawer();
    toast(`${name} agregada a la cartera`);
    enterClient(id, 'impuestos', 'f29');
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
    if (e.key === 'Escape') { closeCmdk(); closeDrawer(); closeMobileSidebar(); return; }
    if (!$('v2-cmdk-backdrop').hidden) {
      const list = $('v2-cmdk-list');
      const entries = list._entries || [];
      if (!entries.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.cmdkIdx = (state.cmdkIdx + 1) % entries.length;
        updateCmdkActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.cmdkIdx = (state.cmdkIdx - 1 + entries.length) % entries.length;
        updateCmdkActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entry = entries[state.cmdkIdx] || entries[0];
        closeCmdk();
        if (entry) entry.run();
      }
    }
  });

  if (location.hash === '#cliente-f29') enterClient('san-isidro', 'impuestos', 'f29');
  else if (location.hash === '#cliente-nomina') enterClient('san-isidro', 'remuneraciones', 'nomina');
  else if (location.hash === '#cliente-finiquitos') enterClient('san-isidro', 'remuneraciones', 'finiquitos');
  else if (location.hash === '#cliente-previred') enterClient('san-isidro', 'remuneraciones', 'previred');
  else if (location.hash === '#cliente-bancos') enterClient('san-isidro', 'bancos', 'match');
  else if (location.hash === '#cliente-contabilidad') enterClient('san-isidro', 'contabilidad', 'balance');
  else if (location.hash === '#olas') enterStudio('olas');
  else render();
})();
