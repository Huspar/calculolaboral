# Plan de cambios pendientes y batería de pruebas — Cálculo Laboral (`calculolaboral.cl`)

**Fecha de corte:** 13 de noviembre de 2026  
**Estado:** Olas 1, 2, 3 y 4 implementadas y verificadas en código; pendiente solo lo que requiere **revisión de abogado** o **empresa real / credenciales externas / portales terceros**.

---

## 1. Qué ya quedó resuelto y verificado en código

### Olas 1–3 (ya en `origin/main` en `26fbfef`)
- [x] **Indicadores y cálculos críticos:** UTM noviembre (`$72.440`) y respaldo diciembre (`$72.802`), parámetros 2027 base preparados (`js/liquidacion_parametros.js`, `js/constants.js`), tope de 90 UF con UF del último día del mes anterior al pago (art. 172 CT), F29 con notas de crédito con signo negativo (`538`/`537`), `calculadora-costo-empresa-chile.html` actualizada a cotización adicional empleador `3,5%` (Ley 21.735), `que-hacer-si-no-te-pagan-el-finiquito.html` con recargos art. 168 correctos (`30%, 50%, 80% o 100%`).
- [x] **Portada y B2B:** tarjeta #15 **Finiquito Casa Particular** (`finiquito-trabajadora-casa-particular-chile.html`), guías de cierre (`aguinaldo-navidad-cierre-laboral-diciembre-2026.html`, `checklist-ley-21719-1-diciembre-2026.html`), puente `#estudios-contables` en `para-empleadores.html`, nota editable Ley 21.850 en `#f29-tasa-ppm` (`demo-contadores.html`), GA4 en `/app` sin exposición de UUIDs (`js/app_pyme.js`) y evento `add_to_cart` en `js/checkout_consent.js`.
- [x] **Verificación de Ley 21.828 (Equidad de Género) y FAQ:** `ley-equidad-genero-brecha-salarial-chile-2026.html` contrastada con normativa vigente (art. 157 septies CT) y `FAQPage` de `finiquito_calculator.html` (3 preguntas) 100% alineada con preguntas visibles.

### Ola 4 — Bloque B (técnico/comercial/SEO) y Bloque C (UX/UI) listos para publicar
- [x] **Portada y calculadora finiquito (`index.html`, `finiquito_calculator.html`):** contador hero `"Ver todas"` corregido de `14` a `15`, fecha `#lastUpdateDate` en `finiquito_calculator.html` actualizada a `Noviembre 2026`, hero móvil `.clf-fan` compactado (`274px` / `.h-14` compactada en `<=639px`).
- [x] **Archivos IA (`llms.txt`, `llms-full.txt`):** `valores oficiales` cambiado a `valores vigentes`, comisión AFP Planvital corregida a `10% + 1.16% = 11.16%` e incorporadas las nuevas páginas (`finiquito-trabajadora-casa-particular-chile`, `checklist-ley-21719-1-diciembre-2026`, `aguinaldo-navidad-cierre-laboral-diciembre-2026`, `como-generar-archivo-previred-lre-f29-chile`).
- [x] **Lista de espera Pase Pyme (`asistente-laboral-pyme.html`):** formulario `#pase-waitlist-form` dentro de `#planes` conectado a `/api/send-lead` (`fuente: "Lista Espera Pase Pyme"`) para capturar interesados mientras `PYME_PASE_VENTA` permanezca cerrado.
- [x] **Cruce de kits y estudios (`para-empleadores.html`):** caja combinada Kit Ley 21.719 (`$29.990`) + Kit Blindaje Laboral (`$19.990`) y enlace a la guía Previred/LRE/F29 en `#estudios-contables`.
- [x] **Nueva guía técnica (`como-generar-archivo-previred-lre-f29-chile.html`, `assets/covers/previred-lre-f29.svg`, `blog.html`, `sitemap.xml`, `tools/promo_asistente.js`):** guía práctica paso a paso para Previred (105 campos), LRE (147 columnas) y F29 RCV; sitemap en `53` URLs indexables (`demo-contadores.html` se mantiene fuera por conservar `noindex`).
- [x] **Accesibilidad de formularios:** `aria-label` añadidos en campos honeypot (`carta-de-renuncia-chile.html`, `protocolo-ley-karin-empresas.html`) y en inputs `<input type="file">` ocultos de `app.html` y `demo-contadores.html` (`0` controles sin etiqueta en todo el sitio).
- [x] **Asistente Pyme `/app` (`app.html`, `assets/css/app.css`, `js/app_pyme.js`, `js/pyme_finanzas.js`):** ficha del trabajador dividida en bloque esencial visible + 3 acordeones `<details>` (`#pm-bloque-contrato`, `#pm-bloque-haberes`, `#pm-bloque-prevision`) con apertura automática ante errores, vistas móviles en tarjetas `#cob-cards` y `#pag-cards` (y conciliación ya con tarjetas `.conc-card`), compactación del sidebar para laptops (`1366x768`, altura útil `680px`), caché `app.css?v=1.25.0`, `pyme_finanzas.js?v=1.1.0`, `app_pyme.js?v=1.36.0`.
- [x] **Suite Contadores `/demo-contadores` (`demo-contadores.html`, `assets/css/suite_contadores.css`, `js/demo_suite.js`):** eliminación de `style="..."` inline en `#liq-cliente` y `#suite-regimen`, tarjetas resumen móviles `#f29-resumen-movil` y `#bal-resumen-movil` (`<=768px`), guía visual SII RCV en 2 pasos (`.rcv-guia-card`), homologador referencial de plan de cuentas (`#panel-mapeo-cuentas`: SII, Softland, Transtecnia, Laudus, CSV), compactación de sidebar a `680px` sin scroll vertical, caché `suite_contadores.css?v=1.1.0` y `demo_suite.js?v=1.2.0`.
- [x] **Caché pública CSS:** `style.css?v=3.4.0` actualizado en las `55` páginas HTML tras compilar Tailwind (`npm run build:css`).

---

## 2. Lo que queda pendiente (fuera de alcance técnico inmediato)

### A. Pendientes con revisión de abogado (`docs/revision-legal-asistente-pyme.md`)
- [ ] Validar **Términos §12** (`terminos.html#asistente-pyme`), **Privacidad §10** (`privacidad.html#asistente-pyme`) y texto de aceptación en `api/_pyme/correo.js` (`paginaConfirmar`).
- [ ] Definir mecanismos contractuales (DPA / cláusulas tipo) por transferencia internacional de datos (Neon São Paulo, Vercel y Resend EE. UU.).
- [ ] Revisar redacción de retracto legal frente al reembolso voluntario de 14 días corridos antes de vender el Pase Pyme.
- [ ] Auditar los 7 modelos legales de `js/pyme_docs.js` (plazo fijo art. 159 N°4, necesidades de la empresa art. 161, amonestación, feriado, certificados, anexo datos 21.719).
- [ ] Definir texto de identificación editorial / proveedor en `sobre-nosotros.html` y política de conservación/borrado de cuentas inactivas.
- [ ] Autorizar y revisar si corresponde extender o cerrar la fecha promocional `"hasta el 31 de diciembre de 2026"` en `asistente-laboral-pyme.html` y `tools/promo_asistente.js` según calendario 2027.

### B. Pendientes con empresa real, credenciales externas o portales terceros
- [ ] **Base de datos Neon (`pruebas`):** ejecutar `node tools/test_pyme_almacen_db.js --entorno=pruebas` con `DATABASE_URL_MIGRACION`.
- [ ] **Pagos Flow y correos Resend reales:** probar compra sandbox de Pase Pyme, webhook, recepción real en Resend y reversión con `node tools/revocar_pase.js`; recién después activar `PYME_PASE_VENTA=1` en Vercel.
- [ ] **Portales Previred y Mi DT con datos reales:** cargar un archivo Previred generado (105 campos) y un CSV LRE (147 columnas) durante el piloto con empresa/estudio contable real; al validar aceptación real, actualizar `docs/piloto-contadores.md`.
- [ ] **Normativa futura no publicada:** incorporar tasas y topes definitivos `2027-01` cuando se publiquen en enero 2027; automatizar PPM `0,23%` (Ley 21.850, vigente permanente desde `01-ene-2029`) una vez salga la circular interpretativa SII correspondiente.
- [ ] **Search Console / Bing / Cloudflare / Backlinks:** reenviar `sitemap.xml` en GSC y Bing Webmaster Tools, revisar manualmente los `3` errores `404` y `2` de redirección para agregar reglas `301` en `vercel.json`, revisar GA4 Realtime/DebugView en vivo y ejecutar campaña externa de backlinks.

### C. Roadmap de producto posterior al piloto (requiere definición y feedback real)
- [ ] Envío directo de liquidación por correo al trabajador con enlace firmado temporal.
- [ ] Múltiples usuarios y roles por estudio contable.
- [ ] Soporte avanzado para ex cajas IPS, APV externo avanzado o segundo contrato según demanda real de estudios piloto.
- [ ] Decisión comercial/SEO sobre si mantener `/demo-contadores` con `noindex` (fuera del sitemap) o abrirlo a indexación orgánica.

---

## 3. Batería de pruebas locales y en navegador (resultados última ejecución)

- `npm run build:css`: OK (`assets/css/style.css` compilado, HTMLs en `?v=3.4.0`).
- `sitemap.xml`: `53` URLs válidas.
- `python tools/verify_all_pages.py`: `56 / 58` (solo excluye SPAs `app.html` y `demo-contadores.html`).
- `node tools/test_promo_asistente.js`: `9 pruebas correctas`, `0` fallos.
- Auditoría de formularios (`audit_forms.py`): `0` controles `<input>`/`<select>`/`<textarea>` sin etiqueta en todo el sitio.
- `python tools/test_footer.py` (`index.html`, `para-empleadores.html`, `como-generar-archivo-previred-lre-f29-chile.html`): `0` overflows en `390, 768, 1024, 1280, 1440, 1920 px`.
- Suites Node locales (`tools/test_*.js`): **`43` aprobadas**, `1` omitida por requerir Neon externo (`test_pyme_almacen_db.js`).
- Verificación Playwright Chromium (`verify_browser.py`): `0` fallos y `0` errores JS en desktop (`1366x768`, `1366x680`, `1440x900`) y móvil (`375x667`), incluyendo acordeones y tarjetas de `/app`, sidebar compacto (`680px`) y tarjetas móviles `#bal-resumen-movil` / `#f29-resumen-movil` + homologador ERP en `/demo-contadores`, contador `15` en `/`, `Noviembre 2026` en `/finiquito_calculator`, mock de `#pase-waitlist-form` y nueva guía `/como-generar-archivo-previred-lre-f29-chile`.
