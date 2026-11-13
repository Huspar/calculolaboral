/* Personalizador Web del Pack Cartas de Despido por Causal 2026 (client-side, zero datos enviados al servidor) */
(function (root) {
    'use strict';

    var E = root.CLKitZipEngine || (typeof require === 'function' ? require('./kit_zip_engine.js') : null);
    if (!E) throw new Error('CLKitZipEngine no cargado.');

    var CATALOGO = [
        {
            id: 'doc01',
            archivo: '01_Carta_Art161_Necesidades_de_la_Empresa.docx',
            zipPath: '01_Carta_Art161_Necesidades_de_la_Empresa.docx',
            grupo: '161',
            modulo: 'Art. 161 · Necesidades empresa',
            titulo: '01 · Necesidades de la Empresa (Art. 161 inc. 1)',
            etiqueta: 'Requiere aviso 30 días o indemnización sustitutiva + años de servicio',
            resumen: 'Carta con hoja de instrucciones, descripción de hechos económicos/técnicos objetivos para [RAZÓN SOCIAL EMPRESA], pago de cotizaciones y aviso de finiquito en [NOTARÍA / LUGAR DE FIRMA].'
        },
        {
            id: 'doc16',
            archivo: '16_Carta_Art161_Inc2_Desahucio_Escrito.docx',
            zipPath: '16_Carta_Art161_Inc2_Desahucio_Escrito.docx',
            grupo: '161',
            modulo: 'Art. 161 · Desahucio',
            titulo: '16 · Desahucio Escrito (Art. 161 inc. 2)',
            etiqueta: 'Gerentes, apoderados, exclusiva confianza y casa particular',
            resumen: 'Incluye opción A con aviso de 30 días y opción B con cese inmediato e indemnización sustitutiva para [NOMBRE COMPLETO DEL TRABAJADOR].'
        },
        {
            id: 'doc02',
            archivo: '02_Carta_Art160_N3_Inasistencia_Injustificada.docx',
            zipPath: '02_Carta_Art160_N3_Inasistencia_Injustificada.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '02 · Inasistencia Injustificada (Art. 160 N° 3)',
            etiqueta: '2 días seguidos, 2 lunes en el mes o 3 días en el mes',
            resumen: 'Carta formal con recuadro para detallar fechas exactas de ausencia sin aviso ni licencia médica y envío dentro de 3 días hábiles.'
        },
        {
            id: 'doc03',
            archivo: '03_Carta_Art160_N1a_Falta_de_Probidad.docx',
            zipPath: '03_Carta_Art160_N1a_Falta_de_Probidad.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '03 · Falta de Probidad (Art. 160 N° 1 a)',
            etiqueta: 'Apropiación, adulteración de registros o deshonestidad grave',
            resumen: 'Estructura detallada de hechos, descargos previos y respaldo probatorio para término sin indemnización.'
        },
        {
            id: 'doc04',
            archivo: '04_Carta_Art160_N1b_y_f_Acoso_Sexual_o_Laboral.docx',
            zipPath: '04_Carta_Art160_N1b_y_f_Acoso_Sexual_o_Laboral.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '04 · Acoso Sexual o Laboral (Art. 160 N° 1 b y f)',
            etiqueta: 'Alineada con procedimiento de investigación Ley Karin',
            resumen: 'Carta que vincula la denuncia, investigación interna o DT e informe final acreditado antes de desvincular.'
        },
        {
            id: 'doc05',
            archivo: '05_Carta_Art160_N1c_Vias_de_Hecho.docx',
            zipPath: '05_Carta_Art160_N1c_Vias_de_Hecho.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '05 · Vías de Hecho / Agresión (Art. 160 N° 1 c)',
            etiqueta: 'Agresión física contra empleador o compañeros',
            resumen: 'Modelo con detalle de fecha, testigos, constancias médicas y descargos.'
        },
        {
            id: 'doc06',
            archivo: '06_Carta_Art160_N1d_Injurias.docx',
            zipPath: '06_Carta_Art160_N1d_Injurias.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '06 · Injurias al Empleador (Art. 160 N° 1 d)',
            etiqueta: 'Ofensas graves debidamente acreditadas',
            resumen: 'Redacción precisa de expresiones ofensivas, contexto laboral y prueba testimonial o documental.'
        },
        {
            id: 'doc07',
            archivo: '07_Carta_Art160_N1e_Conducta_Inmoral.docx',
            zipPath: '07_Carta_Art160_N1e_Conducta_Inmoral.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '07 · Conducta Inmoral Grave (Art. 160 N° 1 e)',
            etiqueta: 'Actos graves que afecten el desempeño en la empresa',
            resumen: 'Instrucciones de prueba y relación directa con la actividad de [RAZÓN SOCIAL EMPRESA].'
        },
        {
            id: 'doc08',
            archivo: '08_Carta_Art160_N2_Negociaciones_Prohibidas.docx',
            zipPath: '08_Carta_Art160_N2_Negociaciones_Prohibidas.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '08 · Negociaciones Prohibidas (Art. 160 N° 2)',
            etiqueta: 'Competencia directa prohibida por escrito en el contrato',
            resumen: 'Verifica cláusula de prohibición expresa en contrato y detalla operaciones incompatibles.'
        },
        {
            id: 'doc09',
            archivo: '09_Carta_Art160_N4_Abandono_del_Trabajo.docx',
            zipPath: '09_Carta_Art160_N4_Abandono_del_Trabajo.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '09 · Abandono del Trabajo (Art. 160 N° 4)',
            etiqueta: 'Salida intempestiva o negativa injustificada a trabajar',
            resumen: 'Cubre letras a) y b) del Art. 160 N° 4 con detalle de turno, jefatura y orden incumplida.'
        },
        {
            id: 'doc10',
            archivo: '10_Carta_Art160_N5_Imprudencias_Temerarias.docx',
            zipPath: '10_Carta_Art160_N5_Imprudencias_Temerarias.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '10 · Imprudencias Temerarias (Art. 160 N° 5)',
            etiqueta: 'Afectación a seguridad, salud o higiene laboral',
            resumen: 'Registra incumplimiento grave a normas de seguridad, ODI/RIOSH y riesgo creado.'
        },
        {
            id: 'doc11',
            archivo: '11_Carta_Art160_N6_Perjuicio_Material_Intencional.docx',
            zipPath: '11_Carta_Art160_N6_Perjuicio_Material_Intencional.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '11 · Perjuicio Material Intencional (Art. 160 N° 6)',
            etiqueta: 'Sabotaje o daño deliberado en instalaciones o equipos',
            resumen: 'Detalla bien afectado, acto intencional y respaldo técnico de daños.'
        },
        {
            id: 'doc12',
            archivo: '12_Carta_Art160_N7_Incumplimiento_Grave_del_Contrato.docx',
            zipPath: '12_Carta_Art160_N7_Incumplimiento_Grave_del_Contrato.docx',
            grupo: '160',
            modulo: 'Art. 160 · Conducta imputable',
            titulo: '12 · Incumplimiento Grave del Contrato (Art. 160 N° 7)',
            etiqueta: 'La causal más litigada: exige hechos específicos y gravedad',
            resumen: 'Carta estructurada con obligación contractual infringida, amonestaciones previas y acuse de recibo.'
        },
        {
            id: 'doc13',
            archivo: '13_Carta_Art159_N4_Vencimiento_del_Plazo.docx',
            zipPath: '13_Carta_Art159_N4_Vencimiento_del_Plazo.docx',
            grupo: '159',
            modulo: 'Art. 159 · Sin culpa',
            titulo: '13 · Vencimiento del Plazo Fijo (Art. 159 N° 4)',
            etiqueta: 'Tope legal 1 año (2 años técnicos/profesionales) y max 1 renovación',
            resumen: 'Avisa término al vencer el plazo pactado y recuerda evitar continuidad tácita tras el vencimiento.'
        },
        {
            id: 'doc14',
            archivo: '14_Carta_Art159_N5_Conclusion_del_Trabajo_o_Servicio.docx',
            zipPath: '14_Carta_Art159_N5_Conclusion_del_Trabajo_o_Servicio.docx',
            grupo: '159',
            modulo: 'Art. 159 · Sin culpa',
            titulo: '14 · Conclusión Obra o Faena (Art. 159 N° 5)',
            etiqueta: 'Término de proyecto, faena o servicio determinado',
            resumen: 'Incluye referencia al contrato por obra y acta o recepción final que acredita conclusión.'
        },
        {
            id: 'doc15',
            archivo: '15_Carta_Art159_N6_Caso_Fortuito_o_Fuerza_Mayor.docx',
            zipPath: '15_Carta_Art159_N6_Caso_Fortuito_o_Fuerza_Mayor.docx',
            grupo: '159',
            modulo: 'Art. 159 · Sin culpa',
            titulo: '15 · Caso Fortuito o Fuerza Mayor (Art. 159 N° 6)',
            etiqueta: 'Plazo especial 6 días hábiles · Exige imposibilidad absoluta',
            resumen: 'Advierte criterios estrictos de DT/tribunales y acompaña respaldo técnico o administrativo.'
        },
        {
            id: 'doc17',
            archivo: '17_Carta_de_Amonestacion_Escrita.docx',
            zipPath: '17_Carta_de_Amonestacion_Escrita.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Documentación previa',
            titulo: '17 · Carta de Amonestación Escrita',
            etiqueta: 'Construye historial previo antes de llegar al Art. 160 N° 7',
            resumen: 'Constancia formal de falta leve/media, conducta esperada y entrega con firma.'
        },
        {
            id: 'doc18',
            archivo: '18_Citacion_y_Acta_de_Descargos.docx',
            zipPath: '18_Citacion_y_Acta_de_Descargos.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Documentación previa',
            titulo: '18 · Citación y Acta de Descargos',
            etiqueta: 'Buena práctica antes de aplicar causales del Art. 160',
            resumen: 'Citación a reunión con 2 días y acta de declaración del trabajador.'
        },
        {
            id: 'doc19',
            archivo: '19_Comunicacion_a_la_Inspeccion_del_Trabajo.docx',
            zipPath: '19_Comunicacion_a_la_Inspeccion_del_Trabajo.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Trámite DT',
            titulo: '19 · Comunicación a Inspección del Trabajo (DT)',
            etiqueta: 'Copia obligatoria Art. 162 dentro de 3 o 6 días hábiles',
            resumen: 'Oficio para ingresar presencialmente o adjuntar respaldo de envío por carta certificada.'
        },
        {
            id: 'doc20',
            archivo: '20_Estado_de_Pago_de_Cotizaciones_Previsionales.docx',
            zipPath: '20_Estado_de_Pago_de_Cotizaciones_Previsionales.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Ley Bustos',
            titulo: '20 · Estado de Pago de Cotizaciones Previsionales',
            etiqueta: 'Anexo obligatorio Ley Bustos (AFP, Salud, AFC, Mutual)',
            resumen: 'Planilla Word de respaldo previsional para adjuntar a la carta de despido.'
        },
        {
            id: 'doc21',
            archivo: '21_Checklist_de_Despido_Paso_a_Paso.docx',
            zipPath: '21_Checklist_de_Despido_Paso_a_Paso.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Control',
            titulo: '21 · Checklist de Despido Paso a Paso (Word)',
            etiqueta: 'Verificación imprimible de fuero, cotizaciones, carta y finiquito',
            resumen: 'Pauta en Word previa a notificar cualquier desvinculación.'
        },
        {
            id: 'xlsx22',
            archivo: '22_Control_Despidos_Plazos_Art162_y_Cotizaciones_2026.xlsx',
            zipPath: '22_Control_Despidos_Plazos_Art162_y_Cotizaciones_2026.xlsx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Excel Control',
            titulo: '22 · Excel Control Plazos Art. 162 y Ley Bustos (4 hojas)',
            etiqueta: 'Calcula límites de 3/6 y 10 días hábiles y verifica cotizaciones',
            resumen: 'Planilla Excel corporativa de 4 pestañas: Guía Rápida, Panel Resumen %, Bitácora Art. 162 y Checklist Ley Bustos.'
        },
        {
            id: 'doc00',
            archivo: '00_LEEME_Guia_de_Uso_y_Plazos.docx',
            zipPath: '00_LEEME_Guia_de_Uso_y_Plazos.docx',
            grupo: 'apoyo',
            modulo: 'Apoyo · Guía inicial',
            titulo: '00 · LÉEME Guía de Uso y Plazos',
            etiqueta: 'Mapa rápido de causales y reglas de envío',
            resumen: 'Instructivo general para elegir la carta correcta y respetar los plazos legales.'
        }
    ];

    function normData(raw) {
        raw = raw || {};
        var fecha = E.or(raw.fechaCarta, E.fechaHoyLarga());
        var dmy = E.splitFechaDiaMesAnio(fecha);
        return {
            grupo: E.or(raw.grupo, 'todas'),
            razonSocial: E.or(raw.razonSocial, '[RAZÓN SOCIAL EMPRESA]'),
            rutEmpresa: E.or(raw.rutEmpresa, '[RUT EMPRESA]'),
            representante: E.or(raw.representante, '[NOMBRE REPRESENTANTE LEGAL]'),
            rutRepresentante: E.or(raw.rutRepresentante, '[RUT REPRESENTANTE]'),
            ciudad: E.or(raw.ciudad, '[CIUDAD]'),
            direccionEmpresa: E.or(raw.direccionEmpresa, '[DIRECCIÓN]'),
            notaria: E.or(raw.notaria, '[NOTARÍA / LUGAR DE FIRMA]'),
            fechaCarta: fecha,
            dia: dmy.dia,
            mes: dmy.mes,
            anio: dmy.anio,
            diaTermino: E.or(raw.diaTermino, ''),
            mesTermino: E.or(raw.mesTermino, ''),
            trabajadorNombre: E.or(raw.trabajadorNombre, ''),
            trabajadorRut: E.or(raw.trabajadorRut, ''),
            trabajadorCargo: E.or(raw.trabajadorCargo, ''),
            trabajadorDomicilio: E.or(raw.trabajadorDomicilio, ''),
            trabajadorComuna: E.or(raw.trabajadorComuna, ''),
            saludInstitucion: E.or(raw.saludInstitucion, ''),
            mutualInstitucion: E.or(raw.mutualInstitucion, ''),
            mesCotizaciones: E.or(raw.mesCotizaciones, '')
        };
    }

    function buildReplacements(raw) {
        var d = normData(raw);
        var pairs = [
            ['[RAZÓN SOCIAL EMPRESA]', d.razonSocial],
            ['[RUT EMPRESA]', d.rutEmpresa],
            ['[NOMBRE REPRESENTANTE LEGAL]', d.representante],
            ['[RUT REPRESENTANTE]', d.rutRepresentante],
            ['[CIUDAD]', d.ciudad],
            ['[COMUNA]', d.ciudad],
            ['[DIRECCIÓN]', d.direccionEmpresa],
            ['[NOTARÍA / LUGAR DE FIRMA]', d.notaria],
            ['[DÍA]', d.dia],
            ['[MES]', d.mes],
            ['[AÑO]', d.anio]
        ];
        if (d.diaTermino) {
            pairs.push(
                ['[DÍA DE TÉRMINO]', d.diaTermino],
                ['[DÍA DE CESE]', d.diaTermino]
            );
        }
        if (d.mesTermino) {
            pairs.push(['[MES DE CESE]', d.mesTermino]);
        } else if (d.diaTermino) {
            pairs.push(['[MES DE CESE]', d.mes]);
        }
        if (d.trabajadorNombre) {
            pairs.push(
                ['[NOMBRE COMPLETO DEL TRABAJADOR]', d.trabajadorNombre],
                ['[NOMBRE TRABAJADOR]', d.trabajadorNombre],
                ['[NOMBRE COMPLETO]', d.trabajadorNombre]
            );
        }
        if (d.trabajadorRut) {
            pairs.push(
                ['[RUT DEL TRABAJADOR]', d.trabajadorRut],
                ['[RUT TRABAJADOR]', d.trabajadorRut],
                ['[RUT]', d.trabajadorRut]
            );
        }
        if (d.trabajadorCargo) {
            pairs.push(
                ['[CARGO O FUNCIÓN]', d.trabajadorCargo],
                ['[CARGO]', d.trabajadorCargo]
            );
        }
        if (d.trabajadorDomicilio) {
            pairs.push(['[DIRECCIÓN REGISTRADA EN EL CONTRATO]', d.trabajadorDomicilio]);
        }
        if (d.trabajadorComuna) {
            pairs.push(['[COMUNA / CIUDAD]', d.trabajadorComuna]);
        }
        if (d.saludInstitucion) {
            pairs.push(['[FONASA / ISAPRE NOMBRE]', d.saludInstitucion]);
        }
        if (d.mutualInstitucion) {
            pairs.push(['[MUTUAL / ISL]', d.mutualInstitucion]);
        }
        if (d.mesCotizaciones) {
            pairs.push(['[MES Y AÑO ANTERIOR AL TÉRMINO]', d.mesCotizaciones]);
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
            'Pack_Cartas_Despido_Personalizado_' + E.slugRut(d.rutEmpresa) + '.zip'
        );
    }

    function filterByGrupo(grupo) {
        if (!grupo || grupo === 'todas') return CATALOGO;
        return CATALOGO.filter(function (item) {
            return item.grupo === grupo;
        });
    }

    root.CLKitDespidoPersonalizador = {
        CATALOGO: CATALOGO,
        normData: normData,
        buildReplacements: buildReplacements,
        applyXmlReplacements: E.applyXmlReplacements,
        parseZip: E.parseZip,
        buildZipBytes: E.buildZipBytes,
        personalizeEntryBytes: personalizeEntryBytes,
        personalizeMasterZip: personalizeMasterZip,
        extractDocPreviewText: E.extractDocPreviewText,
        filterByGrupo: filterByGrupo,
        slugRut: E.slugRut
    };
})(typeof window !== 'undefined' ? window : globalThis);
