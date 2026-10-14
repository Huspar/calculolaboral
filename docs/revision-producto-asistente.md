# Segunda revisión del Asistente Laboral Pyme (13-oct-2026)

Pedido del dueño: revisar lo que ofrecemos antes de lanzar, ver qué falta para que sea útil a las pymes y a los empleadores, cómo diferenciarnos de Buk, Talana, Nubox y Rex+, y qué agregar para que sea un producto que la gente quiera comprar.

Fuentes de la competencia al final. Los precios en UF se pasaron a pesos con la UF del 9-oct-2026 ($41.131) y son referenciales.

## 1. Qué ofrecemos hoy

- Cuenta con enlace al correo, sin contraseña. Datos cifrados, descargables y eliminables.
- 1 trabajador activo gratis; hasta 5 con el Pase Pyme ($19.990 por 3 meses o $59.990 por 12 meses, pago único, reembolso de 14 días).
- Cierre del mes: liquidaciones preparadas con valores base, vista previa, marcar emitidas, imprimir todas.
- Siete documentos (certificados, comprobante de feriado, cartas 159 N°4 y 161, amonestación, anexo de datos) e historial.
- Vacaciones con saldo calculado (arts. 67 a 70), calendario laboral y avisos del mes (plazo fijo, cotizaciones, liquidaciones sin emitir).
- Contrato, anexo 42 h y finiquito prellenados en los generadores del sitio.

Verificado: pruebas automáticas (12 baterías), 25 pruebas contra Neon `pruebas`, compra en el sandbox de Flow y revisión de diseño. Sin verificar todavía: correo real con Resend en producción, un pago real, el reembolso en Flow y `tools/revocar_pase.js` contra una base real.

## 2. La competencia

| | Precio para 1 a 5 trabajadores | Lo que trae que nosotros no |
|---|---|---|
| **Buk Starter** | **Gratis hasta 20 trabajadores** | Archivo Previred, nómina de pago al banco, DDJJ 1887, firma digital, portal del trabajador, vacaciones y permisos, carga de contratos a Mi DT. Soporte solo de autogestión y "cálculo de liquidaciones limitado". |
| Buk Basic | 1,5 UF + IVA al mes (unos $73.000) | Lo anterior más soporte. |
| Nubox Remuneraciones | Desde 1,5 a 2,6 UF al mes (unos $62.000 a $107.000) | Archivos Previred y Libro de Remuneraciones Electrónico (LRE), contratos y finiquitos, DDJJ 1887. |
| Talana | Cotización (su blog habla de 1 a 3 UF al mes) | Asistencia, firma, vacaciones. |
| Rex+ (Defontana) | Mínimo 3,5 a 6 UF + IVA al mes (unos $171.000 o más) | Asistencia, gestión de personas. |

**Lectura honesta.** Buk Starter es gratis y hace más cálculo de remuneraciones que nosotros: si competimos como "software de remuneraciones más barato", perdemos. Nuestro precio ($5.000 a $6.700 al mes) ya está muy por debajo de los planes pagados, así que bajar precio no es la palanca.

Lo que ellos no hacen bien, y donde sí podemos ganar:

1. **Están hechos para un área de RR. HH., no para el dueño.** Buk, Talana y Rex+ suponen a alguien que sabe de remuneraciones. Nuestro usuario es el dueño de la panadería que nunca hizo una liquidación. El cierre del mes guiado, en lenguaje simple, es nuestra ventaja de producto.
2. **No avisan los riesgos legales en palabras del dueño.** Nosotros ya avisamos plazo fijo que se convierte en indefinido, feriado progresivo, cotizaciones y la advertencia del art. 162 en las cartas. Nadie más lo pone en primer plano.
3. **No traen los documentos del día a día con explicación.** Amonestación, cartas de término con sus advertencias, certificados para el banco: ellos dan plantillas, nosotros damos el documento armado y qué revisar antes de firmar.
4. **No tienen el tráfico de las calculadoras gratuitas.** La gente ya llega a calculolaboral.cl a calcular finiquitos y sueldos: el Asistente es el paso natural, sin vendedor ni demo.
5. **Suscripción mensual en UF.** Nosotros cobramos una vez, sin renovación automática.

Posicionamiento propuesto: **"El asistente laboral para el dueño de una pyme chica: te dice qué hacer este mes, te arma las liquidaciones y los documentos, y te avisa antes de que algo te salga caro."** No competir como "software de remuneraciones", sino como el asistente que acompaña el cumplimiento laboral de quien no tiene área de personas.

## 3. Problemas a corregir antes de vender

1. **Aporte del empleador de la reforma de pensiones (Ley 21.735).** Desde las remuneraciones de agosto de 2026 es 3,5 % de la remuneración imponible e incluye el SIS (entre agosto de 2025 y julio de 2026 fue 1 % más el SIS aparte). No cambia el líquido del trabajador, pero sí el costo del empleador y lo que paga en Previred. Hoy el Asistente no lo muestra en ninguna parte, y es justo lo que más le preocupa a un empleador este año. **Prioridad alta.**
2. **(Aclarado: la UF y la UTM se cargan al día desde las API; el ingreso mínimo, los topes, las comisiones AFP y las tasas del empleador siguen en `js/liquidacion_parametros.js`.) Los parámetros del motor llegan solo hasta diciembre de 2026** (`PRIMER_MES` 2026-01, `ULTIMO_MES` 2026-12). Un Pase de 12 meses vendido hoy dura hasta octubre de 2027. Antes de vender el de 12 meses hay que asumir el compromiso de cargar cada mes los valores (UF, UTM, topes, tasas, IMM) y tener listos los de enero de 2027 apenas se publiquen. Si no, en enero el producto deja de calcular para clientes que pagaron.
3. **El tope de 5 trabajadores choca con el LRE.** Desde 5 trabajadores el empleador está obligado a declarar el Libro de Remuneraciones Electrónico en la DT cada mes (art. 62, Ley 21.327). Nuestro cliente con 5 trabajadores es justo el que ya está obligado, y hoy no lo ayudamos.

## 4. Qué agregar (en orden de impacto)

### Etapa 1: lo que hace que valga la pena pagar (antes o junto al lanzamiento)

> **Estado (13-oct-2026):** los cuatro puntos están construidos en la rama `claude/asistente-pyme-plan`, con pruebas, sin publicar. Las tasas del empleador de noviembre y diciembre de 2026 se marcan «por confirmar» hasta que la Superintendencia publique el SIS de ese período. El problema 2 (parámetros hasta diciembre de 2026) queda mitigado: desde enero de 2027 el asistente sigue calculando con los últimos valores y lo avisa, pero hay que cargar los valores de 2027 apenas se publiquen.

1. **Costo del empleador y resumen para Previred.** Por trabajador y del mes: aporte de la reforma (3,5 %), seguro de cesantía del empleador (2,4 % indefinido, 3 % plazo fijo), mutual o ISL (0,93 % base más la cotización adicional que el dueño indique) y lo que se descuenta al trabajador, agrupado por institución (cada AFP, Fonasa o Isapre, AFC). Rotulado como estimación, con "confirma el monto en Previred". Responde la pregunta "¿cuánto me cuesta este trabajador y cuánto pago este mes?". En la liquidación, los aportes del empleador como sección informativa. *Esfuerzo: medio. Requiere ampliar el motor y sus pruebas.*
2. **Avisos de la DT del art. 9 bis.** Registrar el contrato en Mi DT dentro de los 15 días desde el ingreso, y el término de contrato en los plazos de los arts. 162 y 159. Salen solos de la ficha (fecha de ingreso) y van al calendario y a los avisos del mes. Nadie más lo avisa así. *Esfuerzo: bajo.*
3. **Finiquito dentro del Asistente.** Hoy mandamos al generador externo. Con la ficha y el saldo de vacaciones que ya calculamos, el finiquito sale con el feriado proporcional y las indemnizaciones sin reescribir nada, con el aviso de cotizaciones al día (art. 162). Es el momento de mayor riesgo para el dueño y donde más vale el producto. *Esfuerzo: medio (reusar el motor del generador de finiquitos).*
4. **Anticipos y préstamos con cuotas.** Se registran una vez y se descuentan solos cada mes, respetando el tope del 15 % (art. 58). Es lo que el dueño de pyme hace en un cuaderno. *Esfuerzo: medio.*

### Etapa 2: igualar lo básico de la competencia

5. **Archivo para Previred (formato de 105 campos por separador).** El formato es público. Se arma con lo que ya calculamos. Hay que validarlo subiendo un archivo real en Previred con la cuenta del dueño antes de anunciarlo. *Esfuerzo: alto, riesgo de errores de formato.*
6. **Archivo del LRE para la DT (CSV con punto y coma).** Obligatorio desde 5 trabajadores; voluntario bajo 5. Junto con el anterior, cierra la brecha con Buk y Nubox. *Esfuerzo: alto.*
7. **Enviar la liquidación al trabajador por correo** (enlace firmado a un PDF, con registro de envío). Ahorra imprimir y deja constancia. *Esfuerzo: medio; usa Resend.*

### Etapa 3: crecer

8. **Revisión de cumplimiento de la pyme.** Una lista según su tamaño: protocolo Ley Karin, contratos y anexos 42 h firmados, reglamento interno desde 10 trabajadores, registro de contratos en Mi DT, LRE desde 5. Cada punto enlaza al kit o generador del sitio que lo resuelve. Diferencia y venta cruzada de los kits que ya existen.
9. **Plan para contadores con varias empresas.** El canal más eficiente para llegar a muchas pymes. El producto ya quedó preparado para varias empresas por cuenta.
10. **Licencias médicas y horas extra del mes** con su efecto en la liquidación, y aviso de los días de licencia que paga el empleador.

### No recomendado por ahora

- **Control de asistencia:** exige certificación de la DT.
- **Firma electrónica avanzada:** costo y trámite altos.
- **Asistente con IA que responde preguntas legales:** encaja con el nombre, pero tiene riesgo legal sin revisión de abogado y costo por uso. Retomarlo cuando haya clientes.

## 5. Precio

Mantener los precios. Opciones a evaluar después de tener los primeros clientes:

- Subir el tope del Pase de 12 meses a 10 trabajadores, junto con el archivo del LRE (el cliente que crece de 5 no tiene que irse a otra herramienta).
- Seguir con 1 trabajador gratis: es la respuesta directa a "Buk Starter es gratis" para el que recién parte.

## 6. Recomendación

No migrar producción ni publicar todavía. Construir antes los puntos 1 a 3 de la Etapa 1 (costo del empleador y resumen para Previred, avisos del art. 9 bis y finiquito dentro del Asistente) y resolver el compromiso de carga mensual de parámetros. Con eso el producto tiene un motivo claro para pagarlo aunque exista una opción gratis. La Etapa 2 puede venir después del lanzamiento.

Nada de esto ha sido revisado por un abogado; los cálculos nuevos (reforma de pensiones, finiquito) deben verificarse contra las fuentes oficiales al construirlos.

## 7. Tercera revisión (13-oct-2026): todo dentro del asistente y qué más agregar

**Hecho en esta vuelta.** «Contratos y finiquitos» ya no manda a los generadores del sitio. El contrato de trabajo, el anexo de contrato (sueldo, jornada, cargo, prórroga del plazo fijo, paso a indefinido u otro cambio) y el pacto de horas extra se arman dentro del asistente con la ficha, igual que el finiquito. La vista muestra por persona si tiene contrato emitido, sus anexos y las acciones. Al emitir un anexo, el asistente ofrece pasar el cambio a la ficha con un clic. Con el pase, cada documento se descarga también en Word para editarlo. Los generadores sueltos siguen en el sitio para quien compra un documento puntual, pero el Pase ya no los promete.

**Lo que trae Buk Starter (gratis hasta 20 colaboradores) según su página:** registrar colaboradores, asistencia (manual), bonos y descuentos; generar liquidaciones, archivo Previred y nómina de pago; portal de autoconsulta del trabajador, documentos, vacaciones y permisos. **Lo que no trae:** firma digital y registros en la DT, que están en los planes pagados (Basic desde 1,5 UF + IVA al mes). El soporte es de autogestión.

**Qué agregar, en orden de impacto:**

| # | Qué | Por qué | Esfuerzo |
|---|---|---|---|
| 1 | **Semana corrida automática** para quien gana comisiones (art. 45) | Hoy el motor no la calcula: es una diferencia que el trabajador puede reclamar. Antes de vender a comercio, debe estar. | Medio |
| 2 | **Licencias médicas, permisos y ausencias** registrados una vez | Ajustan solos los días trabajados de la liquidación, aparecen en el calendario y avisan qué días paga el empleador. Buk lo tiene como «vacaciones y permisos». | Medio |
| 3 | **Bonos y asignaciones fijas en la ficha** (como el anticipo fijo) | Hoy un bono permanente se escribe cada mes. Se propone solo en cada liquidación nueva. | Bajo |
| 4 | **Libro de remuneraciones del mes para el contador** (planilla Excel y PDF) | Es lo primero que pide el contador. Se arma con lo que ya guardamos. | Bajo |
| 5 | **Avisos por correo** antes de cada vencimiento (plazo fijo, cotizaciones, Mi DT, prórroga) | «Te avisa antes de que te salga caro» deja de depender de entrar al asistente. Buk Starter no acompaña así. Requiere Resend en producción (ya está para el acceso). | Medio |
| 6 | **Liquidación al trabajador por enlace** con constancia de que la vio | Reemplaza imprimir y es la base de un portal del trabajador como el de Buk. | Medio |
| 7 | **Nómina de pago al banco** (planilla para transferencias masivas) | Buk Starter la trae. Cada banco usa su formato: empezar con una planilla genérica y los 3 bancos más usados por pymes. | Medio |
| 8 | **Archivo Previred y LRE** | Cierran la brecha de cálculo con Buk y Nubox (Etapa 2 de la sección 4). Hay que validarlos con archivos reales. | Alto |
| 9 | **Aceptación del trabajador por enlace** (comprobante de feriado, anexo, pacto de horas extra) | Buk Starter no tiene firma. Requiere revisar qué validez tiene una aceptación electrónica simple para cada documento antes de ofrecerla. | Medio, con revisión legal |
| 10 | **Revisión de cumplimiento** según el tamaño de la empresa | Protocolo Ley Karin, reglamento interno desde 10, contratos firmados y registrados, LRE desde 5. Cada punto enlaza al kit o documento que lo resuelve. | Bajo |
| 11 | **Certificado anual de remuneraciones** para la declaración de renta (marzo) | Lo piden los trabajadores todos los años y sale de las liquidaciones guardadas. | Bajo |

**Recomendación:** construir 1 a 4 antes del lanzamiento (la semana corrida es corrección, no extra) y 5 apenas se verifique el correo en producción. Con eso, frente a Buk Starter, el asistente queda con lo básico de remuneraciones más lo que Buk deja en planes pagados: documentos con explicación, registro DT avisado y acompañamiento.

## Fuentes

- Buk Starter: https://www.buk.cl/starter
- Buk precios: https://www.buk.cl/precios
- Talana, precio para pymes (blog del proveedor): https://web.talana.com/blog/software-de-remuneraciones-cuanto-cuesta-para-una-pyme
- Nubox Remuneraciones: https://www.nubox.com/software-remuneraciones
- Rex+ precios: https://rexmas.com/precios/
- LRE, empleadores con 5 o más trabajadores (DT): https://www.dt.gob.cl/portal/1628/w3-article-120076.html
- Cotización del empleador (Superintendencia de Pensiones): https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-10906.html
- Registro de contratos, art. 9 bis (Ley 21.327): https://www.carey.cl/download/filebase/newsalert/406_ley-no21.327.pdf
- Formato de archivo Previred: https://www.previred.com/documents/80476/80730/FormatoLargoVariablePorSeparador.pdf
- Buk Starter, funciones y comparación con planes pagados: https://www.buk.cl/Starter
