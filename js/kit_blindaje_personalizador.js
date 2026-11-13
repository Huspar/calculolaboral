/* Personalizador Web del Kit Blindaje Laboral Pyme 2026 (client-side, zero datos enviados al servidor) */
(function (root) {
    'use strict';

    var E = root.CLKitZipEngine || (typeof require === 'function' ? require('./kit_zip_engine.js') : null);
    if (!E) throw new Error('CLKitZipEngine no cargado.');

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

    function normData(raw) {
        raw = raw || {};
        var fecha = E.or(raw.fecha, E.fechaHoyLarga());
        var dm = E.splitFechaDiaMesAnio(fecha);
        var rep = E.or(raw.representante, '[NOMBRE REPRESENTANTE LEGAL]');
        return {
            razonSocial: E.or(raw.razonSocial, '[RAZÓN SOCIAL EMPRESA]'),
            rutEmpresa: E.or(raw.rutEmpresa, '[RUT EMPRESA]'),
            representante: rep,
            rutRepresentante: E.or(raw.rutRepresentante, '[RUT REPRESENTANTE]'),
            correoDenuncias: E.or(raw.correoDenuncias, '[CORREO_DENUNCIAS@EMPRESA.CL]'),
            direccion: E.or(raw.direccion, '[DIRECCIÓN COMPLETA, COMUNA, REGIÓN]'),
            ciudad: E.or(raw.ciudad, '[CIUDAD]'),
            sucursal: E.or(raw.sucursal, '[SUCURSAL O FAENA]'),
            encargadoKarin: E.or(raw.encargadoKarin, raw.representante ? rep : '[NOMBRE DEL ENCARGADO, PREVENCIONISTA O ASESOR]'),
            fecha: fecha,
            dia: dm.dia,
            mes: dm.mes,
            rubro: E.or(raw.rubro, 'todos'),
            trabajadorNombre: E.or(raw.trabajadorNombre, ''),
            trabajadorRut: E.or(raw.trabajadorRut, ''),
            trabajadorCargo: E.or(raw.trabajadorCargo, ''),
            trabajadorDomicilio: E.or(raw.trabajadorDomicilio, ''),
            fechaContrato: E.or(raw.fechaContrato, '')
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

    function personalizeEntryBytes(zipPath, rawBytes, formValues) {
        return E.personalizeEntryBytes(zipPath, rawBytes, buildReplacements(formValues));
    }

    function personalizeMasterZip(masterZipBuffer, formValues) {
        var d = normData(formValues);
        return E.personalizeMasterZip(
            masterZipBuffer,
            buildReplacements(formValues),
            'Kit_Blindaje_Laboral_Personalizado_' + E.slugRut(d.rutEmpresa) + '.zip'
        );
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
        applyXmlReplacements: E.applyXmlReplacements,
        parseZip: E.parseZip,
        buildZipBytes: E.buildZipBytes,
        personalizeEntryBytes: personalizeEntryBytes,
        personalizeMasterZip: personalizeMasterZip,
        extractDocPreviewText: E.extractDocPreviewText,
        filterByRubro: filterByRubro,
        slugRut: E.slugRut
    };
})(typeof window !== 'undefined' ? window : globalThis);
