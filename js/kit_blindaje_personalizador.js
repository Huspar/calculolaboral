/* Personalizador Web del Kit Blindaje Laboral Pyme 2026 (client-side, zero datos enviados al servidor) */
(function (root) {
    'use strict';

    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    var CATALOGO = [
        {
            id: 'doc01',
            archivo: '01_Protocolo_Integral_Ley_Karin_DS44.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/01_Protocolo_Integral_Ley_Karin_DS44.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '01 · Protocolo Integral Ley Karin (DS 44)',
            etiqueta: 'Obligatorio desde 1 trabajador · Acoso laboral, sexual y violencia',
            resumen: 'Protocolo base de prevención, canal de denuncias ([CORREO_DENUNCIAS@EMPRESA.CL]), investigación y resguardo conforme a la Ley 21.643 y DS 44.'
        },
        {
            id: 'doc02',
            archivo: '02_Matriz_Identificacion_Riesgos_Psicosociales_Karin.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/02_Matriz_Identificacion_Riesgos_Psicosociales_Karin.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '02 · Matriz Riesgos Psicosociales (Word)',
            etiqueta: 'Evaluación inicial firmada por representante y trabajador',
            resumen: 'Registro formal de identificación de peligros psicosociales y medidas preventivas en [RAZÓN SOCIAL EMPRESA].'
        },
        {
            id: 'doc03',
            archivo: '03_Formulario_Recepcion_Denuncia_Karin.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/03_Formulario_Recepcion_Denuncia_Karin.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '03 · Formulario Recepción Denuncia Karin',
            etiqueta: 'Acta estandarizada de ingreso confidencial de denuncia',
            resumen: 'Formato oficial interno de recepción de denuncia con fecha, hechos, opción de derivación a DT y firma de reserva.'
        },
        {
            id: 'doc04',
            archivo: '04_Acta_Medidas_Resguardo_Inmediatas_3Dias.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/04_Acta_Medidas_Resguardo_Inmediatas_3Dias.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '04 · Acta Medidas de Resguardo Inmediatas',
            etiqueta: 'Registro de medidas de protección inmediatas tras denuncia',
            resumen: 'Constancia de separación física, ajuste de jornada o cambio de turno para resguardar a las personas involucradas.'
        },
        {
            id: 'doc05',
            archivo: '05_Comprobante_Individual_Entrega_Protocolo_Trabajador.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/05_Comprobante_Individual_Entrega_Protocolo_Trabajador.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '05 · Comprobante Entrega Individual Protocolo',
            etiqueta: 'Para firmar por cada trabajador (respaldo inspección DT)',
            resumen: 'Recibo individual firmado por [NOMBRE COMPLETO TRABAJADOR] acreditando entrega y explicación del Protocolo Ley Karin.'
        },
        {
            id: 'doc05b',
            archivo: '05B_Acta_Colectiva_Capacitacion_Y_Difusion_Ley_Karin.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/01_Modulo_Base_Ley_Karin_Obligatorio/05B_Acta_Colectiva_Capacitacion_Y_Difusion_Ley_Karin.docx',
            modulo: 'Módulo 1 · Ley Karin',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '05B · Acta Colectiva Difusión Ley Karin',
            etiqueta: 'Lista de asistencia para charla o inducción grupal',
            resumen: 'Acta con tabla de firmas múltiples para documentar capacitaciones internas en [SUCURSAL O FAENA].'
        },
        {
            id: 'doc06',
            archivo: '06_Anexo_Reduccion_42h_Jornada_5x2_Viernes.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/02_Modulo_Jornada_Ley_40_Horas_2026/06_Anexo_Reduccion_42h_Jornada_5x2_Viernes.docx',
            modulo: 'Módulo 2 · Jornada 42h',
            rubros: ['oficina', 'todos'],
            titulo: '06 · Anexo 42h Jornada 5x2 (Viernes)',
            etiqueta: 'Ley 21.561 · Salida anticipada los viernes sin rebaja de sueldo',
            resumen: 'Anexo individual Art. 11 CT que reduce jornada semanal a 42 horas concentrando el ajuste los días viernes.'
        },
        {
            id: 'doc07',
            archivo: '07_Anexo_Reduccion_42h_Jornada_6x1_Comercio.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/02_Modulo_Jornada_Ley_40_Horas_2026/07_Anexo_Reduccion_42h_Jornada_6x1_Comercio.docx',
            modulo: 'Módulo 2 · Jornada 42h',
            rubros: ['comercio', 'todos'],
            titulo: '07 · Anexo 42h Jornada 6x1 Comercio',
            etiqueta: 'Ley 21.561 · Turnos de 7 horas con descansos Art. 38',
            resumen: 'Anexo de reducción a 42 horas para comercio, retail y gastronomía en modalidad 6 días de trabajo por 1 de descanso.'
        },
        {
            id: 'doc08',
            archivo: '08_Anexo_Reduccion_42h_Distribucion_Homogenea.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/02_Modulo_Jornada_Ley_40_Horas_2026/08_Anexo_Reduccion_42h_Distribucion_Homogenea.docx',
            modulo: 'Módulo 2 · Jornada 42h',
            rubros: ['todos', 'oficina', 'comercio', 'logistica'],
            titulo: '08 · Anexo 42h Distribución Homogénea',
            etiqueta: 'Ley 21.561 · Ajuste diario proporcional de minutos',
            resumen: 'Anexo flexible que distribuye las 42 horas de manera pareja de lunes a viernes o lunes a sábado.'
        },
        {
            id: 'doc09',
            archivo: '09_Pacto_Fin_Articulo_22_Paso_A_Jornada_Fiscalizada.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/02_Modulo_Jornada_Ley_40_Horas_2026/09_Pacto_Fin_Articulo_22_Paso_A_Jornada_Fiscalizada.docx',
            modulo: 'Módulo 2 · Jornada 42h',
            rubros: ['todos', 'oficina', 'logistica'],
            titulo: '09 · Pacto Término Art. 22 a Jornada 42h',
            etiqueta: 'Regulariza personal que sí tiene supervisión o horario',
            resumen: 'Anexo para traspasar a jornada ordinaria con registro de asistencia a cargos que no cumplen requisitos estrictos del Art. 22 inc. 2.'
        },
        {
            id: 'doc10',
            archivo: '10_Clausula_Propinas_Art64_Sin_Descuentos.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_A_Comercio_Gastronomia_Retail/10_Clausula_Propinas_Art64_Sin_Descuentos.docx',
            modulo: 'Módulo 3 · Comercio',
            rubros: ['comercio'],
            titulo: '10 · Cláusula Propinas Art. 64 sin Descuentos',
            etiqueta: 'Rama A · Restaurantes, cafeterías y atención de mesas',
            resumen: 'Regula entrega íntegra de propinas sin retenciones por comisiones Transbank o merma.'
        },
        {
            id: 'doc11',
            archivo: '11_Protocolo_Karin_Agresiones_Violencia_Clientes.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_A_Comercio_Gastronomia_Retail/11_Protocolo_Karin_Agresiones_Violencia_Clientes.docx',
            modulo: 'Módulo 3 · Comercio',
            rubros: ['comercio'],
            titulo: '11 · Protocolo Karin Violencia de Clientes',
            etiqueta: 'Rama A · Violencia ejercida por terceros ajenos a la relación laboral',
            resumen: 'Anexo operativo para actuar cuando clientes o proveedores agreden física o verbalmente a trabajadores en local.'
        },
        {
            id: 'doc12',
            archivo: '12_Pacto_Turnos_Rotativos_Descansos_Art38.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_A_Comercio_Gastronomia_Retail/12_Pacto_Turnos_Rotativos_Descansos_Art38.docx',
            modulo: 'Módulo 3 · Comercio',
            rubros: ['comercio'],
            titulo: '12 · Pacto Turnos Rotativos Art. 38',
            etiqueta: 'Rama A · Trabajo en domingos/festivos y domingos libres legales',
            resumen: 'Pacto de turnos rotativos con descansos compensatorios y resguardo de domingos libres al mes.'
        },
        {
            id: 'doc13',
            archivo: '13_Pacto_Teletrabajo_Y_A_Distancia_Ley21220.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_B_Oficinas_Servicios_Tecnologia/13_Pacto_Teletrabajo_Y_A_Distancia_Ley21220.docx',
            modulo: 'Módulo 3 · Oficinas',
            rubros: ['oficina'],
            titulo: '13 · Pacto Teletrabajo e Híbrido (Ley 21.220)',
            etiqueta: 'Rama B · Incluye requisitos obligatorios para registro en Mi DT',
            resumen: 'Anexo completo de trabajo a distancia con lugar pactado ([DOMICILIO DEL TRABAJADOR]), modalidad híbrida y reversibilidad.'
        },
        {
            id: 'doc14',
            archivo: '14_Clausula_Desconexion_Digital_12_Horas.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_B_Oficinas_Servicios_Tecnologia/14_Clausula_Desconexion_Digital_12_Horas.docx',
            modulo: 'Módulo 3 · Oficinas',
            rubros: ['oficina'],
            titulo: '14 · Cláusula Desconexión Digital 12h',
            etiqueta: 'Rama B · Garantía obligatoria en teletrabajo (Art. 152 quáter J)',
            resumen: 'Garantiza al trabajador al menos 12 horas continuas sin obligación de responder mensajes ni correos.'
        },
        {
            id: 'doc15',
            archivo: '15_Asignacion_Herramientas_E_Internet_Art41.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_B_Oficinas_Servicios_Tecnologia/15_Asignacion_Herramientas_E_Internet_Art41.docx',
            modulo: 'Módulo 3 · Oficinas',
            rubros: ['oficina'],
            titulo: '15 · Asignación Herramientas e Internet Art. 41',
            etiqueta: 'Rama B · Reembolso no imponible de conectividad y equipos',
            resumen: 'Establece asignación mensual compensatoria no imponible para teletrabajadores.'
        },
        {
            id: 'doc16',
            archivo: '16_Clausula_Control_Asistencia_Georreferenciada.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_C_Logistica_Faena_Terreno/16_Clausula_Control_Asistencia_Georreferenciada.docx',
            modulo: 'Módulo 3 · Logística',
            rubros: ['logistica'],
            titulo: '16 · Cláusula Asistencia en Ruta / Terreno',
            etiqueta: 'Rama C · Choferes, vendedores en terreno y mantención',
            resumen: 'Pacto de marcaje remoto conforme a Res. Ex. 38/2024 DT con opciones alternativas y privacidad.'
        },
        {
            id: 'doc17',
            archivo: '17_Clausula_Viaticos_Y_Movilizacion_Art41.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/03_Carpetas_Sectoriales_Por_Rubro/Rama_C_Logistica_Faena_Terreno/17_Clausula_Viaticos_Y_Movilizacion_Art41.docx',
            modulo: 'Módulo 3 · Logística',
            rubros: ['logistica'],
            titulo: '17 · Cláusula Viáticos y Movilización Art. 41',
            etiqueta: 'Rama C · Rendición o monto fijo razonable no imponible',
            resumen: 'Regula entrega y rendición de viáticos de alimentación, traslado y peajes sin naturaleza remuneracional.'
        },
        {
            id: 'doc18',
            archivo: '18_Checklist_10_Documentos_Inspeccion_DT.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/04_Carpeta_Personal_Y_Auditoria_DT/18_Checklist_10_Documentos_Inspeccion_DT.docx',
            modulo: 'Módulo 4 · Auditoría DT',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '18 · Checklist 10 Documentos Inspección DT (Word)',
            etiqueta: 'Lista imprimible de control documental ante fiscalizaciones',
            resumen: 'Pauta imprimible para revisar la carpeta física y digital con fecha [FECHA DE REVISIÓN].'
        },
        {
            id: 'doc19',
            archivo: '19_Guia_Practica_Como_Actuar_Ante_Fiscalizacion_DT.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/04_Carpeta_Personal_Y_Auditoria_DT/19_Guia_Practica_Como_Actuar_Ante_Fiscalizacion_DT.docx',
            modulo: 'Módulo 4 · Auditoría DT',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '19 · Guía Actuación ante Fiscalización DT',
            etiqueta: 'Pasos ante visita inspectiva, plazos y aclaraciones en acta',
            resumen: 'Instrucciones prácticas para la persona que atiende a la Dirección del Trabajo en [RAZÓN SOCIAL EMPRESA].'
        },
        {
            id: 'xlsx20',
            archivo: '20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/04_Carpeta_Personal_Y_Auditoria_DT/20_Matriz_Control_Cumplimiento_DT_y_Ley_Karin_2026.xlsx',
            modulo: 'Módulo 4 · Excel Control',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '20 · Excel Matriz Control DT y Ley Karin (5 hojas)',
            etiqueta: 'Libro Excel con fórmulas, Checklist 10 puntos y Registro Trabajadores 42h',
            resumen: 'Planilla Excel corporativa de 5 pestañas conectadas: Guía Rápida, Panel Resumen %, Checklist DT, Trabajadores/42h y Matriz Riesgos DS 44.'
        },
        {
            id: 'doc00',
            archivo: '00_INSTRUCCIONES_Y_GUIA_DE_IMPLEMENTACION_PYME.docx',
            zipPath: 'Kit_Blindaje_Laboral_Pyme_2026/00_INSTRUCCIONES_Y_GUIA_DE_IMPLEMENTACION_PYME.docx',
            modulo: 'Módulo 0 · Manual',
            rubros: ['todos', 'comercio', 'oficina', 'logistica'],
            titulo: '00 · Guía de Implementación Pyme (Word)',
            etiqueta: 'Instrucciones generales de uso y orden de firma',
            resumen: 'Documento introductorio editable con la hoja de ruta completa del Kit Blindaje.'
        }
    ];

    function or(val, fallback) {
        var s = String(val == null ? '' : val).trim();
        return s || fallback;
    }

    function slugRut(rut) {
        return String(rut || 'empresa').replace(/[^0-9kK]/g, '').toUpperCase() || 'empresa';
    }

    function fechaHoyLarga() {
        var d = new Date();
        return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
    }

    function escXml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function splitFechaDiaMes(fechaTexto) {
        var s = String(fechaTexto || '').trim();
        var m = s.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);
        if (m) return { dia: m[1], mes: m[2] };
        var d = new Date();
        return { dia: String(d.getDate()), mes: MESES[d.getMonth()] };
    }

    function normData(raw) {
        raw = raw || {};
        var fecha = or(raw.fecha, fechaHoyLarga());
        var dm = splitFechaDiaMes(fecha);
        var rep = or(raw.representante, '[NOMBRE REPRESENTANTE LEGAL]');
        return {
            razonSocial: or(raw.razonSocial, '[RAZÓN SOCIAL EMPRESA]'),
            rutEmpresa: or(raw.rutEmpresa, '[RUT EMPRESA]'),
            representante: rep,
            rutRepresentante: or(raw.rutRepresentante, '[RUT REPRESENTANTE]'),
            correoDenuncias: or(raw.correoDenuncias, '[CORREO_DENUNCIAS@EMPRESA.CL]'),
            direccion: or(raw.direccion, '[DIRECCIÓN COMPLETA, COMUNA, REGIÓN]'),
            ciudad: or(raw.ciudad, '[CIUDAD]'),
            sucursal: or(raw.sucursal, '[SUCURSAL O FAENA]'),
            encargadoKarin: or(raw.encargadoKarin, raw.representante ? rep : '[NOMBRE DEL ENCARGADO, PREVENCIONISTA O ASESOR]'),
            fecha: fecha,
            dia: dm.dia,
            mes: dm.mes,
            rubro: or(raw.rubro, 'todos'),
            trabajadorNombre: or(raw.trabajadorNombre, ''),
            trabajadorRut: or(raw.trabajadorRut, ''),
            trabajadorCargo: or(raw.trabajadorCargo, ''),
            trabajadorDomicilio: or(raw.trabajadorDomicilio, ''),
            fechaContrato: or(raw.fechaContrato, '')
        };
    }

    function buildReplacements(raw) {
        var d = normData(raw);
        var pairs = [
            ['[RAZÓN SOCIAL DE LA EMPRESA]', d.razonSocial],
            ['[RAZÓN SOCIAL EMPRESA]', d.razonSocial],
            ['[RUT EMPRESA]', d.rutEmpresa],
            ['[NOMBRE DEL REPRESENTANTE LEGAL]', d.representante],
            ['[NOMBRE REPRESENTANTE LEGAL]', d.representante],
            ['[RUT REPRESENTANTE]', d.rutRepresentante],
            ['[CORREO_DENUNCIAS@EMPRESA.CL]', d.correoDenuncias],
            ['[DIRECCIÓN COMPLETA, COMUNA, REGIÓN]', d.direccion],
            ['[DIRECCIÓN COMPLETA DE LA EMPRESA]', d.direccion],
            ['[DIRECCIÓN COMPLETA]', d.direccion],
            ['[CIUDAD]', d.ciudad],
            ['[SUCURSAL O FAENA]', d.sucursal],
            ['[ÁREA O SUCURSAL]', d.sucursal],
            ['[NOMBRE DEL ENCARGADO, PREVENCIONISTA O ASESOR]', d.encargadoKarin],
            ['[FECHA DE REVISIÓN]', d.fecha],
            ['[FECHA]', d.fecha],
            ['[DÍA]', d.dia],
            ['[MES]', d.mes]
        ];
        if (d.trabajadorNombre) {
            pairs.push(
                ['[NOMBRE COMPLETO DEL TRABAJADOR]', d.trabajadorNombre],
                ['[NOMBRE COMPLETO TRABAJADOR]', d.trabajadorNombre],
                ['[NOMBRE DEPENDIENTE]', d.trabajadorNombre]
            );
        }
        if (d.trabajadorRut) {
            pairs.push(
                ['[RUT DEL TRABAJADOR]', d.trabajadorRut],
                ['[RUT TRABAJADOR]', d.trabajadorRut]
            );
        }
        if (d.trabajadorCargo) {
            pairs.push(
                ['[CARGO EN LA EMPRESA]', d.trabajadorCargo],
                ['[CARGO O FUNCIÓN]', d.trabajadorCargo]
            );
        }
        if (d.trabajadorDomicilio) {
            pairs.push(
                ['[DOMICILIO DEL TRABAJADOR]', d.trabajadorDomicilio],
                ['[DOMICILIO TRABAJADOR]', d.trabajadorDomicilio]
            );
        }
        if (d.fechaContrato) {
            pairs.push(['[FECHA CONTRATO ORIGINAL]', d.fechaContrato]);
        }
        return pairs;
    }

    function toNumericEntities(s) {
        return String(s).replace(/[^\x00-\x7f]/g, function (ch) {
            return '&#' + ch.charCodeAt(0) + ';';
        });
    }

    function applyXmlReplacements(xmlStr, pairs, useXmlEscape) {
        var out = String(xmlStr);
        for (var i = 0; i < pairs.length; i++) {
            var target = pairs[i][0];
            var rep = useXmlEscape ? escXml(pairs[i][1]) : String(pairs[i][1]);
            if (out.indexOf(target) !== -1) {
                out = out.split(target).join(rep);
            }
            var encodedTarget = toNumericEntities(target);
            if (encodedTarget !== target && out.indexOf(encodedTarget) !== -1) {
                out = out.split(encodedTarget).join(rep);
            }
        }
        return out;
    }

    // --- Motor ZIP puro (parseStore/Deflate + buildStoreZip) ---
    var CRC_TAB = (function () {
        var t = new Uint32Array(256);
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(u8) {
        var c = 0xffffffff;
        for (var i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function inflateRaw(u8) {
        if (typeof DecompressionStream !== 'undefined') {
            var ds = new DecompressionStream('deflate-raw');
            var writer = ds.writable.getWriter();
            writer.write(u8);
            writer.close();
            return new Response(ds.readable).arrayBuffer().then(function (ab) {
                return new Uint8Array(ab);
            });
        }
        if (typeof require === 'function') {
            var zlib = require('zlib');
            return Promise.resolve(new Uint8Array(zlib.inflateRawSync(Buffer.from(u8))));
        }
        return Promise.reject(new Error('Tu navegador no soporta descompresión ZIP nativa (DecompressionStream).'));
    }

    function readU16(v, off) { return v.getUint16(off, true); }
    function readU32(v, off) { return v.getUint32(off, true); }

    function parseZip(arrayBuffer) {
        var u8 = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
        var v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        var eocdOffset = -1;
        var minOff = Math.max(0, u8.length - 65557);
        for (var i = u8.length - 22; i >= minOff; i--) {
            if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset < 0) return Promise.reject(new Error('El archivo no es un ZIP válido.'));

        var totalEntries = readU16(v, eocdOffset + 10);
        var cdOffset = readU32(v, eocdOffset + 16);
        var dec = new TextDecoder('utf-8');
        var cursor = cdOffset;
        var items = [];

        for (var idx = 0; idx < totalEntries; idx++) {
            if (readU32(v, cursor) !== 0x02014b50) {
                return Promise.reject(new Error('Encabezado central ZIP dañado.'));
            }
            var method = readU16(v, cursor + 10);
            var compSize = readU32(v, cursor + 20);
            var uncompSize = readU32(v, cursor + 24);
            var nameLen = readU16(v, cursor + 28);
            var extraLen = readU16(v, cursor + 30);
            var commentLen = readU16(v, cursor + 32);
            var lfhOff = readU32(v, cursor + 42);
            var name = dec.decode(u8.subarray(cursor + 46, cursor + 46 + nameLen));
            cursor += 46 + nameLen + extraLen + commentLen;

            var lfhNameLen = readU16(v, lfhOff + 26);
            var lfhExtraLen = readU16(v, lfhOff + 28);
            var dataStart = lfhOff + 30 + lfhNameLen + lfhExtraLen;
            var payload = u8.subarray(dataStart, dataStart + compSize);
            items.push({ name: name, method: method, size: uncompSize, payload: payload });
        }

        return Promise.all(items.map(function (it) {
            if (it.name.endsWith('/')) return { name: it.name, data: new Uint8Array(0), isDir: true };
            if (it.method === 0) return { name: it.name, data: it.payload, isDir: false };
            if (it.method === 8) {
                return inflateRaw(it.payload).then(function (out) {
                    return { name: it.name, data: out, isDir: false };
                });
            }
            return Promise.reject(new Error('Método ZIP no soportado (' + it.method + ') en ' + it.name));
        }));
    }

    function buildZipBytes(entries) {
        var enc = new TextEncoder();
        var locals = [], centrals = [], offset = 0;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].isDir) continue;
            var nameBytes = enc.encode(entries[i].name);
            var data = entries[i].data;
            var crc = crc32(data);
            var lfh = new Uint8Array(30 + nameBytes.length);
            var lv = new DataView(lfh.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true);
            lv.setUint32(22, data.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lfh.set(nameBytes, 30);
            locals.push(lfh, data);

            var cdh = new Uint8Array(46 + nameBytes.length);
            var cv = new DataView(cdh.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, data.length, true);
            cv.setUint32(24, data.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint32(42, offset, true);
            cdh.set(nameBytes, 46);
            centrals.push(cdh);
            offset += lfh.length + data.length;
        }
        var cSize = centrals.reduce(function (a, b) { return a + b.length; }, 0);
        var eocd = new Uint8Array(22);
        var ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(8, centrals.length, true);
        ev.setUint16(10, centrals.length, true);
        ev.setUint32(12, cSize, true);
        ev.setUint32(16, offset, true);

        var totalLen = offset + cSize + 22;
        var out = new Uint8Array(totalLen);
        var pos = 0;
        for (var j = 0; j < locals.length; j++) { out.set(locals[j], pos); pos += locals[j].length; }
        for (var k = 0; k < centrals.length; k++) { out.set(centrals[k], pos); pos += centrals[k].length; }
        out.set(eocd, pos);
        return out;
    }

    function personalizeOfficePackage(packageBytes, formValues, matchTarget) {
        var pairs = buildReplacements(formValues);
        var enc = new TextEncoder();
        var dec = new TextDecoder('utf-8');
        var pred = typeof matchTarget === 'function'
            ? matchTarget
            : function (name) { return matchTarget.indexOf(name) !== -1; };
        return parseZip(packageBytes).then(function (innerEntries) {
            var updated = innerEntries.map(function (entry) {
                if (entry.isDir) return entry;
                if (pred(entry.name)) {
                    var xml = dec.decode(entry.data);
                    var nextXml = applyXmlReplacements(xml, pairs, true);
                    return { name: entry.name, data: enc.encode(nextXml), isDir: false };
                }
                return entry;
            });
            return buildZipBytes(updated);
        });
    }

    function personalizeEntryBytes(zipPath, rawBytes, formValues) {
        var lower = String(zipPath || '').toLowerCase();
        if (lower.endsWith('.docx')) {
            return personalizeOfficePackage(rawBytes, formValues, function (name) {
                return name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(name);
            });
        }
        if (lower.endsWith('.xlsx')) {
            return personalizeOfficePackage(rawBytes, formValues, function (name) {
                return name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
            });
        }
        return Promise.resolve(rawBytes);
    }

    function personalizeMasterZip(masterZipBuffer, formValues) {
        var d = normData(formValues);
        return parseZip(masterZipBuffer).then(function (entries) {
            var fileEntries = entries.filter(function (e) { return !e.isDir; });
            return Promise.all(fileEntries.map(function (e) {
                return personalizeEntryBytes(e.name, e.data, formValues).then(function (outData) {
                    return { name: e.name, data: outData };
                });
            })).then(function (outEntries) {
                return {
                    filename: 'Kit_Blindaje_Laboral_Personalizado_' + slugRut(d.rutEmpresa) + '.zip',
                    bytes: buildZipBytes(outEntries),
                    entriesCount: outEntries.length
                };
            });
        });
    }

    function extractDocPreviewText(docxBytes, maxParagraphs) {
        var dec = new TextDecoder('utf-8');
        return parseZip(docxBytes).then(function (entries) {
            var docEntry = entries.filter(function (e) { return e.name === 'word/document.xml'; })[0];
            if (!docEntry) return [];
            var xml = dec.decode(docEntry.data);
            var paras = [];
            var reP = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
            var reT = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
            var pm;
            while ((pm = reP.exec(xml)) !== null) {
                var text = '';
                var tm;
                reT.lastIndex = 0;
                while ((tm = reT.exec(pm[1])) !== null) {
                    text += tm[1]
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"');
                }
                text = text.trim();
                if (text) paras.push(text);
                if (maxParagraphs && paras.length >= maxParagraphs) break;
            }
            return paras;
        });
    }

    function filterByRubro(rubro) {
        if (!rubro || rubro === 'todos') return CATALOGO;
        return CATALOGO.filter(function (item) {
            return item.rubros.indexOf(rubro) !== -1 || item.rubros.indexOf('todos') !== -1;
        });
    }

    root.CLKitBlindajePersonalizador = {
        CATALOGO: CATALOGO,
        normData: normData,
        buildReplacements: buildReplacements,
        applyXmlReplacements: applyXmlReplacements,
        parseZip: parseZip,
        buildZipBytes: buildZipBytes,
        personalizeEntryBytes: personalizeEntryBytes,
        personalizeMasterZip: personalizeMasterZip,
        extractDocPreviewText: extractDocPreviewText,
        filterByRubro: filterByRubro,
        slugRut: slugRut
    };
})(typeof window !== 'undefined' ? window : globalThis);
