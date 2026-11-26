/* ============================================================================
 * Suite Contadores v2 — Generador Profesional de Documentos (PDF A4 + Excel)
 * Genera documentos imprimibles limpios (estilo editorial contable chileno,
 * sin adornos IA) y libros Excel (.xlsx) reales vía CLPymeExcel.
 * ============================================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    const num = Math.round(Number(n) || 0);
    return (num < 0 ? '−$' : '$') + Math.abs(num).toLocaleString('es-CL');
  }

  function hoyChile() {
    try {
      return new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) {
      return '26-11-2026';
    }
  }

  function slug(s) {
    return String(s || 'documento')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function buildPrintShell(title, bodyHtml, opts) {
    const landscape = !!(opts && opts.landscape);
    const studioName = (opts && opts.studioName) || 'Estudio Contable';
    return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} — ${esc(studioName)}</title>
  <style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${landscape ? '11mm 12mm' : '13mm 14mm'}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #F4F5F6; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .doc-toolbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; background: #0F172A; color: #F8FAFC; font-size: 12px; }
    .doc-toolbar-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-toolbar-actions { display: flex; gap: 8px; }
    .doc-btn { appearance: none; border: 1px solid #334155; background: #1E293B; color: #F8FAFC; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 500; cursor: pointer; }
    .doc-btn--primary { background: #0F766E; border-color: #0F766E; color: #FFFFFF; }
    .doc-btn:hover { opacity: 0.92; }
    .doc-sheet { width: ${landscape ? '273mm' : '190mm'}; max-width: calc(100vw - 32px); margin: 18px auto 28px; background: #FFFFFF; border: 1px solid #E2E8F0; padding: ${landscape ? '12mm 13mm' : '14mm 15mm'}; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05); }
    .doc-page-break { page-break-before: always; break-before: page; }
    .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #0F172A; padding-bottom: 10px; margin-bottom: 14px; }
    .doc-brand { display: flex; align-items: center; gap: 10px; }
    .doc-mark { width: 30px; height: 30px; border-radius: 6px; background: #0F766E; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; letter-spacing: -0.02em; }
    .doc-studio { font-size: 13px; font-weight: 700; color: #0F172A; }
    .doc-sub { font-size: 10px; color: #475569; margin-top: 1px; }
    .doc-meta { text-align: right; font-size: 10px; color: #475569; }
    .doc-meta strong { display: block; font-size: 13px; color: #0F172A; margin-bottom: 2px; }
    .doc-client-box { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; padding: 9px 12px; margin-bottom: 14px; }
    .doc-kv-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748B; display: block; }
    .doc-kv-val { font-size: 11px; font-weight: 600; color: #0F172A; }
    .doc-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
    .doc-kpi { border: 1px solid #E2E8F0; border-radius: 4px; padding: 8px 10px; }
    .doc-kpi-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748B; }
    .doc-kpi-v { font-size: 14px; font-weight: 700; color: #0F172A; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .doc-kpi-v.is-accent { color: #0F766E; }
    .doc-section { margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
    .doc-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; margin: 0 0 8px; }
    table.doc-tbl { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    table.doc-tbl th, table.doc-tbl td { border-bottom: 1px solid #E2E8F0; padding: 5px 6px; text-align: left; vertical-align: top; }
    table.doc-tbl thead th { background: #F1F5F9; color: #334155; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; border-top: 1px solid #CBD5E1; border-bottom: 1px solid #CBD5E1; }
    table.doc-tbl tfoot td { background: #F8FAFC; font-weight: 700; border-top: 1.5px solid #0F172A; border-bottom: 1.5px solid #0F172A; }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
    .muted { color: #64748B; }
    .doc-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .doc-note { margin-top: 10px; padding: 8px 10px; border-left: 3px solid #0F766E; background: #F8FAFC; font-size: 10px; color: #334155; }
    .doc-note.is-warn { border-left-color: #B45309; background: #FFFBEB; color: #78350F; }
    .doc-legal-p { font-size: 10.5px; color: #1E293B; text-align: justify; margin: 8px 0; line-height: 1.55; }
    .doc-signs { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; page-break-inside: avoid; break-inside: avoid; }
    .doc-sign-box { border-top: 1px solid #334155; padding-top: 6px; text-align: center; font-size: 10px; color: #334155; }
    .doc-sign-box strong { display: block; color: #0F172A; }
    .doc-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 9px; color: #64748B; }
    @media print {
      html, body { background: #FFFFFF; }
      .doc-toolbar { display: none !important; }
      .doc-sheet { width: auto; max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="doc-toolbar">
    <span class="doc-toolbar-title">${esc(title)} · ${esc(studioName)}</span>
    <div class="doc-toolbar-actions">
      <button type="button" class="doc-btn doc-btn--primary" onclick="window.print()">Imprimir / Guardar PDF</button>
      <button type="button" class="doc-btn" onclick="window.close()">Cerrar</button>
    </div>
  </div>
  <main class="doc-sheet">
    ${bodyHtml}
  </main>
</body>
</html>`;
  }

  function showInlinePreviewModal(html, title) {
    let dlg = document.getElementById('v2-doc-preview-modal');
    if (dlg) dlg.remove();
    dlg = document.createElement('div');
    dlg.id = 'v2-doc-preview-modal';
    dlg.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.55);display:flex;flex-direction:column;padding:18px;';
    dlg.innerHTML = `
      <div style="max-width:1040px;width:100%;height:100%;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.28);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0F172A;color:#F8FAFC;font-size:13px;">
          <strong>${esc(title)}</strong>
          <div style="display:flex;gap:8px;">
            <button type="button" id="v2-doc-print-btn" style="background:#0F766E;color:#fff;border:0;padding:6px 12px;border-radius:5px;cursor:pointer;font-weight:600;font-size:12px;">Imprimir / Guardar PDF</button>
            <button type="button" id="v2-doc-close-btn" style="background:#1E293B;color:#F8FAFC;border:1px solid #334155;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:12px;">Cerrar</button>
          </div>
        </div>
        <iframe id="v2-doc-iframe" title="${esc(title)}" style="flex:1;width:100%;border:0;background:#F4F5F6;"></iframe>
      </div>
    `;
    document.body.appendChild(dlg);
    const iframe = dlg.querySelector('#v2-doc-iframe');
    iframe.srcdoc = html.replace(/<div class="doc-toolbar">[\s\S]*?<\/div>\s*<\/div>/, '');
    dlg.querySelector('#v2-doc-print-btn').addEventListener('click', () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (_) {}
    });
    const close = () => dlg.remove();
    dlg.querySelector('#v2-doc-close-btn').addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    return { mode: 'modal', title };
  }

  function openPrintable(title, bodyHtml, opts) {
    const html = buildPrintShell(title, bodyHtml, opts);
    try {
      const w = window.open('', '_blank', 'width=980,height=780');
      if (w && w.document) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        try { w.focus(); } catch (_) {}
        return { mode: 'window', title };
      }
    } catch (_) {
      // fallback a modal embebido
    }
    return showInlinePreviewModal(html, title);
  }

  function docHeader(studioName, docTitle, periodLabel, folioRef) {
    const initials = (studioName || 'CL').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'CL';
    return `
      <header class="doc-head">
        <div class="doc-brand">
          <span class="doc-mark">${esc(initials)}</span>
          <div>
            <div class="doc-studio">${esc(studioName || 'Estudio Contable')}</div>
            <div class="doc-sub">Suite Contadores · Cálculo Laboral Chile</div>
          </div>
        </div>
        <div class="doc-meta">
          <strong>${esc(docTitle)}</strong>
          <span>Período: ${esc(periodLabel)} · Emitido: ${hoyChile()}${folioRef ? ` · Ref. ${esc(folioRef)}` : ''}</span>
        </div>
      </header>
    `;
  }

  function clientStrip(c, extraLabel, extraVal) {
    return `
      <div class="doc-client-box">
        <div><span class="doc-kv-label">Contribuyente / Empleador</span><span class="doc-kv-val">${esc(c.name)}</span></div>
        <div><span class="doc-kv-label">RUT</span><span class="doc-kv-val mono">${esc(c.rut)}</span></div>
        <div><span class="doc-kv-label">Régimen Tributario</span><span class="doc-kv-val">${esc(c.regime)}</span></div>
        <div><span class="doc-kv-label">${esc(extraLabel || 'Estado Período')}</span><span class="doc-kv-val">${esc(extraVal || (c.periodClosed ? 'Cerrado' : 'Abierto'))}</span></div>
      </div>
    `;
  }

  function docFooter(studioName, c) {
    return `
      <footer class="doc-footer">
        <span>${esc(studioName)} · ${esc(c.name)} (${esc(c.rut)})</span>
        <span>Documento referencial generado en Suite Contadores · Validar respaldos/certificados ante SII, DT o PreviRed</span>
      </footer>
    `;
  }

  // ---- 1. PAQUETE MENSUAL EJECUTIVO (PDF) ----
  function emitirPaqueteMensualPdf(ctx) {
    const { c, studioName, period, f29, f29Rows, f29Total, f29StateLabel, workersCalc, bankSummary, accounting } = ctx;
    const totLiq = workersCalc.reduce((s, x) => s + (x.calc.liquido || 0), 0);
    const totEmp = workersCalc.reduce((s, x) => s + (x.calc.costoEmpleador || 0), 0);
    const balTot = (accounting && accounting.bal && accounting.bal.totales) || {};
    const resultado = (balTot.ganancia || 0) - (balTot.perdida || 0);

    const body = `
      ${docHeader(studioName, 'Paquete Mensual Ejecutivo', period.label, c.f29.folio ? `F29 ${c.f29.folio}` : period.iso)}
      ${clientStrip(c, 'Estado F29', f29StateLabel)}

      <div class="doc-kpis">
        <div class="doc-kpi"><div class="doc-kpi-l">Ventas Netas</div><div class="doc-kpi-v">${fmt(c.rcv.ventasNeto)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">F29 a Pagar (Cód. 091)</div><div class="doc-kpi-v is-accent">${fmt(f29Total)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">Líquidos Nómina (${workersCalc.length})</div><div class="doc-kpi-v">${fmt(totLiq)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">Resultado Contable</div><div class="doc-kpi-v">${fmt(resultado)}</div></div>
      </div>

      <section class="doc-section">
        <h2 class="doc-section-title">1. Resumen Tributario · Formulario 29 (${esc(period.label)})</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:70px">Cód.</th><th>Concepto SII</th><th>Origen / Base</th><th class="num">Monto</th></tr></thead>
          <tbody>
            ${f29Rows.map((r) => `<tr><td class="mono">${esc(r.cod)}</td><td>${esc(r.label)}</td><td class="muted">${esc(r.source || '')}</td><td class="num">${fmt(r.val)}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td class="mono">091</td><td colspan="2">Total a pagar F29 · Estado: ${esc(f29StateLabel)}${c.f29.folio ? ` (Folio SII ${esc(c.f29.folio)})` : ''}</td><td class="num">${fmt(f29Total)}</td></tr>
          </tfoot>
        </table>
      </section>

      <section class="doc-section">
        <h2 class="doc-section-title">2. Remuneraciones, PreviRed (105) y LRE Mi DT (147)</h2>
        <table class="doc-tbl">
          <thead><tr><th>Trabajador</th><th>RUT</th><th>Cargo / Régimen</th><th class="num">Imponible</th><th class="num">Líquido</th><th class="num">Aporte Emp.</th></tr></thead>
          <tbody>
            ${workersCalc.map(({ w, calc }) => `
              <tr>
                <td><strong>${esc(w.name)}</strong></td>
                <td class="mono">${esc(w.rut)}</td>
                <td>${esc(w.cargo || 'Trabajador')}${w.tipoRegimen === 'socio' ? ' · Socio Art. 31 N°6' : w.tipoRegimen === 'pensionado' ? ' · Pensionado' : ''}</td>
                <td class="num">${fmt(calc.imponible)}</td>
                <td class="num">${fmt(calc.liquido)}</td>
                <td class="num">${fmt(calc.costoEmpleador)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="3">Totales del período (${workersCalc.length} personas) · ${esc(c.nomina.label)}</td><td class="num">${fmt(workersCalc.reduce((s, x) => s + (x.calc.imponible || 0), 0))}</td><td class="num">${fmt(totLiq)}</td><td class="num">${fmt(totEmp)}</td></tr>
          </tfoot>
        </table>
      </section>

      <section class="doc-section">
        <div class="doc-two-col">
          <div>
            <h2 class="doc-section-title">3. Conciliación Bancaria y Tesorería</h2>
            <table class="doc-tbl">
              <tbody>
                <tr><td>Movimientos conciliados</td><td class="num">${bankSummary.matched} de ${bankSummary.total} (${bankSummary.pct}%)</td></tr>
                <tr><td>Movimientos pendientes</td><td class="num">${bankSummary.pending}</td></tr>
                <tr><td>Cuentas por Cobrar abiertas (CxC)</td><td class="num">${fmt(bankSummary.cxcOpen)}</td></tr>
                <tr><td>Cuentas por Pagar abiertas (CxP)</td><td class="num">${fmt(bankSummary.cxpOpen)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2 class="doc-section-title">4. Situación Contable Resumida</h2>
            <table class="doc-tbl">
              <tbody>
                <tr><td>Total Activo</td><td class="num">${fmt(balTot.activo || 0)}</td></tr>
                <tr><td>Total Pasivo</td><td class="num">${fmt(balTot.pasivo || 0)}</td></tr>
                <tr><td>Total Ganancias / Ingresos</td><td class="num">${fmt(balTot.ganancia || 0)}</td></tr>
                <tr><td>Total Pérdidas / Gastos</td><td class="num">${fmt(balTot.perdida || 0)}</td></tr>
              </tbody>
              <tfoot>
                <tr><td>${resultado >= 0 ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio'}</td><td class="num">${fmt(resultado)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <div class="doc-signs">
        <div class="doc-sign-box"><strong>${esc(studioName)}</strong>Contador Responsable · Revisión Mensual</div>
        <div class="doc-sign-box"><strong>${esc(c.name)}</strong>Recepción Conforme Cliente (${esc(c.rut)})</div>
      </div>
      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Paquete Mensual — ${c.name} (${period.label})`, body, { studioName, landscape: false });
  }

  // ---- 2. HOJA F29 (PDF) ----
  function emitirF29Pdf(ctx) {
    const { c, studioName, period, f29Rows, f29Total, f29StateLabel } = ctx;
    const body = `
      ${docHeader(studioName, 'Borrador y Hoja de Trabajo F29', period.label, c.f29.folio || 'Borrador')}
      ${clientStrip(c, 'Folio SII / TGR', c.f29.folio ? `${c.f29.folio}${c.f29.paidDate ? ' · Pagado ' + c.f29.paidDate : ''}` : f29StateLabel)}

      <section class="doc-section">
        <h2 class="doc-section-title">Detalle de Códigos SII · Formulario 29</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:72px">Código</th><th>Descripción de línea SII</th><th>Respaldo / Fuente</th><th class="num">Monto CLP</th></tr></thead>
          <tbody>
            ${f29Rows.map((r) => `<tr><td class="mono"><strong>${esc(r.cod)}</strong></td><td>${esc(r.label)}</td><td class="muted">${esc(r.source || '')}</td><td class="num">${fmt(r.val)}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td class="mono">091</td><td colspan="2">Total a pagar dentro de plazo legal${c.f29.postergar ? ' (con postergación IVA Cód. 755)' : ''}</td><td class="num">${fmt(f29Total)}</td></tr>
          </tfoot>
        </table>
      </section>

      <section class="doc-section">
        <h2 class="doc-section-title">Parámetros y Control Pre-SII</h2>
        <table class="doc-tbl">
          <tbody>
            <tr><td>Ventas netas RCV del período</td><td class="num">${fmt(c.rcv.ventasNeto)}</td></tr>
            <tr><td>Compras netas RCV del período</td><td class="num">${fmt(c.rcv.comprasNeto)}</td></tr>
            <tr><td>Acuses de recibo pendientes (Ley 19.983 · 8 días)</td><td class="num">${c.rcv.pendingAcuses || 0}</td></tr>
            <tr><td>Tasa PPM aplicada (${esc(c.regime)})</td><td class="num">${esc(ctx.ppmRateLabel || '0,25%')}</td></tr>
            <tr><td>Retención Boletas de Honorarios (Ley 21.133 · 2026)</td><td class="num">15,25%</td></tr>
          </tbody>
        </table>
        ${c.rcv.pendingAcuses ? `<div class="doc-note is-warn">Existen ${c.rcv.pendingAcuses} documento(s) con acuse de recibo pendiente. Confirmar antes del vencimiento de 8 días para asegurar el Crédito Fiscal IVA.</div>` : `<div class="doc-note">Control Pre-SII sin reparos pendientes. ${c.f29.postergar ? 'Para postergar IVA (Art. 64 D.L. 825) debes marcar Cód. 756 dentro de plazo legal (el SII traspasa el IVA a giro Cód. 755; fuera de plazo se pierde el beneficio y PPM/retenciones no se postergan).' : 'Borrador listo para declaración y pago en SII / TGR (Cód. 048 IUSC y Cód. 151 BHE declarados por separado).'}</div>`}
      </section>

      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Hoja F29 — ${c.name} (${period.label})`, body, { studioName, landscape: false });
  }

  // ---- 3. BORRADOR RENTA / DDJJ (PDF) ----
  function emitirRentaPdf(ctx) {
    const { c, studioName, period, ddjj, accounting } = ctx;
    const balTot = (accounting && accounting.bal && accounting.bal.totales) || {};
    const resultado = (balTot.ganancia || 0) - (balTot.perdida || 0);
    const tasaIdpc = c.regime === '14 A' ? 27 : c.regime === '14 D8' ? 0 : 12.5;
    const idpcEst = resultado > 0 ? Math.round(resultado * (tasaIdpc / 100)) : 0;

    const body = `
      ${docHeader(studioName, 'Borrador Operación Renta y DDJJ', `AT 2027 · Corte ${period.label}`, c.regime)}
      ${clientStrip(c, 'Tasa IDPC Ref.', tasaIdpc ? `${tasaIdpc}%` : '0% (Transparente)')}

      <section class="doc-section">
        <h2 class="doc-section-title">1. Nómina de Declaraciones Juradas Obligatorias (${esc(c.regime)})</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:90px">DDJJ</th><th>Descripción</th><th>Aplicabilidad</th><th>Estado / Respaldo</th></tr></thead>
          <tbody>
            ${ddjj.map(([cod, desc, apl, st]) => `<tr><td class="mono"><strong>${esc(cod)}</strong></td><td>${esc(desc)}</td><td>${esc(apl)}</td><td>${esc(st)}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>

      <section class="doc-section">
        <h2 class="doc-section-title">2. Estimación Preliminar Base Imponible e IDPC</h2>
        <table class="doc-tbl">
          <tbody>
            <tr><td>Ingresos del ejercicio acumulados</td><td class="num">${fmt(balTot.ganancia || 0)}</td></tr>
            <tr><td>Egresos / Gastos aceptados acumulados</td><td class="num">${fmt(balTot.perdida || 0)}</td></tr>
            <tr><td>Resultado preliminar antes de ajustes RLI</td><td class="num"><strong>${fmt(resultado)}</strong></td></tr>
            <tr><td>Impuesto de Primera Categoría estimado (${tasaIdpc}%)</td><td class="num"><strong>${fmt(idpcEst)}</strong></td></tr>
          </tbody>
        </table>
        <div class="doc-note">${c.regime === '14 D3' ? 'Régimen 14 D N° 3 ProPyme General: la base imponible se determina sobre ingresos percibidos y gastos efectivamente pagados (Art. 14 D N° 3 LIR), no solo balance devengado. ' : ''}Borrador referencial basado en contabilidad centralizada al cierre de ${esc(period.label)}. Validar ajustes extracontables (gastos rechazados Art. 21, créditos y RRE) antes de enviar F22 al SII.</div>
      </section>

      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Borrador Renta y DDJJ — ${c.name}`, body, { studioName, landscape: false });
  }

  // ---- 4. LIQUIDACIÓN DE SUELDO (PDF individual o lote) ----
  function renderSingleLiquidacionHtml(ctx, item) {
    const { c, studioName, period } = ctx;
    const { w, calc } = item;
    const d = calc.detalle || {};
    const habImp = d.haberesImponibles || [];
    const habNoImp = d.haberesNoImponibles || [];
    const descs = d.descuentosLegales || [];
    const totHab = habImp.reduce((s, x) => s + (x.monto || 0), 0) + habNoImp.reduce((s, x) => s + (x.monto || 0), 0);
    const totDesc = descs.reduce((s, x) => s + (x.monto || 0), 0);
    const regLabel = w.tipoRegimen === 'socio'
      ? 'Socio · Sueldo Empresarial (Art. 31 N°6 LIR)'
      : w.tipoRegimen === 'pensionado'
        ? 'Pensionado por Vejez (Art. 69 D.L. 3.500)'
        : 'Contrato de Trabajo · Estándar';

    return `
      ${docHeader(studioName, 'Liquidación de Remuneraciones', period.label, w.rut)}
      <div class="doc-client-box">
        <div><span class="doc-kv-label">${w.tipoRegimen === 'socio' ? 'Sociedad / Pagador' : 'Empleador'}</span><span class="doc-kv-val">${esc(c.name)}</span></div>
        <div><span class="doc-kv-label">RUT ${w.tipoRegimen === 'socio' ? 'Sociedad' : 'Empleador'}</span><span class="doc-kv-val mono">${esc(c.rut)}</span></div>
        <div><span class="doc-kv-label">${w.tipoRegimen === 'socio' ? 'Socio Administrador' : 'Trabajador'}</span><span class="doc-kv-val">${esc(w.name)}</span></div>
        <div><span class="doc-kv-label">RUT ${w.tipoRegimen === 'socio' ? 'Socio' : 'Trabajador'}</span><span class="doc-kv-val mono">${esc(w.rut)}</span></div>
        <div><span class="doc-kv-label">Cargo</span><span class="doc-kv-val">${esc(w.cargo || 'No informado')}</span></div>
        <div><span class="doc-kv-label">Fecha Ingreso</span><span class="doc-kv-val mono">${esc(w.ingreso || '—')}</span></div>
        <div><span class="doc-kv-label">AFP / Salud</span><span class="doc-kv-val">${esc(w.afp || '—')} / ${esc(w.salud || 'Fonasa')}</span></div>
        <div><span class="doc-kv-label">Régimen Previsional</span><span class="doc-kv-val">${esc(regLabel)}</span></div>
      </div>

      <div class="doc-two-col">
        <section class="doc-section" style="margin-top:0">
          <h2 class="doc-section-title">Haberes</h2>
          <table class="doc-tbl">
            <thead><tr><th>Concepto</th><th class="num">Monto</th></tr></thead>
            <tbody>
              ${habImp.map((h) => `<tr><td>${esc(h.concepto)}</td><td class="num">${fmt(h.monto)}</td></tr>`).join('')}
              ${habNoImp.map((h) => `<tr><td>${esc(h.concepto)} <span class="muted">(No imp.)</span></td><td class="num">${fmt(h.monto)}</td></tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td>Total Haberes</td><td class="num">${fmt(totHab)}</td></tr>
            </tfoot>
          </table>
        </section>

        <section class="doc-section" style="margin-top:0">
          <h2 class="doc-section-title">Descuentos Legales y Tributarios</h2>
          <table class="doc-tbl">
            <thead><tr><th>Concepto</th><th class="num">Monto</th></tr></thead>
            <tbody>
              ${descs.length ? descs.map((x) => `<tr><td>${esc(x.concepto)}</td><td class="num">${fmt(x.monto)}</td></tr>`).join('') : '<tr><td class="muted">Sin descuentos en el período</td><td class="num">$0</td></tr>'}
            </tbody>
            <tfoot>
              <tr><td>Total Descuentos</td><td class="num">${fmt(totDesc)}</td></tr>
            </tfoot>
          </table>
        </section>
      </div>

      <section class="doc-section">
        <table class="doc-tbl">
          <tbody>
            <tr><td>Total Imponible / Tributable</td><td class="num">${fmt(calc.imponible)}</td><td>Aportes Empleador (Informativo)</td><td class="num">${fmt(calc.costoEmpleador)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="3"><strong>ALCANCE LÍQUIDO A PAGAR AL TRABAJADOR</strong></td><td class="num" style="font-size:13px">${fmt(calc.liquido)}</td></tr>
          </tfoot>
        </table>
        ${w.tipoRegimen === 'socio' ? `<div class="doc-note">Sueldo empresarial (Art. 31 N° 6 LIR): liquidación afecta a Impuesto Único de Segunda Categoría (F29 Cód. 048 · LRE 2161/3161). Sin cotizaciones patronales obligatorias ni derecho a finiquito laboral.</div>` : ''}
        ${w.tipoRegimen === 'pensionado' ? `<div class="doc-note">Pensionado por vejez (Art. 69 y 16 D.L. 3.500): exento de cotización AFP, Seguro de Cesantía (AFC), SIS y aporte Ley 21.735; mantiene cotización de Salud (tope 90 UF menos pensión) y aporte empleador Mutual + SANNA (Ley 16.744). La exención o cotización voluntaria AFP exige respaldo escrito del trabajador.</div>` : ''}
      </section>

      <p class="doc-legal-p">Comprobante de pago de remuneraciones emitido conforme al Art. 54 inc. 3° del Código del Trabajo. Declaro haber recibido el saldo líquido indicado correspondiente al período <strong>${esc(period.label)}</strong>. La firma de este comprobante acredita únicamente la recepción del pago y no constituye renuncia de derechos laborales (Art. 5° inc. 2° CT).</p>

      <div class="doc-signs">
        <div class="doc-sign-box"><strong>${esc(w.name)}</strong>RUT ${esc(w.rut)} · Firma ${w.tipoRegimen === 'socio' ? 'Socio' : 'Trabajador'}</div>
        <div class="doc-sign-box"><strong>${esc(c.name)}</strong>RUT ${esc(c.rut)} · Firma y Timbre ${w.tipoRegimen === 'socio' ? 'Sociedad' : 'Empleador'}</div>
      </div>
      ${docFooter(studioName, c)}
    `;
  }

  function emitirLiquidacionPdf(ctx, item) {
    return openPrintable(`Liquidación ${item.w.name} (${ctx.period.label})`, renderSingleLiquidacionHtml(ctx, item), { studioName: ctx.studioName, landscape: false });
  }

  function emitirLiquidacionesLotePdf(ctx) {
    const pages = ctx.workersCalc.map((item, idx) =>
      `<div class="${idx > 0 ? 'doc-page-break' : ''}">${renderSingleLiquidacionHtml(ctx, item)}</div>`
    ).join('');
    return openPrintable(`Liquidaciones ${ctx.c.name} (${ctx.period.label})`, pages, { studioName: ctx.studioName, landscape: false });
  }

  // ---- 5. FINIQUITO DE CONTRATO DE TRABAJO (PDF) ----
  function emitirFiniquitoPdf(ctx, finRow) {
    const { c, studioName, period, cause, uf } = ctx;
    const w = finRow.w;
    const f = finRow.fin;
    const eco = f.economics || {};
    const causalTxt = cause === '161'
      ? 'Artículo 161 inciso 1° del Código del Trabajo (Necesidades de la empresa)'
      : cause === '159'
        ? 'Artículo 159 del Código del Trabajo (N° 1 Mutuo acuerdo, N° 2 Renuncia, N° 4 Vencimiento de plazo o N° 5 Conclusión de obra/faena)'
        : 'Artículo 160 del Código del Trabajo (Causal sin derecho a indemnización)';

    const body = `
      ${docHeader(studioName, 'Finiquito de Contrato de Trabajo', period.label, `Art. ${cause} CT`)}
      ${clientStrip(c, 'Causal Legal', `Art. ${cause} CT`)}

      <p class="doc-legal-p">En Chile, a ${hoyChile()}, entre <strong>${esc(c.name)}</strong>, RUT <strong>${esc(c.rut)}</strong>, en adelante «el Empleador», y don/doña <strong>${esc(w.name)}</strong>, RUT <strong>${esc(w.rut)}</strong>, cargo <strong>${esc(w.cargo || 'Trabajador')}</strong>, en adelante «el Trabajador», se conviene el presente Finiquito de Contrato de Trabajo:</p>

      <p class="doc-legal-p"><strong>PRIMERO:</strong> El Trabajador prestó servicios al Empleador desde el <strong>${esc(w.ingreso || '—')}</strong> hasta el término del período <strong>${esc(period.label)}</strong> (${eco.years || 0} año(s) de servicio computados), concluyendo la relación laboral por aplicación de la causal establecida en el <strong>${esc(causalTxt)}</strong>.</p>

      <section class="doc-section">
        <h2 class="doc-section-title">SEGUNDO: Liquidación de Haberes e Indemnizaciones del Finiquito</h2>
        <table class="doc-tbl">
          <thead><tr><th>Concepto</th><th>Referencia Legal / Cálculo</th><th class="num">Monto CLP</th></tr></thead>
          <tbody>
            <tr><td>Indemnización por Años de Servicio (IAS)</td><td class="muted">${eco.years || 0} año(s) · Tope legal 11 años / 330 días (Art. 163 inc. 2° CT)${eco.isCapped ? ` y 90 UF (UF ${fmt(uf)})` : ''}</td><td class="num">${fmt(eco.ias || 0)}</td></tr>
            <tr><td>Indemnización Sustitutiva del Aviso Previo</td><td class="muted">${cause === '161' ? 'Art. 161 / 162 CT' : 'No aplica a causal'}</td><td class="num">${fmt(eco.aviso || 0)}</td></tr>
            <tr><td>Feriado Proporcional y/o Pendiente</td><td class="muted">Art. 73 del Código del Trabajo</td><td class="num">${fmt(eco.vacaciones || 0)}</td></tr>
            ${eco.afcDesc ? `<tr><td>Descuento aporte empleador Seguro de Cesantía (AFC)</td><td class="muted">Art. 13 Ley 19.728 (solo causal Art. 161 CT)</td><td class="num">−${fmt(eco.afcDesc)}</td></tr>` : ''}
          </tbody>
          <tfoot>
            <tr><td colspan="2"><strong>TOTAL LÍQUIDO A PAGAR POR FINIQUITO</strong></td><td class="num" style="font-size:13px">${fmt(eco.total || 0)}</td></tr>
          </tfoot>
        </table>
        ${c.nomina.leyBustos ? `<div class="doc-note is-warn"><strong>ALERTA LEY BUSTOS (Art. 162 inc. 5° CT):</strong> La empresa registra cotizaciones previsionales impagas. Regularizar PreviRed/AFC y adjuntar certificados de pago antes de ratificar este finiquito ante Ministro de Fe.</div>` : `<div class="doc-note">Adjuntar certificados de pago de cotizaciones previsionales y de cesantía al día (Art. 162 inc. 5° CT). Plazo legal para otorgar y poner el pago a disposición del trabajador: <strong>10 días hábiles</strong> desde la separación (Art. 177 inc. 1° CT).</div>`}
      </section>

      <p class="doc-legal-p"><strong>TERCERO (Poder liberatorio y reserva):</strong> El Trabajador declara recibir en este acto la suma total de <strong>${fmt(eco.total || 0)}</strong> a su entera satisfacción, otorgando el más amplio y completo finiquito respecto de la relación laboral que los unió, sin perjuicio del derecho que le asiste para estampar reserva de derechos de puño y letra al momento de ratificar ante Ministro de Fe conforme al artículo 177 del Código del Trabajo.</p>

      <div class="doc-signs">
        <div class="doc-sign-box"><strong>${esc(w.name)}</strong>RUT ${esc(w.rut)} · Firma Trabajador</div>
        <div class="doc-sign-box"><strong>${esc(c.name)}</strong>RUT ${esc(c.rut)} · Firma Empleador</div>
      </div>
      <div style="margin-top:26px;text-align:center;">
        <div class="doc-sign-box" style="max-width:260px;margin:0 auto;"><strong>Ministro de Fe</strong>Notario Público / Inspector del Trabajo (Art. 177 CT)</div>
      </div>
      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Finiquito — ${w.name}`, body, { studioName, landscape: false });
  }

  // ---- 6. BALANCE 8 COLUMNAS (PDF A4 HORIZONTAL) ----
  function emitirBalancePdf(ctx) {
    const { c, studioName, period, scope, accounting } = ctx;
    const filas = (accounting && accounting.bal && accounting.bal.filas) || [];
    const t = (accounting && accounting.bal && accounting.bal.totales) || {};
    const utilidad = Math.max(0, (t.ganancia || 0) - (t.perdida || 0));
    const perdidaEj = Math.max(0, (t.perdida || 0) - (t.ganancia || 0));
    const sumAct = (t.activo || 0) + perdidaEj;
    const sumPas = (t.pasivo || 0) + utilidad;
    const sumPer = (t.perdida || 0) + utilidad;
    const sumGan = (t.ganancia || 0) + perdidaEj;

    const body = `
      ${docHeader(studioName, 'Balance Tributario de 8 Columnas', scope === 'mes' ? period.label : `Acumulado al ${period.label}`, c.regime)}
      ${clientStrip(c, 'Alcance', scope === 'mes' ? `Movimientos ${period.label}` : 'Acumulado Ejercicio')}

      <table class="doc-tbl">
        <thead>
          <tr>
            <th style="width:62px">Código</th>
            <th>Cuenta Contable</th>
            <th class="num">Débitos</th>
            <th class="num">Créditos</th>
            <th class="num">Deudor</th>
            <th class="num">Acreedor</th>
            <th class="num">Activo</th>
            <th class="num">Pasivo</th>
            <th class="num">Pérdida</th>
            <th class="num">Ganancia</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((f) => `
            <tr>
              <td class="mono">${esc(f.codigo)}</td>
              <td>${esc(f.nombre)}</td>
              <td class="num">${f.debito ? fmt(f.debito) : '—'}</td>
              <td class="num">${f.credito ? fmt(f.credito) : '—'}</td>
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
            <td colspan="2">Sumas parciales (${filas.length} cuentas · ${(accounting.asientos || []).length} asientos)</td>
            <td class="num">${fmt(t.debito || 0)}</td>
            <td class="num">${fmt(t.credito || 0)}</td>
            <td class="num">${fmt(t.deudor || 0)}</td>
            <td class="num">${fmt(t.acreedor || 0)}</td>
            <td class="num">${fmt(t.activo || 0)}</td>
            <td class="num">${fmt(t.pasivo || 0)}</td>
            <td class="num">${fmt(t.perdida || 0)}</td>
            <td class="num">${fmt(t.ganancia || 0)}</td>
          </tr>
          <tr>
            <td colspan="6">${utilidad >= perdidaEj ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio'}</td>
            <td class="num">${perdidaEj ? fmt(perdidaEj) : '—'}</td>
            <td class="num">${utilidad ? fmt(utilidad) : '—'}</td>
            <td class="num">${utilidad ? fmt(utilidad) : '—'}</td>
            <td class="num">${perdidaEj ? fmt(perdidaEj) : '—'}</td>
          </tr>
          <tr>
            <td colspan="2">SUMAS IGUALES</td>
            <td class="num">${fmt(t.debito || 0)}</td>
            <td class="num">${fmt(t.credito || 0)}</td>
            <td class="num">${fmt(t.deudor || 0)}</td>
            <td class="num">${fmt(t.acreedor || 0)}</td>
            <td class="num">${fmt(sumAct)}</td>
            <td class="num">${fmt(sumPas)}</td>
            <td class="num">${fmt(sumPer)}</td>
            <td class="num">${fmt(sumGan)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="doc-signs">
        <div class="doc-sign-box"><strong>Representante Legal</strong>${esc(c.name)} · RUT ${esc(c.rut)}</div>
        <div class="doc-sign-box"><strong>Contador General</strong>${esc(studioName)}</div>
      </div>
      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Balance 8 Columnas — ${c.name} (${period.label})`, body, { studioName, landscape: true });
  }

  // ---- 7b. ESTADO DE RESULTADOS P&L (PDF) ----
  function emitirResultadosPdf(ctx) {
    const { c, studioName, period, scope, accounting } = ctx;
    const filas = (accounting && accounting.bal && accounting.bal.filas) || [];
    const ingresos = filas.filter((f) => (f.ganancia || 0) > 0);
    const gastos = filas.filter((f) => (f.perdida || 0) > 0);
    const totIng = ingresos.reduce((s, f) => s + (f.ganancia || 0), 0);
    const totGas = gastos.reduce((s, f) => s + (f.perdida || 0), 0);
    const res = totIng - totGas;
    const margen = totIng > 0 ? ((res / totIng) * 100).toFixed(1).replace('.', ',') : '0,0';
    const tasaIdpc = c.regime === '14 A' ? 27 : c.regime === '14 D8' ? 0 : 12.5;
    const idpc = res > 0 ? Math.round(res * (tasaIdpc / 100)) : 0;

    const body = `
      ${docHeader(studioName, 'Estado de Resultados (P&L)', scope === 'mes' ? period.label : `Acumulado al ${period.label}`, c.regime)}
      ${clientStrip(c, 'Margen Neto', `${margen}%`)}

      <div class="doc-kpis">
        <div class="doc-kpi"><div class="doc-kpi-l">Total Ingresos</div><div class="doc-kpi-v">${fmt(totIng)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">Total Costos y Gastos</div><div class="doc-kpi-v">${fmt(totGas)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">Resultado antes IDPC</div><div class="doc-kpi-v is-accent">${fmt(res)}</div></div>
        <div class="doc-kpi"><div class="doc-kpi-l">IDPC Est. (${tasaIdpc}%)</div><div class="doc-kpi-v">${fmt(idpc)}</div></div>
      </div>

      <section class="doc-section">
        <h2 class="doc-section-title">1. Ingresos del Período</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:70px">Código</th><th>Cuenta de Ingreso</th><th class="num">Monto CLP</th></tr></thead>
          <tbody>
            ${ingresos.length ? ingresos.map((f) => `<tr><td class="mono">${esc(f.codigo)}</td><td>${esc(f.nombre)}</td><td class="num">${fmt(f.ganancia)}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Sin ingresos registrados en el período.</td></tr>'}
          </tbody>
          <tfoot><tr><td colspan="2">Total Ingresos</td><td class="num">${fmt(totIng)}</td></tr></tfoot>
        </table>
      </section>

      <section class="doc-section">
        <h2 class="doc-section-title">2. Costos y Gastos Operacionales</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:70px">Código</th><th>Cuenta de Gasto / Costo</th><th class="num">Monto CLP</th></tr></thead>
          <tbody>
            ${gastos.length ? gastos.map((f) => `<tr><td class="mono">${esc(f.codigo)}</td><td>${esc(f.nombre)}</td><td class="num">${fmt(f.perdida)}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Sin gastos registrados en el período.</td></tr>'}
          </tbody>
          <tfoot>
            <tr><td colspan="2">Total Costos y Gastos</td><td class="num">${fmt(totGas)}</td></tr>
            <tr><td colspan="2"><strong>${res >= 0 ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO'} (Margen ${margen}%)</strong></td><td class="num" style="font-size:13px">${fmt(res)}</td></tr>
          </tfoot>
        </table>
      </section>

      <div class="doc-signs">
        <div class="doc-sign-box"><strong>Representante Legal</strong>${esc(c.name)} · RUT ${esc(c.rut)}</div>
        <div class="doc-sign-box"><strong>Contador General</strong>${esc(studioName)}</div>
      </div>
      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Estado de Resultados — ${c.name} (${period.label})`, body, { studioName, landscape: false });
  }

  // ---- 7. CONCILIACIÓN BANCARIA (PDF) ----
  function emitirBancosPdf(ctx) {
    const { c, studioName, period, bankSummary } = ctx;
    const txs = c.bankTx || [];
    const body = `
      ${docHeader(studioName, 'Informe de Conciliación Bancaria', period.label, `${bankSummary.pct}% conciliado`)}
      ${clientStrip(c, 'Avance Conciliación', `${bankSummary.matched} / ${bankSummary.total} (${bankSummary.pct}%)`)}

      <section class="doc-section">
        <h2 class="doc-section-title">Movimientos de Cartola Bancaria</h2>
        <table class="doc-tbl">
          <thead><tr><th style="width:58px">Fecha</th><th>Glosa Bancaria</th><th>Documento / Cuenta Vinculada</th><th>Estado</th><th class="num">Monto</th></tr></thead>
          <tbody>
            ${txs.length ? txs.map((tx) => `
              <tr>
                <td class="mono">${esc(tx.date)}</td>
                <td>${esc(tx.desc)}</td>
                <td class="muted">${esc(tx.matchDoc || 'Por clasificar')}</td>
                <td>${esc(tx.status)}</td>
                <td class="num">${fmt(tx.amount)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="muted">Sin movimientos cargados en el período.</td></tr>'}
          </tbody>
          <tfoot>
            <tr><td colspan="4">Flujo neto de cartola (${txs.length} movimientos)</td><td class="num">${fmt(txs.reduce((s, x) => s + (x.amount || 0), 0))}</td></tr>
          </tfoot>
        </table>
      </section>
      ${docFooter(studioName, c)}
    `;
    return openPrintable(`Conciliación Bancaria — ${c.name} (${period.label})`, body, { studioName, landscape: false });
  }

  // ==================== EXPORTACIONES EXCEL (.xlsx OOXML) ====================
  function downloadXlsxSafe(filename, hojas, fallbackDownload) {
    if (window.CLPymeExcel && typeof window.CLPymeExcel.descargarXlsx === 'function') {
      return window.CLPymeExcel.descargarXlsx(filename, hojas);
    }
    // Fallback CSV si el módulo Excel no estuviera cargado
    const first = hojas[0] || { filas: [] };
    const csv = '\uFEFF' + (first.filas || []).map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    fallbackDownload(csv, filename.replace(/\.xlsx$/i, '.csv'), 'text/csv;charset=utf-8');
    return Promise.resolve();
  }

  function buildBalanceSheetRows(c, period, scope, accounting) {
    const filas = (accounting && accounting.bal && accounting.bal.filas) || [];
    const t = (accounting && accounting.bal && accounting.bal.totales) || {};
    const utilidad = Math.max(0, (t.ganancia || 0) - (t.perdida || 0));
    const perdidaEj = Math.max(0, (t.perdida || 0) - (t.ganancia || 0));
    return [
      [`BALANCE TRIBUTARIO DE 8 COLUMNAS — ${c.name} (${c.rut})`],
      [`Período: ${scope === 'mes' ? period.label : 'Acumulado al ' + period.label} · Régimen: ${c.regime}`],
      [],
      ['Código', 'Cuenta Contable', 'Débitos', 'Créditos', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Pérdida', 'Ganancia'],
      ...filas.map((f) => [f.codigo, f.nombre, f.debito || 0, f.credito || 0, f.deudor || 0, f.acreedor || 0, f.activo || 0, f.pasivo || 0, f.perdida || 0, f.ganancia || 0]),
      ['', 'SUMAS PARCIALES', t.debito || 0, t.credito || 0, t.deudor || 0, t.acreedor || 0, t.activo || 0, t.pasivo || 0, t.perdida || 0, t.ganancia || 0],
      ['', utilidad >= perdidaEj ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO', 0, 0, 0, 0, perdidaEj, utilidad, utilidad, perdidaEj],
      ['', 'SUMAS IGUALES', t.debito || 0, t.credito || 0, t.deudor || 0, t.acreedor || 0, (t.activo || 0) + perdidaEj, (t.pasivo || 0) + utilidad, (t.perdida || 0) + utilidad, (t.ganancia || 0) + perdidaEj]
    ];
  }

  function emitirPaqueteMensualExcel(ctx, fallbackDownload) {
    const { c, studioName, period, f29Rows, f29Total, f29StateLabel, workersCalc, accounting } = ctx;
    const hojas = [
      {
        nombre: 'Resumen',
        filas: [
          [`PAQUETE MENSUAL EJECUTIVO — ${c.name}`],
          [`RUT: ${c.rut} · Régimen: ${c.regime} · Período: ${period.label} · Estudio: ${studioName}`],
          [],
          ['Indicador', 'Valor', 'Estado / Detalle'],
          ['Ventas Netas RCV', c.rcv.ventasNeto || 0, c.rcv.label],
          ['Compras Netas RCV', c.rcv.comprasNeto || 0, `${c.rcv.pendingAcuses || 0} acuses pendientes`],
          ['F29 a Pagar (Cód. 091)', f29Total || 0, `${f29StateLabel}${c.f29.folio ? ' · Folio ' + c.f29.folio : ''}`],
          ['Líquidos Nómina', workersCalc.reduce((s, x) => s + (x.calc.liquido || 0), 0), `${workersCalc.length} personas`],
          ['Aportes Empleador', workersCalc.reduce((s, x) => s + (x.calc.costoEmpleador || 0), 0), c.nomina.label]
        ],
        formatoMonedaCols: [1]
      },
      {
        nombre: 'Hoja F29',
        filas: [
          [`HOJA DE TRABAJO F29 — ${c.name} (${period.label})`],
          [],
          ['Código SII', 'Concepto', 'Fuente', 'Monto CLP'],
          ...f29Rows.map((r) => [r.cod, r.label, r.source || '', r.val || 0]),
          ['091', 'TOTAL A PAGAR F29', f29StateLabel, f29Total || 0]
        ],
        formatoMonedaCols: [3]
      },
      {
        nombre: 'Nomina',
        filas: [
          [`NÓMINA DE REMUNERACIONES — ${c.name} (${period.label})`],
          [],
          ['RUT', 'Trabajador', 'Cargo', 'Régimen', 'Sueldo Base', 'Imponible', 'Líquido a Pagar', 'Aporte Empleador'],
          ...workersCalc.map(({ w, calc }) => [w.rut, w.name, w.cargo || '', w.tipoRegimen || 'estandar', w.base || 0, calc.imponible || 0, calc.liquido || 0, calc.costoEmpleador || 0])
        ],
        formatoMonedaCols: [4, 5, 6, 7]
      },
      {
        nombre: 'Balance 8 Col',
        filas: buildBalanceSheetRows(c, period, 'acumulado', accounting),
        formatoMonedaCols: [2, 3, 4, 5, 6, 7, 8, 9]
      }
    ];
    return downloadXlsxSafe(`Paquete_Mensual_${slug(c.id)}_${period.iso}.xlsx`, hojas, fallbackDownload);
  }

  function emitirF29Excel(ctx, fallbackDownload) {
    const { c, period, f29Rows, f29Total, f29StateLabel } = ctx;
    const hojas = [
      {
        nombre: 'Hoja F29',
        filas: [
          [`FORMULARIO 29 — ${c.name} (${c.rut})`],
          [`Período: ${period.label} · Estado: ${f29StateLabel}${c.f29.folio ? ' · Folio SII: ' + c.f29.folio : ''}`],
          [],
          ['Código SII', 'Concepto', 'Origen / Respaldo', 'Monto CLP'],
          ...f29Rows.map((r) => [r.cod, r.label, r.source || '', r.val || 0]),
          ['091', 'TOTAL A PAGAR F29', f29StateLabel, f29Total || 0]
        ],
        formatoMonedaCols: [3]
      }
    ];
    return downloadXlsxSafe(`F29_${slug(c.id)}_${period.iso}.xlsx`, hojas, fallbackDownload);
  }

  function emitirFiniquitosExcel(ctx, finRows, fallbackDownload) {
    const { c, period, cause } = ctx;
    const hojas = [
      {
        nombre: 'Lote Finiquitos',
        filas: [
          [`LOTE DE FINIQUITOS — ${c.name} (${c.rut})`],
          [`Período: ${period.label} · Causal simulada: Art. ${cause} CT`],
          [],
          ['RUT', 'Trabajador', 'Ingreso', 'Años', 'Causal', 'IAS', 'Aviso Previo', 'Vacaciones', 'Total Finiquito', 'Observación'],
          ...finRows.map(({ w, fin }) => {
            const e = (fin && fin.economics) || {};
            const isSocio = w.tipoRegimen === 'socio';
            return [w.rut, w.name, w.ingreso || '', isSocio ? 0 : (e.years || 0), isSocio ? 'Bloqueado (Socio)' : `Art. ${cause}`, isSocio ? 0 : (e.ias || 0), isSocio ? 0 : (e.aviso || 0), isSocio ? 0 : (e.vacaciones || 0), isSocio ? 0 : (e.total || 0), isSocio ? 'Art. 31 N°6 LIR' : (e.isCapped ? 'Tope 90 UF' : 'OK')];
          })
        ],
        formatoMonedaCols: [5, 6, 7, 8]
      }
    ];
    return downloadXlsxSafe(`Finiquitos_${slug(c.id)}_${period.iso}.xlsx`, hojas, fallbackDownload);
  }

  function emitirContabilidadExcel(ctx, fallbackDownload) {
    const { c, period, scope, accounting } = ctx;
    const asientos = (accounting && accounting.asientos) || [];
    const mayor = (accounting && accounting.mayor) || [];
    const diarioRows = [
      [`LIBRO DIARIO CENTRALIZADO — ${c.name} (${c.rut})`],
      [`Período: ${period.label}`],
      [],
      ['Asiento', 'Fecha', 'Código', 'Cuenta', 'Glosa', 'Debe', 'Haber']
    ];
    asientos.forEach((a) => {
      (a.lineas || []).forEach((l) => {
        diarioRows.push([a.id, a.fecha, l.codigo || '', l.cuenta || l.nombre || '', a.glosa || '', l.debe || 0, l.haber || 0]);
      });
    });
    const mayorRows = [
      [`LIBRO MAYOR — ${c.name} (${c.rut})`],
      [`Período: ${period.label}`],
      [],
      ['Código', 'Cuenta', 'Total Débitos', 'Total Créditos', 'Saldo Deudor', 'Saldo Acreedor'],
      ...mayor.map((m) => [m.codigo, m.nombre, m.debito || 0, m.credito || 0, Math.max(0, (m.debito || 0) - (m.credito || 0)), Math.max(0, (m.credito || 0) - (m.debito || 0))])
    ];
    const hojas = [
      { nombre: 'Balance 8 Col', filas: buildBalanceSheetRows(c, period, scope, accounting), formatoMonedaCols: [2, 3, 4, 5, 6, 7, 8, 9] },
      { nombre: 'Libro Diario', filas: diarioRows, formatoMonedaCols: [5, 6] },
      { nombre: 'Libro Mayor', filas: mayorRows, formatoMonedaCols: [2, 3, 4, 5] }
    ];
    return downloadXlsxSafe(`Contabilidad_${slug(c.id)}_${period.iso}.xlsx`, hojas, fallbackDownload);
  }

  function emitirBancosExcel(ctx, auxDocs, fallbackDownload) {
    const { c, period } = ctx;
    const txs = c.bankTx || [];
    const hojas = [
      {
        nombre: 'Conciliacion',
        filas: [
          [`CONCILIACIÓN BANCARIA — ${c.name} (${c.rut})`],
          [`Período: ${period.label}`],
          [],
          ['Fecha', 'Glosa', 'Documento Vinculado', 'Estado', 'Monto CLP'],
          ...txs.map((tx) => [tx.date, tx.desc, tx.matchDoc || 'Sin vincular', tx.status, tx.amount || 0])
        ],
        formatoMonedaCols: [4]
      },
      {
        nombre: 'Auxiliar CxC CxP',
        filas: [
          [`AUXILIAR CXC / CXP POR ANTIGÜEDAD — ${c.name}`],
          [],
          ['Tipo', 'Folio', 'Contraparte', 'RUT', 'Emisión', 'Días atraso', 'Estado', 'Monto CLP'],
          ...(auxDocs || []).map((a) => [a.kind === 'cxc' ? 'Por Cobrar (CxC)' : 'Por Pagar (CxP)', a.folio, a.party, a.rut, a.issued, a.days || 0, a.status, a.amount || 0])
        ],
        formatoMonedaCols: [7]
      }
    ];
    return downloadXlsxSafe(`Bancos_Auxiliar_${slug(c.id)}_${period.iso}.xlsx`, hojas, fallbackDownload);
  }

  window.CLSuiteV2Docs = {
    emitirPaqueteMensualPdf,
    emitirPaqueteMensualExcel,
    emitirF29Pdf,
    emitirF29Excel,
    emitirRentaPdf,
    emitirLiquidacionPdf,
    emitirLiquidacionesLotePdf,
    emitirFiniquitoPdf,
    emitirFiniquitosExcel,
    emitirBalancePdf,
    emitirResultadosPdf,
    emitirContabilidadExcel,
    emitirBancosPdf,
    emitirBancosExcel
  };
})();
