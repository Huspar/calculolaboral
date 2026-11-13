# Plan de cambios pendientes y batería de pruebas — Cálculo Laboral (`calculolaboral.cl`)

**Fecha de corte:** 13 de noviembre de 2026  
**Estado base desplegado en `origin/main`:** `ebe6730` (después de Ola 1 `f544396` y Ola 2 `66ebebc`)

---

## 1. Resumen de qué ya se resolvió vs. qué queda pendiente

### Ya desplegado en producción (Ola 1 + Ola 2)
- **Indicadores y cálculos críticos:** UTM noviembre (`$72.440`) y respaldo diciembre (`$72.802`), tope de 90 UF con UF del último día del mes anterior al pago (art. 172 CT), F29 permitiendo débitos/créditos negativos por notas de crédito (`538`/`537`), UTM coherente en `kit-cumplimiento-ley-datos-personales-chile.html` y sync de `app.css?v=1.24.0` + `hashchange` + importador puente JSON en `/demo-contadores`.
- **Nuevas páginas y UX móvil:** calculadora `finiquito-trabajadora-casa-particular-chile.html` (`js/casa_particular_logic.js`), guías `aguinaldo-navidad-cierre-laboral-diciembre-2026.html` y `checklist-ley-21719-1-diciembre-2026.html`, mejora móvil en `sueldo_liquido.html` + `#mobile-result-bar`, caché `style.css?v=3.2.0` y envío de `sitemap.xml` en Google Search Console y Bing Webmaster Tools.

### En directorio de trabajo local sin desplegar (Ola 3 en curso)
Actualmente hay 5 archivos modificados en el repositorio sin commit ni push:
- `index.html`
- `para-empleadores.html`
- `demo-contadores.html`
- `sitemap.xml`
- `assets/css/style.css` (cambió al compilar Tailwind CSS)

---

## 2. Cambios pendientes (priorizados)

### Bloque A — Inmediato: cerrar y desplegar la Ola 3 local
| # | Archivo(s) | Cambio | Motivo / Impacto |
|---|---|---|---|
| A1 | `index.html` (ya editado local) | Reemplazar tarjeta #15 "En desarrollo" por **Finiquito Casa Particular**, quitar filtro muerto `afp`, actualizar contador (`15` herramientas / `9` más) y sumar enlace a `demo-contadores` en *Pymes y empleadores*. | Elimina aspecto de sitio inacabado y conecta herramientas reales desde portada. |
| A2 | `para-empleadores.html` (ya editado local) | Enlazar `checklist-ley-21719-1-diciembre-2026` bajo el Kit 21.719, sumar sección puente `#estudios-contables` hacia `demo-contadores`, agregar opción `Piloto Suite Contadores` en `#pyme-necesidad` y enlace en pie de página. | Da visibilidad comercial B2B a `/demo-contadores` sin pedir claves SII/bancos (Zero-Knowledge) y aprovecha ventana al 1-dic-2026. |
| A3 | `demo-contadores.html` (ya editado local) | Nota de ayuda en `#f29-tasa-ppm` indicando tasas ProPyme `0,125%` / `0,25%` y `0,23%` transitorio Ley 21.850 sujeto a circular SII (campo editable). | Evita confusión tributaria mientras sale la circular SII. |
| A4 | `sitemap.xml` (ya editado local) | Agregar `https://calculolaboral.cl/demo-contadores` (`53` URLs totales). | Permite indexación/descubrimiento controlado o seguimiento en buscadores (nota: evaluar si se mantiene `noindex` en `demo-contadores.html` o se deja indexable si pasa a vitrina). |
| A5 | Todos los `.html` públicos (`54` archivos) | **Falta hacer antes de subir:** actualizar `assets/css/style.css?v=3.2.0` a `v=3.3.0` (porque `vercel.json` sirve `/assets/(.*)` con `max-age=31536000, immutable` y `assets/css/style.css` cambió al compilar). | Evita que usuarios con caché antiguo pierdan clases CSS de Ola 3. |
| A6 | Git / Vercel / GSC / Bing | Commit, push a `origin/main` y reenvío de `sitemap.xml` en Google Search Console y Bing Webmaster Tools. | Publica Ola 3 y actualiza conteo a 53 URLs. |

> **Nota sobre `demo-contadores.html` y `sitemap.xml`:** actualmente `demo-contadores.html` tiene `<meta name="robots" content="noindex, nofollow, noarchive">` (línea 6). Antes de dejarlo en `sitemap.xml`, decidir si se retira `noindex` (si quieres que posicione en Google) o si se saca de `sitemap.xml` para que GSC no marque alerta *"Enviada pero con etiqueta noindex"*.

---

### Bloque B — Prioridad Alta (P1): Normativa, Legal, Comercial, SEO y Telemetría

#### B.1 Legal y activación del cobro (antes de habilitar `PYME_PASE_VENTA=1`)
Ref.: `docs/revision-legal-asistente-pyme.md`, `api/_pyme/pase.js`
1. **Revisión legal con abogado:** validar Términos §12 y Privacidad §10 (`#asistente-pyme`), mecanismos de transferencia internacional (DPA con Neon Brasil, Vercel y Resend EE. UU.), política de retracto frente al reembolso voluntario de 14 días, y los 7 modelos de `js/pyme_docs.js`.
2. **Pruebas con credenciales reales (staging/producción):** probar envío de correos vía Resend real, flujo completo de pago en sandbox de Flow + webhook + revocación (`tools/revocar_pase.js`) antes de activar `PYME_PASE_VENTA=1`.

#### B.2 Normativa y motores de cálculo
Ref.: Auditoría Normativa (`13-nov-2026`), `docs/piloto-contadores.md`, `docs/revision-producto-asistente.md`
1. **Validación real en portal Previred y Mi DT:** cargar un archivo real de 105 campos en una cuenta de Previred y un CSV LRE (147 columnas) en Mi DT durante el piloto contable; al confirmar aceptación, retirar la advertencia de "aún no probado" en `docs/piloto-contadores.md`.
2. **Licencias médicas y Asignación Familiar:** agregar tabla oficial de tramos de asignación familiar vigente en parámetros y cálculo/descuento de subsidio por licencia médica + aporte AFC (`0,6%`) sin cálculo manual externo.
3. **Actualización Ley 21.850 / Ley de Equidad de Género / Costo Empresa / 2027:**
   - Leer texto completo del art. 8 N°1 Ley 21.850 y circular SII cuando se publique para dejar automática la tasa PPM ProPyme `0,23%`.
   - Auditar `calculadora-costo-empresa-chile.html` contra la cotización adicional empleador `3,5%` vigente desde agosto 2026.
   - Verificar datos oficiales de `ley-equidad-genero-brecha-salarial-chile-2026.html` o retirarla del sitemap si no corresponde mantenerla.
   - Preparar carga de parámetros `2027-01` (UF, UTM, topes imponibles 2027, comisiones AFP) en `js/liquidacion_parametros.js` y `js/constants.js` antes de enero 2027.

#### B.3 Comercial y conversión
Ref.: Auditoría Comercial (`13-nov-2026`)
1. **Lista de espera Pase Pyme y fecha del piloto:** habilitar captura de correos ("Avísame cuando abra el Pase Pyme") mientras `PYME_PASE_VENTA` esté apagado, y revisar/actualizar las menciones `"hasta el 31 de diciembre de 2026"` en `asistente-laboral-pyme.html` según el calendario real de 2027.
2. **Puentes desde calculadoras de alto volumen:** insertar llamadas contextuales no invasivas desde `sueldo_liquido.html`, `calculadora-sueldo-part-time.html` y `calculadora-horas-extras.html` hacia el generador/Asistente Pyme o kits sin afectar la velocidad de cálculo.
3. **Bundle comercial de kits:** evaluar paquete combinado (Kit Ley 21.719 + Kit Blindaje Laboral) en `/para-empleadores` y carrito.

#### B.4 SEO Técnico, Canibalización y Autoridad
Ref.: Auditoría SEO (`13-nov-2026`), `docs/calculolaboral.cl-audit/ACTION-PLAN.md`
1. **Campaña de enlaces externos (backlinks):** hoy GSC reporta `0` enlaces externos; crear recursos citables (tabla/widget de indicadores UF/UTM/IMM al día o calculadora embebible con atribución) y gestionar presencia en directorios Pyme/contables chilenos.
2. **Des-canibalización:** diferenciar aún más `/` frente a `/finiquito_calculator` (intención transaccional `"calcular finiquito"` debe consolidarse en `/finiquito_calculator`), y definir jerarquía clara entre `/sueldo_liquido` y `/liquidacion-de-sueldo` (sin tocar título/meta de `/liquidacion-de-sueldo` ni de `/calculadora-sueldo-part-time`).
3. **Limpieza de errores GSC y exactitud de textos secundarios:**
   - Inspeccionar manualmente en GSC el detalle de los `3` errores `404` y `2` errores de redirección para agregar redirecciones `301` faltantes en `vercel.json`.
   - Corregir en `que-hacer-si-no-te-pagan-el-finiquito.html` la mención del recargo legal Art. 168 (debe reflejar `30% a 100%`, no `150%`).
   - Actualizar `llms.txt` / `llms-full.txt` (topes vigentes, comisiones AFP, sin palabras prohibidas como *"Oficiales"* / *"auditadas"*).
   - Revisar etiquetas FAQ en `finiquito_calculator.html` (schema vs preguntas visibles) y `dateModified` / fechas visibles en guías antiguas; definir en `sobre-nosotros.html` identificación editorial/proveedor.
4. **Contenido nuevo solo de clic obligatorio:** guías prácticas orientadas a archivo Previred, LRE 147 columnas y F29 RCV donde Google AI Overview no reemplaza la herramienta.

#### B.5 Telemetría GA4
1. **Filtrar UUIDs privados en `/app` (`js/app_pyme.js:215`):** hoy `page_location` envía rutas con IDs internos (`/app/liquidaciones/<uuid>`, `/app/trabajadores/<uuid>`). Normalizar a ruta genérica (`/app/liquidaciones`, `/app/trabajadores`) antes de mandar `page_view` a `gtag`.
2. **Medición de `/cart`:** asegurar evento `add_to_cart` en flujos de selección/carrito donde hoy solo se registran vistas sin evento de embudo.

---

### Bloque C — Prioridad Media (P2): UX/UI, Rendimiento Móvil y Producto `/app` + `/demo-contadores`

> **Regla de arquitectura y diseño:** cualquier rediseño de flujo o incorporación de funciones visuales en `/app` o `/demo-contadores` debe coordinarse primero con el agente **Diseño** (`arquitectura-diseno-pyme-contadores.md`).

1. **Sitio público y móvil (`auditoria-integral-diseno-ux-2026.md` + `ACTION-PLAN.md`):**
   - Compactar hero móvil `clf-fan` en `index.html` (de `392 px` a `~280 px`) y reducir altura combinada de barra económica + header móvil (`h-20` -> `56–64 px`).
   - Optimizar Core Web Vitals móvil: autoalojar fuentes con precarga donde falte, reemplazar iconos pesados si afecta LCP/CLS y verificar los controles de formulario sin etiqueta accesible.
2. **Asistente Pyme (`/app`):**
   - Dividir los >25 campos de *"Agregar más datos"* del trabajador en 3 bloques colapsables o pestañas (*Contrato y jornada*, *Haberes*, *Previsión y Previred*).
   - Dar vista en tarjetas responsivas a *Cobranzas*, *Cuentas por pagar* y *Conciliación bancaria* en `375 px`, y compactar sidebar de 14 destinos en laptops `1366×768`.
   - Roadmap funcional (`docs/revision-producto-asistente.md`): semana corrida automática (art. 45), envío de liquidación por correo al trabajador con enlace firmado, y soporte para múltiples usuarios/roles por estudio.
3. **Suite Contadores (`/demo-contadores`):**
   - Reemplazar estilos inline en `#liq-cliente` y `#suite-regimen` de `demo-contadores.html` por clases del sistema (`app.css`).
   - Agregar tarjeta resumen superior en móvil (`<=768 px`) para Balance de 8 columnas y F29 (Activo, Pasivo, Resultado, RLI, Total a pagar).
   - Mapeo CSV de equivalencias de plan de cuentas (Transtecnia / Laudus / Softland), guía visual en 2 clics para bajar el RCV desde el SII, y soporte para APV externo / ex cajas IPS / segundo contrato (`docs/piloto-contadores.md`).

---

## 3. Batería de pruebas posteriores a los cambios

Ejecutar siempre en este orden desde `C:\Users\Jhon\Desktop\Claude\CalculoLaboral` después de aplicar cada bloque de cambios.

### Paso 1 — Compilación CSS, Sitemap y Estructura HTML (obligatorio tras editar HTML/CSS)
```powershell
# 1. Compilar Tailwind y revisar si assets/css/style.css cambió
npm run build:css
git diff --stat assets/css/style.css

# 2. Si style.css cambió, verificar que se actualizó ?v=X.Y.Z en todos los HTML públicos
rg -n "style\.css\?v=" --glob "*.html" | Select-Object -First 10

# 3. Validar sintaxis XML y total de URLs en sitemap.xml
python -c "import xml.etree.ElementTree as ET; r = ET.parse('sitemap.xml').getroot(); print('SITEMAP_URLS:', len(r))"

# 4. Verificar consistencia de header/footer en todo el sitio público (esperado: 55/57; excluye SPAs app.html y demo-contadores.html)
python tools/verify_all_pages.py

# 5. Validar reglas comerciales/GA4 de promociones (9 pruebas)
node tools/test_promo_asistente.js
```

### Paso 2 — Suites lógicas y normativas locales en Node.js
Correr la batería completa (actualmente **43 suites locales** pasan con código de salida `0`; 1 suite adicional requiere PostgreSQL/Neon en Paso 3):

```powershell
# Ejecución consolidada de todas las suites locales (excluyendo DB externa)
Get-ChildItem tools/test_*.js | Sort-Object Name | ForEach-Object {
  if ($_.Name -eq "test_pyme_almacen_db.js") { return }
  Write-Host ">> $($_.Name)" -NoNewline
  node $_.FullName | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "FALLA en $($_.Name)" }
  Write-Host " OK"
}
```

**Desglose por área para pruebas focalizadas:**
- **Finiquitos y Casa Particular:**
  - `node tools/test_casos_referencia.js`
  - `node tools/test_casa_particular.js` (5 casos: Art. 161 inc. 2, Art. 159 N°2, puertas adentro Art. 150 d, tope 60 UF / 11 años y tramo pre/post oct-2020)
  - `node tools/test_demo_contadores.js` (10 comprobaciones, incluye tope 90 UF)
- **Liquidaciones, LRE y Previred:**
  - `node tools/test_liquidacion.js`
  - `node tools/test_liquidacion_documento.js`
  - `node tools/test_tasa_mutual.js`
  - `node tools/test_previred.js` (30 comprobaciones archivo v100 de 105 campos)
  - `node tools/test_lre.js` (17 comprobaciones Anexo LRE 147 columnas)
- **Suite Contadores (RCV SII, F29, Diario, Mayor, Balance 8 Columnas):**
  - `node tools/test_contadores_suite.js` (7 comprobaciones, incluye remanente cód. 77 y signos negativos en 538/537)
- **Asistente Pyme (`/app`, módulos de auth, cifrado, finanzas, documentos, vacaciones y multiempresa):**
  - `node tools/test_pyme_auth.js`, `test_pyme_cifrado.js`, `test_pyme_liquidaciones.js`, `test_pyme_finanzas.js`, `test_pyme_vacaciones.js`, `test_pyme_docs.js`, `test_pyme_previred.js`, `test_pyme_pase.js`, `test_pyme_estudio.js`, `test_pyme_multiempresa.js`, `test_pyme_permisos.js`, `test_pyme_piloto.js`.

### Paso 3 — Base de datos, pagos y validadores externos (previo a `PYME_PASE_VENTA=1`)
```powershell
# Requiere variable de entorno DATABASE_URL_MIGRACION apuntando a la rama Neon `pruebas`
node tools/test_pyme_almacen_db.js --entorno=pruebas
```
- **Flow + Resend (en entorno de pruebas):** ejecutar una compra sandbox de Pase Pyme, validar recepción del webhook y correo de comprobante en Resend, y ejecutar `node tools/revocar_pase.js` verificando reversión al plan gratuito.
- **Validadores reales externos (piloto con estudio contable):**
  - Subir un archivo Previred generado (105 campos) en la plataforma real de Previred y confirmar 0 errores de formato.
  - Subir un CSV LRE generado (147 columnas) en Mi DT y validar lectura de encabezados ANSI.

### Paso 4 — Verificación responsive y funcional en navegador
1. **Script de footer multiresolución (si se edita footer o layout público):**
   ```powershell
   python tools/test_footer.py index.html
   python tools/test_footer.py para-empleadores.html
   # Importante: borrar tools/screenshots/*.png generados antes de commitear
   ```
2. **Inspección interactiva en escritorio (~1280 px) y móvil (~380 px):**
   - Confirmar `document.documentElement.scrollWidth <= window.innerWidth` (cero scroll horizontal).
   - En `/`: filtrar por `Trabajadores (10)` y `Pymes y empleadores (5)`, expandir el botón a 15 herramientas y validar clic hacia `/finiquito-trabajadora-casa-particular-chile` y `/demo-contadores`.
   - En `/para-empleadores`: pulsar *"Solicitar piloto para estudio"* (`#btn-piloto-contadores`) y confirmar scroll al formulario con `Piloto Suite Contadores` preseleccionado en `#pyme-necesidad`.
   - En `/demo-contadores`: cargar ejemplo de Remuneraciones y SII en F29, cambiar `#f29-tasa-ppm` a `0.23`, probar hash en URL (`#f29`, `#balance`) tras F5, y revisar Balance de 8 columnas en 375–380 px.
   - En `/app`: probar alta rápida de trabajador, acordeones de ficha extendida (cuando se implementen) y tarjetas de cobranzas/pagos en móvil.

### Paso 5 — Verificación en producción tras despliegue a `origin/main`
```powershell
# 1. Confirmar HTTP 200 en páginas nuevas y editadas (esperar ~20s tras push a Vercel)
@("https://calculolaboral.cl/", "https://calculolaboral.cl/para-empleadores", "https://calculolaboral.cl/demo-contadores", "https://calculolaboral.cl/finiquito-trabajadora-casa-particular-chile", "https://calculolaboral.cl/sitemap.xml", "https://calculolaboral.cl/assets/css/style.css?v=3.3.0") | ForEach-Object {
  $code = curl.exe -s -o NUL -w "%{http_code}" $_
  Write-Output "$code $_"
}
```
- **GA4 en vivo (Realtime / DebugView):** confirmar disparo limpio de `lead_pyme_b2b`, `add_to_cart`, `begin_checkout`, `calculate_finiquito` (con debounce, sin ráfagas por tecla) y `page_view` de `/app` sin exposición de UUIDs.
- **Google Search Console y Bing Webmaster Tools:** confirmar lectura sin errores del nuevo `sitemap.xml`, ausencia de alertas *"noindex en sitemap"* y caída progresiva de los `404` reportados.
