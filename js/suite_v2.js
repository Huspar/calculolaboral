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
      imm: 553553, topeAfpUF: 90, topeAfcUF: 135.2, jornadaMaxima: 42,
      afp: { Capital: 0.1144, Cuprum: 0.1144, Habitat: 0.1127, Modelo: 0.1058, Planvital: 0.1116, Provida: 0.1145, Uno: 0.1046 },
      empleador: { afp: 0.001, seguroSocial: 0.0161, sis: 0.0179 }
    };
    const resp = (P && P.RESPALDO && (P.RESPALDO[iso] || P.RESPALDO['2026-11'] || P.RESPALDO['2026-09'])) || { uf: 41439.89, utm: 72440 };
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
          '2106': tipo === 'socio' ? 0 : (gratLine ? gratLine.monto : 0),
          '2161': tipo === 'socio' ? w.base : 0,
          '3141': findDesc(/^afp/i),
          '3143': findDesc(/^salud/i),
          '3151': findDesc(/cesant/i),
          '3161': findDesc(/impuesto/i),
          '4151': findEmp('afc'),
          '4152': findEmp('mutual'),
          '4155': findEmp('sis'),
          '5201': d.totalHaberes || calc.imponible,
          '5210': calc.imponible,
          '5301': d.totalDescuentos || 0,
          '5410': calc.costoEmpleador || 0,
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
      f29: { state: 'revisar', folio: '', postergar: false, debito: 3496000, credito: 1968700, ppm: 24125, retenciones: 544679, bhe: 183000, history: [1890, 2040, 1760, 2110, 1950, 2280, 2190, 2410, 2080, 2150, 2279, 2279] },
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
    auxFilter: 'todos',
    selectedAuxId: null,
    lastPlanSync: '',
    gatewayConnected: false,
    studioChart: [
      { code: '11010', name: 'Caja', type: 'Activo' },
      { code: '11020', name: 'Banco cuenta corriente', type: 'Activo' },
      { code: '11050', name: 'Clientes nacionales', type: 'Activo' },
      { code: '11080', name: 'IVA Crédito Fiscal', type: 'Activo' },
      { code: '11090', name: 'PPM por recuperar', type: 'Activo' },
      { code: '12010', name: 'Activo fijo / Maquinaria', type: 'Activo' },
      { code: '21010', name: 'Proveedores nacionales', type: 'Pasivo' },
      { code: '21030', name: 'Remuneraciones por pagar', type: 'Pasivo' },
      { code: '21035', name: 'Cotizaciones PreviRed por pagar', type: 'Pasivo' },
      { code: '21040', name: 'Impuesto único por pagar', type: 'Pasivo' },
      { code: '21050', name: 'IVA Débito Fiscal', type: 'Pasivo' },
      { code: '21055', name: 'F29 por pagar (IVA + PPM)', type: 'Pasivo' },
      { code: '41010', name: 'Costo de ventas / Insumos', type: 'Pérdida' },
      { code: '41020', name: 'Envases y empaques', type: 'Pérdida' },
      { code: '41030', name: 'Arriendos y servicios básicos', type: 'Pérdida' },
      { code: '42010', name: 'Remuneraciones', type: 'Pérdida' },
      { code: '42015', name: 'Aportes empleador (SIS/AFC/Mutual)', type: 'Pérdida' },
      { code: '51010', name: 'Ventas afectas del giro', type: 'Ganancia' }
    ],
    reopenPromptOpen: false,
    reopenError: '',
    bankRules: {},
    supplierRules: {},
    finiquitoCause: '161',
    balanceScope: 'acumulado',
    studioName: 'Asesorías Pérez Ltda.',
    accountMode: 'demo',
    accountEmail: '',
    studioClientsSaved: null,
    onboardingMinimized: false,
    onboardingHidden: false,
    onboardingDone: { company: false, data: false, mcpOrDoc: false },
    sidebarCollapsed: false,
    selectedIds: new Set(),
    clients: INITIAL_CLIENTS(),
    inbox: INITIAL_INBOX()
  };

  const ACCOUNT_KEY = 'cl_suite_account_v1';
  function saveAccountState() {
    if (state.accountMode !== 'studio') return;
    try {
      state.studioClientsSaved = state.clients;
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({
        studioName: state.studioName,
        accountEmail: state.accountEmail,
        clients: state.clients,
        onboardingMinimized: !!state.onboardingMinimized,
        onboardingHidden: !!state.onboardingHidden,
        onboardingDone: state.onboardingDone
      }));
    } catch (_) {}
  }
  function loadSavedAccount() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || !saved.studioName) return false;
      state.accountMode = 'studio';
      state.studioName = saved.studioName;
      state.accountEmail = saved.accountEmail || '';
      state.clients = Array.isArray(saved.clients) ? saved.clients : [];
      state.studioClientsSaved = state.clients;
      state.onboardingMinimized = !!saved.onboardingMinimized;
      state.onboardingHidden = !!saved.onboardingHidden;
      state.onboardingDone = Object.assign({ company: state.clients.length > 0, data: false, mcpOrDoc: false }, saved.onboardingDone || {});
      return true;
    } catch (_) {
      return false;
    }
  }
  function markOnboardStep(key) {
    if (!state.onboardingDone) state.onboardingDone = { company: false, data: false, mcpOrDoc: false };
    state.onboardingDone[key] = true;
    saveAccountState();
  }
  function openAccountDrawer() {
    const wrap = $('v2-account-drawer-wrap');
    if (!wrap) return;
    wrap.hidden = false;
    setTimeout(() => $('acc-studio-name')?.focus(), 40);
  }
  function closeAccountDrawer() {
    const wrap = $('v2-account-drawer-wrap');
    if (wrap) wrap.hidden = true;
  }
  function syncSidebarFoot() {
    const nameEl = $('v2-studio-name-foot');
    const countEl = $('v2-studio-count-foot');
    const btnAcc = $('btn-open-account');
    if (nameEl) nameEl.textContent = state.studioName;
    if (countEl) countEl.textContent = state.accountMode === 'studio' ? `Mi estudio · ${state.clients.length} RUT` : `Demo · ${state.clients.length} RUT`;
    if (btnAcc) {
      if (state.accountMode === 'studio') {
        btnAcc.textContent = 'Ver demo';
        btnAcc.style.background = '';
        btnAcc.style.color = '';
        btnAcc.style.borderColor = '';
      } else if (state.studioClientsSaved !== null) {
        btnAcc.textContent = 'Mi estudio';
        btnAcc.style.background = '#00382E';
        btnAcc.style.color = '#ffffff';
        btnAcc.style.borderColor = '#00382E';
      } else {
        btnAcc.textContent = 'Crear mi estudio';
        btnAcc.style.background = '#00382E';
        btnAcc.style.color = '#ffffff';
        btnAcc.style.borderColor = '#00382E';
      }
    }
  }
  function renderOnboardingHtml() {
    if (state.accountMode !== 'studio') {
      return `
        <div class="v2-f29-hint" style="margin-bottom:10px">
          <span><strong>Modo demo (6 empresas de ejemplo):</strong> explora libremente o crea tu propio estudio en 10 segundos para trabajar con tus empresas reales y guía paso a paso.</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn btn--primary btn--sm" data-open-account="1">${state.studioClientsSaved !== null ? 'Volver a mi estudio' : 'Crear mi estudio →'}</button>
            <button type="button" class="btn btn--sm" data-studio-nav="conexiones">Conexiones SII · MCP</button>
          </div>
        </div>
      `;
    }
    if (state.onboardingHidden) return '';
    const d1 = !!state.onboardingDone.company || state.clients.length > 0;
    const d2 = !!state.onboardingDone.data || (state.liveCompanies && state.liveCompanies.length > 0);
    const d3 = !!state.onboardingDone.mcpOrDoc || !!state.mcpTokenLive;
    const doneTotal = (d1 ? 1 : 0) + (d2 ? 1 : 0) + (d3 ? 1 : 0);
    const allDone = doneTotal === 3;
    if (allDone || state.onboardingMinimized) {
      return `
        <div class="v2-onboard" style="padding:10px 14px">
          <div class="v2-onboard-head">
            <div class="v2-onboard-title">
              <span>${allDone ? 'Estudio configurado' : 'Primeros pasos de tu estudio'}</span>
              <span class="mono" style="font-size:12px;color:#0F5E4F">${doneTotal}/3</span>
            </div>
            <div class="v2-onboard-ctrls">
              ${!allDone ? `<button type="button" class="btn btn--sm" data-onboard-action="expand">Ver pasos</button>` : ''}
              <button type="button" class="btn btn--sm" data-onboard-action="hide">Ocultar</button>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <section class="v2-onboard" aria-label="Primeros pasos de tu estudio">
        <div class="v2-onboard-head">
          <h2 class="v2-onboard-title">
            <span>Primeros pasos de tu estudio</span>
            <span class="mono" style="font-size:12px;color:#0F5E4F">${doneTotal}/3</span>
          </h2>
          <div class="v2-onboard-ctrls">
            <button type="button" class="btn btn--sm" data-onboard-action="minimize">Minimizar</button>
            <button type="button" class="btn btn--sm" data-onboard-action="hide">Ocultar</button>
          </div>
        </div>
        <div class="v2-onboard-grid">
          <div class="v2-onboard-card ${d1 ? 'is-done' : ''}">
            <div>
              <div class="v2-onboard-num">${d1 ? '✓ 01 · Listo' : '01 · Pendiente'}</div>
              <h3>Crea tu primera empresa cliente</h3>
              <p>Ingresa RUT, razón social y régimen tributario (14 D3, 14 D8 o 14 A) para abrir su ficha mensual.</p>
            </div>
            <div class="v2-onboard-actions">
              <button type="button" class="btn ${d1 ? '' : 'btn--primary'} btn--sm" data-onboard-action="step-company">${d1 ? '+ Otra empresa' : 'Agregar empresa'}</button>
            </div>
          </div>
          <div class="v2-onboard-card ${d2 ? 'is-done' : ''}">
            <div>
              <div class="v2-onboard-num">${d2 ? '✓ 02 · Listo' : '02 · Pendiente'}</div>
              <h3>Trae tus datos (archivos o SII)</h3>
              <p>Trabaja subiendo CSV de RCV/LRE sin entregar claves, o vincula el RUT al SII con cifrado AES-256-GCM.</p>
            </div>
            <div class="v2-onboard-actions">
              <button type="button" class="btn ${d1 && !d2 ? 'btn--primary' : ''} btn--sm" data-onboard-action="step-data-file">Subir RCV / LRE</button>
              <button type="button" class="btn btn--sm" data-onboard-action="step-data-sii">Conectar SII</button>
            </div>
          </div>
          <div class="v2-onboard-card ${d3 ? 'is-done' : ''}">
            <div>
              <div class="v2-onboard-num">${d3 ? '✓ 03 · Listo' : '03 · Pendiente'}</div>
              <h3>Conecta IA (MCP) o emite tu primer PDF</h3>
              <p>Genera tu token de solo lectura para Claude/ChatGPT o descarga el primer Paquete Mensual PDF con tu marca.</p>
            </div>
            <div class="v2-onboard-actions">
              <button type="button" class="btn ${d1 && d2 && !d3 ? 'btn--primary' : ''} btn--sm" data-onboard-action="step-mcp">Configurar MCP</button>
              <button type="button" class="btn btn--sm" data-onboard-action="step-pdf">Emitir PDF</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL');
  };
  const currentPeriod = () => PERIODS[state.periodIdx];

  function f29Total(c) {
    const iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
    const ivaPagar = c.f29.postergar ? 0 : iva;
    return ivaPagar + (c.f29.ppm || 0) + (c.f29.retenciones || 0) + (c.f29.bhe || 0);
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

  /* ==================== ADAPTADOR OPCIONAL SII GATEWAY (vía /api/studio-proxy) ==================== */
  async function gatewayCall(method, upstreamPath, body) {
    if (!state.gatewayConnected) return null;
    try {
      const url = '/api/studio-proxy?path=' + encodeURIComponent(upstreamPath);
      const opts = { method, credentials: 'same-origin', headers: { accept: 'application/json' } };
      if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
        opts.headers['content-type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (_) {
      return null;
    }
  }

  async function syncRangeFromGateway(companyId, fromPeriod, toPeriod, jobType = 'RCV_COMPRAS') {
    const res = await gatewayCall('POST', `/api/v1/accounting/${encodeURIComponent(companyId)}/sync-range`, { fromPeriod, toPeriod, jobType });
    if (!res) { toast('Modo demo local: configura /api/studio-proxy para sincronizar SII en vivo'); return null; }
    if (!res.ok) {
      toast((res.data && (res.data.message || res.data.error)) || `Error sync-range (${res.status})`);
      return res;
    }
    const warn = res.data && res.data.priorCoverage && res.data.priorCoverage.warning;
    toast(warn ? `Sync encolada · Aviso IVA: ${warn}` : `Sync encolada (${(res.data && res.data.enqueuedCount) || 1} mes(es))`);
    return res;
  }

  async function loadLiveCompanies() {
    if (!state.gatewayConnected) return [];
    const res = await gatewayCall('GET', '/api/v1/companies');
    if (res && res.ok && res.data) {
      const items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      state.liveCompanies = items;
      return items;
    }
    return state.liveCompanies || [];
  }

  async function probeStudioGateway() {
    if (typeof fetch !== 'function' || location.protocol === 'file:') return { mode: 'demo-local', configured: false };
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 3000) : null;
      const res = await fetch('/api/studio-proxy?action=status', { credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      if (!res.ok) return { mode: 'demo-local', configured: false };
      const data = await res.json().catch(() => null);
      if (data && data.ok && data.configured && (!data.sessionRequired || data.authenticated)) {
        state.gatewayConnected = true;
        state.gateway = data;
        await loadLiveCompanies();
        renderSidebar();
        if (state.level === 'studio' && state.studioView === 'conexiones') renderStudioConexiones();
        return data;
      }
      state.gateway = data || { mode: 'demo-local', configured: false };
      return state.gateway;
    } catch (_) {
      return { mode: 'demo-local', configured: false };
    }
  }

  window.CLStudioGateway = { call: gatewayCall, syncRange: syncRangeFromGateway, probe: probeStudioGateway };

  function getClient() {
    return state.clients.find((c) => c.id === state.clientId) || state.clients[0];
  }

  function enterClient(clientId, area = 'resumen', sub = null) {
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
        <div class="v2-ws-title">${state.accountMode === 'studio' ? 'Mi estudio' : 'Espacio Estudio (Demo)'}</div>
        <div class="v2-ws-meta">
          <span id="v2-studio-name-ws">${state.studioName}</span>
          <span class="tag tag--in">${state.accountMode === 'studio' ? 'Activo' : 'Demo'}</span>
        </div>
      `;
      syncSidebarFoot();
      const items = [
        { id: 'hoy', label: 'Hoy · Cierre', count: urgentCount ? `${urgentCount} urg.` : '' },
        { id: 'olas', label: 'Cierre en Lote', count: 'Lotes' },
        { id: 'bandeja', label: 'Bandeja', count: pendingInbox || '' },
        { id: 'empresas', label: 'Empresas', count: state.clients.length }
      ];
      nav.innerHTML = `<div class="v2-nav-group-label">Estudio</div>` + items.map((it) => `
        <button type="button" class="v2-nav-btn" data-studio-nav="${it.id}" ${state.studioView === it.id ? 'aria-current="page"' : ''}>
          <span class="v2-nav-left">${it.label}</span>
          ${it.count !== '' ? `<span class="v2-nav-count">${it.count}</span>` : ''}
        </button>
      `).join('') + `
        <div class="v2-nav-group-label" style="margin-top:14px">Automatización</div>
        <button type="button" class="v2-nav-btn" data-studio-nav="conexiones" ${state.studioView === 'conexiones' ? 'aria-current="page"' : ''}>
          <span class="v2-nav-left">Conexiones</span>
          <span class="v2-nav-count">SII · MCP</span>
        </button>
        <button type="button" class="v2-nav-btn" data-studio-nav="monitor" ${state.studioView === 'monitor' ? 'aria-current="page"' : ''}>
          <span class="v2-nav-left">Monitor SII · TGR</span>
          <span class="v2-nav-count">${urgentCount ? `${urgentCount}!` : '24/7'}</span>
        </button>
        <div style="margin-top:14px;padding:0 6px">
          <a href="/suite-contadores" class="v2-ws-switch" style="text-decoration:none;justify-content:space-between">
            <span>Ver planes · 90 días gratis</span><span>↗</span>
          </a>
        </div>
      `;

      mob.innerHTML = [
        { id: 'hoy', label: 'Hoy' },
        { id: 'olas', label: 'Lotes' },
        { id: 'conexiones', label: 'SII · MCP' },
        { id: 'empresas', label: 'Empresas' }
      ].map((it) => `
        <button type="button" data-studio-nav="${it.id}" ${state.studioView === it.id ? 'aria-current="page"' : ''}>
          <span>${it.label}</span>
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
        <button type="button" class="v2-ws-switch" data-studio-nav="conexiones" style="margin-top:4px;font-size:11.5px">
          <span>SII · PreviRed · MCP</span><span class="mono">Abrir →</span>
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
      const titles = { hoy: 'Mesa de Cierre', olas: 'Cierre en Lote', bandeja: 'Bandeja', empresas: 'Empresas', conexiones: 'Conexiones e Integraciones', monitor: 'Monitor Tributario y Previsional' };
      titleEl.textContent = titles[state.studioView] || 'Mesa de Cierre';
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
      } else if (state.studioView === 'conexiones') {
        tabsEl.innerHTML = '';
        ctaEl.textContent = 'Verificar Gateway SII';
      } else if (state.studioView === 'monitor') {
        tabsEl.innerHTML = '';
        ctaEl.textContent = 'Actualizar Monitor';
      } else {
        tabsEl.innerHTML = '';
        ctaEl.textContent = 'Aprobar F29 listos';
      }
    } else {
      const c = getClient();
      const payrollBlockers = getClientPayrollBlockers(c).length;
      const map = {
        resumen: { title: 'Resumen y Cierre', cta: 'Emitir Paquete PDF', tabs: [{ id: 'estado', label: 'Ruta de cierre 1→4' }] },
        impuestos: {
          title: 'Impuestos',
          cta: c.f29.state === 'pagado' ? 'Emitir Hoja F29 PDF' : c.f29.state === 'declarado' ? 'Registrar pago TGR' : c.f29.state === 'contabilizado' ? 'Declarar F29' : 'Contabilizar F29',
          tabs: [
            { id: 'f29', label: 'Hoja F29' },
            { id: 'rcv', label: 'Compras y Acuses' },
            { id: 'bhe', label: 'Honorarios BHE' },
            { id: 'renta', label: `Renta (${c.regime})` }
          ]
        },
        remuneraciones: {
          title: 'Remuneraciones',
          cta: state.clientSub === 'previred' ? 'Descargar LRE 147 CSV' : state.clientSub === 'finiquitos' ? 'Exportar Finiquitos Excel' : (payrollBlockers ? `Completar ${payrollBlockers} ficha${payrollBlockers > 1 ? 's' : ''}` : 'Descargar Previred 105'),
          tabs: [
            { id: 'nomina', label: 'Nómina del mes' },
            { id: 'fichas', label: 'Trabajadores' },
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
          cta: state.clientSub === 'plan' ? 'Aplicar plan al Estudio' : state.clientSub === 'resultados' ? 'Emitir Resultados PDF' : 'Exportar Contabilidad Excel',
          tabs: [
            { id: 'balance', label: 'Balance 8 Col.' },
            { id: 'resultados', label: 'Resultados (P&L)' },
            { id: 'mayor', label: 'Libro Mayor' },
            { id: 'diario', label: 'Libro Diario' },
            { id: 'plan', label: 'Plan de Cuentas' }
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
            <button type="button" class="v2-cell-btn" data-open-client="${c.id}" data-open-area="resumen">
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
          <td class="num">
            <button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="resumen" title="${c.cierre}">
              ${c.status === 'critico' ? 'Resolver →' : 'Entrar →'}
            </button>
          </td>
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
      ${renderOnboardingHtml()}
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
              <th class="num" style="width:108px">Acción</th>
            </tr>
          </thead>
          <tbody id="v2-hoy-tbody">
            ${rows.length ? studioHoyRowsHtml(rows) : `
              <tr>
                <td colspan="6" style="text-align:center;padding:28px 16px">
                  <div style="font-weight:700;color:var(--ink);margin-bottom:4px">${state.accountMode === 'studio' ? 'Tu estudio está listo para cargar su primera empresa' : 'No hay empresas con este filtro'}</div>
                  <div class="muted" style="font-size:12px;margin-bottom:10px">${state.accountMode === 'studio' ? 'Agrega un RUT manualmente o conéctalo en Conexiones para empezar a operar.' : 'Limpia el buscador o cambia de filtro.'}</div>
                  ${state.accountMode === 'studio' ? `<button type="button" class="btn btn--primary btn--sm" id="btn-empty-new-client">+ Agregar mi primera empresa</button>` : ''}
                </td>
              </tr>
            `}
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
          <h2 class="v2-ins-title">Oportunidades de Acción</h2>
          <span class="mono muted">${(() => {
            let n = 0;
            state.clients.forEach((c) => {
              if (c.nomina.leyBustos) n++;
              if (c.rcv.pendingAcuses) n++;
              if (getClientPayrollBlockers(c).length) n++;
              if (c.bancos && c.bancos.state !== 'ok') n++;
            });
            return n;
          })()}</span>
        </div>
        <div class="v2-ins-list">
          ${(() => {
            const ops = [];
            state.clients.forEach((c) => {
              if (c.nomina.leyBustos) ops.push({ prio: 1, name: c.name, msg: 'Riesgo Ley Bustos (Art. 162 CT): finiquito abierto con PreviRed impago.', cid: c.id, area: 'remuneraciones', sub: 'finiquitos', cta: 'Revisar' });
              if (c.rcv.pendingAcuses) ops.push({ prio: 2, name: c.name, msg: `${c.rcv.pendingAcuses} factura(s) a crédito vencen plazo 8 días en SII.`, cid: c.id, area: 'impuestos', sub: 'rcv', cta: 'Acusar' });
              const bl = getClientPayrollBlockers(c).length;
              if (bl) ops.push({ prio: 3, name: c.name, msg: `${bl} ficha(s) incompleta(s) bloquean TXT PreviRed.`, cid: c.id, area: 'remuneraciones', sub: 'nomina', cta: 'Completar' });
              if (c.bancos && c.bancos.state !== 'ok') ops.push({ prio: 4, name: c.name, msg: `Cartola pendiente (${c.bancos.label}): cruzar pagos y pasarelas.`, cid: c.id, area: 'bancos', sub: 'match', cta: 'Conciliar' });
            });
            return ops.sort((a, b) => a.prio - b.prio).slice(0, 5).map((op) => `
              <div class="v2-ins-row">
                <div>
                  <strong>${op.name}</strong>
                  <div class="muted">${op.msg}</div>
                </div>
                <button type="button" class="btn btn--sm" data-open-client="${op.cid}" data-open-area="${op.area}" data-open-sub="${op.sub}">${op.cta}</button>
              </div>
            `).join('') || '<div class="muted" style="font-size:12px">Sin acciones pendientes hoy.</div>';
          })()}
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

    const totalEmp = state.clients.length;
    const completedEmp = state.clients.filter((c) => c.status === 'cerrado' || (c.f29.state === 'declarado' && c.nomina.previredOk)).length;
    const blockedEmp = state.clients.filter((c) => c.status === 'critico' || !c.nomina.previredOk || getClientPayrollBlockers(c).length > 0).length;
    const inProgressEmp = Math.max(0, totalEmp - completedEmp - blockedEmp);
    const pctDone = totalEmp ? Math.round((completedEmp / totalEmp) * 100) : 0;
    const batchLive = state.liveSyncBatch;

    const progressStrip = `
      <div class="v2-f29-hint" style="margin-bottom:12px;display:block;padding:12px 14px">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px">
          <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:12px">
            <span><strong>Empresas en período:</strong> <span class="mono">${totalEmp}</span></span>
            <span style="color:#00382E"><strong>Completadas:</strong> <span class="mono">${completedEmp}</span></span>
            <span class="muted"><strong>En proceso:</strong> <span class="mono">${inProgressEmp}</span></span>
            <span style="color:${blockedEmp ? '#b91c1c' : '#475569'}"><strong>Con bloqueos:</strong> <span class="mono">${blockedEmp}</span></span>
          </div>
          <span class="mono" style="font-size:12px;font-weight:700;color:#00382E">${pctDone}% cierre</span>
        </div>
        <div style="height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;display:flex">
          <div style="width:${pctDone}%;background:#00382E"></div>
          <div style="width:${totalEmp ? Math.round((inProgressEmp / totalEmp) * 100) : 0}%;background:#94a3b8"></div>
          <div style="width:${totalEmp ? Math.round((blockedEmp / totalEmp) * 100) : 0}%;background:#b91c1c"></div>
        </div>
      </div>
    `;

    $('v2-canvas').innerHTML = `${progressStrip}<div class="v2-table-wrap"><table class="v2-table"><thead>${headCols}</thead><tbody>${rowsHtml}</tbody></table></div>`;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Operación en lote</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Marca varias empresas para aprobar lotes limpios sin abrir empresa por empresa, o lanza una sincronización SII masiva.</p>
        <dl class="v2-ins-kv" style="margin:6px 0 0">
          <dt>Cartera activa</dt><dd>${state.clients.length} empresas</dd>
          <dt>Motores conectados</dt><dd>F29 · Previred · LRE</dd>
          <dt>Con bloqueos</dt><dd style="color:${blockedEmp ? '#b91c1c' : '#00382E'};font-weight:700">${blockedEmp} empresa(s)</dd>
        </dl>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
          <button type="button" class="btn btn--primary btn--sm" data-ola-action="batch-sync-sii">Sincronizar cartera SII en lote</button>
          ${batchLive ? `<div class="v2-ins-note" style="font-size:11.5px;margin-top:2px">Lote <span class="mono">${batchLive.batchId || 'local'}</span>: ${batchLive.completed || 0}/${batchLive.total || 0} completadas · ${batchLive.inProgress || 0} en proceso · ${batchLive.failed || 0} con error.</div>` : ''}
        </div>
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
        { code: '755', glosa: 'Postergación IVA Art. 64 D.L. 825 (marcar Cód. 756 dentro de plazo; no posterga PPM ni retenciones)', field: null, val: c.f29.postergar ? iva : 0, editable: false },
        { code: '062', glosa: 'PPM obligatorio mensual', field: 'ppm', val: c.f29.ppm, editable: true },
        { code: '048', glosa: 'Impuesto Único 2ª Categoría (sueldos y sueldo empresarial)', field: 'retenciones', val: c.f29.retenciones || 0, editable: true },
        { code: '151', glosa: 'Retención Boletas de Honorarios BHE (15,25% Ley 21.133)', field: 'bhe', val: c.f29.bhe || 0, editable: true }
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
      const pendDocs = rcvDocs.filter((d) => !d.acuseDone && d.plazoTag !== 'tag--in');
      $('v2-canvas').innerHTML = `
        ${pendDocs.length ? `
          <div class="v2-f29-hint" style="margin-bottom:8px;border-color:#fecaca;background:#fff5f5">
            <span><strong>${pendDocs.length} factura(s) en riesgo de perder IVA:</strong> en Chile tienes 8 días corridos para aceptar facturas a crédito en el SII. Pulsa <strong>Dar acuse</strong> en cada fila o acúsalas juntas.</span>
            <button type="button" class="btn btn--primary btn--sm" data-acuse-all="1">Acusar las ${pendDocs.length} pendientes</button>
          </div>
        ` : `
          <div class="v2-f29-hint" style="margin-bottom:8px">
            <span><strong>RCV al día:</strong> todas las facturas tienen su acuse resuelto y tu Crédito Fiscal IVA (Cód. 537) está cubierto.</span>
            <button type="button" class="btn btn--sm" data-client-sub="f29">Volver al F29 →</button>
          </div>
        `}
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
                const isPending = !d.acuseDone && d.plazoTag !== 'tag--in';
                return `
                  <tr class="${selRcv && selRcv.id === d.id ? 'is-selected' : ''}" data-select-rcv="${d.id}">
                    <td class="mono">${d.folio}</td>
                    <td><strong>${d.supplier}</strong></td>
                    <td><span class="mono" style="font-size:11.5px">${d.account}</span>${hasRule ? ' <span class="tag tag--in">Regla</span>' : ''}</td>
                    <td class="num">${fmt(d.neto)}</td>
                    <td class="num">${fmt(d.iva)}</td>
                    <td><span class="tag ${d.plazoTag}">${d.plazo}</span></td>
                    <td>${isPending
                      ? `<button type="button" class="btn btn--primary btn--sm" data-acuse-doc="${d.id}">Dar acuse</button>`
                      : `<span class="muted" style="font-size:12px">Acusado ✓</span>`}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (state.clientSub === 'bhe') {
      if (!Array.isArray(c.bheDocs)) {
        const retTarget = c.f29.bhe || 0;
        const brutoDefault = retTarget > 0 ? Math.round(retTarget / 0.1525) : 0;
        c.bheDocs = brutoDefault > 0
          ? [
              { id: 'bh1', folio: '1402', date: '08/11/2026', name: 'Estudio Diseño Sur Ltda.', rut: rutConDv(16224510), bruto: Math.round(brutoDefault * 0.6), status: 'Pagada' },
              { id: 'bh2', folio: '1419', date: '19/11/2026', name: 'Andrés Morales Vega (TI)', rut: rutConDv(17992310), bruto: brutoDefault - Math.round(brutoDefault * 0.6), status: 'Pendiente pago' }
            ]
          : [];
      }
      const totBruto = c.bheDocs.reduce((s, b) => s + (b.bruto || 0), 0);
      const totRet = c.bheDocs.reduce((s, b) => s + Math.round((b.bruto || 0) * 0.1525), 0);
      const totLiq = totBruto - totRet;
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Boletas BHE</span><span class="v2-tape-val">${c.bheDocs.length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Honorario bruto</span><span class="v2-tape-val">${fmt(totBruto)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Retención 15,25% (Cód. 151)</span><span class="v2-tape-val is-in">${fmt(totRet)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Líquido a pagar</span><span class="v2-tape-val">${fmt(totLiq)}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th style="width:68px">Folio</th><th style="width:92px">Fecha</th><th>Profesional / RUT</th><th class="num">Bruto</th><th class="num">Ret. 15,25%</th><th class="num">Líquido</th><th>Estado</th></tr></thead>
            <tbody>
              ${c.bheDocs.length ? c.bheDocs.map((b) => {
                const ret = Math.round((b.bruto || 0) * 0.1525);
                return `
                  <tr>
                    <td class="mono">${b.folio}</td>
                    <td class="mono">${b.date}</td>
                    <td><strong>${b.name}</strong><span class="v2-cell-sub mono">${b.rut}</span></td>
                    <td class="num">${fmt(b.bruto)}</td>
                    <td class="num">${fmt(ret)}</td>
                    <td class="num"><strong>${fmt(b.bruto - ret)}</strong></td>
                    <td><span class="tag ${b.status === 'Pagada' ? 'tag--in' : 'tag--out'}">${b.status}</span></td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">Sin boletas de honorarios recibidas en ${currentPeriod().label}. Registra una en el panel derecho para actualizar automáticamente el F29 Cód. 151.</td></tr>`}
            </tbody>
            <tfoot>
              <tr><td colspan="3">Total BHE recibidas · Alimenta F29 Cód. 151 y DJ 1879</td><td class="num">${fmt(totBruto)}</td><td class="num">${fmt(totRet)}</td><td class="num">${fmt(totLiq)}</td><td></td></tr>
            </tfoot>
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
      ${state.clientSub === 'f29' ? renderF29ExplainBlock(c) : state.clientSub === 'rcv' ? renderRcvExplainBlock(c) : state.clientSub === 'bhe' ? `
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Registrar Boleta (BHE)</h2><span class="tag tag--in">15,25% · 2026</span></div>
          <p class="muted" style="margin:0;font-size:12px">Al agregar una boleta se recalcula automáticamente el Cód. 151 del F29 y el respaldo anual DJ 1879 (Ley 21.133).</p>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <input type="text" id="inp-bhe-name" class="v2-ins-select" placeholder="Nombre profesional (ej. Juan Pérez)" aria-label="Nombre profesional">
            <input type="text" id="inp-bhe-rut" class="v2-ins-select mono" placeholder="RUT (ej. 16.440.221-8)" aria-label="RUT profesional">
            <input type="number" id="inp-bhe-bruto" class="v2-ins-select mono" placeholder="Monto bruto CLP (ej. 500000)" aria-label="Monto bruto">
            <button type="button" class="btn btn--primary btn--sm" data-add-bhe="1">+ Agregar BHE y actualizar F29</button>
          </div>
        </div>
      ` : ''}
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Auditor F29 / RCV · SII vs Motor</h2>
          ${c.rcv.pendingAcuses
            ? `<button type="button" class="tag tag--danger" style="cursor:pointer;border:1px solid #fecaca" data-client-sub="rcv" title="Ir a Compras y Acuses">Brecha detectada →</button>`
            : `<span class="tag tag--in">Cuadrado</span>`}
        </div>
        ${(() => {
          const iuscNom = (c.workers || []).reduce((s, w) => s + (calcularWorkerReal(w, currentPeriod().iso).impUnico || 0), 0);
          const diff048 = (c.f29.retenciones || 0) - iuscNom;
          return `
            <div class="v2-ins-list" style="font-size:12px">
              <div class="v2-ins-row">
                <div>
                  <div>Impuesto sueldos (Nómina vs F29 Cód. 048)</div>
                  ${diff048 !== 0 ? `<div class="muted" style="font-size:11px">El F29 tiene ${fmt(c.f29.retenciones || 0)}, pero tus sueldos suman ${fmt(iuscNom)}.</div>` : ''}
                </div>
                ${diff048 === 0
                  ? `<span class="tag tag--in">Cuadrado</span>`
                  : `<button type="button" class="tag tag--on" style="cursor:pointer;border:0" data-open-client="${c.id}" data-open-area="remuneraciones" data-open-sub="nomina" title="Ver Impuesto Único en Nómina">Dif. ${fmt(diff048)} →</button>`}
              </div>
              <div class="v2-ins-row">
                <div>
                  <div>Facturas sin acuse (plazo 8 días SII)</div>
                  ${c.rcv.pendingAcuses ? `<div class="muted" style="font-size:11px">Acúsalas en Compras para no perder el Crédito IVA.</div>` : ''}
                </div>
                ${c.rcv.pendingAcuses
                  ? `<button type="button" class="tag tag--danger" style="cursor:pointer;border:1px solid #fecaca" data-client-sub="rcv" title="Ver facturas con acuse pendiente">${c.rcv.pendingAcuses} en riesgo →</button>`
                  : `<span class="tag tag--in">OK</span>`}
              </div>
              <div class="v2-ins-row"><span>Postergación IVA (Cód. 756/755)</span>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="checkbox" id="chk-postergar" ${c.f29.postergar ? 'checked' : ''}> <span class="mono">${c.f29.postergar ? 'Sí' : 'No'}</span>
                </label>
              </div>
            </div>
            ${diff048 !== 0 ? `<button type="button" class="btn btn--sm" style="margin-top:6px" data-sync-f29-iusc="${iuscNom}">Alinear Cód. 048 con Nómina (${fmt(iuscNom)})</button>` : ''}
          `;
        })()}
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
        <div class="v2-ins-head"><h2 class="v2-ins-title">Documentos tributarios</h2><span class="mono muted">PDF · XLSX</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn btn--sm" data-emit-doc="f29-pdf">Hoja F29 (PDF)</button>
          <button type="button" class="btn btn--sm" data-emit-doc="f29-xlsx">F29 (Excel)</button>
          <button type="button" class="btn btn--sm" data-emit-doc="renta-pdf">Borrador Renta / DDJJ (PDF)</button>
        </div>
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

    if (state.clientSub === 'fichas') {
      const calcMeses = (ingreso) => {
        if (!ingreso) return 12;
        const d = new Date(ingreso + 'T00:00:00');
        if (isNaN(d.getTime())) return 12;
        const ref = new Date(iso + '-30T00:00:00');
        return Math.max(1, (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth()));
      };
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Dotación vigente</span><span class="v2-tape-val">${c.workers.length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Socios Art. 31 N°6</span><span class="v2-tape-val">${c.workers.filter((w) => w.tipoRegimen === 'socio').length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Pensionados vejez</span><span class="v2-tape-val">${c.workers.filter((w) => w.tipoRegimen === 'pensionado').length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Fichas incompletas</span><span class="v2-tape-val ${getClientPayrollBlockers(c).length ? 'is-danger' : 'is-in'}">${getClientPayrollBlockers(c).length}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Trabajador / RUT</th><th>Cargo</th><th>Ingreso</th><th class="num">Vacaciones (Art. 67)</th><th>Previsión</th><th>Régimen</th><th class="num">Sueldo base</th><th class="num">Documentos</th></tr></thead>
            <tbody>
              ${c.workers.map((w) => {
                const m = calcMeses(w.ingreso);
                const vac = w.tipoRegimen === 'socio' ? 'N/A' : `${(m * 1.25).toFixed(1).replace('.', ',')} d`;
                const reg = w.tipoRegimen === 'socio' ? 'Socio Emp.' : w.tipoRegimen === 'pensionado' ? 'Pensionado' : 'Dependiente';
                return `
                  <tr class="${selectedObj && selectedObj.w.id === w.id ? 'is-selected' : ''}" data-select-worker="${w.id}" style="cursor:pointer">
                    <td><strong>${w.name}</strong><span class="v2-cell-sub mono">${w.rut}</span></td>
                    <td>${w.cargo || 'Sin cargo'}</td>
                    <td class="mono">${w.ingreso || '—'}</td>
                    <td class="num mono">${vac}</td>
                    <td>${w.afp || '—'} / Fonasa</td>
                    <td><span class="tag ${w.tipoRegimen === 'socio' ? 'tag--out' : 'tag--in'}">${reg}</span></td>
                    <td class="num"><strong>${fmt(w.base)}</strong></td>
                    <td class="num"><a href="/generador-contrato-trabajo-chile" target="_blank" rel="noopener" class="btn btn--sm" style="text-decoration:none">Contrato / Anexo ↗</a></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      $('v2-inspector').innerHTML = `
        ${selectedObj ? `
          <div class="v2-ins-block v2-ins-block--soft">
            <div class="v2-ins-head"><h2 class="v2-ins-title">${selectedObj.w.name}</h2><span class="mono muted">${selectedObj.w.rut}</span></div>
            <p class="muted" style="margin:0 0 6px;font-size:12px">Genera contratos y anexos laborales en Word actualizados a Ley 40 Horas (42h en 2026) directo desde la ficha.</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <a href="/generador-contrato-trabajo-chile" target="_blank" rel="noopener" class="btn btn--primary btn--sm" style="text-decoration:none;flex:1;text-align:center">Generar Contrato Word ↗</a>
              <a href="/app" target="_blank" rel="noopener" class="btn btn--sm" style="text-decoration:none">Anexos ↗</a>
            </div>
          </div>
        ` : ''}
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Agregar trabajador a ${c.name.split(' ')[0]}</h2><span class="tag tag--in">Legajo</span></div>
          <p class="muted" style="margin:0;font-size:12px">Se suma de inmediato a Nómina, PreviRed (105), LRE (147) y Finiquitos.</p>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <input type="text" id="inp-nw-name" class="v2-ins-select" placeholder="Nombre completo" aria-label="Nombre completo">
            <input type="text" id="inp-nw-rut" class="v2-ins-select mono" placeholder="RUT (ej. 18.234.567-K)" aria-label="RUT trabajador">
            <input type="text" id="inp-nw-cargo" class="v2-ins-select" placeholder="Cargo (ej. Administrativo)" aria-label="Cargo">
            <input type="number" id="inp-nw-base" class="v2-ins-select mono" placeholder="Sueldo base CLP (ej. 850000)" aria-label="Sueldo base">
            <select id="sel-nw-regimen" class="v2-ins-select" aria-label="Régimen laboral">
              <option value="dependiente">Dependiente estándar</option>
              <option value="socio">Socio · Sueldo empresarial (Art. 31 N°6)</option>
              <option value="pensionado">Pensionado por vejez (Art. 69 D.L. 3.500)</option>
            </select>
            <button type="button" class="btn btn--primary btn--sm" data-add-worker="1">+ Guardar trabajador</button>
          </div>
        </div>
      `;
      return;
    }

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
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-emit-doc="finiquito-pdf"${selIsSocio ? ' disabled' : ''}>Emitir Finiquito PDF</button>
            <button type="button" class="btn btn--sm" data-emit-doc="finiquitos-xlsx">Lote Excel</button>
          </div>
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
            <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-emit-doc="liq-pdf">Liquidación PDF</button>
            <button type="button" class="btn btn--sm" data-emit-doc="liq-lote-pdf">Todas (PDF)</button>
          </div>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn--sm" style="flex:1" id="btn-dl-previred">${incompleteCount ? `Previred bloqueado (${incompleteCount})` : 'Previred 105'}</button>
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

  function ensureAuxDocs(c) {
    if (Array.isArray(c.auxDocs) && c.auxDocs.length) return c.auxDocs;
    if (c.id === 'san-isidro') {
      c.auxDocs = [
        { id: 'ax1', kind: 'cxc', folio: '3990', party: 'Distribuidora Oriente SpA', rut: '76.440.120-4', issued: '18/09', days: 68, amount: 640000, status: 'Abierto' },
        { id: 'ax2', kind: 'cxc', folio: '4109', party: 'Café Central Ltda.', rut: '77.210.890-1', issued: '15/10', days: 42, amount: 1250000, status: 'Abierto' },
        { id: 'ax3', kind: 'cxp', folio: '88412', party: 'Molinos del Sur S.A.', rut: '76.112.400-5', issued: '14/11', days: 12, amount: 945000, status: 'Abierto' },
        { id: 'ax4', kind: 'cxc', folio: '4152', party: 'Hotel Providencia S.A.', rut: '96.712.440-8', issued: '21/11', days: 0, amount: 890000, status: 'Abierto' },
        { id: 'ax5', kind: 'cxp', folio: '20491', party: 'Envases Chile SpA', rut: '77.409.118-2', issued: '24/11', days: 0, amount: 412000, status: 'Abierto' }
      ];
    } else {
      const vBase = Math.max(450000, Math.round((c.rcv.ventasNeto || 2000000) * 0.14));
      const cBase = Math.max(280000, Math.round((c.rcv.comprasNeto || 1200000) * 0.16));
      c.auxDocs = [
        { id: `${c.id}-ax1`, kind: 'cxc', folio: '1108', party: 'Cliente Corporativo Principal', rut: '76.901.112-3', issued: '19/10', days: 38, amount: vBase, status: 'Abierto' },
        { id: `${c.id}-ax2`, kind: 'cxp', folio: '50114', party: 'Distribuidora Central Ltda.', rut: '76.889.210-1', issued: '16/11', days: 10, amount: cBase, status: 'Abierto' }
      ];
    }
    return c.auxDocs;
  }

  function auxAgingLabel(days) {
    if (days <= 0) return { label: 'Al día', cls: 'tag--in' };
    if (days <= 30) return { label: `${days} d (1–30)`, cls: 'tag--out' };
    if (days <= 60) return { label: `${days} d (31–60)`, cls: 'tag--on' };
    return { label: `${days} d (> 60)`, cls: 'tag--danger' };
  }

  function renderClientBancos(c) {
    if (state.clientSub === 'cxc') {
      const allAux = ensureAuxDocs(c);
      const openAux = allAux.filter((d) => d.status === 'Abierto');
      const totCxc = openAux.filter((d) => d.kind === 'cxc').reduce((s, d) => s + d.amount, 0);
      const totCxp = openAux.filter((d) => d.kind === 'cxp').reduce((s, d) => s + d.amount, 0);
      const vencido30 = openAux.filter((d) => d.days > 30).reduce((s, d) => s + d.amount, 0);
      const bucket0_30 = openAux.filter((d) => d.days <= 30).reduce((s, d) => s + d.amount, 0);
      const bucket31_60 = openAux.filter((d) => d.days > 30 && d.days <= 60).reduce((s, d) => s + d.amount, 0);
      const bucket60p = openAux.filter((d) => d.days > 60).reduce((s, d) => s + d.amount, 0);
      const filtered = allAux.filter((d) => {
        if (state.auxFilter === 'cxc') return d.kind === 'cxc';
        if (state.auxFilter === 'cxp') return d.kind === 'cxp';
        if (state.auxFilter === 'vencido') return d.status === 'Abierto' && d.days > 30;
        return true;
      });
      const selAux = filtered.find((d) => d.id === state.selectedAuxId) || filtered[0] || null;
      if (selAux) state.selectedAuxId = selAux.id;

      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Por cobrar (CxC)</span><span class="v2-tape-val is-in">${fmt(totCxc)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Por pagar (CxP)</span><span class="v2-tape-val">${fmt(totCxp)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Vencido &gt; 30 días</span><span class="v2-tape-val ${vencido30 ? 'is-danger' : ''}">${fmt(vencido30)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Posición neta</span><span class="v2-tape-val">${fmt(totCxc - totCxp)}</span></div>
        </div>
        <div class="v2-f29-hint" style="margin:8px 0 0;padding:8px 14px;font-size:12px">
          <span><strong>Antigüedad de saldos abierta (incluida sin costo extra):</strong> 0–30 d <span class="mono">${fmt(bucket0_30)}</span> · 31–60 d <span class="mono">${fmt(bucket31_60)}</span> · &gt;60 d <span class="mono" style="color:${bucket60p ? '#b91c1c' : 'inherit'};font-weight:700">${fmt(bucket60p)}</span></span>
        </div>
        <div class="v2-pulse-bar">
          <div class="v2-filter-pills" role="group" aria-label="Filtrar auxiliar por cobrar y pagar">
            <button type="button" class="v2-pill-btn" data-aux-filter="todos" aria-pressed="${state.auxFilter === 'todos'}">Todos <span class="mono">${allAux.length}</span></button>
            <button type="button" class="v2-pill-btn" data-aux-filter="cxc" aria-pressed="${state.auxFilter === 'cxc'}">Por Cobrar</button>
            <button type="button" class="v2-pill-btn" data-aux-filter="cxp" aria-pressed="${state.auxFilter === 'cxp'}">Por Pagar</button>
            <button type="button" class="v2-pill-btn" data-aux-filter="vencido" aria-pressed="${state.auxFilter === 'vencido'}">Vencidos &gt; 30d</button>
          </div>
          <span class="muted" style="font-size:12px">Auxiliar por antigüedad · Al día / 1–30 / 31–60 / &gt;60 d</span>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th>Tipo</th><th>Folio</th><th>Contraparte</th><th>Emisión</th><th>Antigüedad</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
            <tbody>
              ${filtered.map((d) => {
                const ag = auxAgingLabel(d.days);
                return `
                  <tr class="${selAux && selAux.id === d.id ? 'is-selected' : ''}" data-select-aux="${d.id}" style="cursor:pointer">
                    <td><span class="tag ${d.kind === 'cxc' ? 'tag--in' : 'tag--out'}">${d.kind === 'cxc' ? 'CxC' : 'CxP'}</span></td>
                    <td class="mono">${d.folio}</td>
                    <td><strong>${d.party}</strong><span class="v2-cell-sub mono">${d.rut}</span></td>
                    <td class="mono">${d.issued}</td>
                    <td>${d.status === 'Saldado' ? '<span class="muted">Saldado</span>' : `<span class="tag ${ag.cls}">${ag.label}</span>`}</td>
                    <td class="num"><strong>${fmt(d.amount)}</strong></td>
                    <td><span class="tag ${d.status === 'Saldado' ? 'tag--in' : 'tag--out'}">${d.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      $('v2-inspector').innerHTML = selAux ? `
        <div class="v2-ins-block" id="v2-aux-inspector">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">${selAux.kind === 'cxc' ? 'Cuenta por Cobrar' : 'Cuenta por Pagar'}</h2>
            <span class="tag ${selAux.status === 'Saldado' ? 'tag--in' : auxAgingLabel(selAux.days).cls}">${selAux.status === 'Saldado' ? 'Saldado' : auxAgingLabel(selAux.days).label}</span>
          </div>
          <dl class="v2-ins-kv">
            <dt>Contraparte</dt><dd style="font-family:var(--font-sans);font-weight:600">${selAux.party}</dd>
            <dt>RUT</dt><dd>${selAux.rut}</dd>
            <dt>Folio DTE</dt><dd>#${selAux.folio}</dd>
            <dt>Emisión</dt><dd>${selAux.issued}</dd>
            <dt>Saldo</dt><dd><strong>${fmt(selAux.amount)}</strong></dd>
          </dl>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
            ${selAux.status === 'Abierto'
              ? `<button type="button" class="btn btn--primary" data-settle-aux="${selAux.id}">${selAux.kind === 'cxc' ? 'Registrar cobro en Banco' : 'Registrar pago en Banco'}</button>`
              : `<div class="v2-ins-note">Movimiento ya saldado y registrado en Conciliación Bancaria.</div>`}
            <button type="button" class="btn btn--sm" data-quick-ok="Recordatorio enviado por folio #${selAux.folio} (${selAux.party})">${selAux.kind === 'cxc' ? 'Enviar recordatorio de cobro' : 'Solicitar comprobante de pago'}</button>
          </div>
        </div>
      ` : '';
      return;
    }

    const selected = c.bankTx.find((b) => b.id === state.selectedBankId) || c.bankTx[0] || null;
    if (selected) state.selectedBankId = selected.id;
    const conc = c.bankTx.filter((t) => t.status === 'Conciliado').length;
    const pend = c.bankTx.length - conc;
    $('v2-canvas').innerHTML = `
      <div class="v2-pulse-bar">
        <span class="muted">Conciliación bancaria (${conc}/${c.bankTx.length} cuadrados)</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn--sm" data-sample-cartola="1">Cargar cartola ejemplo + Transbank</button>
          <label class="btn btn--sm">
            Importar cartola CSV
            <input type="file" accept=".csv,.txt" id="v2-csv-cartola" class="sr-only">
          </label>
        </div>
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

        ${selected.amount > 0 ? (() => {
          const feePct = Number(state.gatewayFeePct || 2.95);
          const netoBanco = selected.amount;
          const factor = 1 - (feePct / 100) * 1.19;
          const ventaBruta = Math.round(netoBanco / (factor > 0.5 ? factor : 0.965));
          const comNeta = Math.round(ventaBruta * (feePct / 100));
          const ivaCom = Math.round(comNeta * 0.19);
          return `
            <div class="v2-ins-block v2-ins-block--soft">
              <div class="v2-ins-head">
                <h2 class="v2-ins-title">Split Pasarela (Transbank / Getnet / MP)</h2>
                <span class="tag tag--in">${feePct.toFixed(2).replace('.', ',')}% + IVA</span>
              </div>
              <p class="muted" style="margin:0;font-size:11.5px">Separa venta bruta POS, comisión neta (42030) e IVA crédito comisión (11080) del abono bancario.</p>
              <dl class="v2-ins-kv" style="margin-top:4px">
                <dt>Venta bruta POS (DTE 39)</dt><dd>${fmt(ventaBruta)}</dd>
                <dt>Comisión neta (42030)</dt><dd>−${fmt(comNeta)}</dd>
                <dt>IVA comisión 19% (11080)</dt><dd>−${fmt(ivaCom)}</dd>
                <dt><strong>Abono neto en banco</strong></dt><dd><strong>${fmt(netoBanco)}</strong></dd>
              </dl>
              <button type="button" class="btn btn--sm" style="margin-top:6px" data-apply-split-tx="${selected.id}" data-split-bruta="${ventaBruta}" data-split-com="${comNeta}" data-split-iva="${ivaCom}">Aplicar Split y cuadrar asiento</button>
            </div>
          `;
        })() : ''}

        <div class="v2-ins-block v2-ins-block--soft">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Informes bancarios</h2><span class="mono muted">PDF · XLSX</span></div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn--sm" style="flex:1" data-emit-doc="bancos-pdf">Conciliación PDF</button>
            <button type="button" class="btn btn--sm" data-emit-doc="bancos-xlsx">Excel (.xlsx)</button>
          </div>
        </div>
      `;
    } else {
      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <h2 class="v2-ins-title">Cartola pendiente</h2>
          <p class="muted" style="margin:0;font-size:12.5px">Pendientes por conciliar: ${pend}</p>
          <button type="button" class="btn btn--primary" data-quick-ok="Enlace sin clave enviado a ${c.name}">Pedir cartola al cliente</button>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="btn btn--sm" style="flex:1" data-emit-doc="bancos-pdf">Informe PDF</button>
            <button type="button" class="btn btn--sm" data-emit-doc="bancos-xlsx">Excel (.xlsx)</button>
          </div>
        </div>
      `;
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
    const { asientos, mayor, bal } = buildAccountingReal(c);
    const t = bal.totales || {};
    const cuadra = t.debito === t.credito;

    if (state.clientSub === 'plan') {
      const usedCodes = new Set((bal.filas || []).map((f) => String(f.codigo)));
      const protectedCount = state.studioChart.filter((a) => usedCodes.has(a.code)).length;
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Cuentas maestro</span><span class="v2-tape-val">${state.studioChart.length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">En uso (protegidas)</span><span class="v2-tape-val is-in">${protectedCount}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Empresas estudio</span><span class="v2-tape-val">${state.clients.length}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Última propagación</span><span class="v2-tape-val" style="font-size:13px">${state.lastPlanSync || 'Pendiente'}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th style="width:92px">Código</th><th>Cuenta contable (Plan del Estudio)</th><th>Tipo</th><th>Uso en ${c.name.split(' ')[0]}</th><th class="num">Acción</th></tr></thead>
            <tbody>
              ${state.studioChart.map((a) => {
                const inUse = usedCodes.has(a.code);
                return `
                  <tr>
                    <td class="mono"><strong>${a.code}</strong></td>
                    <td>${a.name}</td>
                    <td><span class="tag tag--out">${a.type}</span></td>
                    <td><span class="tag ${inUse ? 'tag--in' : 'tag--out'}">${inUse ? 'En uso · protegida' : 'Sin movimientos'}</span></td>
                    <td class="num">${inUse ? '<span class="muted" style="font-size:11.5px">Protegida</span>' : `<button type="button" class="btn btn--sm" data-del-studio-acc="${a.code}">Quitar</button>`}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block" id="v2-plan-propagate-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">Propagar plan del Estudio</h2>
            <span class="tag tag--in">${state.clients.length} empresas</span>
          </div>
          <p class="muted" style="margin:0;font-size:12px;line-height:1.4">Aplica este Plan de Cuentas maestro a todas las empresas del estudio. Las cuentas con movimientos contables quedan protegidas y nunca se eliminan ni sobrescriben.</p>
          <button type="button" class="btn btn--primary" data-propagate-plan="1">Aplicar plan a mis ${state.clients.length} empresas</button>
        </div>
        <div class="v2-ins-block v2-ins-block--soft">
          <h2 class="v2-ins-title">Agregar cuenta al maestro</h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input type="text" id="inp-acc-code" class="v2-ins-select mono" placeholder="Código (ej. 41060)" aria-label="Código de cuenta">
            <input type="text" id="inp-acc-name" class="v2-ins-select" placeholder="Nombre (ej. Software y suscripciones)" aria-label="Nombre de cuenta">
            <select id="sel-acc-type" class="v2-ins-select" aria-label="Tipo de cuenta">
              <option value="Pérdida">Pérdida (Gasto)</option>
              <option value="Activo">Activo</option>
              <option value="Pasivo">Pasivo</option>
              <option value="Ganancia">Ganancia (Ingreso)</option>
            </select>
            <button type="button" class="btn btn--sm" data-add-studio-acc="1">Agregar al plan maestro</button>
          </div>
        </div>
      `;
      return;
    }

    if (state.clientSub === 'resultados') {
      const ingresos = (bal.filas || []).filter((f) => (f.ganancia || 0) > 0);
      const gastos = (bal.filas || []).filter((f) => (f.perdida || 0) > 0);
      const totIng = ingresos.reduce((s, f) => s + (f.ganancia || 0), 0);
      const totGas = gastos.reduce((s, f) => s + (f.perdida || 0), 0);
      const res = totIng - totGas;
      const margen = totIng > 0 ? ((res / totIng) * 100).toFixed(1).replace('.', ',') : '0,0';
      const tasaIdpc = c.regime === '14 A' ? 27 : c.regime === '14 D8' ? 0 : 12.5;
      const idpcEst = res > 0 ? Math.round(res * (tasaIdpc / 100)) : 0;
      $('v2-canvas').innerHTML = `
        <div class="v2-tape">
          <div class="v2-tape-cell"><span class="v2-tape-label">Ingresos</span><span class="v2-tape-val">${fmt(totIng)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Costos y gastos</span><span class="v2-tape-val">${fmt(totGas)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Resultado neto</span><span class="v2-tape-val ${res < 0 ? 'is-danger' : 'is-in'}">${fmt(res)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Margen operativo</span><span class="v2-tape-val">${margen}%</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th style="width:72px">Código</th><th>Estado de Resultados (P&amp;L) · ${state.balanceScope === 'mes' ? currentPeriod().label : 'Acumulado'}</th><th>Tipo</th><th class="num">Monto CLP</th></tr></thead>
            <tbody>
              ${ingresos.map((f) => `<tr><td class="mono">${f.codigo}</td><td><strong>${f.nombre}</strong></td><td><span class="tag tag--in">Ingreso</span></td><td class="num">${fmt(f.ganancia)}</td></tr>`).join('')}
              ${gastos.map((f) => `<tr><td class="mono">${f.codigo}</td><td>${f.nombre}</td><td><span class="tag tag--out">Gasto / Costo</span></td><td class="num">−${fmt(f.perdida)}</td></tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="3"><strong>${res >= 0 ? 'Utilidad del período' : 'Pérdida del período'} (Margen ${margen}%)</strong></td><td class="num">${fmt(res)}</td></tr>
            </tfoot>
          </table>
        </div>
      `;
      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Proyección Tributaria (${c.regime})</h2><span class="tag tag--in">IDPC ${tasaIdpc}%</span></div>
          <dl class="v2-ins-kv">
            <dt>Resultado antes IDPC</dt><dd>${fmt(res)}</dd>
            <dt>IDPC estimado (${tasaIdpc}%)</dt><dd>${fmt(idpcEst)}</dd>
            <dt>Resultado después IDPC</dt><dd><strong>${fmt(res - idpcEst)}</strong></dd>
          </dl>
          <p class="muted" style="margin:4px 0 0;font-size:11.5px">${c.regime === '14 D3' ? 'En 14 D3 ProPyme la base real se determina sobre ingresos percibidos y gastos pagados.' : 'Referencial antes de ajustes extracontables de RLI.'}</p>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="button" class="btn btn--sm" style="flex:1" data-emit-doc="resultados-pdf">Emitir P&amp;L PDF</button>
            <button type="button" class="btn btn--sm" data-emit-doc="contab-xlsx">Excel (.xlsx)</button>
          </div>
        </div>
      `;
      return;
    }

    if (state.clientSub === 'mayor') {
      const selCode = state.selectedMayorCode || (mayor[0] && mayor[0].codigo) || null;
      const selMayor = mayor.find((m) => m.codigo === selCode) || mayor[0];
      const movs = selMayor ? asientos.flatMap((a) => a.lineas.filter((l) => l.cuenta === selMayor.codigo).map((l) => ({ id: a.id, fecha: a.fecha, glosa: a.glosa, debe: l.debe || 0, haber: l.haber || 0 }))) : [];
      $('v2-canvas').innerHTML = `
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead><tr><th style="width:72px">Código</th><th>Cuenta (clic para ver movimientos del Mayor)</th><th class="num">Débitos</th><th class="num">Créditos</th><th class="num">Saldo Deudor</th><th class="num">Saldo Acreedor</th></tr></thead>
            <tbody>
              ${mayor.map((m) => {
                const sd = Math.max(0, (m.debito || 0) - (m.credito || 0));
                const sa = Math.max(0, (m.credito || 0) - (m.debito || 0));
                return `
                  <tr class="${selMayor && selMayor.codigo === m.codigo ? 'is-selected' : ''}" data-select-mayor="${m.codigo}" style="cursor:pointer">
                    <td class="mono"><strong>${m.codigo}</strong></td>
                    <td>${m.nombre}</td>
                    <td class="num">${fmt(m.debito || 0)}</td>
                    <td class="num">${fmt(m.credito || 0)}</td>
                    <td class="num">${sd ? fmt(sd) : '—'}</td>
                    <td class="num">${sa ? fmt(sa) : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      $('v2-inspector').innerHTML = selMayor ? `
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">${selMayor.codigo} · ${selMayor.nombre}</h2><span class="tag tag--out">${movs.length} mov.</span></div>
          <div class="v2-ins-list" style="font-size:12px">
            ${movs.map((mv) => `
              <div class="v2-ins-row">
                <div><strong>${mv.id}</strong> · <span class="mono muted">${mv.fecha}</span><div class="muted">${mv.glosa}</div></div>
                <span class="mono">${mv.debe ? `D ${fmt(mv.debe)}` : `H ${fmt(mv.haber)}`}</span>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn--sm" style="margin-top:8px" data-emit-doc="contab-xlsx">Descargar Mayor en Excel (.xlsx)</button>
        </div>
      ` : '';
      return;
    }

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
              <button type="button" data-export-bal="pdf">Balance 8 Columnas (PDF horizontal)</button>
              <button type="button" data-export-bal="xlsx">Balance + Diario + Mayor (Excel .xlsx)</button>
              <button type="button" data-export-bal="csv">Balance 8 Columnas (CSV)</button>
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
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-emit-doc="balance-pdf">Balance 8 Col. PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="contab-xlsx">Excel (.xlsx)</button>
        </div>
      </div>
    `;
  }

  function renderClientResumen(c) {
    const blockers = getClientPayrollBlockers(c);
    const steps = [
      {
        num: 1,
        title: '1. Compras, Ventas (RCV) y Acuses 8 días',
        sub: 'Revisa compras y da acuse antes de 8 días para no perder Crédito Fiscal IVA.',
        done: c.rcv.state !== 'alerta' && !c.rcv.pendingAcuses,
        tagClass: c.rcv.state === 'alerta' ? 'tag--danger' : 'tag--in',
        status: c.rcv.label,
        btnLabel: c.rcv.pendingAcuses ? `Revisar ${c.rcv.pendingAcuses} acuses →` : 'Abrir RCV',
        area: 'impuestos',
        subArea: 'rcv'
      },
      {
        num: 2,
        title: '2. Remuneraciones, PreviRed (105) y LRE (147)',
        sub: 'Verifica fichas completas, calcula liquidaciones y exporta PreviRed / LRE.',
        done: c.nomina.state === 'ok' && blockers.length === 0,
        tagClass: (c.nomina.state !== 'ok' || blockers.length) ? 'tag--danger' : 'tag--in',
        status: blockers.length ? `${blockers.length} ficha(s) bloquean PreviRed` : c.nomina.label,
        btnLabel: blockers.length ? `Completar ${blockers.length} ficha(s) →` : (c.nomina.leyBustos ? 'Revisar Ley Bustos →' : 'Abrir Nómina'),
        area: 'remuneraciones',
        subArea: 'nomina'
      },
      {
        num: 3,
        title: '3. Conciliación Bancaria',
        sub: 'Cruza la cartola bancaria con facturas y remuneraciones del mes.',
        done: c.bancos.state === 'ok',
        tagClass: c.bancos.state === 'ok' ? 'tag--in' : 'tag--out',
        status: c.bancos.label,
        btnLabel: c.bancos.state === 'ok' ? 'Ver Bancos' : 'Conciliar cartola →',
        area: 'bancos',
        subArea: 'match'
      },
      {
        num: 4,
        title: '4. Declaración F29 (Cód. 091) y Cierre',
        sub: 'Valida IVA, PPM, IUSC (048) y BHE (151), contabiliza y declara en SII.',
        done: c.f29.state === 'declarado' || c.f29.state === 'pagado',
        tagClass: (c.f29.state === 'declarado' || c.f29.state === 'pagado' || c.f29.state === 'listo') ? 'tag--in' : 'tag--out',
        status: `${fmt(f29Total(c))} · ${f29StateLabel(c.f29.state)}`,
        btnLabel: (c.f29.state === 'declarado' || c.f29.state === 'pagado') ? 'Ver F29' : 'Revisar F29 →',
        area: 'impuestos',
        subArea: 'f29'
      }
    ];
    const nextStep = steps.find((s) => !s.done) || null;
    const doneCount = steps.filter((s) => s.done).length;

    $('v2-canvas').innerHTML = `
      <div class="v2-f29-hint" style="margin-bottom:10px">
        <span>${nextStep
          ? `<strong>Siguiente paso recomendado (${doneCount}/4):</strong> ${nextStep.title} — ${nextStep.sub}`
          : `<strong>Mes completo (4/4):</strong> todos los hitos están al día. Ya puedes emitir el Paquete PDF para el cliente.`}</span>
        ${nextStep
          ? `<button type="button" class="btn btn--primary btn--sm" data-open-client="${c.id}" data-open-area="${nextStep.area}" data-open-sub="${nextStep.subArea}">${nextStep.btnLabel}</button>`
          : `<span class="tag tag--in">Listo</span>`}
      </div>
      <div class="v2-tape">
        <div class="v2-tape-cell"><span class="v2-tape-label">Ventas netas</span><span class="v2-tape-val">${fmt(c.rcv.ventasNeto)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Compras netas</span><span class="v2-tape-val">${fmt(c.rcv.comprasNeto)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">F29 estimado</span><span class="v2-tape-val is-in">${fmt(f29Total(c))}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Avance cierre</span><span class="v2-tape-val">${doneCount}/4 pasos</span></div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Ruta de cierre mensual (en orden)</th><th>Estado actual</th><th class="num">Acción</th></tr></thead>
          <tbody>
            ${steps.map((s) => `
              <tr class="${nextStep && nextStep.num === s.num ? 'is-selected' : ''}">
                <td><strong>${s.title}</strong><span class="v2-cell-sub">${s.sub}</span></td>
                <td><span class="tag ${s.tagClass}">${s.status}</span></td>
                <td class="num"><button type="button" class="btn btn--sm ${nextStep && nextStep.num === s.num ? 'btn--primary' : ''}" data-open-client="${c.id}" data-open-area="${s.area}" data-open-sub="${s.subArea}">${s.btnLabel}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Qué revisar antes de cerrar (Normativa)</h2>
        <div class="v2-ins-list" style="font-size:12px">
          <div class="v2-ins-row"><span><strong>Acuses 8d:</strong> sin acuse pierdes Crédito Fiscal IVA.</span><span class="tag ${c.rcv.pendingAcuses ? 'tag--danger' : 'tag--in'}">${c.rcv.pendingAcuses ? `${c.rcv.pendingAcuses} pend.` : 'OK'}</span></div>
          <div class="v2-ins-row"><span><strong>PPM ${c.regime}:</strong> ${c.regime === '14 D3' ? 'en ProPyme tributa sobre cobrado.' : 'validar tasa sobre ingresos.'}</span><span class="tag tag--out">Revisar</span></div>
          <div class="v2-ins-row"><span><strong>Ley Bustos / Fichas:</strong> no ratificar finiquitos con mora.</span><span class="tag ${(c.nomina.leyBustos || blockers.length) ? 'tag--danger' : 'tag--in'}">${(c.nomina.leyBustos || blockers.length) ? 'Bloqueo' : 'OK'}</span></div>
          <div class="v2-ins-row"><span><strong>F29 048 vs 151:</strong> IUSC y BHE 15,25% separados.</span><span class="tag tag--in">Separados</span></div>
        </div>
      </div>
      <div class="v2-ins-block v2-ins-block--soft">
        <h2 class="v2-ins-title">Entregables del mes · ${state.studioName}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn btn--sm" data-emit-doc="paquete-xlsx">Paquete Excel (.xlsx)</button>
          <button type="button" class="btn btn--sm" data-emit-doc="expediente-pdf">Expediente Tributario PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="f29-pdf">Hoja F29 PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="liq-lote-pdf">Liquidaciones PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="balance-pdf">Balance 8 Col. PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="bancos-pdf">Conciliación PDF</button>
          <button type="button" class="btn btn--sm" data-emit-doc="copy-portal">Copiar enlace Portal</button>
        </div>
      </div>
    `;
  }

  /* ==================== HUB CONEXIONES (SII + PREVIRED + MCP + PORTAL) ==================== */
  function runMcpDemoQuery(queryId) {
    const clients = state.clients;
    if (queryId === 'acuses') {
      const urg = clients.filter((c) => c.rcv.pendingAcuses > 0);
      return urg.length
        ? `tool: get_tax_alerts → ${urg.length} empresa(s) con acuses < 8 días: ` + urg.map((c) => `${c.name} (${c.rcv.pendingAcuses} doc.)`).join(' · ')
        : 'tool: get_tax_alerts → 0 acuses por vencer en la cartera.';
    }
    if (queryId === 'f29') {
      const total = clients.reduce((s, c) => s + f29Total(c), 0);
      const cerr = clients.filter((c) => c.f29.state === 'declarado' || c.f29.state === 'pagado').length;
      return `tool: get_f29_summary → Cartera ${currentPeriod().label}: ${fmt(total)} total F29 Cód. 091 (${cerr}/${clients.length} declarados). Mayor monto: Importadora Pacífico ($3.662.000).`;
    }
    const bustos = clients.filter((c) => c.nomina.leyBustos);
    const incomp = clients.map((c) => ({ c, n: getClientPayrollBlockers(c).length })).filter((x) => x.n > 0);
    return `tool: get_previred_status → Riesgo Ley Bustos: ${bustos.map((c) => c.name).join(', ') || 'ninguno'}. Fichas que bloquean PreviRed: ${incomp.map((x) => `${x.c.name} (${x.n})`).join(', ') || 'ninguna'}.`;
  }

  function renderStudioConexiones() {
    if (!state.selectedConn) state.selectedConn = 'sii';
    const gwConnected = !!state.gatewayConnected || !!(state.gateway && (state.gateway.mode === 'connected' || state.gateway.configured));
    const liveList = Array.isArray(state.liveCompanies) ? state.liveCompanies : [];
    const mcpTools = [
      'list_companies', 'get_rcv_documents', 'get_bhe_documents',
      'get_f29_summary', 'get_sync_status', 'get_f22_ddjj',
      'get_tgr_status', 'get_previred_status', 'get_tax_alerts',
      'get_morning_report', 'get_glossary', 'auditor_f29'
    ];
    const integrations = [
      {
        id: 'sii',
        name: 'Conector SII Automático',
        sub: 'RCV Compras/Ventas · BHE 15,25% · F29 · Acuses 8d · sync-range',
        endpoint: 'connect.calculolaboral.cl · /api/studio-proxy',
        statusTag: gwConnected ? 'tag--in' : 'tag--out',
        statusLabel: gwConnected ? `Gateway conectado · ${liveList.length} RUT real(es)` : 'Demo local (sin proxy)'
      },
      {
        id: 'previred',
        name: 'PreviRed (105 campos) y LRE Mi DT (147 cols)',
        sub: 'Bóveda cifrada AES-256-GCM · Alertas Ley Bustos y fichas incompletas',
        endpoint: 'PREVIRED_CREDENTIALS · Archivo 105 / ANSI Win-1252',
        statusTag: 'tag--in',
        statusLabel: gwConnected ? 'Conectado · Exportadores activos' : 'Exportadores activos · Sync listo'
      },
      {
        id: 'mcp',
        name: 'Conector MCP · Claude, ChatGPT y Agentes IA',
        sub: '12 herramientas oficiales de solo lectura (incluye Reporte Matutino, Glosario y Auditor F29)',
        endpoint: 'https://connect.calculolaboral.cl/mcp',
        statusTag: 'tag--in',
        statusLabel: '12 herramientas · Solo lectura'
      },
      {
        id: 'portal',
        name: 'Portal del Cliente sin clave',
        sub: 'Recibe cartolas/respaldos y entrega Paquete Mensual PDF con tu marca',
        endpoint: '/portal-estudio?cliente=<id>',
        statusTag: 'tag--in',
        statusLabel: `${state.clients.length} enlaces listos`
      }
    ];
    const sel = integrations.find((x) => x.id === state.selectedConn) || integrations[0];

    $('v2-canvas').innerHTML = `
      <div class="v2-f29-hint" style="margin-bottom:10px">
        <span><strong>Integraciones reales de Cálculo Laboral:</strong> selecciona una fila para conectar un RUT real por bóveda cifrada, sincronizar SII/PreviRed o emitir tu token MCP para Claude.</span>
        <span class="mono">${gwConnected ? 'Gateway: conectado en vivo' : 'Modo: Demo local'}</span>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Integración</th><th>Canal / Alcance</th><th>Estado real</th><th class="num">Detalle</th></tr></thead>
          <tbody>
            ${integrations.map((it) => `
              <tr class="${sel.id === it.id ? 'is-selected' : ''}" data-select-conn="${it.id}" style="cursor:pointer">
                <td><strong>${it.name}</strong><span class="v2-cell-sub">${it.sub}</span></td>
                <td class="mono" style="font-size:11.5px">${it.endpoint}</td>
                <td><span class="tag ${it.statusTag}">${it.statusLabel}</span></td>
                <td class="num"><button type="button" class="btn btn--sm" data-select-conn="${it.id}">Configurar →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="v2-table-wrap" style="margin-top:14px">
        <table class="v2-table">
          <thead><tr><th>Empresas conectadas en Gateway SII (${liveList.length})</th><th>RUT</th><th>Estado real</th><th class="num">Acción</th></tr></thead>
          <tbody>
            ${liveList.length ? liveList.map((lc) => `
              <tr>
                <td><strong>${lc.name || lc.razonSocial || 'Empresa'}</strong></td>
                <td class="mono">${lc.rut || '—'}</td>
                <td><span class="tag ${lc.hasCredentials ? 'tag--in' : 'tag--out'}">${lc.hasCredentials ? 'Credencial en bóveda' : 'Sin credencial'}</span></td>
                <td class="num"><button type="button" class="btn btn--sm" data-sync-live-company="${lc.id}">Sincronizar ahora</button></td>
              </tr>
            `).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:14px">${gwConnected ? 'Gateway conectado y listo. Conecta tu primer RUT real en el panel derecho para descargar RCV, BHE y F29 automáticamente.' : 'Modo demo local activo.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    if (sel.id === 'mcp') {
      const demoOut = state.mcpDemoOutput || 'Haz clic en cualquiera de las consultas para probar el Conector MCP en vivo sobre tu cartera demo.';
      const claudeSnippet = JSON.stringify({
        mcpServers: {
          'calculo-laboral': {
            url: 'https://connect.calculolaboral.cl/mcp',
            headers: { 'x-mcp-token': state.mcpTokenLive || 'emitir_token_con_el_boton_de_arriba' }
          }
        }
      }, null, 2);
      const tokensList = Array.isArray(state.mcpTokensList) ? state.mcpTokensList : [];
      const accessLogs = Array.isArray(state.mcpAccessLogs) ? state.mcpAccessLogs : [];
      const sampleLogs = [
        { toolName: 'get_morning_report', companyRut: 'Cartera completa', clientLabel: 'Claude Desktop (ejemplo)', status: 'ok', createdAt: 'Hoy 08:15' },
        { toolName: 'get_tax_alerts', companyRut: '76.543.210-3', clientLabel: 'ChatGPT MCP (ejemplo)', status: 'ok', createdAt: 'Hoy 08:17' },
        { toolName: 'get_previred_status', companyRut: '77.120.450-8', clientLabel: 'Claude Web (ejemplo)', status: 'ok', createdAt: 'Hoy 08:19' }
      ];
      const logsToShow = accessLogs.length ? accessLogs.slice(0, 6) : sampleLogs;
      const isSampleLogs = !accessLogs.length;

      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Conector MCP (Solo lectura)</h2><span class="tag tag--in">12 tools</span></div>
          <p class="muted" style="margin:0;font-size:12px">Conecta Claude, ChatGPT, Gemini o Copilot a tu cartera sin cambiar de ERP. Solo lectura por diseño, tokens revocables y registro de consultas.</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${mcpTools.map((fn) => `<span class="tag tag--out mono" style="font-size:10.5px">${fn}</span>`).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
            <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-conn-action="issue-mcp-token">Emitir token MCP real</button>
            <button type="button" class="btn btn--sm" data-conn-action="copy-mcp-json">Copiar JSON</button>
            <a href="https://connect.calculolaboral.cl/reference" target="_blank" rel="noopener" class="btn btn--sm" style="text-decoration:none">API Docs ↗</a>
            <a href="/conector-mcp-contadores-chile" target="_blank" rel="noopener" class="btn btn--sm" style="text-decoration:none">Guía ↗</a>
          </div>
          ${state.mcpTokenLive ? `<div class="v2-ins-note" style="margin-top:6px;font-size:11.5px">Token emitido una sola vez. Cópialo ahora en tu configuración de Claude/ChatGPT.</div>` : ''}
          <pre class="mono" style="margin:6px 0 0;padding:8px;background:var(--ink-paper-2,#f4f5f6);border:1px solid var(--ink-rule);border-radius:6px;font-size:10.5px;overflow:auto;max-height:110px">${claudeSnippet}</pre>
        </div>
        <div class="v2-ins-block v2-ins-block--soft">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">Seguridad: tokens y registro de consultas</h2>
            <button type="button" class="btn btn--sm" data-conn-action="refresh-mcp-audit">Actualizar</button>
          </div>
          ${tokensList.length ? `
            <div class="v2-ins-list" style="margin-bottom:8px">
              ${tokensList.filter((tk) => !tk.revokedAt).slice(0, 4).map((tk) => `
                <div class="v2-ins-row">
                  <div style="font-size:11.5px"><strong>${tk.label || 'Token MCP'}</strong> <span class="mono muted">${tk.tokenPrefix || tk.prefix || tk.id.slice(0, 8)}</span></div>
                  <button type="button" class="btn btn--sm" data-revoke-mcp-token="${tk.id}" style="color:#b91c1c">Revocar</button>
                </div>
              `).join('')}
            </div>
          ` : `<p class="muted" style="margin:0 0 6px;font-size:11.5px">Tokens activos en gateway: ${tokensList.length}. Pulsa «Actualizar» o emite un token para verlo aquí y revocarlo en 1 clic.</p>`}
          <div style="font-size:11px;font-weight:700;color:#334155;margin:4px 0">${isSampleLogs ? 'Registro de consultas MCP (ejemplo de formato)' : `Registro real de consultas (${accessLogs.length})`}</div>
          <div class="v2-ins-list">
            ${logsToShow.map((lg) => `
              <div class="v2-ins-row" style="font-size:11px">
                <div>
                  <strong class="mono">${lg.toolName || lg.tool || 'mcp_tool'}</strong>
                  <div class="muted">${lg.companyRut || lg.companyId || 'Estudio'} · ${lg.clientLabel || 'Cliente MCP'}</div>
                </div>
                <span class="mono muted">${String(lg.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="v2-ins-block v2-ins-block--soft">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Prueba en vivo sobre tu cartera</h2><span class="mono muted">MCP</span></div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button type="button" class="btn btn--sm" style="text-align:left" data-mcp-query="acuses">¿Qué clientes tienen acuses &lt; 8 días?</button>
            <button type="button" class="btn btn--sm" style="text-align:left" data-mcp-query="f29">¿Cuánto suma el F29 de la cartera?</button>
            <button type="button" class="btn btn--sm" style="text-align:left" data-mcp-query="previred">¿Quién tiene Ley Bustos o fichas incompletas?</button>
          </div>
          <div class="v2-ins-note" style="margin-top:6px;font-size:11.5px">${demoOut}</div>
        </div>
      `;
    } else if (sel.id === 'portal') {
      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <div class="v2-ins-head"><h2 class="v2-ins-title">Portal del Cliente sin clave</h2><span class="tag tag--in">Activo</span></div>
          <p class="muted" style="margin:0;font-size:12px">Cada empresa recibe un enlace único para subir cartolas o licencias y descargar su Paquete Mensual PDF con tu marca (${state.studioName}).</p>
          <div class="v2-ins-list" style="margin-top:6px">
            ${state.clients.map((c) => `
              <div class="v2-ins-row">
                <span style="font-size:12px"><strong>${c.name.split(' ').slice(0, 2).join(' ')}</strong></span>
                <button type="button" class="btn btn--sm" data-copy-portal-id="${c.id}">Copiar enlace</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      const isPrev = sel.id === 'previred';
      $('v2-inspector').innerHTML = `
        <div class="v2-ins-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">${isPrev ? 'Conectar PreviRed real' : 'Conectar empresa real al SII'}</h2>
            <span class="tag ${gwConnected ? 'tag--in' : 'tag--out'}">${gwConnected ? 'Gateway en vivo' : 'Demo local'}</span>
          </div>
          <p class="muted" style="margin:0;font-size:12px;line-height:1.45">
            ${isPrev
              ? 'Guarda credenciales PreviRed en bóveda cifrada AES-256-GCM (VPS Chile) para consultar estado de cotizaciones y alerta Ley Bustos.'
              : 'Guarda la Clave Tributaria SII en bóveda AES-256-GCM vía /api/studio-proxy (nunca en el navegador) y sincroniza RCV, BHE y F29.'}
          </p>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <input type="text" id="inp-conn-rut" class="v2-ins-select mono" placeholder="RUT empresa (ej. 76.543.210-3)" aria-label="RUT empresa">
            <input type="text" id="inp-conn-name" class="v2-ins-select" placeholder="Razón social" aria-label="Razón social">
            <input type="password" id="inp-conn-pass" class="v2-ins-select" autocomplete="off" placeholder="${isPrev ? 'Clave PreviRed' : 'Clave Tributaria SII'}" aria-label="Clave cifrada">
            <button type="button" class="btn btn--primary btn--sm" data-conn-action="connect-real-company" data-conn-kind="${isPrev ? 'previred' : 'sii'}">Guardar en bóveda y sincronizar</button>
            <button type="button" class="btn btn--sm" data-conn-action="morning-report">Generar Reporte Matutino ahora</button>
            <button type="button" class="btn btn--sm" data-conn-action="probe-gateway">Verificar estado del Gateway</button>
          </div>
        </div>
      `;
    }
  }

  function renderBatchBar() {
    const bar = $('v2-batch-bar');
    const n = state.selectedIds.size;
    bar.hidden = n === 0;
    if (n > 0) $('v2-batch-count').textContent = `${n} seleccionados en lote`;
  }

  function evaluateMonitorRow(c) {
    const blockers = getClientPayrollBlockers(c);
    const hasAcuses = (c.rcv && c.rcv.pendingAcuses) || 0;
    const hasBustos = !!(c.nomina && c.nomina.leyBustos);
    const prevMora = !!(c.nomina && !c.nomina.previredOk);
    const f29Pend = !(c.f29 && (c.f29.state === 'declarado' || c.f29.state === 'pagado'));
    const tgrPending = c.f29 && c.f29.state === 'declarado' && !c.f29.paidDate;
    const riskAmount = (hasBustos || prevMora ? 1850000 : 0) + (hasAcuses ? hasAcuses * 450000 : 0) + (tgrPending ? f29Total(c) : 0);
    let level = 'ok';
    if (hasBustos || prevMora || hasAcuses >= 2) level = 'riesgo';
    else if (hasAcuses > 0 || blockers.length > 0 || f29Pend || tgrPending) level = 'revisar';
    return {
      c,
      level,
      levelLabel: level === 'riesgo' ? 'Riesgo' : level === 'revisar' ? 'Revisar' : 'Al día',
      levelTag: level === 'riesgo' ? 'tag--danger' : level === 'revisar' ? 'tag--out' : 'tag--in',
      siiText: hasAcuses ? `${hasAcuses} acuse(s) < 48h` : (f29Pend ? `F29 ${f29StateLabel(c.f29.state)}` : 'RCV y F29 al día'),
      siiOk: !hasAcuses && !f29Pend,
      tgrText: tgrPending ? `F29 declarado sin pago` : 'Sin deuda / giros',
      tgrOk: !tgrPending,
      prevText: hasBustos ? 'Ley Bustos Art. 162' : prevMora ? 'Mora PreviRed' : blockers.length ? `${blockers.length} ficha(s) bloq.` : 'PreviRed al día',
      prevOk: !hasBustos && !prevMora && blockers.length === 0,
      riskAmount,
      targetArea: hasBustos || prevMora || blockers.length ? 'remuneraciones' : (hasAcuses || f29Pend ? 'impuestos' : 'resumen')
    };
  }

  function renderStudioMonitor() {
    if (!state.monitorFilter) state.monitorFilter = 'todas';
    const evaluated = state.clients.map(evaluateMonitorRow);
    const counts = {
      todas: evaluated.length,
      riesgo: evaluated.filter((r) => r.level === 'riesgo').length,
      revisar: evaluated.filter((r) => r.level === 'revisar').length,
      ok: evaluated.filter((r) => r.level === 'ok').length
    };
    const siiTgrAlerts = evaluated.filter((r) => !r.siiOk || !r.tgrOk).length;
    const prevBlockers = evaluated.filter((r) => !r.prevOk).length;
    const totalRisk = evaluated.reduce((s, r) => s + r.riskAmount, 0);
    const rows = evaluated.filter((r) => state.monitorFilter === 'todas' || r.level === state.monitorFilter);
    const sel = rows.find((r) => r.c.id === state.selectedMonitorId) || rows[0] || evaluated[0] || null;
    if (sel) state.selectedMonitorId = sel.c.id;

    const gwConnected = !!state.gatewayConnected || !!(state.gateway && state.gateway.configured);
    const mr = state.morningReportLive;
    const lastSweep = (mr && mr.generatedAt) ? String(mr.generatedAt).slice(0, 16).replace('T', ' ') : 'Hoy 04:45 · Turno Nocturno';

    $('v2-canvas').innerHTML = `
      <div class="v2-tape">
        <div class="v2-tape-cell"><span class="v2-tape-label">Empresas vigiladas</span><span class="v2-tape-val">${evaluated.length}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Alertas SII / TGR</span><span class="v2-tape-val ${siiTgrAlerts ? 'is-danger' : 'is-in'}">${siiTgrAlerts}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Bloqueos PreviRed / Bustos</span><span class="v2-tape-val ${prevBlockers ? 'is-danger' : 'is-in'}">${prevBlockers}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Monto en riesgo</span><span class="v2-tape-val ${totalRisk ? 'is-danger' : 'is-in'}">${fmt(totalRisk)}</span></div>
      </div>
      <div class="v2-pulse-bar">
        <div class="v2-filter-pills" role="group" aria-label="Filtrar monitor">
          ${[
            ['todas', 'Todas', counts.todas],
            ['riesgo', 'Riesgo', counts.riesgo],
            ['revisar', 'Revisar', counts.revisar],
            ['ok', 'Al día', counts.ok]
          ].map(([k, lbl, n]) => `
            <button type="button" class="v2-pill-btn" data-monitor-filter="${k}" aria-pressed="${state.monitorFilter === k}">
              <span>${lbl}</span><span class="mono">${n}</span>
            </button>
          `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px">
          <span class="mono muted">${lastSweep}</span>
          <button type="button" class="btn btn--sm" data-monitor-action="refresh">Actualizar ahora</button>
        </div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>SII (Acuses / F29)</th>
              <th>TGR (Deuda / Giros)</th>
              <th>PreviRed / Bustos</th>
              <th class="num">Monto en riesgo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((r) => `
              <tr class="${sel && sel.c.id === r.c.id ? 'is-selected' : ''}" data-select-monitor="${r.c.id}" style="cursor:pointer">
                <td><strong>${r.c.name}</strong><span class="v2-cell-sub mono">${r.c.rut}</span></td>
                <td>${r.siiText}</td>
                <td>${r.tgrText}</td>
                <td>${r.prevText}</td>
                <td class="num mono">${fmt(r.riskAmount)}</td>
                <td><span class="tag ${r.levelTag}">${r.levelLabel}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Sin empresas en este filtro.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    const topAlerts = evaluated.filter((r) => r.level !== 'ok').slice(0, 3);
    $('v2-inspector').innerHTML = `
      ${sel ? `
        <div class="v2-ins-block">
          <div class="v2-ins-head">
            <h2 class="v2-ins-title">${sel.c.name}</h2>
            <span class="tag ${sel.levelTag}">${sel.levelLabel}</span>
          </div>
          <div class="muted mono" style="font-size:11.5px;margin-top:-4px">${sel.c.rut} · Régimen ${sel.c.regime}</div>
          <ul class="v2-ev-list" style="margin:6px 0">
            <li class="${sel.siiOk ? 'is-ok' : 'is-fail'}"><span>SII: ${sel.siiText}</span></li>
            <li class="${sel.tgrOk ? 'is-ok' : 'is-fail'}"><span>TGR: ${sel.tgrText}</span></li>
            <li class="${sel.prevOk ? 'is-ok' : 'is-fail'}"><span>PreviRed: ${sel.prevText}</span></li>
          </ul>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <button type="button" class="btn btn--primary btn--sm" data-monitor-pdf="${sel.c.id}">Emitir Expediente Tributario PDF</button>
            <button type="button" class="btn btn--sm" data-open-client="${sel.c.id}" data-open-area="${sel.targetArea}">Abrir empresa →</button>
          </div>
        </div>
      ` : ''}
      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Reporte Matutino · Turno Nocturno 24/7</h2>
          <span class="tag ${gwConnected ? 'tag--in' : 'tag--out'}">${gwConnected ? 'VPS' : 'Demo local'}</span>
        </div>
        <dl class="v2-ins-kv">
          <dt>Empresas chequeadas</dt><dd class="mono">${mr && mr.companiesChecked != null ? mr.companiesChecked : evaluated.length}</dd>
          <dt>Novedades nocturnas</dt><dd class="mono">${mr && mr.alertCount != null ? mr.alertCount : (counts.riesgo + counts.revisar)}</dd>
          <dt>Próximo barrido</dt><dd class="mono">03:30 / 04:45</dd>
        </dl>
        ${topAlerts.length ? `
          <div class="v2-ins-list" style="margin-top:6px">
            ${topAlerts.map((al) => `
              <button type="button" class="v2-ins-row-btn" data-select-monitor="${al.c.id}">
                <span><strong>${al.c.name.split(' ').slice(0, 2).join(' ')}</strong> · ${!al.prevOk ? al.prevText : al.siiText}</span>
                <span class="mono">${fmt(al.riskAmount)}</span>
              </button>
            `).join('')}
          </div>
        ` : `<p class="muted" style="margin:6px 0 0;font-size:12px">Sin alertas prioritarias hoy.</p>`}
      </div>
    `;
  }

  function render() {
    renderSidebar();
    renderTopbar();
    renderBatchBar();
    if (state.level === 'studio') {
      if (state.studioView === 'hoy') renderStudioHoy();
      else if (state.studioView === 'olas') renderStudioOlas();
      else if (state.studioView === 'bandeja') renderStudioBandeja();
      else if (state.studioView === 'conexiones') renderStudioConexiones();
      else if (state.studioView === 'monitor') renderStudioMonitor();
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

  function buildDocContext(c) {
    const period = currentPeriod();
    const iso = period.iso;
    const mesVals = valoresMesActual(iso);
    const iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
    const ppmPct = c.f29.ppmRate != null
      ? Number(c.f29.ppmRate)
      : (c.rcv.ventasNeto > 0 && c.f29.ppm > 0 ? (c.f29.ppm / c.rcv.ventasNeto) * 100 : (c.regime === '14 A' ? 1.5 : 0.25));
    const ppmRateLabel = `${ppmPct.toFixed(2).replace('.', ',')}%`;
    const f29Rows = [
      { cod: '538', label: 'Débito fiscal IVA (ventas afectas RCV)', source: 'RCV Ventas SII', val: c.f29.debito || 0 },
      { cod: '537', label: 'Crédito fiscal IVA (compras con derecho a crédito)', source: 'RCV Compras SII', val: c.f29.credito || 0 },
      { cod: '089', label: 'IVA determinado del período (Cód. 538 − Cód. 537)', source: 'Cálculo neto IVA', val: iva },
      { cod: '755', label: 'Postergación IVA Art. 64 D.L. 825 (marcar Cód. 756 dentro de plazo)', source: c.f29.postergar ? 'Activada (Cód. 756)' : 'No aplicada', val: c.f29.postergar ? iva : 0 },
      { cod: '062', label: `PPM obligatorio mensual (${ppmRateLabel} · ${c.regime})`, source: 'Base ingresos netos', val: c.f29.ppm || 0 },
      { cod: '048', label: 'Impuesto Único 2ª Categoría (sueldos y sueldo empresarial)', source: 'Nómina / LRE 3161', val: c.f29.retenciones || 0 },
      { cod: '151', label: 'Retención Boletas de Honorarios BHE (15,25% Ley 21.133)', source: 'BHE Recibidas SII', val: c.f29.bhe || 0 }
    ];
    const workersCalc = (c.workers || []).map((w) => ({ w, calc: calcularWorkerReal(w, iso) }));
    const auxDocs = ensureAuxDocs(c);
    const totalTx = (c.bancos && c.bancos.total) || (c.bankTx || []).length;
    const matchedTx = (c.bancos && c.bancos.matched) || (c.bankTx || []).filter((x) => x.status === 'Conciliado').length;
    const bankSummary = {
      matched: matchedTx,
      total: totalTx,
      pending: Math.max(0, totalTx - matchedTx),
      pct: totalTx ? Math.round((matchedTx / totalTx) * 100) : 0,
      cxcOpen: auxDocs.filter((a) => a.kind === 'cxc' && a.status === 'Abierto').reduce((s, a) => s + (a.amount || 0), 0),
      cxpOpen: auxDocs.filter((a) => a.kind === 'cxp' && a.status === 'Abierto').reduce((s, a) => s + (a.amount || 0), 0)
    };
    const accounting = buildAccountingReal(c);
    const ddjjBase = c.regime === '14 D3'
      ? [['DJ 1948', 'Retiros, remesas y dividendos', 'Obligatoria 14 D3'], ['DJ 1887', 'Sueldos y retenciones', 'Obligatoria'], ['DJ 1879', 'Retenciones de honorarios (15,25%)', 'Si hubo BHE']]
      : c.regime === '14 D8'
        ? [['DJ 1947', 'Base imponible transparente', 'Obligatoria 14 D8'], ['DJ 1887', 'Sueldos y retenciones', 'Obligatoria'], ['DJ 1879', 'Retenciones de honorarios (15,25%)', 'Si hubo BHE']]
        : [['DJ 1847', 'Balance 8 Columnas', 'Obligatoria 14 A'], ['DJ 1926', 'Renta Líquida Imponible', 'Obligatoria 14 A'], ['DJ 1948', 'Retiros y dividendos', 'Obligatoria'], ['DJ 1887', 'Sueldos y retenciones', 'Obligatoria'], ['DJ 1879', 'Retenciones de honorarios (15,25%)', 'Si hubo BHE']];
    const ddjj = ddjjBase.map(([cod, desc, apl]) => {
      const is1887 = cod === 'DJ 1887' && c.lreHistory && c.lreHistory.imports > 0;
      const st = is1887 ? `${c.lreHistory.imports} LRE · Renta ${fmt(c.lreHistory.rentaNetaAnual)} · IUSC ${fmt(c.lreHistory.iuscRetenidoAnual)}` : 'Borrador listo';
      return [cod, desc, apl, st];
    });
    const FinCalc = window.FiniquitoCalculator;
    const finRows = workersCalc.map(({ w, calc }) => {
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
      return {
        w,
        fin: fRes ? {
          economics: {
            years: fRes.serviceTime ? fRes.serviceTime.years : 0,
            isCapped: !!(fRes.economics && fRes.economics.isCapped),
            ias: fRes.indemnities ? fRes.indemnities.yearsOfService.total : 0,
            aviso: fRes.indemnities ? fRes.indemnities.notice.total : 0,
            vacaciones: fRes.indemnities ? fRes.indemnities.vacation.total : 0,
            afcDesc: fRes.afc && fRes.afc.applied ? fRes.afc.total : 0,
            total: fRes.total || 0
          }
        } : null
      };
    });
    return {
      c,
      studioName: state.studioName,
      period,
      f29Rows,
      ppmRateLabel,
      f29Total: f29Total(c),
      f29StateLabel: f29StateLabel(c.f29.state),
      workersCalc,
      bankSummary,
      auxDocs,
      accounting,
      scope: state.balanceScope,
      ddjj,
      finRows,
      cause: state.finiquitoCause,
      uf: mesVals.uf
    };
  }

  function emitDocument(docType, c) {
    if (docType === 'copy-portal') {
      const url = `${window.location.origin}/portal-estudio?cliente=${encodeURIComponent(c.id)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      toast(`Enlace de Portal sin clave copiado: /portal-estudio?cliente=${c.id}`);
      return;
    }
    const D = window.CLSuiteV2Docs;
    if (!D) { toast('Motor de documentos no disponible'); return; }
    const ctx = buildDocContext(c);
    if (docType === 'paquete-pdf') {
      D.emitirPaqueteMensualPdf(ctx);
      toast(`Paquete Mensual PDF listo para ${c.name}`);
    } else if (docType === 'paquete-xlsx') {
      D.emitirPaqueteMensualExcel(ctx, downloadFile).then(() => toast(`Paquete Mensual Excel (.xlsx) descargado para ${c.name}`));
    } else if (docType === 'f29-pdf') {
      D.emitirF29Pdf(ctx);
      toast(`Hoja F29 PDF lista para ${c.name}`);
    } else if (docType === 'f29-xlsx') {
      D.emitirF29Excel(ctx, downloadFile).then(() => toast(`Hoja F29 Excel (.xlsx) descargada para ${c.name}`));
    } else if (docType === 'renta-pdf') {
      D.emitirRentaPdf(ctx);
      toast(`Borrador Renta y DDJJ PDF listo para ${c.name}`);
    } else if (docType === 'liq-pdf') {
      const item = ctx.workersCalc.find((x) => x.w.id === state.selectedWorkerId) || ctx.workersCalc[0];
      if (!item) { toast('No hay trabajador seleccionado'); return; }
      D.emitirLiquidacionPdf(ctx, item);
      toast(`Liquidación PDF lista para ${item.w.name}`);
    } else if (docType === 'liq-lote-pdf') {
      if (!ctx.workersCalc.length) { toast('No hay trabajadores en nómina'); return; }
      D.emitirLiquidacionesLotePdf(ctx);
      toast(`${ctx.workersCalc.length} liquidaciones PDF listas para imprimir`);
    } else if (docType === 'finiquito-pdf') {
      const row = ctx.finRows.find((x) => x.w.id === state.selectedWorkerId) || ctx.finRows[0];
      if (!row) { toast('No hay trabajador seleccionado'); return; }
      if ((row.w.tipoRegimen || 'dependiente') === 'socio' || !row.fin) {
        toast('Finiquito bloqueado: Socio con sueldo empresarial (Art. 31 N°6 LIR)');
        return;
      }
      D.emitirFiniquitoPdf(ctx, row);
      toast(`Finiquito PDF listo para ${row.w.name}`);
    } else if (docType === 'finiquitos-xlsx') {
      D.emitirFiniquitosExcel(ctx, ctx.finRows, downloadFile).then(() => toast(`Lote de Finiquitos Excel (.xlsx) descargado`));
    } else if (docType === 'balance-pdf') {
      D.emitirBalancePdf(ctx);
      toast(`Balance 8 Columnas PDF (horizontal) listo para ${c.name}`);
    } else if (docType === 'resultados-pdf') {
      D.emitirResultadosPdf(ctx);
      toast(`Estado de Resultados (P&L) PDF listo para ${c.name}`);
    } else if (docType === 'contab-xlsx') {
      D.emitirContabilidadExcel(ctx, downloadFile).then(() => toast(`Contabilidad Excel (.xlsx: Balance + Diario + Mayor) descargada`));
    } else if (docType === 'bancos-pdf') {
      D.emitirBancosPdf(ctx);
      toast(`Informe de Conciliación Bancaria PDF listo para ${c.name}`);
    } else if (docType === 'expediente-pdf') {
      D.emitirExpedientePdf(ctx);
      toast(`Expediente Tributario Auditable PDF listo para ${c.name}`);
    } else if (docType === 'bancos-xlsx') {
      D.emitirBancosExcel(ctx, ctx.auxDocs, downloadFile).then(() => toast(`Conciliación + Auxiliar CxC/CxP Excel (.xlsx) descargado`));
    }
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
    gatewayCall('PUT', `/api/v1/studio/companies/${encodeURIComponent(c.id)}/lre-history`, {
      year: Number(currentPeriod().iso.slice(0, 4)) || 2026,
      imports: c.lreHistory.imports,
      rentaNetaAnual: c.lreHistory.rentaNetaAnual,
      iuscRetenidoAnual: c.lreHistory.iuscRetenidoAnual,
      lastFile: c.lreHistory.lastFile,
      workersSnapshot: c.workers.map((w) => ({
        rut: w.rut, name: w.name, ingreso: w.ingreso, afp: w.afp, base: w.base,
        tipoRegimen: w.tipoRegimen || 'dependiente', pensionMensual: w.pensionMensual || 0,
        cotizaAfpVoluntaria: !!w.cotizaAfpVoluntaria, sinContrato: !!w.sinContrato,
        sinPlanIsapre: !!w.sinPlanIsapre, licenciaSinTipo: !!w.licenciaSinTipo
      }))
    });
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
    const t = e.target.closest('button, [data-select-worker], [data-select-bank], [data-select-aux], [data-select-f29], [data-select-rcv], [data-select-inbox], [data-select-conn], [data-select-mayor], [data-select-monitor]');
    if (!t) return;

    if (t.id === 'btn-open-cmdk' || t.id === 'btn-switch-client') { openCmdk(); return; }
    if (t.id === 'btn-back-studio' || t.dataset.backStudio) { enterStudio('hoy'); return; }
    if (t.id === 'btn-new-client' || t.id === 'btn-ins-new-client' || t.id === 'btn-empty-new-client') { openDrawer(); return; }
    if (t.id === 'btn-open-account' || t.dataset.openAccount === '1') {
      if (state.accountMode === 'studio') {
        saveAccountState();
        state.accountMode = 'demo';
        state.studioName = 'Asesorías Pérez Ltda.';
        state.clients = INITIAL_CLIENTS();
        toast('Modo demo activado (tu estudio real sigue guardado)');
        enterStudio('hoy');
      } else if (state.studioClientsSaved !== null) {
        loadSavedAccount();
        toast(`Volviste a ${state.studioName}`);
        enterStudio('hoy');
      } else {
        openAccountDrawer();
      }
      return;
    }
    if (t.id === 'btn-close-account-drawer' || t.id === 'btn-cancel-account-drawer') { closeAccountDrawer(); return; }
    if (t.dataset.onboardAction) {
      const act = t.dataset.onboardAction;
      if (act === 'minimize') { state.onboardingMinimized = true; saveAccountState(); renderStudioHoy(); return; }
      if (act === 'expand') { state.onboardingMinimized = false; saveAccountState(); renderStudioHoy(); return; }
      if (act === 'hide') { state.onboardingHidden = true; saveAccountState(); renderStudioHoy(); toast('Guía ocultada (puedes volver a verla desde Conexiones)'); return; }
      if (act === 'show') { state.onboardingHidden = false; state.onboardingMinimized = false; saveAccountState(); enterStudio('hoy'); return; }
      if (act === 'step-company') { openDrawer(); return; }
      if (act === 'step-data-file') {
        if (state.clients.length) {
          markOnboardStep('data');
          enterClient(state.clients[0].id, 'impuestos', 'rcv');
        } else {
          toast('Primero crea tu primera empresa en el paso 01');
          openDrawer();
        }
        return;
      }
      if (act === 'step-data-sii') { state.selectedConn = 'sii'; markOnboardStep('data'); enterStudio('conexiones'); return; }
      if (act === 'step-mcp') { state.selectedConn = 'mcp'; markOnboardStep('mcpOrDoc'); enterStudio('conexiones'); return; }
      if (act === 'step-pdf') {
        if (state.clients.length) {
          markOnboardStep('mcpOrDoc');
          emitDocument('paquete-pdf', state.clients[0]);
        } else {
          toast('Primero crea tu primera empresa en el paso 01');
          openDrawer();
        }
        return;
      }
    }
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
      if (t.dataset.exportBal === 'pdf') { emitDocument('balance-pdf', getClient()); }
      else if (t.dataset.exportBal === 'xlsx') { emitDocument('contab-xlsx', getClient()); }
      else {
        const c = getClient();
        const { bal } = buildAccountingReal(c);
        const csv = '\uFEFFCodigo;Cuenta;Debitos;Creditos;Deudor;Acreedor;Activo;Pasivo;Perdida;Ganancia\n' +
          (bal.filas || []).map((f) => `${f.codigo};${f.nombre};${f.debito || 0};${f.credito || 0};${f.deudor || 0};${f.acreedor || 0};${f.activo || 0};${f.pasivo || 0};${f.perdida || 0};${f.ganancia || 0}`).join('\n');
        downloadFile(csv, `balance_8col_${c.id}_${currentPeriod().iso}.csv`, 'text/csv;charset=utf-8');
        toast('Balance 8 Columnas exportado a CSV');
      }
      return;
    }
    if (t.dataset.emitDoc) {
      emitDocument(t.dataset.emitDoc, getClient());
      return;
    }
    if (t.dataset.selectConn) {
      state.selectedConn = t.dataset.selectConn;
      renderStudioConexiones();
      return;
    }
    if (t.dataset.selectMayor) {
      state.selectedMayorCode = t.dataset.selectMayor;
      renderClientContabilidad(getClient());
      return;
    }
    if (t.dataset.addBhe) {
      const c = getClient();
      const name = ($('inp-bhe-name') && $('inp-bhe-name').value.trim()) || 'Profesional Independiente';
      const rut = ($('inp-bhe-rut') && $('inp-bhe-rut').value.trim()) || rutConDv(16554321);
      const bruto = Math.max(0, Number($('inp-bhe-bruto') && $('inp-bhe-bruto').value) || 0);
      if (!bruto) { toast('Ingresa un monto bruto mayor a $0'); return; }
      if (!Array.isArray(c.bheDocs)) c.bheDocs = [];
      c.bheDocs.unshift({ id: 'bh-' + Date.now(), folio: String(1420 + c.bheDocs.length), date: '26/11/2026', name, rut, bruto, status: 'Pendiente pago' });
      c.f29.bhe = c.bheDocs.reduce((s, b) => s + Math.round((b.bruto || 0) * 0.1525), 0);
      toast(`BHE registrada · Retención 15,25% actualizada en F29 Cód. 151 (${fmt(c.f29.bhe)})`);
      render();
      return;
    }
    if (t.dataset.addWorker) {
      const c = getClient();
      const name = ($('inp-nw-name') && $('inp-nw-name').value.trim());
      const rut = ($('inp-nw-rut') && $('inp-nw-rut').value.trim()) || rutConDv(18554321);
      const cargo = ($('inp-nw-cargo') && $('inp-nw-cargo').value.trim()) || 'Administrativo';
      const base = Math.max(0, Number($('inp-nw-base') && $('inp-nw-base').value) || 0);
      const tipoRegimen = ($('sel-nw-regimen') && $('sel-nw-regimen').value) || 'dependiente';
      if (!name || !base) { toast('Completa nombre y sueldo base'); return; }
      const nw = { id: 'w-' + Date.now(), name, rut, sexo: 'F', ingreso: currentPeriod().iso + '-01', cargo, base, afp: 'Habitat', tipoRegimen, estado: 'Listo' };
      c.workers.push(nw);
      c.nomina.count = c.workers.length;
      c.nomina.label = `${c.workers.length} liq · LRE listo`;
      state.selectedWorkerId = nw.id;
      toast(`${name} agregado a dotación (${c.workers.length} personas)`);
      render();
      return;
    }
    if (t.dataset.mcpQuery) {
      state.mcpDemoOutput = runMcpDemoQuery(t.dataset.mcpQuery);
      renderStudioConexiones();
      return;
    }
    if (t.dataset.copyPortalId) {
      const targetC = state.clients.find((x) => x.id === t.dataset.copyPortalId) || getClient();
      emitDocument('copy-portal', targetC);
      return;
    }
    if (t.dataset.connAction === 'copy-mcp-json') {
      const snippet = JSON.stringify({
        mcpServers: {
          'calculo-laboral': {
            url: 'https://connect.calculolaboral.cl/mcp',
            headers: { 'x-mcp-token': state.mcpTokenLive || 'emitir_token_con_el_boton_de_arriba' }
          }
        }
      }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(snippet).catch(() => {});
      toast('Configuración JSON de MCP copiada para Claude');
      return;
    }
    if (t.dataset.connAction === 'issue-mcp-token') {
      gatewayCall('POST', '/api/v1/mcp/tokens', { label: state.studioName || 'Estudio Contable' }).then((res) => {
        if (res && res.ok && res.data && (res.data.token || res.data.rawToken || res.data.accessToken)) {
          state.mcpTokenLive = res.data.token || res.data.rawToken || res.data.accessToken;
          toast('Token MCP real emitido por connect.calculolaboral.cl');
          renderStudioConexiones();
        } else {
          toast((res && res.data && (res.data.message || res.data.error)) || 'No se pudo emitir token MCP desde el gateway');
        }
      });
      return;
    }
    if (t.dataset.connAction === 'connect-real-company') {
      const rut = ($('inp-conn-rut') && $('inp-conn-rut').value.trim()) || '';
      const name = ($('inp-conn-name') && $('inp-conn-name').value.trim()) || 'Empresa conectada';
      const passEl = $('inp-conn-pass');
      const password = (passEl && passEl.value) || '';
      const kind = t.dataset.connKind === 'previred' ? 'PREVIRED_CREDENTIALS' : 'CLAVE_TRIBUTARIA';
      if (!rut || !password) { toast('Ingresa RUT y clave para guardar en bóveda AES-256-GCM'); return; }
      if (passEl) passEl.value = '';
      (async () => {
        let compRes = await gatewayCall('POST', '/api/v1/companies', { rut, name });
        let companyId = compRes && compRes.data && (compRes.data.id || (compRes.data.company && compRes.data.company.id));
        if (!companyId) {
          const list = await loadLiveCompanies();
          const norm = (s) => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase();
          const found = list.find((x) => norm(x.rut) === norm(rut));
          if (found) companyId = found.id;
        }
        if (!companyId) {
          toast((compRes && compRes.data && (compRes.data.message || compRes.data.error)) || 'No se pudo registrar empresa en el gateway');
          return;
        }
        const credRes = await gatewayCall('POST', `/api/v1/companies/${encodeURIComponent(companyId)}/credentials`, { type: kind, rut, password });
        if (!credRes || !credRes.ok) {
          toast((credRes && credRes.data && (credRes.data.message || credRes.data.error)) || 'Error guardando credencial en bóveda');
          return;
        }
        await loadLiveCompanies();
        const iso = currentPeriod().iso;
        await syncRangeFromGateway(companyId, iso, iso, kind === 'PREVIRED_CREDENTIALS' ? 'PREVIRED_STATUS' : 'RCV_COMPRAS');
        renderStudioConexiones();
      })();
      return;
    }
    if (t.dataset.syncLiveCompany) {
      const cid = t.dataset.syncLiveCompany;
      const iso = currentPeriod().iso;
      syncRangeFromGateway(cid, iso, iso, 'RCV_COMPRAS');
      return;
    }
    if (t.dataset.sampleCartola) {
      const c = getClient();
      const sampleTx = [
        {
          id: 'tbk-' + Date.now(),
          date: '25/11',
          desc: 'ABONO LIQUIDACION TRANSBANK POS #88421',
          amount: 1420500,
          status: 'Pendiente',
          match: 'Liquidación POS Transbank (aplicar Split comisión)',
          rulePattern: 'TRANSBANK',
          checks: [
            { ok: true, label: 'Abono neto Transbank detectado automáticamente' },
            { ok: false, label: 'Pendiente aplicar Split: Venta bruta vs Comisión + IVA' }
          ]
        },
        {
          id: 'trf-' + (Date.now() + 1),
          date: '24/11',
          desc: 'TRASPASO DE 76.440.120-4 DISTRIBUIDORA ORIENTE',
          amount: 640000,
          status: 'Conciliado',
          match: 'Auto-calce: Factura #3990 (RUT + monto exacto)',
          rulePattern: 'DISTRIBUIDORA ORIENTE',
          checks: [
            { ok: true, label: 'RUT 76.440.120-4 coincide en glosa bancaria' },
            { ok: true, label: 'Monto exacto $640.000 calza con CxC #3990' }
          ]
        }
      ];
      c.bankTx.unshift(...sampleTx);
      c.bancos.total = c.bankTx.length;
      c.bancos.matched = c.bankTx.filter((x) => x.status === 'Conciliado').length;
      c.bancos.label = `${Math.round((c.bancos.matched / c.bancos.total) * 100)}% match`;
      state.selectedBankId = sampleTx[0].id;
      toast('Cartola BancoEstado + Transbank cargada y auto-calzada');
      render();
      return;
    }
    if (t.dataset.applySplitTx) {
      const c = getClient();
      if (isPeriodClosed(c)) {
        toast('Mes cerrado y bloqueado: reabre el período en Impuestos con motivo para modificar conciliaciones');
        return;
      }
      const tx = c.bankTx.find((x) => x.id === t.dataset.applySplitTx);
      if (tx) {
        const bruta = Number(t.dataset.splitBruta) || tx.amount;
        const com = Number(t.dataset.splitCom) || 0;
        const ivaC = Number(t.dataset.splitIva) || 0;
        tx.status = 'Conciliado';
        tx.match = `Split Pasarela: Venta ${fmt(bruta)} − Com. ${fmt(com)} − IVA ${fmt(ivaC)}`;
        tx.checks = [
          { ok: true, label: `Venta bruta POS (DTE 39): ${fmt(bruta)}` },
          { ok: true, label: `Comisión neta Cta. 42030: ${fmt(com)} + IVA 11080: ${fmt(ivaC)}` },
          { ok: true, label: `Cuadrado exacto con abono banco ${fmt(tx.amount)}` }
        ];
        c.bancos.matched = c.bankTx.filter((x) => x.status === 'Conciliado').length;
        c.bancos.total = c.bankTx.length;
        c.bancos.state = c.bancos.matched === c.bancos.total ? 'ok' : 'pendiente';
        c.bancos.label = `${Math.round((c.bancos.matched / c.bancos.total) * 100)}% match`;
        toast('Split de pasarela aplicado y asiento cuadrado');
        render();
      }
      return;
    }
    if (t.dataset.acuseDoc || t.dataset.acuseAll) {
      const c = getClient();
      const docs = ensureRcvDocs(c);
      let count = 0;
      docs.forEach((d) => {
        const isPend = !d.acuseDone && d.plazoTag !== 'tag--in';
        if (isPend && (t.dataset.acuseAll || d.id === t.dataset.acuseDoc)) {
          d.acuseDone = true;
          d.plazo = 'Acusado';
          d.plazoTag = 'tag--in';
          d.action = 'Acusado ✓';
          count++;
        }
      });
      const remaining = docs.filter((d) => !d.acuseDone && d.plazoTag !== 'tag--in').length;
      c.rcv.pendingAcuses = remaining;
      c.rcv.state = remaining > 0 ? 'alerta' : 'ok';
      c.rcv.label = remaining > 0 ? `${remaining} acuse(s) < 48h` : 'RCV 100% cuadrado';
      toast(remaining === 0 ? `Listo: ${count} acuse(s) aceptados. Brecha de Crédito IVA resuelta.` : `Acuse aceptado (${remaining} pendiente)`);
      render();
      return;
    }
    if (t.dataset.syncF29Iusc !== undefined) {
      const c = getClient();
      if (isPeriodClosed(c)) {
        toast('Mes cerrado y bloqueado: reabre el período con motivo antes de modificar el F29');
        return;
      }
      c.f29.retenciones = Number(t.dataset.syncF29Iusc) || 0;
      toast(`F29 Cód. 048 alineado con Nómina LRE 3161 (${fmt(c.f29.retenciones)})`);
      render();
      return;
    }
    if (t.dataset.olaAction === 'batch-sync-sii') {
      const gwConnected = !!state.gatewayConnected || !!(state.gateway && state.gateway.configured);
      if (!gwConnected || !(state.liveCompanies && state.liveCompanies.length)) {
        state.liveSyncBatch = {
          batchId: 'demo-' + String(Date.now()).slice(-4),
          total: state.clients.length,
          completed: state.clients.filter((c) => c.status !== 'critico').length,
          inProgress: 0,
          failed: state.clients.filter((c) => c.status === 'critico').length
        };
        toast('Lote demo verificado (conecta RUT reales en Conexiones para encolar en el SII)');
        renderStudioOlas();
        return;
      }
      gatewayCall('POST', '/api/v1/sync/batch', { mode: 'rcv' }).then((res) => {
        if (res && res.ok && res.data) {
          const d = res.data;
          state.liveSyncBatch = {
            batchId: d.batchId,
            total: d.totalEnqueued != null ? d.totalEnqueued : (d.total || 0),
            completed: d.completed || 0,
            inProgress: d.totalEnqueued != null ? d.totalEnqueued : (d.inProgress || 0),
            failed: d.failed || 0
          };
          toast(`Sincronización masiva encolada: ${state.liveSyncBatch.total} job(s)`);
          renderStudioOlas();
          if (d.batchId) {
            setTimeout(() => {
              gatewayCall('GET', `/api/v1/sync/batch/${encodeURIComponent(d.batchId)}`).then((stRes) => {
                if (stRes && stRes.ok && stRes.data) {
                  state.liveSyncBatch = stRes.data;
                  if (state.level === 'studio' && state.studioView === 'olas') renderStudioOlas();
                }
              });
            }, 2500);
          }
        } else {
          toast((res && res.data && (res.data.message || res.data.error)) || 'No se pudo iniciar la sincronización en lote');
        }
      });
      return;
    }
    if (t.dataset.connAction === 'refresh-mcp-audit') {
      Promise.all([
        gatewayCall('GET', '/api/v1/mcp/tokens'),
        gatewayCall('GET', '/api/v1/mcp/access-logs?limit=20')
      ]).then(([tkRes, logRes]) => {
        if (tkRes && tkRes.ok && tkRes.data) {
          state.mcpTokensList = Array.isArray(tkRes.data) ? tkRes.data : (tkRes.data.tokens || tkRes.data.items || []);
        }
        if (logRes && logRes.ok && logRes.data) {
          state.mcpAccessLogs = Array.isArray(logRes.data) ? logRes.data : (logRes.data.logs || logRes.data.items || []);
        }
        toast('Tokens y registro de consultas MCP actualizados');
        renderStudioConexiones();
      });
      return;
    }
    if (t.dataset.revokeMcpToken) {
      const tid = t.dataset.revokeMcpToken;
      gatewayCall('DELETE', `/api/v1/mcp/tokens/${encodeURIComponent(tid)}`).then((res) => {
        if (res && res.ok) {
          state.mcpTokensList = (state.mcpTokensList || []).filter((x) => x.id !== tid);
          toast('Token MCP revocado de inmediato');
          renderStudioConexiones();
        } else {
          toast((res && res.data && (res.data.message || res.data.error)) || 'No se pudo revocar el token');
        }
      });
      return;
    }
    if (t.dataset.selectMonitor) {
      state.selectedMonitorId = t.dataset.selectMonitor;
      renderStudioMonitor();
      return;
    }
    if (t.dataset.monitorFilter) {
      state.monitorFilter = t.dataset.monitorFilter;
      renderStudioMonitor();
      return;
    }
    if (t.dataset.monitorPdf) {
      const targetC = state.clients.find((x) => x.id === t.dataset.monitorPdf) || state.clients[0];
      if (targetC) {
        if (state.accountMode === 'studio') markOnboardStep('mcpOrDoc');
        emitDocument('expediente-pdf', targetC);
      }
      return;
    }
    if (t.dataset.monitorAction === 'refresh') {
      gatewayCall('POST', '/api/v1/studio/morning-report/generate').then((res) => {
        if (res && res.ok && res.data) {
          state.morningReportLive = res.data;
          toast(`Monitor actualizado: ${res.data.companiesChecked || 0} empresas chequeadas · ${res.data.alertCount || 0} alertas`);
        } else {
          toast('Monitor actualizado sobre la cartera actual');
        }
        renderStudioMonitor();
      });
      return;
    }
    if (t.dataset.connAction === 'morning-report') {
      gatewayCall('POST', '/api/v1/studio/morning-report/generate').then((res) => {
        if (res && res.ok && res.data) {
          const d = res.data;
          toast(`Reporte Matutino generado: ${d.companiesChecked || 0} empresas revisadas · ${d.alertCount || 0} alertas`);
        } else {
          toast((res && res.data && (res.data.message || res.data.error)) || 'No se pudo generar el Reporte Matutino');
        }
      });
      return;
    }
    if (t.dataset.connAction === 'probe-gateway') {
      probeStudioGateway().then((info) => {
        toast(info && info.configured ? `Gateway SII conectado (${(state.liveCompanies || []).length} RUT reales)` : 'Gateway en modo Demo local');
        render();
      });
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
      if (state.level === 'studio' && state.studioView === 'conexiones') {
        probeStudioGateway().then((info) => {
          state.gateway = info || { mode: 'demo-local', configured: false };
          toast(state.gateway.configured ? 'Gateway SII verificado y operativo' : 'Gateway en modo Demo local');
          render();
        });
        return;
      }
      if (state.level === 'studio' && state.studioView === 'monitor') {
        gatewayCall('POST', '/api/v1/studio/morning-report/generate').then((res) => {
          if (res && res.ok && res.data) {
            state.morningReportLive = res.data;
            toast(`Monitor actualizado: ${res.data.companiesChecked || 0} empresas · ${res.data.alertCount || 0} alertas`);
          } else {
            toast('Monitor actualizado sobre la cartera actual');
          }
          renderStudioMonitor();
        });
        return;
      }
      if (state.level === 'studio' && state.studioView === 'hoy') {
        let ok = 0;
        state.clients.forEach((c) => { if (c.f29.state === 'listo') { c.f29.state = 'declarado'; c.f29.folio = String(84920200 + ok); c.status = 'cerrado'; c.cierre = 'Cerrado'; ok++; } });
        toast(ok ? `${ok} declaraciones F29 aprobadas en lote` : 'No hay F29 pendientes en estado listo');
        render(); return;
      }
      if (state.level === 'client' && state.clientArea === 'resumen') {
        emitDocument('paquete-pdf', getClient());
        return;
      }
      if (state.level === 'client' && state.clientArea === 'impuestos') {
        const c = getClient();
        if (c.f29.state === 'pagado') {
          emitDocument('f29-pdf', c);
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
          emitDocument('finiquitos-xlsx', getClient());
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
        if (state.clientSub === 'plan') {
          state.lastPlanSync = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
          toast(`Plan de cuentas (${state.studioChart.length} cuentas) propagado a ${state.clients.length} empresas · cuentas con movimiento protegidas`);
          render(); return;
        }
        if (state.clientSub === 'resultados') {
          emitDocument('resultados-pdf', getClient());
          return;
        }
        emitDocument('contab-xlsx', getClient());
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
    if (t.dataset.selectAux) { state.selectedAuxId = t.dataset.selectAux; render(); return; }
    if (t.dataset.auxFilter) { state.auxFilter = t.dataset.auxFilter; render(); return; }
    if (t.dataset.settleAux) {
      const c = getClient();
      const doc = ensureAuxDocs(c).find((d) => d.id === t.dataset.settleAux);
      if (doc && doc.status === 'Abierto') {
        doc.status = 'Saldado';
        const isCxc = doc.kind === 'cxc';
        c.bankTx.unshift({
          id: `aux-tx-${Date.now()}`,
          date: '26/11',
          desc: `${isCxc ? 'Cobro' : 'Pago'} ${doc.party} (#${doc.folio})`,
          amount: isCxc ? doc.amount : -doc.amount,
          status: 'Conciliado',
          match: `Auxiliar ${isCxc ? 'CxC' : 'CxP'} · Folio #${doc.folio}`,
          confidence: 'Alta',
          account: isCxc ? '11050 · Clientes nacionales' : '21010 · Proveedores nacionales',
          rulePattern: doc.party.split(' ').slice(0, 2).join(' '),
          checks: [
            { ok: true, label: `Monto exacto saldado (${fmt(doc.amount)})` },
            { ok: true, label: `Registrado desde Auxiliar ${isCxc ? 'CxC' : 'CxP'}` },
            { ok: true, label: `RUT contraparte ${doc.rut}` }
          ],
          docs: [{ title: `Factura #${doc.folio} · ${doc.party}`, sub: `Auxiliar ${isCxc ? 'Por Cobrar' : 'Por Pagar'}`, amount: isCxc ? doc.amount : -doc.amount }]
        });
        c.bancos.total = Math.max(c.bancos.total || 0, c.bankTx.length);
        c.bancos.matched = Math.min(c.bancos.total, (c.bancos.matched || 0) + 1);
        toast(`${isCxc ? 'Cobro' : 'Pago'} registrado en Banco · Folio #${doc.folio} saldado`);
        render();
      }
      return;
    }
    if (t.dataset.propagatePlan) {
      state.lastPlanSync = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      gatewayCall('PUT', '/api/v1/studio/chart', { accounts: state.studioChart });
      toast(`Plan de cuentas (${state.studioChart.length} cuentas) aplicado a ${state.clients.length} empresas · cuentas con movimiento protegidas`);
      render();
      return;
    }
    if (t.dataset.addStudioAcc) {
      const code = ($('inp-acc-code') && $('inp-acc-code').value.trim()) || '';
      const name = ($('inp-acc-name') && $('inp-acc-name').value.trim()) || '';
      const type = ($('sel-acc-type') && $('sel-acc-type').value) || 'Pérdida';
      if (!/^\d{4,6}$/.test(code) || name.length < 3) {
        toast('Ingresa un código numérico (4–6 dígitos) y un nombre de cuenta válido');
        return;
      }
      if (state.studioChart.some((a) => a.code === code)) {
        toast(`El código ${code} ya existe en el plan maestro`);
        return;
      }
      state.studioChart.push({ code, name, type });
      state.studioChart.sort((a, b) => a.code.localeCompare(b.code));
      toast(`Cuenta ${code} · ${name} agregada al plan maestro`);
      render();
      return;
    }
    if (t.dataset.delStudioAcc) {
      const code = t.dataset.delStudioAcc;
      state.studioChart = state.studioChart.filter((a) => a.code !== code);
      toast(`Cuenta ${code} quitada del plan maestro`);
      render();
      return;
    }
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
          gatewayCall('PUT', `/api/v1/studio/companies/${encodeURIComponent(c.id)}/supplier-rules`, {
            rutEmisor: doc.rut,
            supplierName: doc.supplier,
            accountCode: newAcc
          });
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
        gatewayCall('PUT', `/api/v1/studio/companies/${encodeURIComponent(getClient().id)}/bank-rules`, {
          pattern: t.dataset.rulePattern,
          accountCode: String(t.dataset.ruleAccount || '').split(' ')[0],
          accountLabel: t.dataset.ruleAccount
        });
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
  $('v2-account-drawer-wrap')?.addEventListener('click', (e) => { if (e.target.id === 'v2-account-drawer-wrap') closeAccountDrawer(); });
  $('v2-sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);
  $('v2-brand-home').addEventListener('click', (e) => { e.preventDefault(); enterStudio('hoy'); });

  $('form-create-account')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sName = ($('acc-studio-name')?.value || '').trim();
    const sEmail = ($('acc-studio-email')?.value || '').trim();
    const startMode = $('acc-start-mode')?.value || 'clean';
    if (!sName || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(sEmail)) {
      toast('Ingresa el nombre de tu estudio y un correo válido');
      return;
    }
    state.accountMode = 'studio';
    state.studioName = sName;
    state.accountEmail = sEmail;
    state.onboardingMinimized = false;
    state.onboardingHidden = false;
    state.clients = startMode === 'sample' ? [INITIAL_CLIENTS()[0]] : [];
    state.onboardingDone = { company: state.clients.length > 0, data: false, mcpOrDoc: false };
    saveAccountState();
    e.target.reset();
    closeAccountDrawer();
    toast(`¡Bienvenido, ${sName}! Sigue los 3 pasos para configurar tu estudio.`);
    enterStudio('hoy');
    fetch('/api/send-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: sName,
        correo: sEmail,
        telefono: '',
        tipo: 'Estudio Contable',
        fuente: 'Suite Contadores - Alta directa de estudio',
        detalle: `Alta en /demo-contadores (modo: ${startMode})`,
        monto_calculado: '0'
      })
    }).catch(() => {});
  });

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
    if (state.accountMode === 'studio') markOnboardStep('company');
    e.target.reset();
    closeDrawer();
    toast(`${name} agregada a la cartera`);
    enterClient(id, 'resumen');
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
    if (e.key === 'Escape') { closeCmdk(); closeDrawer(); closeAccountDrawer(); closeMobileSidebar(); return; }
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

  loadSavedAccount();
  if (location.hash === '#cliente-f29') enterClient('san-isidro', 'impuestos', 'f29');
  else if (location.hash === '#cliente-nomina') enterClient('san-isidro', 'remuneraciones', 'nomina');
  else if (location.hash === '#cliente-finiquitos') enterClient('san-isidro', 'remuneraciones', 'finiquitos');
  else if (location.hash === '#cliente-previred') enterClient('san-isidro', 'remuneraciones', 'previred');
  else if (location.hash === '#cliente-bancos') enterClient('san-isidro', 'bancos', 'match');
  else if (location.hash === '#cliente-contabilidad') enterClient('san-isidro', 'contabilidad', 'balance');
  else if (location.hash === '#olas') enterStudio('olas');
  else if (location.hash === '#monitor') enterStudio('monitor');
  else render();
  if (new URLSearchParams(location.search).get('crear') === '1' && state.accountMode !== 'studio') {
    openAccountDrawer();
  }
  probeStudioGateway();
})();
