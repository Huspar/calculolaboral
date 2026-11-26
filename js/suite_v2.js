/* Suite Contadores v2 — Motor limpio desde cero (Arquitectura Dual + Workbench 70/30) */
(() => {
  'use strict';

  const PERIODS = ['Septiembre 2026', 'Octubre 2026', 'Noviembre 2026', 'Diciembre 2026'];

  const INITIAL_CLIENTS = () => ([
    {
      id: 'san-isidro',
      name: 'Panadería San Isidro SpA',
      rut: '76.543.210-4',
      regime: '14 D3',
      status: 'critico',
      rcv: { state: 'alerta', label: '2 acuses < 48h', pendingAcuses: 2, ventasNeto: 18400000, comprasNeto: 10361579 },
      nomina: { state: 'ok', label: '12 liq · LRE listo', count: 12, previredOk: true, leyBustos: false },
      bancos: { state: 'pendiente', label: '68% match', matched: 34, total: 50 },
      f29: { state: 'revisar', folio: '', postergar: false, debito: 3496000, credito: 1968700, ppm: 24125, retenciones: 727679, history: [1890, 2040, 1760, 2110, 1950, 2280, 2190, 2410, 2080, 2150, 2279, 2279] },
      cierre: 'En revisión',
      workers: [
        { id: 'w1', name: 'Camila Rojas Fuentes', rut: '19.876.543-2', cargo: 'Jefa de Producción', base: 1450000, grat: 180000, afp: 'Habitat', imponible: 1630000, liquido: 1324500, estado: 'Listo' },
        { id: 'w2', name: 'María González Pérez', rut: '12.345.678-9', cargo: 'Maestra Panadera', base: 1180000, grat: 170000, afp: 'Cuprum', imponible: 1350000, liquido: 1098200, estado: 'Listo' },
        { id: 'w3', name: 'Pedro Soto Ramírez', rut: '9.876.543-2', cargo: 'Repartidor', base: 850000, grat: 160000, afp: 'Modelo', imponible: 1010000, liquido: 829400, estado: 'Revisar hrs' },
        { id: 'w4', name: 'Andrés Muñoz Tapia', rut: '16.543.210-K', cargo: 'Administrador', base: 2400000, grat: 320000, afp: 'Capital', imponible: 2720000, liquido: 2140900, estado: 'Listo' },
        { id: 'w5', name: 'Valentina Castro León', rut: '20.111.222-3', cargo: 'Cajera', base: 700000, grat: 160000, afp: 'UNO', imponible: 860000, liquido: 712600, estado: 'Listo' },
        { id: 'w6', name: 'Jorge Vergara Salas', rut: '10.999.888-7', cargo: 'Encargado Bodega', base: 1050000, grat: 175000, afp: 'Provida', imponible: 1225000, liquido: 998100, estado: 'Tope 90 UF' }
      ],
      bankTx: [
        { id: 'b1', date: '24/11', desc: 'Abono Transbank Ventas POS', amount: 1840500, status: 'Por conciliar', match: 'Boletas diarias #412–439' },
        { id: 'b2', date: '22/11', desc: 'Pago Molinos del Sur S.A.', amount: -945000, status: 'Por conciliar', match: 'Factura #88412 ($945.000)' },
        { id: 'b3', date: '19/11', desc: 'Cargo Supermercado Jumbo', amount: -180000, status: 'Por conciliar', match: 'Cód. 761 · Pedir justificación giro' },
        { id: 'b4', date: '15/11', desc: 'Pago Previred Octubre', amount: -1482000, status: 'Conciliado', match: 'Planilla #904122' }
      ]
    },
    {
      id: 'andes-sur',
      name: 'Constructora Andes Sur Ltda.',
      rut: '77.128.450-1',
      regime: '14 A',
      status: 'critico',
      rcv: { state: 'ok', label: 'RCV cuadrado', pendingAcuses: 0, ventasNeto: 42100000, comprasNeto: 28900000 },
      nomina: { state: 'alerta', label: 'Mora Previred · Ley Bustos', count: 24, previredOk: false, leyBustos: true },
      bancos: { state: 'ok', label: '96% match', matched: 48, total: 50 },
      f29: { state: 'revisar', folio: '', postergar: false, debito: 7999000, credito: 5491000, ppm: 421000, retenciones: 615000, history: [2900, 3120, 3400, 2980, 3650, 3490, 3100, 3890, 3220, 3410, 3544, 3544] },
      cierre: 'Bloqueado (Ley Bustos)',
      workers: [
        { id: 'a1', name: 'Carlos Méndez Pino', rut: '14.221.334-5', cargo: 'Jefe de Obra', base: 2100000, grat: 210000, afp: 'Habitat', imponible: 2310000, liquido: 1845000, estado: 'Finiquito abierto' },
        { id: 'a2', name: 'Luis Herrera Soto', rut: '15.887.412-0', cargo: 'Carpintero', base: 980000, grat: 180000, afp: 'Provida', imponible: 1160000, liquido: 942000, estado: 'Listo' }
      ],
      bankTx: [
        { id: 'ab1', date: '23/11', desc: 'Estado de Pago Obra Temuco', amount: 15200000, status: 'Conciliado', match: 'Factura #1104' }
      ]
    },
    {
      id: 'dental-prov',
      name: 'Clínica Dental Providencia SpA',
      rut: '76.901.332-8',
      regime: '14 D3',
      status: 'esperando',
      rcv: { state: 'ok', label: 'Sin acuses pendientes', pendingAcuses: 0, ventasNeto: 14200000, comprasNeto: 4850000 },
      nomina: { state: 'ok', label: '7 liq · Previred OK', count: 7, previredOk: true, leyBustos: false },
      bancos: { state: 'esperando', label: 'Falta cartola BCI', matched: 0, total: 32 },
      f29: { state: 'listo', folio: '', postergar: false, debito: 0, credito: 0, ppm: 142000, retenciones: 498000, history: [580, 610, 595, 620, 640, 615, 630, 650, 625, 635, 640, 640] },
      cierre: 'Esperando cliente',
      workers: [
        { id: 'd1', name: 'Dra. Sofía Larrain', rut: '17.445.901-3', cargo: 'Directora Clínica', base: 2900000, grat: 210000, afp: 'Cuprum', imponible: 3110000, liquido: 2420000, estado: 'Listo' }
      ],
      bankTx: []
    },
    {
      id: 'ruta-5',
      name: 'Logística Ruta 5 SpA',
      rut: '77.812.094-K',
      regime: '14 D3',
      status: 'revisar',
      rcv: { state: 'ok', label: 'RCV 100% cuadrado', pendingAcuses: 0, ventasNeto: 29600000, comprasNeto: 18400000 },
      nomina: { state: 'ok', label: '15 liq · LRE listo', count: 15, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '100% match', matched: 64, total: 64 },
      f29: { state: 'listo', folio: '', postergar: false, debito: 5624000, credito: 3496000, ppm: 296000, retenciones: 184000, history: [2200, 2350, 2180, 2410, 2500, 2490, 2610, 2550, 2480, 2590, 2608, 2608] },
      cierre: 'F29 listo para aprobar',
      workers: [
        { id: 'r1', name: 'Mauricio Díaz Vera', rut: '13.998.112-4', cargo: 'Conductor Clase A4', base: 1250000, grat: 180000, afp: 'Habitat', imponible: 1430000, liquido: 1164000, estado: 'Listo' }
      ],
      bankTx: []
    },
    {
      id: 'barrio-italia',
      name: 'Cafetería Barrio Italia EIRL',
      rut: '76.224.819-5',
      regime: '14 D8',
      status: 'esperando',
      rcv: { state: 'alerta', label: '1 acuse < 24h', pendingAcuses: 1, ventasNeto: 6800000, comprasNeto: 3950000 },
      nomina: { state: 'esperando', label: 'Faltan novedades', count: 5, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '91% match', matched: 21, total: 23 },
      f29: { state: 'revisar', folio: '', postergar: true, debito: 1292000, credito: 750500, ppm: 68000, retenciones: 95000, history: [610, 640, 590, 680, 710, 695, 670, 720, 685, 700, 704, 704] },
      cierre: 'Esperando cliente',
      workers: [
        { id: 'c1', name: 'Javiera Núñez Paz', rut: '19.442.108-7', cargo: 'Barista', base: 680000, grat: 155000, afp: 'Modelo', imponible: 835000, liquido: 691000, estado: 'Pendiente horas' }
      ],
      bankTx: []
    },
    {
      id: 'pacifico',
      name: 'Importadora Pacífico SpA',
      rut: '76.778.102-3',
      regime: '14 A',
      status: 'cerrado',
      rcv: { state: 'ok', label: 'Cerrado SII', pendingAcuses: 0, ventasNeto: 54000000, comprasNeto: 39200000 },
      nomina: { state: 'ok', label: '9 liq · Pagado', count: 9, previredOk: true, leyBustos: false },
      bancos: { state: 'ok', label: '100% match', matched: 41, total: 41 },
      f29: { state: 'declarado', folio: '84920144', postergar: false, debito: 10260000, credito: 7448000, ppm: 540000, retenciones: 310000, history: [3400, 3550, 3620, 3480, 3710, 3590, 3640, 3700, 3610, 3680, 3662, 3662] },
      cierre: 'Cerrado',
      workers: [
        { id: 'p1', name: 'Rodrigo Castro Araya', rut: '12.665.430-1', cargo: 'Comercio Exterior', base: 1950000, grat: 210000, afp: 'Capital', imponible: 2160000, liquido: 1735000, estado: 'Pagado' }
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
    level: 'studio', // 'studio' | 'client'
    studioView: 'hoy', // 'hoy' | 'olas' | 'bandeja' | 'empresas'
    olaTab: 'acuses', // 'acuses' | 'lre' | 'f29'
    inboxTab: 'pendientes', // 'pendientes' | 'resueltos'
    selectedInboxId: 'in1',
    clientId: 'san-isidro',
    clientArea: 'impuestos', // 'resumen' | 'impuestos' | 'remuneraciones' | 'bancos' | 'contabilidad'
    clientSub: 'f29',
    periodIdx: 2,
    filter: 'todos',
    query: '',
    selectedWorkerId: null,
    selectedBankId: null,
    selectedIds: new Set(),
    clients: INITIAL_CLIENTS(),
    inbox: INITIAL_INBOX()
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');

  function f29Total(c) {
    const iva = Math.max(0, (c.f29.debito || 0) - (c.f29.credito || 0));
    const ivaPagar = c.f29.postergar ? 0 : iva;
    return ivaPagar + (c.f29.ppm || 0) + (c.f29.retenciones || 0);
  }

  function toast(msg) {
    const el = $('v2-toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3200);
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
  }

  /* ==================== SIDEBAR + TOPBAR RENDER ==================== */
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
          <span>Asesorías Pérez Ltda.</span>
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
        { id: 'remuneraciones', label: 'Remuneraciones', count: c.nomina.count },
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
    $('v2-period-label').textContent = PERIODS[state.periodIdx];
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
          cta: c.f29.state === 'declarado' ? 'Descargar comprobante' : 'Declarar F29',
          tabs: [
            { id: 'f29', label: 'Hoja F29' },
            { id: 'rcv', label: 'Compras y Acuses' },
            { id: 'renta', label: `Renta (${c.regime})` }
          ]
        },
        remuneraciones: {
          title: 'Remuneraciones',
          cta: 'Descargar Previred TXT',
          tabs: [
            { id: 'nomina', label: 'Nómina del mes' },
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
          <tbody>
            ${rows.map((c) => {
              const rcvTag = c.rcv.state === 'alerta' ? 'tag--on' : 'tag--in';
              const nomTag = c.nomina.state === 'alerta' ? 'tag--on' : c.nomina.state === 'esperando' ? 'tag--out' : 'tag--in';
              const bcoTag = c.bancos.state === 'ok' ? 'tag--in' : 'tag--out';
              const cierreTag = c.status === 'cerrado' ? 'tag--in' : c.status === 'critico' ? 'tag--on' : 'tag--out';
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
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">${rows.length} empresas en vista · ${PERIODS[state.periodIdx]}</td>
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
          <span class="mono muted">Nov 2026</span>
        </div>
        <div class="v2-ins-list">
          <button type="button" class="v2-ins-row-btn" data-jump-ola="acuses">
            <span><strong>Día 8</strong> · Acuses Ley 19.983</span>
            <span class="tag tag--on">3 por vencer</span>
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
            <span class="tag tag--out">1/6 cerrado</span>
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
        { id: 'ac1', clientId: 'san-isidro', client: 'Panadería San Isidro SpA', doc: 'Fact. #88412 · Molinos del Sur', monto: 945000, vence: 'En 18 h', estado: 'Urgente' },
        { id: 'ac2', clientId: 'san-isidro', client: 'Panadería San Isidro SpA', doc: 'Fact. #20491 · Envases Chile', monto: 412000, vence: 'En 36 h', estado: 'Por revisar' },
        { id: 'ac3', clientId: 'barrio-italia', client: 'Cafetería Barrio Italia EIRL', doc: 'Fact. #9920 · Tostaduría Sur', monto: 318500, vence: 'En 22 h', estado: 'Urgente' }
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
      headCols = `<tr><th style="width:32px"></th><th>Empresa</th><th class="num">Trabajadores</th><th>PreviRed (Día 13)</th><th>LRE Mi DT (Día 15)</th><th>Acción</th></tr>`;
      rowsHtml = state.clients.map((c) => `
        <tr>
          <td><input type="checkbox" data-batch-id="${c.id}" ${state.selectedIds.has(c.id) ? 'checked' : ''} aria-label="Seleccionar ${c.name}"></td>
          <td><strong>${c.name}</strong><span class="v2-cell-sub mono">${c.rut}</span></td>
          <td class="num">${c.nomina.count}</td>
          <td><span class="tag ${c.nomina.previredOk ? 'tag--in' : 'tag--on'}">${c.nomina.previredOk ? 'Al día' : 'Mora · Ley Bustos'}</span></td>
          <td><span class="tag ${c.nomina.state === 'ok' ? 'tag--in' : 'tag--out'}">${c.nomina.label}</span></td>
          <td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="remuneraciones">Abrir</button></td>
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

    $('v2-canvas').innerHTML = `
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>${headCols}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Operación en lote</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Selecciona varias empresas con los checkboxes para aprobar lotes limpios sin abrir cada empresa por separado.</p>
        <dl class="v2-ins-kv" style="margin:6px 0 0">
          <dt>Cartera activa</dt><dd>${state.clients.length} empresas</dd>
          <dt>Listas para lote</dt><dd>${state.clients.filter((c) => c.f29.state === 'listo').length}</dd>
          <dt>Con excepciones</dt><dd>${state.clients.filter((c) => c.status === 'critico').length}</dd>
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
          <thead>
            <tr><th>Documento / Solicitud</th><th>Empresa</th><th>Tipo</th><th>Recibido</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${list.length ? list.map((it) => `
              <tr class="${active && active.id === it.id ? 'is-selected' : ''}" data-select-inbox="${it.id}" style="cursor:pointer">
                <td><strong>${it.title}</strong></td>
                <td>${it.client}</td>
                <td>${it.type}</td>
                <td class="mono muted">${it.age}</td>
                <td><span class="tag ${it.state === 'Resuelto' ? 'tag--in' : 'tag--out'}">${it.state}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="muted" style="padding:24px;text-align:center">Bandeja al día: sin ítems en esta vista.</td></tr>`}
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
    ` : `<div class="v2-ins-block"><h2 class="v2-ins-title">Sin selección</h2><p class="muted">Selecciona un elemento de la bandeja.</p></div>`;
  }

  function renderStudioEmpresas() {
    $('v2-canvas').innerHTML = `
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr><th>Razón social</th><th>RUT</th><th>Régimen</th><th class="num">Dotación</th><th>Estado mes</th><th></th></tr>
          </thead>
          <tbody>
            ${state.clients.map((c) => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td class="mono">${c.rut}</td>
                <td><span class="tag tag--out">${c.regime}</span></td>
                <td class="num">${c.nomina.count}</td>
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
        <button type="button" class="btn btn--primary" id="btn-ins-new-client" style="margin-top:8px">+ Agregar nueva empresa</button>
      </div>
    `;
  }

  /* ==================== NIVEL 2: ESPACIO CLIENTE (WORKBENCH 70/30) ==================== */
  function sparklineSvg(arr) {
    const max = Math.max(...arr, 1);
    const min = Math.min(...arr, 0);
    const span = Math.max(max - min, 1);
    const pts = arr.map((v, i) => {
      const x = (i / (arr.length - 1)) * 300;
      const y = 46 - ((v - min) / span) * 38;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="v2-spark" viewBox="0 0 300 52" preserveAspectRatio="none" aria-label="Tendencia F29 12 meses">
      <polyline fill="none" stroke="oklch(50% 0.095 188)" stroke-width="2" points="${pts}" />
    </svg>`;
  }

  function renderClientImpuestos(c) {
    const iva = Math.max(0, c.f29.debito - c.f29.credito);
    const total = f29Total(c);

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
          <div class="v2-tape-cell"><span class="v2-tape-label">Débito (538)</span><span class="v2-tape-val">${fmt(c.f29.debito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Crédito (537)</span><span class="v2-tape-val">${fmt(c.f29.credito)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">IVA neto (089)</span><span class="v2-tape-val">${fmt(iva)}</span></div>
          <div class="v2-tape-cell"><span class="v2-tape-label">Total F29 (091)</span><span class="v2-tape-val is-in">${fmt(total)}</span></div>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead>
              <tr><th style="width:78px">Código</th><th>Glosa oficial Formulario 29</th><th class="num" style="width:160px">Monto ($)</th></tr>
            </thead>
            <tbody>
              ${lines.map((l) => `
                <tr>
                  <td class="mono"><strong>${l.code}</strong></td>
                  <td>${l.glosa}</td>
                  <td class="num">
                    ${l.editable
                      ? `<input type="number" class="v2-inline-input" data-f29-field="${l.field}" value="${l.val}" aria-label="Código ${l.code}">`
                      : `<span class="mono">${fmt(l.val)}</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td class="mono">091</td>
                <td>Total a pagar dentro de plazo legal</td>
                <td class="num">${fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    } else if (state.clientSub === 'rcv') {
      $('v2-canvas').innerHTML = `
        <div class="v2-pulse-bar">
          <span class="muted">Registro de Compras y Ventas · ${c.rcv.label}</span>
          <label class="btn btn--sm">
            Importar CSV RCV SII
            <input type="file" accept=".csv" id="v2-csv-rcv" class="sr-only">
          </label>
        </div>
        <div class="v2-table-wrap">
          <table class="v2-table">
            <thead>
              <tr><th>Folio</th><th>Proveedor</th><th class="num">Neto</th><th class="num">IVA</th><th>Plazo 8 días</th><th>Acción</th></tr>
            </thead>
            <tbody>
              <tr>
                <td class="mono">88412</td>
                <td>Molinos del Sur S.A.</td>
                <td class="num">$794.118</td>
                <td class="num">$150.882</td>
                <td><span class="tag tag--on">Vence en 18 h</span></td>
                <td><button type="button" class="btn btn--sm" data-quick-ok="Acuse aceptado en SII para folio 88412">Aceptar</button></td>
              </tr>
              <tr>
                <td class="mono">20491</td>
                <td>Envases Chile SpA</td>
                <td class="num">$346.218</td>
                <td class="num">$65.782</td>
                <td><span class="tag tag--out">Vence en 36 h</span></td>
                <td><button type="button" class="btn btn--sm" data-quick-ok="Acuse aceptado en SII para folio 20491">Aceptar</button></td>
              </tr>
              <tr>
                <td class="mono">77104</td>
                <td>Supermercado Jumbo (Cód. 761)</td>
                <td class="num">$151.261</td>
                <td class="num">$28.739</td>
                <td><span class="tag tag--in">Contado</span></td>
                <td><button type="button" class="btn btn--sm" data-quick-ok="Solicitud de respaldo enviada al cliente">Pedir respaldo</button></td>
              </tr>
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
              ${ddjj.map(([cod, desc, apl]) => `
                <tr>
                  <td class="mono"><strong>${cod}</strong></td>
                  <td>${desc}</td>
                  <td><span class="tag tag--in">${apl}</span></td>
                  <td><span class="tag tag--out">Borrador listo</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    $('v2-inspector').innerHTML = `
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

      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Conexión SII y TGR</h2>
          <span class="tag tag--out">Modo local</span>
        </div>
        <dl class="v2-ins-kv">
          <dt>Estado F29</dt><dd>${c.f29.state}</dd>
          <dt>Folio SII</dt><dd>${c.f29.folio || 'Sin declarar'}</dd>
          <dt>Deuda TGR</dt><dd>$0</dd>
        </dl>
      </div>

      <div class="v2-ins-block v2-ins-block--soft">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Tendencia F29 (12 meses)</h2>
          <span class="mono muted">M$</span>
        </div>
        ${sparklineSvg(c.f29.history)}
      </div>
    `;
  }

  function renderClientRemuneraciones(c) {
    const selected = c.workers.find((w) => w.id === state.selectedWorkerId) || c.workers[0];
    if (selected) state.selectedWorkerId = selected.id;
    const totalLiquido = c.workers.reduce((s, w) => s + w.liquido, 0);
    const totalImp = c.workers.reduce((s, w) => s + w.imponible, 0);

    $('v2-canvas').innerHTML = `
      <div class="v2-tape">
        <div class="v2-tape-cell"><span class="v2-tape-label">Dotación</span><span class="v2-tape-val">${c.workers.length}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Total imponible</span><span class="v2-tape-val">${fmt(totalImp)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">Líquido a pagar</span><span class="v2-tape-val is-in">${fmt(totalLiquido)}</span></div>
        <div class="v2-tape-cell"><span class="v2-tape-label">PreviRed</span><span class="v2-tape-val">${c.nomina.previredOk ? 'Al día' : 'Mora'}</span></div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr><th style="width:32px"></th><th>Trabajador</th><th>RUT</th><th>AFP</th><th class="num">Imponible</th><th class="num">Líquido</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${c.workers.map((w) => `
              <tr class="${selected && selected.id === w.id ? 'is-selected' : ''}" data-select-worker="${w.id}" style="cursor:pointer">
                <td><input type="checkbox" data-batch-id="${w.id}" ${state.selectedIds.has(w.id) ? 'checked' : ''} aria-label="Seleccionar ${w.name}"></td>
                <td><strong>${w.name}</strong><span class="v2-cell-sub">${w.cargo}</span></td>
                <td class="mono">${w.rut}</td>
                <td>${w.afp}</td>
                <td class="num">${fmt(w.imponible)}</td>
                <td class="num"><strong>${fmt(w.liquido)}</strong></td>
                <td><span class="tag ${w.estado === 'Listo' || w.estado === 'Pagado' ? 'tag--in' : 'tag--on'}">${w.estado}</span></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">Totales nómina · ${c.workers.length} trabajadores</td>
              <td class="num">${fmt(totalImp)}</td>
              <td class="num">${fmt(totalLiquido)}</td>
              <td class="mono">LRE 147</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    $('v2-inspector').innerHTML = selected ? `
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">${selected.name}</h2>
          <span class="tag ${selected.estado === 'Listo' ? 'tag--in' : 'tag--on'}">${selected.estado}</span>
        </div>
        <div class="muted" style="font-size:12px">${selected.cargo} · <span class="mono">${selected.rut}</span></div>
        <dl class="v2-ins-kv" style="margin-top:4px">
          <dt>Sueldo base</dt><dd>${fmt(selected.base)}</dd>
          <dt>Gratificación legal</dt><dd>${fmt(selected.grat)}</dd>
          <dt>Total imponible</dt><dd>${fmt(selected.imponible)}</dd>
          <dt>AFP (${selected.afp})</dt><dd>−${fmt(selected.imponible * 0.1144)}</dd>
          <dt>Salud (7%)</dt><dd>−${fmt(selected.imponible * 0.07)}</dd>
          <dt><strong>Líquido a pagar</strong></dt><dd><strong>${fmt(selected.liquido)}</strong></dd>
        </dl>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-quick-ok="Liquidación PDF generada para ${selected.name}">Liquidación PDF</button>
          <button type="button" class="btn btn--sm" data-quick-ok="Borrador de finiquito abierto para ${selected.name}">Finiquito</button>
        </div>
      </div>
      ${c.nomina.leyBustos ? `
        <div class="v2-ins-block v2-ins-block--soft">
          <h2 class="v2-ins-title">Alerta Ley Bustos (Art. 162 CT)</h2>
          <p class="muted" style="margin:0;font-size:12.5px">Hay cotizaciones impagas con finiquito abierto. Regulariza PreviRed antes de ratificar el despido.</p>
        </div>
      ` : ''}
    ` : '';
  }

  function renderClientBancos(c) {
    const selected = c.bankTx.find((b) => b.id === state.selectedBankId) || c.bankTx[0] || null;
    if (selected) state.selectedBankId = selected.id;

    $('v2-canvas').innerHTML = `
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
            `).join('') : `<tr><td colspan="5" style="padding:24px;text-align:center" class="muted">Sin cartola cargada para ${PERIODS[state.periodIdx]}. Pide la cartola desde el Inspector derecho.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    $('v2-inspector').innerHTML = selected ? `
      <div class="v2-ins-block">
        <div class="v2-ins-head">
          <h2 class="v2-ins-title">Conciliación asistida</h2>
          <span class="tag ${selected.status === 'Conciliado' ? 'tag--in' : 'tag--out'}">${selected.status}</span>
        </div>
        <dl class="v2-ins-kv">
          <dt>Movimiento</dt><dd>${selected.desc}</dd>
          <dt>Monto</dt><dd>${fmt(selected.amount)}</dd>
          <dt>Cruce sugerido</dt><dd>${selected.match}</dd>
        </dl>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
          ${selected.status !== 'Conciliado' ? `<button type="button" class="btn btn--primary" data-match-tx="${selected.id}">Cuadrar movimiento</button>` : ''}
          <button type="button" class="btn" data-quick-ok="Micro-solicitud sin clave enviada al cliente por ${selected.desc}">Pedir respaldo al cliente</button>
        </div>
      </div>
    ` : `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Cartola pendiente</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Envía un enlace sin clave al dueño para que suba su cartola directo a esta cuenta.</p>
        <button type="button" class="btn btn--primary" data-quick-ok="Enlace sin clave enviado a ${c.name}">Pedir cartola al cliente</button>
      </div>
    `;
  }

  function renderClientContabilidad(c) {
    const accounts = [
      { code: '1101', name: 'Caja y Bancos', deudor: 12480000, acreedor: 0, activo: 12480000, pasivo: 0 },
      { code: '1104', name: 'Clientes por Cobrar', deudor: 6820000, acreedor: 0, activo: 6820000, pasivo: 0 },
      { code: '2101', name: 'Proveedores Nacionales', deudor: 0, acreedor: 4910000, activo: 0, pasivo: 4910000 },
      { code: '2105', name: 'IVA Débito / Impuestos por Pagar', deudor: 0, acreedor: f29Total(c), activo: 0, pasivo: f29Total(c) },
      { code: '4101', name: 'Ingresos del Giro', deudor: 0, acreedor: c.rcv.ventasNeto, activo: 0, pasivo: 0 },
      { code: '5101', name: 'Costos y Remuneraciones', deudor: c.rcv.comprasNeto, acreedor: 0, activo: 0, pasivo: 0 }
    ];
    $('v2-canvas').innerHTML = `
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead>
            <tr><th style="width:76px">Cuenta</th><th>Nombre cuenta</th><th class="num">Saldo Deudor</th><th class="num">Saldo Acreedor</th><th class="num">Activo</th><th class="num">Pasivo</th></tr>
          </thead>
          <tbody>
            ${accounts.map((a) => `
              <tr>
                <td class="mono">${a.code}</td>
                <td><strong>${a.name}</strong></td>
                <td class="num">${fmt(a.deudor)}</td>
                <td class="num">${fmt(a.acreedor)}</td>
                <td class="num">${fmt(a.activo)}</td>
                <td class="num">${fmt(a.pasivo)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Salud contable · ${c.regime}</h2>
        <dl class="v2-ins-kv">
          <dt>Asientos del mes</dt><dd>142</dd>
          <dt>Cuadre Debe = Haber</dt><dd>OK</dd>
          <dt>Estado período</dt><dd>${c.cierre}</dd>
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
        <div class="v2-tape-cell"><span class="v2-tape-label">Dotación</span><span class="v2-tape-val">${c.nomina.count}</span></div>
      </div>
      <div class="v2-table-wrap">
        <table class="v2-table">
          <thead><tr><th>Hito de cierre mensual</th><th>Estado actual</th><th>Acceso directo</th></tr></thead>
          <tbody>
            <tr><td>1. Registro Compras y Ventas (RCV) + Acuses 8d</td><td><span class="tag ${c.rcv.state === 'alerta' ? 'tag--on' : 'tag--in'}">${c.rcv.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="rcv">Abrir RCV</button></td></tr>
            <tr><td>2. Remuneraciones, PreviRed y LRE Mi DT</td><td><span class="tag ${c.nomina.state === 'ok' ? 'tag--in' : 'tag--on'}">${c.nomina.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="remuneraciones">Abrir Nómina</button></td></tr>
            <tr><td>3. Conciliación Bancaria</td><td><span class="tag ${c.bancos.state === 'ok' ? 'tag--in' : 'tag--out'}">${c.bancos.label}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="bancos">Abrir Bancos</button></td></tr>
            <tr><td>4. Declaración F29 (Cód. 91)</td><td><span class="tag ${c.f29.state === 'declarado' || c.f29.state === 'listo' ? 'tag--in' : 'tag--out'}">${fmt(f29Total(c))} · ${c.f29.state}</span></td><td><button type="button" class="btn btn--sm" data-open-client="${c.id}" data-open-area="impuestos" data-open-sub="f29">Abrir F29</button></td></tr>
          </tbody>
        </table>
      </div>
    `;
    $('v2-inspector').innerHTML = `
      <div class="v2-ins-block">
        <h2 class="v2-ins-title">Paquete Mensual para el dueño</h2>
        <p class="muted" style="margin:0;font-size:12.5px">Envía en 1 clic el resumen ejecutivo del mes (F29, nómina y caja) con membrete de Asesorías Pérez Ltda.</p>
        <button type="button" class="btn btn--primary" data-quick-ok="Paquete Mensual PDF generado para ${c.name}">Emitir Paquete PDF</button>
        <button type="button" class="btn" data-quick-ok="Enlace de Portal Cliente copiado para ${c.name}">Copiar enlace Portal sin clave</button>
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

  /* ==================== COMMAND PALETTE ⌘K ==================== */
  function openCmdk() {
    $('v2-cmdk-backdrop').hidden = false;
    const inp = $('v2-cmdk-input');
    inp.value = '';
    renderCmdk('');
    setTimeout(() => inp.focus(), 10);
  }
  function closeCmdk() { $('v2-cmdk-backdrop').hidden = true; }
  function renderCmdk(q) {
    const term = q.trim().toLowerCase();
    const entries = [
      { label: 'Volver a Mesa de Cierre (Estudio)', meta: 'Estudio', run: () => enterStudio('hoy') },
      { label: 'Ir a Olas del Mes (Lotes)', meta: 'Estudio', run: () => enterStudio('olas') },
      { label: '+ Agregar nueva empresa', meta: 'Acción', run: () => openDrawer() },
      ...state.clients.flatMap((c) => ([
        { label: `${c.name} · Hoja F29`, meta: c.rut, run: () => enterClient(c.id, 'impuestos', 'f29') },
        { label: `${c.name} · Nómina`, meta: `${c.nomina.count} trab.`, run: () => enterClient(c.id, 'remuneraciones', 'nomina') },
        { label: `${c.name} · Bancos`, meta: c.bancos.label, run: () => enterClient(c.id, 'bancos', 'match') }
      ]))
    ].filter((e) => !term || e.label.toLowerCase().includes(term) || e.meta.toLowerCase().includes(term));

    const list = $('v2-cmdk-list');
    list.innerHTML = entries.slice(0, 10).map((e, idx) => `
      <button type="button" class="v2-cmdk-item ${idx === 0 ? 'is-active' : ''}" data-cmdk-idx="${idx}">
        <span>${e.label}</span><span class="mono muted">${e.meta}</span>
      </button>
    `).join('');
    list._entries = entries.slice(0, 10);
  }

  function openDrawer() { $('v2-drawer-wrap').hidden = false; setTimeout(() => $('nc-name').focus(), 20); }
  function closeDrawer() { $('v2-drawer-wrap').hidden = true; }

  /* ==================== GLOBAL EVENTS ==================== */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-select-worker], [data-select-bank], [data-select-inbox]');
    if (!t) return;

    if (t.id === 'btn-open-cmdk' || t.id === 'btn-switch-client') { openCmdk(); return; }
    if (t.id === 'btn-back-studio' || t.dataset.backStudio) { enterStudio('hoy'); return; }
    if (t.id === 'btn-new-client' || t.id === 'btn-ins-new-client') { openDrawer(); return; }
    if (t.id === 'btn-close-drawer' || t.id === 'btn-cancel-drawer') { closeDrawer(); return; }
    if (t.id === 'btn-mobile-menu') { $('v2-sidebar').classList.toggle('is-open'); return; }
    if (t.id === 'btn-period-prev') { state.periodIdx = Math.max(0, state.periodIdx - 1); render(); return; }
    if (t.id === 'btn-period-next') { state.periodIdx = Math.min(PERIODS.length - 1, state.periodIdx + 1); render(); return; }
    if (t.id === 'btn-reset-demo') { state.clients = INITIAL_CLIENTS(); state.inbox = INITIAL_INBOX(); toast('Datos de demostración restablecidos'); render(); return; }
    if (t.id === 'btn-batch-clear') { state.selectedIds.clear(); render(); return; }
    if (t.id === 'btn-batch-action') { toast(`Lote procesado (${state.selectedIds.size} elementos)`); state.selectedIds.clear(); render(); return; }

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
        c.f29.state = 'declarado'; c.f29.folio = c.f29.folio || '84920311'; c.status = 'cerrado'; c.cierre = 'Cerrado';
        toast(`F29 declarado · Folio SII ${c.f29.folio}`); render(); return;
      }
      if (state.level === 'client' && state.clientArea === 'remuneraciones') {
        const c = getClient();
        const blob = new Blob([c.workers.map((w) => `${w.rut};${w.name};${w.imponible};${w.afp}`).join('\n')], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `previred_${c.id}.txt`; a.click();
        toast(`Archivo Previred descargado (${c.workers.length} trabajadores)`); return;
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
    if (t.dataset.jumpOla) { state.olaTab = t.dataset.jumpOla; enterStudio('olas'); return; }
    if (t.dataset.openClient) { enterClient(t.dataset.openClient, t.dataset.openArea || 'impuestos', t.dataset.openSub || null); return; }
    if (t.dataset.selectWorker) { state.selectedWorkerId = t.dataset.selectWorker; render(); return; }
    if (t.dataset.selectBank) { state.selectedBankId = t.dataset.selectBank; render(); return; }
    if (t.dataset.selectInbox) { state.selectedInboxId = t.dataset.selectInbox; render(); return; }
    if (t.dataset.resolveInbox) {
      const it = state.inbox.find((x) => x.id === t.dataset.resolveInbox);
      if (it) { it.state = 'Resuelto'; toast('Elemento marcado como resuelto'); render(); }
      return;
    }
    if (t.dataset.matchTx) {
      const c = getClient();
      const tx = c.bankTx.find((x) => x.id === t.dataset.matchTx);
      if (tx) { tx.status = 'Conciliado'; c.bancos.matched = Math.min(c.bancos.total, c.bancos.matched + 1); toast('Movimiento conciliado'); render(); }
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
    if (e.target.id === 'v2-matrix-search') { state.query = e.target.value; renderStudioHoy(); $('v2-matrix-search')?.focus(); return; }
    if (e.target.id === 'v2-cmdk-input') { renderCmdk(e.target.value); return; }
    if (e.target.dataset.f29Field) {
      const c = getClient();
      c.f29[e.target.dataset.f29Field] = Math.max(0, Number(e.target.value) || 0);
      renderClientImpuestos(c);
      const again = document.querySelector(`[data-f29-field="${e.target.dataset.f29Field}"]`);
      if (again) again.focus();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'chk-postergar') { getClient().f29.postergar = e.target.checked; render(); return; }
    if (e.target.dataset.batchId) {
      const id = e.target.dataset.batchId;
      if (e.target.checked) state.selectedIds.add(id); else state.selectedIds.delete(id);
      renderBatchBar();
    }
  });

  $('v2-cmdk-backdrop').addEventListener('click', (e) => { if (e.target.id === 'v2-cmdk-backdrop') closeCmdk(); });
  $('v2-drawer-wrap').addEventListener('click', (e) => { if (e.target.id === 'v2-drawer-wrap') closeDrawer(); });
  $('v2-brand-home').addEventListener('click', (e) => { e.preventDefault(); enterStudio('hoy'); });

  $('form-new-client').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('nc-name').value.trim();
    const rut = $('nc-rut').value.trim();
    const regime = $('nc-regime').value;
    const workersCount = Math.max(0, Number($('nc-workers').value) || 0);
    if (!name || !rut) return;
    const id = 'cli-' + Date.now();
    state.clients.unshift({
      id, name, rut, regime, status: 'revisar',
      rcv: { state: 'ok', label: 'Sin movimientos', pendingAcuses: 0, ventasNeto: 0, comprasNeto: 0 },
      nomina: { state: 'ok', label: `${workersCount} trab.`, count: workersCount, previredOk: true, leyBustos: false },
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); }
    if (e.key === 'Escape') { closeCmdk(); closeDrawer(); closeMobileSidebar(); }
  });

  // Hash shortcut para pruebas directas (#cliente-f29, #cliente-nomina, #olas)
  if (location.hash === '#cliente-f29') enterClient('san-isidro', 'impuestos', 'f29');
  else if (location.hash === '#cliente-nomina') enterClient('san-isidro', 'remuneraciones', 'nomina');
  else if (location.hash === '#olas') enterStudio('olas');
  else render();
})();
