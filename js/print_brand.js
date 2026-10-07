/*
 * CalculoLaboral · identidad de los informes imprimibles (PDF)
 * Un solo lenguaje para todos los informes: logo oficial (caja verde bosque
 * e isotipo ambar), tipografia Geist / Geist Mono, filetes finos y una hoja A4.
 * Uso: CLPrint.css() dentro de un <style>, y los helpers para cada bloque.
 */
(function () {
    'use strict';

    var ISOTIPO = '<path d="M30 84h40M38 79h24"/><path d="M50 22v57"/><path d="M50 14l-2 4h4l-2-4v8"/>' +
        '<path d="M18 36c10-9 22-12 32-12s22 3 32 12"/><path d="M18 36l-8 18h16Z"/><path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"/>' +
        '<path d="M82 36l-8 18h16Z"/><path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"/><path d="M41 43.5a10 10 0 1 0 0 20h6"/><path d="M58 43.5v20h10"/>';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function css() {
        return [
            '@page { size: A4; margin: 13mm 14mm 12mm; }',
            '.clr { font-family: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; font-size: 9pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; zoom: 0.93; }',
            '.clr *, .clr *::before, .clr *::after { box-sizing: border-box; }',
            '.clr .mono { font-family: "Geist Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }',
            /* Encabezado */
            '.clr-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 9pt; border-bottom: 1.5pt solid #00382E; margin-bottom: 11pt; }',
            '.clr-brand { display: flex; align-items: center; gap: 8pt; }',
            '.clr-logo { width: 26pt; height: 26pt; border-radius: 7pt; background: #00382E; display: flex; align-items: center; justify-content: center; }',
            '.clr-logo svg { width: 16pt; height: 16pt; }',
            '.clr-word { font-size: 13pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }',
            '.clr-word span { color: #00382E; }',
            '.clr-tag { font-size: 7.5pt; color: #4B5563; margin-top: 2pt; }',
            '.clr-docmeta { text-align: right; font-size: 7.5pt; color: #4B5563; line-height: 1.5; }',
            '.clr-doctype { font-size: 8pt; font-weight: 700; color: #00382E; }',
            /* Titulo */
            '.clr-title { font-size: 14pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin: 0; }',
            '.clr-sub { font-size: 8.5pt; color: #4B5563; margin: 3pt 0 0; }',
            '.clr-cite { font-size: 7.5pt; color: #064A3E; margin: 5pt 0 0; }',
            '.clr-cite::before { content: ""; display: inline-block; width: 14pt; height: 1.5pt; background: #FFB703; vertical-align: middle; margin-right: 5pt; }',
            '.clr-ind { display: flex; gap: 14pt; margin: 9pt 0 12pt; font-size: 7.5pt; color: #4B5563; }',
            '.clr-ind b { color: #111827; font-weight: 600; }',
            /* Secciones y tablas */
            '.clr-sec { margin-top: 11pt; }',
            '.clr-h { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #00382E; padding-bottom: 3pt; border-bottom: 0.75pt solid #ADD6C9; margin: 0 0 2pt; }',
            '.clr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; }',
            '.clr-t { width: 100%; border-collapse: collapse; }',
            '.clr-t td, .clr-t th { padding: 3.6pt 0; border-bottom: 0.5pt solid #E5E7EB; vertical-align: top; }',
            '.clr-t th { font-size: 7pt; font-weight: 600; color: #6B7280; text-align: left; }',
            '.clr-t .k { color: #4B5563; }',
            '.clr-t .v { text-align: right; font-family: "Geist Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; padding-left: 10pt; }',
            '.clr-t .n { display: block; font-size: 7.3pt; color: #6B7280; margin-top: 1pt; }',
            '.clr-t .neg { color: #B91C1C; }',
            '.clr-t tr.sum td { border-bottom: 0; border-top: 0.75pt solid #111827; font-weight: 700; padding-top: 5pt; }',
            /* Total: trazo de resaltador ambar, el mismo gesto del sitio */
            '.clr-total { display: flex; justify-content: space-between; align-items: center; margin-top: 12pt; padding: 10pt 12pt; border: 1pt solid #00382E; border-radius: 6pt; }',
            '.clr-total .lbl { font-size: 9.5pt; font-weight: 700; }',
            '.clr-total .lbl small { display: block; font-size: 7.3pt; font-weight: 400; color: #4B5563; margin-top: 1pt; }',
            '.clr-total .amt { font-family: "Geist Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; font-size: 19pt; font-weight: 700; color: #00382E; padding: 0 3pt; background: linear-gradient(transparent 58%, rgba(255,183,3,0.55) 58%, rgba(255,183,3,0.55) 92%, transparent 92%); }',
            '.clr-flags { display: flex; flex-wrap: wrap; gap: 4pt 12pt; margin-top: 6pt; font-size: 7.3pt; color: #4B5563; }',
            '.clr-flags .off { color: #9CA3AF; text-decoration: line-through; }',
            /* Notas */
            '.clr-note { margin-top: 10pt; padding: 7pt 9pt; border: 0.75pt solid #FDE68A; background: #FFFBEB; border-radius: 5pt; font-size: 7.8pt; color: #78350F; }',
            '.clr-note b.t { display: block; font-size: 7.6pt; color: #92400E; margin-bottom: 2pt; }',
            '.clr-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; margin-top: 9pt; font-size: 7.5pt; color: #4B5563; }',
            '.clr-steps b { color: #111827; }',
            '.clr-sponsor { margin-top: 10pt; padding-top: 7pt; border-top: 0.5pt dashed #D1D5DB; font-size: 7.3pt; color: #4B5563; break-inside: avoid; }',
            '.clr-sponsor b { color: #111827; }',
            '.clr-sponsor .clr-sp-txt { margin-bottom: 4pt; }',
            '.clr-sponsor .clr-sp-banner { display: block; }',
            '.clr-sponsor .clr-sp-banner img { display: block; width: 100%; height: auto; border: 0.5pt solid #E5E7EB; border-radius: 4pt; }',
            '.clr-sponsor .clr-sp-alt { display: flex; align-items: center; gap: 10pt; padding: 8pt 11pt; border: 0.75pt solid #E5E7EB; border-radius: 4pt; font-size: 8.5pt; color: #111827; }',
            '.clr-sponsor .clr-sp-alt b { font-size: 13pt; font-weight: 800; letter-spacing: -0.03em; color: #111827; }',
            '.clr-sponsor .clr-sp-alt span { flex: 1; }',
            '.clr-sponsor .clr-sp-alt em { font-style: normal; font-weight: 700; color: #00382E; white-space: nowrap; }',
            '.clr-sponsor .url { display: block; margin-top: 3pt; text-align: right; font-family: "Geist Mono", ui-monospace, monospace; color: #00382E; text-decoration: underline; }',
            '.clr-foot { margin-top: 10pt; padding-top: 6pt; border-top: 0.5pt solid #E5E7EB; font-size: 7pt; color: #6B7280; line-height: 1.4; }',
            '.clr-foot .brand { color: #00382E; font-weight: 600; }'
        ].join('\n');
    }

    function header(opts) {
        return '<header class="clr-head">' +
            '<div class="clr-brand">' +
            '<div class="clr-logo"><svg viewBox="0 0 100 100" fill="none" stroke="#FFB703" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' + ISOTIPO + '</svg></div>' +
            '<div><div class="clr-word">Cálculo<span>Laboral</span></div><div class="clr-tag">Herramientas laborales para Chile · calculolaboral.cl</div></div>' +
            '</div>' +
            '<div class="clr-docmeta"><div class="clr-doctype">' + esc(opts.doctype) + '</div>' +
            '<div>Emitido el ' + esc(opts.date) + '</div>' +
            (opts.folio ? '<div class="mono">Folio ' + esc(opts.folio) + '</div>' : '') +
            '</div></header>';
    }

    function folio(prefix) {
        var d = new Date();
        var day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        return prefix + '-' + day + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    }

    window.CLPrint = { css: css, header: header, folio: folio, esc: esc, isotipo: ISOTIPO };
})();
