import os
import re
import glob
import json

# Paths
SOURCE_DIR = r"c:\Users\Jhon\Desktop\Arreglarpagina"
DEST_DIR = r"c:\Users\Jhon\Desktop\Arreglarpagina\calculolaboral-v2"

if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

def generate_seo_tags(filename, title, description, page_type="website"):
    # 1. Canonical URL
    if filename == "index.html":
        canonical_url = "https://calculolaboral.cl/"
    else:
        canonical_url = f"https://calculolaboral.cl/{filename.replace(".html", "")}"
        
    # 2. Open Graph Tags
    if filename == "fondos-generacionales-afp-chile.html":
        og_img = "https://calculolaboral.cl/assets/guia-fondos-generacionales-afp-cover.png"
    elif filename == "propuesta-indemnizacion-a-todo-evento-chile.html":
        og_img = "https://calculolaboral.cl/assets/guia-indemnizacion-todo-evento-chile.jpg"
    elif filename == "checklist-fiscalizacion-dt-pymes-chile.html":
        og_img = "https://calculolaboral.cl/assets/guia-fiscalizacion-dt-pymes-cover.png"
    else:
        og_img = "https://calculolaboral.cl/assets/og-image.png"
    og_tags_list = [
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{description}">',
        f'<meta property="og:type" content="{page_type}">',
        f'<meta property="og:url" content="{canonical_url}">',
        f'<meta property="og:image" content="{og_img}">',
        '<meta property="og:locale" content="es_CL">',
        '<meta property="og:site_name" content="Cálculo Laboral">'
    ]
    og_tags = "\n    ".join(og_tags_list)
    
    # 3. Structured Data with FAQPage Schema
    faqs_sueldo = [
        {
            "@type": "Question",
            "name": "¿Cómo se calcula el sueldo líquido en Chile?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El sueldo líquido se obtiene restando del Sueldo Bruto Imponible los descuentos obligatorios: AFP (10,58% a 11,45%), Salud (7% Fonasa o pactado en Isapre), Seguro de Cesantía (0,6% en contrato indefinido) y el Impuesto Único de Segunda Categoría si la renta imponible supera las 13,5 UTM."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuáles son las comisiones de las AFP vigentes en 2026?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Las tasas totales obligatorias de AFP en 2026 son: AFP Modelo 10,58%, AFP Uno 10,69%, Planvital 11,16%, Habitat 11,27%, Capital 11,44%, Cuprum 11,44% y Provida 11,45%."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo funciona el tope de gratificación legal (Art. 50)?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El empleador abona el 25% de las remuneraciones devengadas con un tope anual legal de 4,75 Ingresos Mínimos Mensuales (IMM), equivalentes a $219.114 mensuales con el sueldo mínimo vigente de 2026."
            }
        },
        {
            "@type": "Question",
            "name": "¿Qué haberes no pagan impuestos ni cotizaciones previsionales?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Las asignaciones de colación, movilización y viáticos no son imponibles ni tributables, siempre que sus montos sean razonables y correspondan a gastos efectivos del trabajador."
            }
        }
    ]

    faqs_finiquito = [
        {
            "@type": "Question",
            "name": "¿Qué conceptos integra un finiquito laboral en Chile?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Un finiquito legal contempla: remuneraciones pendientes de los días trabajados en el mes, indemnización por vacaciones proporcionales y pendientes, indemnización por años de servicio (1 mes por año en despidos por Art. 161) e indemnización sustitutiva de aviso previo (1 mes si no se avisó con 30 días de anticipación)."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo se calcula la indemnización por años de servicio?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Conforme al artículo 163 del Código del Trabajo, si el despido es por Necesidades de la Empresa (Art. 161), corresponde 1 mes de la última remuneración mensual por cada año trabajado (y fracción superior a 6 meses), con un tope legal máximo de 11 años y 90 UF por mes."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo se pagan las vacaciones proporcionales en el finiquito?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Se acumulan 1,25 días hábiles por cada mes trabajado. Al terminar la relación laboral, los días hábiles acumulados se proyectan sobre días corridos y se multiplican por la remuneración diaria del trabajador."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuál es el plazo legal para el pago del finiquito?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "De acuerdo con el artículo 177 del Código del Trabajo, el empleador tiene un plazo máximo legal de 10 días hábiles desde el término del contrato para poner a disposición del trabajador el finiquito y el pago total."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuándo puede el empleador descontar el aporte de la AFC?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Solo en despidos por el Artículo 161 (Necesidades de la Empresa), el empleador tiene derecho a descontar de la indemnización por años de servicio el monto histórico que aportó a la cuenta individual de cesantía del trabajador (Art. 13 Ley 19.728)."
            }
        }
    ]

    faqs_40h = [
        {
            "@type": "Question",
            "name": "¿La reducción a 42 horas puede disminuir mi sueldo?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. La Ley 21.561 prohíbe expresamente que la reducción de jornada laboral disminuya las remuneraciones de los trabajadores."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuánto vale la hora ordinaria de trabajo en Chile en 2026?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Con la jornada legal de 42 horas y el sueldo mínimo de $553.553, el valor oficial de la hora ordinaria es de $3.075 CLP (divisor mensual de 180 horas) y la hora extraordinaria al 50% es de $4.613 CLP."
            }
        },
        {
            "@type": "Question",
            "name": "¿Qué pasa si mi empleador no aplica la reducción a 42 horas?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Puedes ingresar una denuncia confidencial ante la Dirección del Trabajo (DT). El empleador se expone a multas que van desde 1 a 60 UTM por cada trabajador afectado."
            }
        }
    ]

    faqs_horas_extras = [
        {
            "@type": "Question",
            "name": "¿Cuánto vale la hora de trabajo y la hora extra con sueldo mínimo en Chile en 2026?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Con el sueldo mínimo de $553.553 y la jornada legal de 42 horas (Ley 40 Horas), la hora ordinaria vale $3.075 CLP (divisor mensual de 180 horas). La hora extra con recargo del 50% (días hábiles) vale $4.613 CLP y con recargo del 100% (domingos o festivos) vale $6.151 CLP."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo se calcula el valor de una hora extra en Chile en 2026?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Con la jornada legal de 42 horas, se divide el Sueldo Base por 180 horas (o se multiplica por el factor DT 0,0055555) para obtener la hora ordinaria. Luego se multiplica por 1,50 para el recargo del 50% legal o por 2,00 para el recargo del 100%."
            }
        },
        {
            "@type": "Question",
            "name": "¿Las horas extras pagan impuestos y cotizaciones?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sí. Las horas extraordinarias constituyen remuneración imponible y tributable, por lo que están sujetas a los descuentos legales de AFP, Salud (Fonasa/Isapre) y Seguro de Cesantía."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuál es el límite legal máximo de horas extras por día?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El Código del Trabajo (Art. 31) limita las horas extraordinarias a un máximo de 2 horas diarias, previo pacto escrito por necesidades temporales de la empresa."
            }
        }
    ]

    faqs_part_time = [
        {
            "@type": "Question",
            "name": "¿Cuál es el sueldo mínimo para un contrato part-time en Chile?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El sueldo mínimo es proporcional a la jornada semanal respecto a las 42 horas legales. Con el ingreso mínimo de $553.553, el piso para 30 horas es de $395.395 CLP y para 20 horas es de $263.596 CLP."
            }
        },
        {
            "@type": "Question",
            "name": "¿Los estudiantes pierden la Gratuidad por trabajar part-time?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. Según la Ley 21.155 (Art. 40 bis E), los estudiantes entre 18 y 24 años pueden percibir remuneraciones de hasta 2 Ingresos Mínimos Mensuales ($1.107.106) sin perder la Gratuidad, becas estatales ni su condición de carga médica de sus padres."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo se calcula la semana corrida si gano comisiones en un part-time?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Se divide el total de comisiones devengadas en la semana por los días efectivamente trabajados, y ese promedio diario se multiplica por los días domingos y festivos del mes."
            }
        }
    ]

    faqs_vacaciones = [
        {
            "@type": "Question",
            "name": "¿Cómo se calculan las vacaciones proporcionales en Chile en 2026?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Se calculan multiplicando el tiempo trabajado por 1,25 días hábiles al mes (o 1,67 en zona extrema). A los días hábiles acumulados se les proyectan los días inhábiles (sábados, domingos y festivos) conforme a la doctrina de la Dirección del Trabajo (Art. 73 CT), y el total de días se multiplica por el sueldo diario (sueldo mensual / 30)."
            }
        },
        {
            "@type": "Question",
            "name": "¿Por qué las vacaciones se pagan con días sábados y domingos en el finiquito?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Conforme a los dictámenes oficiales de la Dirección del Trabajo (DT N° 4535/209), el feriado se proyecta en días corridos a partir del día siguiente al término laboral. Como el descanso legal presupone que el trabajador habría descansado los fines de semana y festivos, estos días inhábiles deben sumarse y pagarse en el finiquito."
            }
        },
        {
            "@type": "Question",
            "name": "¿Las vacaciones proporcionales sufren descuentos de AFP y Fonasa?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. La compensación en dinero del feriado proporcional tiene naturaleza indemnizatoria y no remuneratoria, por lo que está legalmente exenta de cotizaciones previsionales de AFP, Fonasa/Isapre y Seguro de Cesantía (Dictamen DT N° 2399/112)."
            }
        },
        {
            "@type": "Question",
            "name": "¿Se pagan las vacaciones proporcionales si renuncio voluntariamente?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sí. El feriado legal y proporcional es un derecho irrenunciable garantizado por el Código del Trabajo. El empleador está obligado a pagarlo en cualquier tipo de término de contrato: renuncia voluntaria, despido por necesidades de la empresa, despido disciplinario (Art. 160) o mutuo acuerdo."
            }
        }
    ]

    faqs_despido_art160 = [
        {
            "@type": "Question",
            "name": "¿Qué me deben pagar si me despiden por el Artículo 160 del Código del Trabajo?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Aunque el Art. 160 no da derecho a indemnización por años de servicio ni aviso previo, tus derechos irrenunciables son sagrados: el empleador DEBE pagarte las remuneraciones por los días efectivamente trabajados en el mes y la indemnización por feriado proporcional y vacaciones acumuladas pendientes en un plazo máximo de 10 días hábiles (Art. 177 CT)."
            }
        },
        {
            "@type": "Question",
            "name": "¿Qué recargo puedo exigir si demando por despido injustificado bajo el Art. 160?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "De acuerdo con el artículo 168 letra c del Código del Trabajo, si el tribunal laboral declara que el despido por el Art. 160 fue injustificado o improcedente, ordenará el pago de 1 mes de aviso previo, 1 mes por año de servicio (tope 11 años) más un recargo legal que va del 50% al 100% sobre la indemnización por años de servicio."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo debo firmar el finiquito para poder demandar al empleador?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Debes escribir de tu puño y letra la 'Reserva de Derechos' antes de firmar ante el ministro de fe (o ratificarla en Mi DT). Ejemplo: 'Me reservo el derecho a demandar por despido injustificado e improcedente conforme al Art. 168 del Código del Trabajo, recargos legales y prestaciones adeudadas'. El empleador está obligado a pagarte de inmediato los montos reconocidos sin retenciones (Ley 21.361)."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cuál es el plazo para demandar por despido injustificado?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El plazo legal es de 60 días hábiles contados desde la fecha de separación. Si interpones un reclamo administrativo ante la Inspección del Trabajo, el plazo judicial se suspende pero en ningún caso podrá superar los 90 días hábiles totales."
            }
        }
    ]

    faqs_fondos_generacionales = [
        {
            "@type": "Question",
            "name": "¿Qué son los Fondos Generacionales de las AFP?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Son fondos de inversión por ciclo de vida (Target Date Funds) donde los ahorros previsionales de los trabajadores se asignan según su año de nacimiento. A medida que el trabajador envejece, el fondo reduce automáticamente el riesgo pasando de renta variable a renta fija sin necesidad de hacer trámites manuales."
            }
        },
        {
            "@type": "Question",
            "name": "¿Tendré que hacer algún trámite en mi AFP para el cambio de fondo?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. La asignación inicial a tu fondo generacional por año de nacimiento se realiza de forma 100% automática por parte de tu AFP, sin costo ni comisiones de traspaso para el afiliado."
            }
        },
        {
            "@type": "Question",
            "name": "¿Desaparecen los multifondos A, B, C, D y E en Chile?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sí. Para las cotizaciones obligatorias de los trabajadores dependientes e independientes, el esquema tradicional de 5 multifondos (A al E) se reemplaza por el sistema de fondos generacionales."
            }
        },
        {
            "@type": "Question",
            "name": "¿Podré elegir un fondo diferente al que me asignaron por edad?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El modelo está diseñado para mantener a cada persona en su cohorte generacional para maximizar la pensión y evitar pérdidas por especulación. Sin embargo, la normativa contempla opciones acotadas para optar por fondos adyacentes de perfil más conservador o dinámico dentro de márgenes legales."
            }
        },
        {
            "@type": "Question",
            "name": "¿Este cambio modifica el 10% de cotización mensual de mi sueldo?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. El porcentaje de cotización previsional de tu sueldo no cambia por esta medida; lo que cambia es la estrategia de inversión y diversificación de tus ahorros en la administradora."
            }
        }
    ]

    faqs_indemnizacion_todo_evento = [
        {
            "@type": "Question",
            "name": "¿La indemnización a todo evento ya está aprobada y es ley vigente?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. Actualmente es una propuesta técnica en fase de estudio y diseño pre-legislativo dentro del Ministerio del Trabajo, sobre la base de las recomendaciones de la Mesa de Reactivación Laboral. No ha sido aprobada por el Congreso ni promulgada como ley."
            }
        },
        {
            "@type": "Question",
            "name": "¿Si renuncio a mi trabajo hoy en 2026, tengo derecho a indemnización por años de servicio?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. Conforme al artículo 159 Nº2 del Código del Trabajo vigente, la renuncia voluntaria no da derecho a indemnización por años de servicio ni sustitutiva del aviso previo. En tu finiquito actual solo te corresponde el pago de los días trabajados en el mes y las vacaciones proporcionales y pendientes."
            }
        },
        {
            "@type": "Question",
            "name": "¿Qué pasará con mis años de servicio acumulados si se llega a aprobar esta reforma?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "El Gobierno y las autoridades laborales han reiterado que la reforma no sería retroactiva. Cualquier modificación legal regiría exclusivamente para los nuevos contratos que se firmen a futuro, manteniendo intactos los derechos adquiridos y el sistema de un mes por año de los contratos vigentes."
            }
        },
        {
            "@type": "Question",
            "name": "¿Cómo funcionaría el esquema del 1,8% en estudio?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "La propuesta plantea que el empleador cotice mensualmente un porcentaje cercano al 1,8% de la remuneración en una cuenta individual vinculada al Seguro de Cesantía. Ese fondo se acumularía mes a mes y el trabajador podría retirarlo al terminar su relación laboral por cualquier causa, incluida la renuncia."
            }
        },
        {
            "@type": "Question",
            "name": "¿Es posible pactar una indemnización a todo evento con las leyes actuales de Chile?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sí, pero bajo reglas muy restringidas: el artículo 164 del Código del Trabajo permite pactar indemnización a todo evento únicamente a contar del inicio del séptimo año de relación laboral, con acuerdo mutuo y mediante un depósito mensual del empleador no inferior al 4,11% de la remuneración en la AFP."
            }
        }
    ]

    faqs_checklist_dt = [
        {
            "@type": "Question",
            "name": "¿Cuáles son los documentos más fiscalizados por la Dirección del Trabajo a Pymes?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Los 4 documentos prioritarios en 2026 son: 1) Contratos de trabajo firmados con funciones actualizadas, 2) Anexos de reducción a 42 horas (Ley 40 Horas), 3) Protocolo de Prevención de Ley Karin con canal de denuncias (DS 44), y 4) Registro fidedigno y diario de asistencia."
            }
        },
        {
            "@type": "Question",
            "name": "¿A cuánto ascienden las multas de la DT para micro y pequeñas empresas?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Conforme al Art. 506 del Código del Trabajo, para microempresas (1-9 trabajadores) las multas oscilan entre 1 y 10 UTM por infracción. Para pequeñas empresas (10-49 trabajadores), van de 2 a 40 UTM. En materias gravísimas como seguridad o Ley Karin, alcanzan hasta 60 UTM."
            }
        },
        {
            "@type": "Question",
            "name": "¿Qué plazo tiene la empresa para exhibir documentos no disponibles en el local?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Si los documentos no se encuentran físicamente en el local durante la visita, el fiscalizador otorga habitualmente entre 2 y 5 días hábiles para exhibirlos en la oficina de la Inspección o cargarlos en el portal Mi DT."
            }
        },
        {
            "@type": "Question",
            "name": "¿Se puede apelar o rebajar una multa impuesta por la DT?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sí. Mediante el recurso de reconsideración administrativa del Art. 511 del Código del Trabajo, las micro y pequeñas empresas pueden solicitar una rebaja de hasta el 80% o sustitución por capacitación dentro de los 15 días hábiles siguientes a la notificación si acreditan haber corregido la infracción."
            }
        }
    ]

    howto_sueldo = {
        "@type": "HowTo",
        "name": "Cómo Calcular el Sueldo Líquido en Chile (Fórmula 2026)",
        "description": "Fórmula legal paso a paso para calcular el sueldo líquido a partir del sueldo bruto con descuentos de AFP, salud, cesantía e impuesto único en Chile.",
        "step": [
            {
                "@type": "HowToStep",
                "name": "Paso 1: Determinar el Sueldo Imponible",
                "text": "Suma el sueldo base, horas extras, gratificación legal (tope 4,75 IMM) y bonos imponibles para obtener la base afecta a cotizaciones.",
                "url": "https://calculolaboral.cl/como-calcular-sueldo-liquido-paso-a-paso#paso-1"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 2: Calcular Descuentos Previsionales Obligatorios",
                "text": "Descuenta la cotización de AFP (10,58% a 11,45% con tope de 89.9 UF), 7% de Salud (Fonasa o Isapre) y 0,6% de Seguro de Cesantía.",
                "url": "https://calculolaboral.cl/como-calcular-sueldo-liquido-paso-a-paso#paso-2"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 3: Aplicar Impuesto Único de Segunda Categoría",
                "text": "Resta las leyes sociales para obtener la base tributable. Si supera 13,5 UTM mensuales, aplica el factor y la rebaja del tramo según la tabla del SII.",
                "url": "https://calculolaboral.cl/como-calcular-sueldo-liquido-paso-a-paso#paso-3"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 4: Sumar Haberes No Imponibles",
                "text": "Agrega asignaciones no imponibles ni tributables como colación, movilización y viáticos para obtener el sueldo líquido a pago final.",
                "url": "https://calculolaboral.cl/como-calcular-sueldo-liquido-paso-a-paso#paso-4"
            }
        ]
    }

    howto_finiquito = {
        "@type": "HowTo",
        "name": "Cómo Calcular el Finiquito Laboral en Chile (Fórmula 2026)",
        "description": "Paso a paso para calcular el finiquito de trabajo según causales del Código del Trabajo (Art. 159, 160 y 161), con indemnizaciones, aviso previo y vacaciones.",
        "step": [
            {
                "@type": "HowToStep",
                "name": "Paso 1: Calcular Remuneraciones Pendientes",
                "text": "Calcula el pago de los días efectivamente trabajados en el mes de desvinculación multiplicando los días trabajados por el sueldo diario.",
                "url": "https://calculolaboral.cl/como-calcular-finiquito-chile#paso-1"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 2: Calcular Vacaciones Proporcionales (Art. 73)",
                "text": "Calcula 1,25 días hábiles por mes trabajado. Proyecta los días hábiles sobre el calendario corrido y multiplica por el sueldo diario íntegro.",
                "url": "https://calculolaboral.cl/como-calcular-finiquito-chile#paso-2"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 3: Calcular Indemnización por Años de Servicio (Art. 163)",
                "text": "En despido por Necesidades de la Empresa (Art. 161), corresponde 1 mes de sueldo por cada año trabajado (y fracción > 6 meses), con tope de 11 años y 90 UF/mes.",
                "url": "https://calculolaboral.cl/como-calcular-finiquito-chile#paso-3"
            },
            {
                "@type": "HowToStep",
                "name": "Paso 4: Indemnización Sustitutiva de Aviso Previo (Art. 162)",
                "text": "Si el empleador no notificó la carta con al menos 30 días de anticipación, suma 1 mes completo adicional de la última remuneración mensual.",
                "url": "https://calculolaboral.cl/como-calcular-finiquito-chile#paso-4"
            }
        ]
    }

    if filename == "index.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "name": "Cálculo Laboral Chile",
                    "url": "https://calculolaboral.cl/",
                    "description": "Calcula gratis finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time en Chile conforme a la Dirección del Trabajo.",
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": "https://calculolaboral.cl/?q={search_term_string}",
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_sueldo[:2] + faqs_finiquito[:2]
                }
            ]
        }
    elif filename == "sueldo_liquido.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Sueldo Líquido Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "url": "https://calculolaboral.cl/sueldo_liquido",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "412",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Calculadora de Sueldo Líquido", "item": "https://calculolaboral.cl/sueldo_liquido" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_sueldo
                }
            ]
        }
    elif filename == "finiquito_calculator.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Finiquito Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "url": "https://calculolaboral.cl/finiquito_calculator",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "580",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Calculadora de Finiquito", "item": "https://calculolaboral.cl/finiquito_calculator" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_finiquito
                }
            ]
        }
    elif filename == "calculadora-horas-extras.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Horas Extras Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "url": "https://calculolaboral.cl/calculadora-horas-extras",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "348",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Inicio",
                            "item": "https://calculolaboral.cl/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Calculadora de Horas Extras",
                            "item": "https://calculolaboral.cl/calculadora-horas-extras"
                        }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_horas_extras
                }
            ]
        }
    elif filename == "calculadora-sueldo-part-time.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Sueldo Part-Time Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "215",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Calculadora Sueldo Part-Time", "item": "https://calculolaboral.cl/calculadora-sueldo-part-time" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_part_time
                }
            ]
        }
    elif filename == "calculadora-vacaciones-proporcionales.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Vacaciones Proporcionales Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "url": "https://calculolaboral.cl/calculadora-vacaciones-proporcionales",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "284",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Calculadora de Vacaciones Proporcionales", "item": "https://calculolaboral.cl/calculadora-vacaciones-proporcionales" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_vacaciones
                }
            ]
        }
    elif filename == "calculadora-despido-articulo-160.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": "Calculadora de Finiquito por Despido Art. 160 Chile 2026",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "All",
                    "url": "https://calculolaboral.cl/calculadora-despido-articulo-160",
                    "description": description,
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.9",
                        "reviewCount": "319",
                        "bestRating": "5",
                        "worstRating": "1"
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Calculadora Despido Art. 160", "item": "https://calculolaboral.cl/calculadora-despido-articulo-160" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_despido_art160
                }
            ]
        }
    elif filename == "checklist-fiscalizacion-dt-pymes-chile.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "image": "https://calculolaboral.cl/assets/guia-fiscalizacion-dt-pymes-cover.png",
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-09-10",
                    "dateModified": "2026-09-10"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Para Empleadores", "item": "https://calculolaboral.cl/para-empleadores" },
                        { "@type": "ListItem", "position": 3, "name": "Checklist Fiscalización DT (Pymes)", "item": "https://calculolaboral.cl/checklist-fiscalizacion-dt-pymes-chile" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_checklist_dt
                }
            ]
        }
    elif filename == "ley-40-horas-chile-2026.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-01-01",
                    "dateModified": "2026-07-08"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://calculolaboral.cl/blog" },
                        { "@type": "ListItem", "position": 3, "name": "Ley 40 Horas Chile 2026", "item": "https://calculolaboral.cl/ley-40-horas-chile-2026" }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_40h
                }
            ]
        }
    elif filename == "como-calcular-sueldo-liquido-paso-a-paso.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-01-01",
                    "dateModified": "2026-07-08"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://calculolaboral.cl/blog" },
                        { "@type": "ListItem", "position": 3, "name": "Cómo Calcular Sueldo Líquido", "item": "https://calculolaboral.cl/como-calcular-sueldo-liquido-paso-a-paso" }
                    ]
                },
                howto_sueldo,
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_sueldo
                }
            ]
        }
    elif filename == "como-calcular-finiquito-chile.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-01-01",
                    "dateModified": "2026-07-08"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://calculolaboral.cl/blog" },
                        { "@type": "ListItem", "position": 3, "name": "Cómo Calcular Finiquito", "item": "https://calculolaboral.cl/como-calcular-finiquito-chile" }
                    ]
                },
                howto_finiquito,
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_finiquito
                }
            ]
        }
    elif filename == "despido-necesidades-empresa-articulo-161.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-01-01",
                    "dateModified": "2026-07-08"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://calculolaboral.cl/" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://calculolaboral.cl/blog" },
                        { "@type": "ListItem", "position": 3, "name": "Despido Artículo 161", "item": "https://calculolaboral.cl/despido-necesidades-empresa-articulo-161" }
                    ]
                }
            ]
        }
    elif filename == "fondos-generacionales-afp-chile.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-09-05",
                    "dateModified": "2026-09-05"
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Inicio",
                            "item": "https://calculolaboral.cl/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Blog",
                            "item": "https://calculolaboral.cl/blog"
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": "Fondos Generacionales AFP Chile",
                            "item": "https://calculolaboral.cl/fondos-generacionales-afp-chile"
                        }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_fondos_generacionales
                }
            ]
        }
    elif filename == "propuesta-indemnizacion-a-todo-evento-chile.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Article",
                    "headline": title.split("|")[0].strip(),
                    "description": description,
                    "author": { "@type": "Organization", "name": "Cálculo Laboral" },
                    "datePublished": "2026-09-09",
                    "dateModified": "2026-09-09",
                    "image": og_img
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Inicio",
                            "item": "https://calculolaboral.cl/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Blog",
                            "item": "https://calculolaboral.cl/blog"
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": "Indemnización a Todo Evento",
                            "item": "https://calculolaboral.cl/propuesta-indemnizacion-a-todo-evento-chile"
                        }
                    ]
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": faqs_indemnizacion_todo_evento
                }
            ]
        }
    elif page_type == "article":
        json_ld_data = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title.split("|")[0].strip(),
            "description": description,
            "author": { "@type": "Organization", "name": "Cálculo Laboral" },
            "datePublished": "2026-01-01",
            "dateModified": "2026-07-08"
        }
    elif filename == "sobre-nosotros.html":
        json_ld_data = {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": "Sobre Nosotros | Cálculo Laboral Chile",
            "description": description,
            "url": canonical_url,
            "mainEntity": {
                "@type": "Organization",
                "name": "Cálculo Laboral",
                "url": "https://calculolaboral.cl",
                "logo": "https://calculolaboral.cl/assets/og-image.png"
            }
        }
    else:
        json_ld_data = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title.split("|")[0].strip(),
            "description": description,
            "url": canonical_url
        }
        
    json_ld_str = f'<script type="application/ld+json">\n{json.dumps(json_ld_data, indent=4, ensure_ascii=False)}\n</script>'
    
    return canonical_url, og_tags, json_ld_str


# 1. Base Layout Components
HEADER_HTML = """
    <!-- Header -->
    <header class="sticky top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm transition-all duration-300 no-print">
        <div class="max-w-[1200px] mx-auto px-6">
            <div class="flex justify-between items-center h-16">
                <!-- Logo -->
                <a href="./" class="flex-shrink-0 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                    <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition-transform">
                        <svg class="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                            <!-- Pedestal Base -->
                            <path d="M30 84h40M38 79h24"></path>
                            <!-- Vertical Pillar -->
                            <path d="M50 22v57"></path>
                            <!-- Center pointer tip -->
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <!-- Balance Beam -->
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <!-- Left Pan strings and dish -->
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Right Pan strings and dish -->
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Monogram C wrapping left side -->
                            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                            <!-- Monogram L wrapping right side -->
                            <path d="M58 43.5v20h10"></path>
                        </svg>
                    </div>
                    <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span class="text-sky-500">Laboral</span></span>
                </a>

                <!-- Desktop Menu -->
                <nav class="hidden md:flex gap-6 items-center">
                    <!-- Dropdown Calculadoras -->
                    <div class="relative group">
                        <button class="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-sky-500 transition-colors py-2 outline-none">
                            Calculadoras
                            <span class="material-icons text-xs group-hover:rotate-180 transition-transform">expand_more</span>
                        </button>
                        <div class="absolute left-0 mt-0 w-48 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                            <div class="p-2 space-y-1">
                                <a href="sueldo_liquido" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Sueldo Líquido</a>
                                <a href="finiquito_calculator" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Finiquito</a>
                                <a href="calculadora-horas-extras" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Horas Extras</a>
                                <a href="calculadora-sueldo-part-time" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Sueldo Part-Time</a>
                                <a href="calculadora-vacaciones-proporcionales" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Vacaciones Proporcionales</a>
                                <a href="calculadora-despido-articulo-160" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Despido Art. 160</a>
                            </div>
                        </div>
                    </div>

                    <!-- Dropdown Guías -->
                    <div class="relative group">
                        <button class="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-sky-500 transition-colors py-2 outline-none">
                            Guías
                            <span class="material-icons text-xs group-hover:rotate-180 transition-transform">expand_more</span>
                        </button>
                        <div class="absolute left-0 mt-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                            <div class="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                                <a href="carta-de-renuncia-chile" class="block px-3 py-2 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-slate-50 rounded-lg transition-colors font-bold">Carta de Renuncia (Asistente)</a>
                                <a href="checklist-fiscalizacion-dt-pymes-chile" class="block px-3 py-2 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-slate-50 rounded-lg transition-colors font-bold">📋 Checklist Fiscalización DT (Pymes)</a>
                                <a href="propuesta-indemnizacion-a-todo-evento-chile" class="block px-3 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-slate-50 rounded-lg transition-colors font-bold">Indemnización a Todo Evento (Propuesta)</a>
                                <a href="fondos-generacionales-afp-chile" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Fondos Generacionales AFP</a>
                                <a href="como-calcular-finiquito-chile" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Cómo Calcular Finiquito</a>
                                <a href="como-calcular-sueldo-liquido-paso-a-paso" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Cómo Calcular Sueldo Líquido</a>
                                <a href="como-leer-liquidacion-de-sueldo" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Cómo Leer Liquidación</a>
                                <a href="despido-necesidades-empresa-articulo-161" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Art. 161 Necesidades Empresa</a>
                                <a href="ley-40-horas-chile-2026" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Ley 40 Horas 2026</a>
                                <a href="guia-vacaciones-proporcionales" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Vacaciones Proporcionales</a>
                                <a href="seguro-de-cesantia-chile-como-cobrar" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Cobrar Seguro Cesantía</a>
                                <a href="que-hacer-si-no-te-pagan-el-finiquito" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Si no te Pagan el Finiquito</a>
                                <a href="reclamar-despido-injustificado-chile" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Despido Injustificado</a>
                                <a href="finiquito-por-renuncia-voluntaria" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Finiquito Renuncia Voluntaria</a>
                                <a href="carta-de-despido-chile" class="block px-3 py-2 text-xs font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50 rounded-lg transition-colors">Carta de Despido Ejemplo</a>
                            </div>
                        </div>
                    </div>

                    <a href="para-empleadores" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/70 transition-colors">
                        <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        <span>Para Empleadores</span>
                    </a>

                    <a href="blog" class="text-sm font-semibold text-slate-600 hover:text-sky-500 transition-colors">Blog</a>
                    <a href="contacto" class="text-sm font-semibold text-slate-600 hover:text-sky-500 transition-colors">Contacto</a>
                </nav>

                <!-- Mobile Menu -->
                <details class="md:hidden">
                    <summary class="list-none p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors active:scale-95 duration-100 cursor-pointer flex items-center" aria-label="Abrir menú de navegación">
                        <span class="material-icons">menu</span>
                    </summary>
                    <div class="fixed left-0 right-0 top-16 bg-white border-t border-slate-200 shadow-xl z-50 max-h-[calc(100vh-4.5rem)] overflow-y-auto">
                        <div class="max-w-[1200px] mx-auto px-6 py-4 space-y-2">
                <a href="para-empleadores" class="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/80">
                    <span class="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>Portal Para Empleadores</span>
                </a>
                <a href="carta-de-renuncia-chile" class="block px-3 py-2 rounded-lg text-base font-semibold text-sky-600 bg-sky-50 font-bold">Carta de Renuncia (Asistente)</a>
                <a href="checklist-fiscalizacion-dt-pymes-chile" class="block px-3 py-2 rounded-lg text-base font-semibold text-amber-600 bg-amber-50 font-bold">📋 Checklist Fiscalización DT (Pymes)</a>
                <a href="sueldo_liquido" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Sueldo Líquido</a>
                <a href="finiquito_calculator" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Finiquito</a>
                <a href="calculadora-horas-extras" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Horas Extras</a>
                <a href="calculadora-sueldo-part-time" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Sueldo Part-Time</a>
                <a href="calculadora-vacaciones-proporcionales" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Vacaciones Proporcionales</a>
                <a href="calculadora-despido-articulo-160" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Despido Art. 160</a>
                <div class="border-t border-slate-100 my-2"></div>
                <p class="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Guías</p>
                <a href="propuesta-indemnizacion-a-todo-evento-chile" class="block px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-slate-50 font-bold">Indemnización a Todo Evento (Propuesta)</a>
                <a href="fondos-generacionales-afp-chile" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Fondos Generacionales AFP</a>
                <a href="como-calcular-finiquito-chile" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Cómo Calcular Finiquito</a>
                <a href="como-calcular-sueldo-liquido-paso-a-paso" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Cómo Calcular Sueldo Líquido</a>
                <a href="como-leer-liquidacion-de-sueldo" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Cómo Leer Liquidación</a>
                <a href="despido-necesidades-empresa-articulo-161" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Art. 161 Necesidades Empresa</a>
                <a href="ley-40-horas-chile-2026" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Ley 40 Horas 2026</a>
                <a href="guia-vacaciones-proporcionales" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Vacaciones Proporcionales</a>
                <a href="seguro-de-cesantia-chile-como-cobrar" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Cobrar Seguro Cesantía</a>
                <a href="que-hacer-si-no-te-pagan-el-finiquito" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Si no te Pagan el Finiquito</a>
                <a href="reclamar-despido-injustificado-chile" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Despido Injustificado</a>
                <a href="finiquito-por-renuncia-voluntaria" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Finiquito Renuncia Voluntaria</a>
                <a href="carta-de-despido-chile" class="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Carta de Despido Ejemplo</a>
                <div class="border-t border-slate-100 my-2"></div>
                <a href="blog" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Blog</a>
                <a href="contacto" class="block px-3 py-2 rounded-lg text-base font-semibold text-slate-600 hover:text-sky-500 hover:bg-slate-50">Contacto</a>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    </header>
"""

FOOTER_HTML = """
    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 pt-16 pb-12 mt-auto no-print">
        <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <!-- Brand Column -->
            <div class="space-y-4">
                <a href="./" class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition-transform">
                        <svg class="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                            <!-- Pedestal Base -->
                            <path d="M30 84h40M38 79h24"></path>
                            <!-- Vertical Pillar -->
                            <path d="M50 22v57"></path>
                            <!-- Center pointer tip -->
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <!-- Balance Beam -->
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <!-- Left Pan strings and dish -->
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Right Pan strings and dish -->
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Monogram C wrapping left side -->
                            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                            <!-- Monogram L wrapping right side -->
                            <path d="M58 43.5v20h10"></path>
                        </svg>
                    </div>
                    <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span class="text-sky-500">Laboral</span></span>
                </a>
                <p class="text-sm text-slate-600 leading-relaxed">
                    Herramientas y simuladores gratuitos y actualizados conforme a la legislación laboral chilena vigente en 2026.
                </p>
                <p class="text-xs text-slate-500 font-mono">Versión 2.0.0 (2026)</p>
            </div>

            <!-- Calculadoras Column -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-slate-900 uppercase tracking-widest">Calculadoras</h4>
                <ul class="space-y-2">
                    <li><a href="sueldo_liquido" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Sueldo Líquido</a></li>
                    <li><a href="finiquito_calculator" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Finiquito</a></li>
                    <li><a href="calculadora-horas-extras" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Horas Extras</a></li>
                    <li><a href="calculadora-sueldo-part-time" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Sueldo Part-Time</a></li>
                    <li><a href="calculadora-vacaciones-proporcionales" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Vacaciones Proporcionales</a></li>
                    <li><a href="calculadora-despido-articulo-160" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Despido Art. 160</a></li>
                    <li><a href="./" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium font-semibold">Simulador Integrado</a></li>
                </ul>
            </div>

            <!-- Guías Populares Column -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-slate-900 uppercase tracking-widest">Guías Populares</h4>
                <ul class="space-y-2">
                    <li><a href="carta-de-renuncia-chile" class="text-sm text-sky-600 hover:text-sky-700 transition-colors font-bold">Carta de Renuncia (Asistente)</a></li>
                    <li><a href="checklist-fiscalizacion-dt-pymes-chile" class="text-sm text-amber-600 hover:text-amber-700 transition-colors font-bold">📋 Checklist Fiscalización DT (Pymes)</a></li>
                    <li><a href="propuesta-indemnizacion-a-todo-evento-chile" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Indemnización Todo Evento</a></li>
                    <li><a href="fondos-generacionales-afp-chile" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Fondos Generacionales AFP</a></li>
                    <li><a href="como-calcular-finiquito-chile" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Cómo Calcular Finiquito</a></li>
                    <li><a href="como-calcular-sueldo-liquido-paso-a-paso" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Cómo Calcular Sueldo Líquido</a></li>
                    <li><a href="guia-vacaciones-proporcionales" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Vacaciones Proporcionales</a></li>
                    <li><a href="ley-40-horas-chile-2026" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Ley de 40 Horas (2026)</a></li>
                </ul>
            </div>

            <!-- Legal Column -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-slate-900 uppercase tracking-widest">Sobre el Sitio</h4>
                <ul class="space-y-2">
                    <li><a href="para-empleadores" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Para Empleadores (Pymes)</a></li>
                    <li><a href="sobre-nosotros" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Sobre Nosotros</a></li>
                    <li><a href="contacto" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Contacto</a></li>
                    <li><a href="terminos" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Términos de Servicio</a></li>
                    <li><a href="privacidad" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Política de Privacidad</a></li>
                    <li><a href="disclaimer" class="text-sm text-slate-600 hover:text-sky-500 transition-colors font-medium">Disclaimer Legal</a></li>
                </ul>
            </div>
        </div>

        <!-- Bottom Footer -->
        <div class="max-w-[1200px] mx-auto px-6 border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p class="text-xs text-slate-500">
                &copy; 2026 Cálculo Laboral Chile. Todos los derechos reservados. Todos los cálculos son estimativos y de carácter ilustrativo.
            </p>
            <div class="flex items-center gap-4">
                <span class="text-xs text-slate-500 flex items-center gap-1">
                    <span class="material-icons text-xs text-emerald-500">verified</span>
                    DT Chile Conforme
                </span>
            </div>
        </div>
    </footer>
"""

INDICATOR_BAR_HTML = """
    <!-- Indicators Carousel (Mobile) / Grid (Desktop) -->
    <style>
        @media (max-width: 639px) {
            .indicators-carousel {
                display: flex !important;
                overflow-x: auto !important;
                scroll-snap-type: x mandatory !important;
                -webkit-overflow-scrolling: touch !important;
            }
            .indicator-card {
                min-width: 148px !important;
                max-width: 148px !important;
                width: 148px !important;
                flex-shrink: 0 !important;
                scroll-snap-align: start !important;
            }
        }
        @media (min-width: 640px) {
            .indicators-carousel {
                display: grid !important;
            }
            .indicator-card {
                width: auto !important;
                min-width: 0 !important;
                flex-shrink: 1 !important;
            }
        }
    </style>
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 mt-3 sm:mt-4 mb-4 sm:mb-8 no-print overflow-hidden sm:overflow-visible">
        <div class="indicators-carousel sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 pb-2 sm:pb-0 scrollbar-none overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0" style="-webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none;">
            <!-- UF Card -->
            <div class="indicator-card bg-white border border-slate-200 rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 shadow-xs sm:shadow-sm hover:border-slate-300 sm:hover:shadow transition-all">
                <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valor UF</span>
                <span class="uf-value text-[15px] sm:text-lg font-black text-slate-900 font-mono tracking-tight">$39.682,99</span>
            </div>
            <!-- UTM Card -->
            <div class="indicator-card bg-white border border-slate-200 rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 shadow-xs sm:shadow-sm hover:border-slate-300 sm:hover:shadow transition-all">
                <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">UTM Mensual</span>
                <span class="utm-value text-[15px] sm:text-lg font-black text-slate-900 font-mono tracking-tight">$69.611</span>
            </div>
            <!-- Sueldo Mínimo Card -->
            <div class="indicator-card bg-white border border-slate-200 rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 shadow-xs sm:shadow-sm hover:border-slate-300 sm:hover:shadow transition-all">
                <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sueldo Mínimo</span>
                <span class="text-[15px] sm:text-lg font-black text-slate-900 font-mono tracking-tight">$553.553</span>
            </div>
            <!-- Tope AFP Card -->
            <div class="indicator-card bg-white border border-slate-200 rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 shadow-xs sm:shadow-sm hover:border-slate-300 sm:hover:shadow transition-all">
                <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tope AFP</span>
                <span class="text-[15px] sm:text-lg font-black text-slate-900 font-mono tracking-tight">89.9 UF</span>
            </div>
            <!-- Tope Finiquito Card -->
            <div class="indicator-card bg-white border border-slate-200 rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 shadow-xs sm:shadow-sm hover:border-slate-300 sm:hover:shadow transition-all">
                <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tope Finiquito</span>
                <span class="text-[15px] sm:text-lg font-black text-slate-900 font-mono tracking-tight">90 UF</span>
            </div>
        </div>
        <div class="flex justify-between items-center mt-2 sm:mt-2.5 px-0.5 text-[10px] text-slate-500 font-medium">
            <div id="indicators-status" class="flex items-center gap-1.5 text-slate-500 text-[10px]">
                <span class="material-icons text-[13px] text-emerald-500">check_circle</span>
                <span>Valores oficiales vigentes (Banco Central de Chile)</span>
            </div>
            <a href="#" id="btn-history" class="text-sky-500 hover:text-sky-600 hover:underline flex items-center gap-0.5 text-[10px]">
                <span class="material-icons text-[12px]">history</span>
                <span>Historial</span>
            </a>
        </div>
    </div>
"""

HISTORY_MODAL_HTML = """
    <!-- History Modal -->
    <div id="history-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 relative overflow-hidden animate-fade-in">
            <div class="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-sky-500">history</span>
                    <h3 class="text-base font-bold text-slate-900">Historial de Indicadores</h3>
                </div>
                <button id="btn-close-history" aria-label="Cerrar modal" class="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-full transition-colors active:scale-95 duration-100">
                    <span class="material-icons">close</span>
                </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span> UF (Últimos 30 días)
                    </h4>
                    <div class="max-h-[250px] overflow-y-auto pr-1">
                        <table class="w-full text-left">
                            <tbody id="uf-history-body">
                                <tr><td class="p-2 text-center text-slate-500 text-xs italic font-medium">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> UTM (Últimos 12 meses)
                    </h4>
                    <div class="max-h-[250px] overflow-y-auto pr-1">
                        <table class="w-full text-left">
                            <tbody id="utm-history-body">
                                <tr><td class="p-2 text-center text-slate-500 text-xs italic font-medium">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
"""

HTML_LAYOUT = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{description}">
    <title>{title}</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="{canonical_url}">
    
    <!-- Open Graph Tags -->
    {og_tags}
    
    <!-- Structured Data -->
    {json_ld}
    
    <!-- Fonts and Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-9Y03F1WB8J"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){{dataLayer.push(arguments);}}
        gtag('js', new Date());

        gtag('config', 'G-9Y03F1WB8J');
    </script>
    
    <!-- Precompiled Tailwind CSS -->
    <link rel="stylesheet" href="/assets/css/style.css">
    <style>
        @media (min-width: 1024px) {{
            [class*="lg:w-[480px]"], .lg-w-480 {{
                width: 480px !important;
                flex-shrink: 0 !important;
            }}
            [class*="lg:w-7/12"], .lg-col-7 {{
                width: 58.333333% !important;
            }}
            [class*="lg:w-5/12"], .lg-col-5 {{
                width: 41.666667% !important;
            }}
        }}
        .scrollbar-none::-webkit-scrollbar {{
            display: none;
        }}
        .scrollbar-none {{
            -ms-overflow-style: none;
            scrollbar-width: none;
        }}
        .prose-content h2 {{
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2rem;
            margin-bottom: 1rem;
            letter-spacing: -0.02em;
        }}
        .prose-content h3 {{
            font-size: 1.25rem;
            font-weight: 600;
            color: #1e293b;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            letter-spacing: -0.01em;
        }}
        .prose-content p {{
            margin-bottom: 1.25rem;
            line-height: 1.75;
        }}
        .prose-content ul {{
            list-style-type: disc;
            padding-left: 1.5rem;
            margin-bottom: 1.25rem;
        }}
        .prose-content ol {{
            list-style-type: decimal;
            padding-left: 1.5rem;
            margin-bottom: 1.25rem;
        }}
        .prose-content li {{
            margin-bottom: 0.5rem;
        }}
        .prose-content strong {{
            color: #0f172a;
            font-weight: 600;
        }}
        .prose-content a {{
            color: #0ea5e9;
            text-decoration: underline;
            font-weight: 500;
        }}
        .prose-content a:hover {{
            color: #0284c7;
        }}
        .prose-content a.cta-btn,
        .prose-content a.bg-sky-500,
        .prose-content a[class*="bg-sky-"],
        .prose-content a[class*="bg-blue-"] {{
            color: #ffffff !important;
            text-decoration: none !important;
            font-weight: 600 !important;
        }}
        .prose-content a.cta-btn:hover,
        .prose-content a.bg-sky-500:hover,
        .prose-content a[class*="bg-sky-"]:hover,
        .prose-content a[class*="bg-blue-"]:hover {{
            color: #ffffff !important;
            text-decoration: none !important;
        }}
        .prose-content a.cta-btn span,
        .prose-content a.bg-sky-500 span,
        .prose-content a[class*="bg-sky-"] span,
        .prose-content a[class*="bg-blue-"] span {{
            color: #ffffff !important;
        }}
        .prose-content a.cta-lead-btn {{
            color: #ffffff !important;
            text-decoration: none !important;
            font-weight: 700 !important;
        }}
        .prose-content a.cta-lead-btn:hover {{
            color: #ffffff !important;
            text-decoration: none !important;
        }}
        .prose-content .callout {{
            background-color: #f0fdf4;
            border-left: 4px solid #22c55e;
            padding: 1rem 1.25rem;
            border-radius: 0.5rem;
            margin: 1.5rem 0;
        }}
        .prose-content .callout-amber {{
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 1rem 1.25rem;
            border-radius: 0.5rem;
            margin: 1.5rem 0;
        }}
        .prose-content .formula-box {{
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            padding: 1.25rem;
            margin: 1.5rem 0;
            text-align: center;
        }}
        .rubro-card {{
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            padding: 1rem;
            transition: all 0.2s ease;
        }}
        .rubro-card:hover {{
            border-color: #cbd5e1;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
        }}
        .rubro-label {{
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.125rem 0.5rem;
            border-radius: 9999px;
            display: inline-block;
            flex-shrink: 0;
        }}
        .rubro-imponible {{
            background-color: #f0f9ff;
            color: #0369a1;
            border: 1px solid #e0f2fe;
        }}
        .rubro-no-imponible {{
            background-color: #f0fdf4;
            color: #15803d;
            border: 1px solid #dcfce7;
        }}
        .rubro-descuento {{
            background-color: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fee2e2;
        }}
        .timeline-item {{
            position: relative;
            padding-left: 1.75rem;
            border-left: 2px solid #e2e8f0;
            padding-bottom: 1.5rem;
        }}
        .timeline-item::before {{
            content: "";
            position: absolute;
            left: -5px;
            top: 4px;
            width: 8px;
            height: 8px;
            border-radius: 9999px;
            background-color: #cbd5e1;
            border: 2px solid #ffffff;
            transition: all 0.2s ease;
        }}
        .timeline-item.active {{
            border-left-color: #0ea5e9;
        }}
        .timeline-item.active::before {{
            background-color: #0ea5e9;
            left: -7px;
            top: 2px;
            width: 12px;
            height: 12px;
            box-shadow: 0 0 0 4px rgb(14 165 233 / 0.15);
        }}
        .timeline-item:last-child {{
            padding-bottom: 0;
            border-left-color: transparent;
        }}
        .step-card {{
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            padding: 1.25rem;
            margin-bottom: 1rem;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.02);
        }}
        .step-number {{
            width: 2.25rem;
            height: 2.25rem;
            background-color: #e0f2fe;
            color: #0369a1;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.875rem;
            flex-shrink: 0;
        }}
        .field-error {{
            color: #ef4444;
            font-size: 0.75rem;
            margin-top: 0.25rem;
        }}
        .print-only {{ display: none !important; }}
        
        /* High-contrast CTA and button link enforcement */
        .cta-btn, .cta-btn *,
        .prose a.cta-btn, .prose a.cta-btn *,
        .prose a[class*="bg-sky-500"], .prose a[class*="bg-sky-500"] *,
        .prose a[class*="bg-emerald-600"], .prose a[class*="bg-emerald-600"] *,
        .prose a[class*="bg-blue-600"], .prose a[class*="bg-blue-600"] * {{
            color: #ffffff !important;
            text-decoration: none !important;
        }}
        .cta-lead-btn, .cta-lead-btn *,
        .prose a.cta-lead-btn, .prose a.cta-lead-btn * {{
            color: #0f172a !important;
            text-decoration: none !important;
            font-weight: 700 !important;
        }}
        
        .copy-box {{
            position: relative;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            padding: 1.5rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.875rem;
            line-height: 1.6;
            color: #1e293b;
            white-space: pre-wrap;
            word-break: break-word;
            margin: 1.25rem 0;
        }}
        .copy-btn {{
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            color: #475569;
            padding: 0.35rem 0.75rem;
            border-radius: 0.5rem;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            z-index: 10;
        }}
        .copy-btn:hover {{
            background: #0ea5e9;
            color: #ffffff;
            border-color: #0ea5e9;
            box-shadow: 0 2px 4px rgba(14,165,233,0.2);
        }}
        .copy-btn.copied {{
            background: #10b981 !important;
            color: #ffffff !important;
            border-color: #10b981 !important;
        }}

        #print-section {{
            display: none;
        }}

        @media print {{
            @page {{
                size: A4 portrait;
                margin: 6mm 8mm;
            }}
            body > *:not(#print-section) {{
                display: none !important;
            }}
            #print-section {{
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                height: auto !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
                color: #1e293b !important;
                box-sizing: border-box !important;
            }}
            html, body {{
                background: #ffffff !important;
                color: #1e293b !important;
                font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
                font-size: 8.5pt !important;
                line-height: 1.35 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
            }}
            * {{
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}
            .print-table {{
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }}
            .print-table th, .print-table td {{
                border: 1px solid #e2e8f0 !important;
            }}
            .print-section-title {{
                page-break-after: avoid !important;
                break-after: avoid !important;
            }}
        }}
    </style>
    {custom_head}
</head>
<body class="bg-slate-50 text-slate-700 min-h-screen flex flex-col font-sans selection:bg-sky-500/20 selection:text-slate-900">

    {header}
    {indicator_bar}

    <!-- Main Content -->
    <main class="flex-grow pt-4 pb-16">
        {content}
    </main>

    {footer}
    {history_modal}

    
    <!-- Load shared indicators script -->
    <script src="/js/constants.js?v=2.0.3"></script>
    <script src="/js/indicators.js?v=2.0.3"></script>
    <script src="/js/pdf_generator.js?v=2.1.1"></script>
    <script>
        function enviarLead(fuenteCustom) {{
            var nombre = document.getElementById('lead-nombre').value.trim();
            var correo = document.getElementById('lead-correo').value.trim();
            var telefono = document.getElementById('lead-telefono').value.trim();
            var monto = window.resultadoActualMonto || '0';
            var detalle = window.resultadoDesgloseLead || '';

            var privacyCheck = document.getElementById('lead-privacy');
            if (privacyCheck && !privacyCheck.checked) {{
                alert('Debes aceptar la Política de Privacidad para continuar.');
                return;
            }}

            if (!nombre || !correo) {{
                alert('Por favor completa nombre y correo.');
                return;
            }}

            var btn = document.querySelector('#lead-form button');
            var btnTextOriginal = btn ? btn.innerHTML : 'Enviar';
            if (btn) {{
                btn.disabled = true;
                btn.innerText = 'Enviando solicitud...';
            }}

            var causeSelect = document.getElementById('cause');
            var fuenteDefault = (causeSelect && causeSelect.value === '161') ? 'Calculadora Finiquito - Art. 161' : 'Calculadora de Finiquito';

            fetch('/api/send-lead', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json'
                }},
                body: JSON.stringify({{
                    nombre: nombre,
                    correo: correo,
                    telefono: telefono,
                    monto_calculado: monto,
                    tipo: 'Finiquito',
                    fuente: fuenteCustom || fuenteDefault,
                    detalle: detalle
                }})
            }}).then(function(response) {{
                if (response.ok) {{
                    document.getElementById('lead-form').classList.add('hidden');
                    document.getElementById('lead-confirmacion').classList.remove('hidden');
                }} else {{
                    throw new Error('Error al enviar');
                }}
            }}).catch(function(err) {{
                alert('Hubo un problema al enviar tus datos. Por favor inténtalo nuevamente.');
                if (btn) {{
                    btn.disabled = false;
                    btn.innerHTML = btnTextOriginal;
                }}
            }});
        }}

        function enviarLeadArticulo(event, formId, fuente) {{
            if (event) event.preventDefault();
            var form = document.getElementById(formId);
            if (!form) return;

            var nombre = form.querySelector('[name="nombre"]').value.trim();
            var correo = form.querySelector('[name="correo"]').value.trim();
            var telefono = form.querySelector('[name="telefono"]').value.trim();
            var detalleInput = form.querySelector('[name="consulta"]');
            var detalle = detalleInput ? detalleInput.value.trim() : '';

            var privacyCheck = form.querySelector('[name="privacy_consent"]');
            if (privacyCheck && !privacyCheck.checked) {{
                alert('Debes aceptar la Política de Privacidad para continuar.');
                return;
            }}

            if (!nombre || !correo) {{
                alert('Por favor ingresa tu nombre y correo electrónico.');
                return;
            }}

            var btn = form.querySelector('button[type="submit"]');
            var btnOriginal = btn ? btn.innerHTML : 'Solicitar Revisión';
            if (btn) {{
                btn.disabled = true;
                btn.innerHTML = 'Enviando...';
            }}

            fetch('/api/send-lead', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json'
                }},
                body: JSON.stringify({{
                    nombre: nombre,
                    correo: correo,
                    telefono: telefono,
                    tipo: 'Despido',
                    fuente: fuente || 'Guía Informativa',
                    detalle: detalle
                }})
            }}).then(function(response) {{
                if (response.ok) {{
                    var successDiv = document.getElementById(formId + '-confirmacion');
                    if (successDiv) {{
                        form.classList.add('hidden');
                        successDiv.classList.remove('hidden');
                    }} else {{
                        form.innerHTML = '<div class="p-6 bg-emerald-50 rounded-2xl text-center border border-emerald-200"><h4 class="text-base font-bold text-emerald-950 mb-1">¡Solicitud recibida con éxito!</h4><p class="text-xs text-emerald-800">Un abogado laboralista revisará tus antecedentes y te contactará a la brevedad.</p></div>';
                    }}
                }} else {{
                    throw new Error('Error en el servidor');
                }}
            }}).catch(function(err) {{
                alert('Ocurrió un error al enviar tu consulta. Por favor inténtalo de nuevo.');
                if (btn) {{
                    btn.disabled = false;
                    btn.innerHTML = btnOriginal;
                }}
            }});
        }}

        function copiarTexto(btn) {{
            var box = btn.closest('.copy-box');
            if (!box) return;
            var clone = box.cloneNode(true);
            var btnInClone = clone.querySelector('.copy-btn');
            if (btnInClone) btnInClone.remove();
            var text = (clone.innerText || clone.textContent || '').trim();

            function onSuccess() {{
                var originalHTML = btn.innerHTML;
                btn.innerHTML = '<span class="material-icons text-xs" style="vertical-align:middle;font-size:14px;">check</span> ¡Copiado!';
                btn.classList.add('copied');
                setTimeout(function() {{
                    btn.innerHTML = originalHTML;
                    btn.classList.remove('copied');
                }}, 2500);
            }}

            if (navigator.clipboard && window.isSecureContext) {{
                navigator.clipboard.writeText(text).then(onSuccess).catch(function() {{
                    fallbackCopy(text);
                }});
            }} else {{
                fallbackCopy(text);
            }}

            function fallbackCopy(str) {{
                var ta = document.createElement('textarea');
                ta.value = str;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {{
                    document.execCommand('copy');
                    onSuccess();
                }} catch (e) {{
                    console.error('Fallback copy failed', e);
                }}
                document.body.removeChild(ta);
            }}
        }}

        function shareFiniquitoWhatsApp() {{
            var totalEl = document.getElementById('totalFiniquitoOutput');
            var total = totalEl ? totalEl.innerText.trim() : '';
            var texto = 'Hola! Hice mi cálculo de finiquito en Cálculo Laboral Chile' + (total && total !== '$0' && total !== '—' ? ' y me dio ' + total : '') + '. Puedes calcular el tuyo gratis según la Dirección del Trabajo aquí: https://calculolaboral.cl/finiquito_calculator';
            if (typeof gtag !== 'undefined') {{
                gtag('event', 'share', {{ method: 'WhatsApp', content_type: 'finiquito' }});
            }}
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(texto), '_blank');
        }}

        function shareSueldoWhatsApp() {{
            var liquidoEl = document.getElementById('netSalaryOutput');
            var liquido = liquidoEl ? liquidoEl.innerText.trim() : '';
            var texto = 'Hola! Calculé mi sueldo líquido en Cálculo Laboral Chile' + (liquido && liquido !== '$0' && liquido !== '—' ? ' (Líquido: ' + liquido + ')' : '') + '. Revisa tu liquidación con todos los descuentos legales aquí: https://calculolaboral.cl/sueldo_liquido';
            if (typeof gtag !== 'undefined') {{
                gtag('event', 'share', {{ method: 'WhatsApp', content_type: 'sueldo_liquido' }});
            }}
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(texto), '_blank');
        }}

        function shareHEWhatsApp() {{
            var totalBrutoEl = document.getElementById('he-total-bruto');
            var horasEl = document.getElementById('he-total-horas');
            var totalBruto = totalBrutoEl ? totalBrutoEl.innerText.trim() : '$46.130';
            var horas = horasEl ? horasEl.innerText.trim() : '10.0 hrs';
            var texto = 'Hola! Calculé mis horas extras en Cálculo Laboral Chile con la Ley 40 Horas (42h en 2026): ' + horas + ' extras = ' + totalBruto + ' adicionales. Simula las tuyas gratis aquí: https://calculolaboral.cl/calculadora-horas-extras';
            if (typeof gtag !== 'undefined') {{
                gtag('event', 'share', {{ method: 'WhatsApp', content_type: 'horas_extras' }});
            }}
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(texto), '_blank');
        }}

        function sharePTWhatsApp() {{
            var liquidoEl = document.getElementById('pt-sueldo-liquido');
            var jornadaEl = document.getElementById('pt-jornada-badge');
            var liquido = liquidoEl ? liquidoEl.innerText.trim() : '$323.512';
            var jornada = jornadaEl ? jornadaEl.innerText.trim() : '30 Horas/Sem';
            var texto = 'Hola! Calculé mi sueldo part-time (' + jornada + ') en Cálculo Laboral Chile: Sueldo Líquido estimado ' + liquido + '. Revisa el tuyo gratis con protección para estudiantes aquí: https://calculolaboral.cl/calculadora-sueldo-part-time';
            if (typeof gtag !== 'undefined') {{
                gtag('event', 'share', {{ method: 'WhatsApp', content_type: 'part_time' }});
            }}
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(texto), '_blank');
        }}
    </script>
    {custom_scripts}
</body>
</html>
"""

def flexible_replace(text, old_block, new_block):
    text_norm = text.replace('\r\n', '\n')
    old_norm = old_block.replace('\r\n', '\n')
    
    old_lines = [line.strip() for line in old_norm.split('\n') if line.strip()]
    if not old_lines:
        return text
    
    escaped_lines = [re.escape(line) for line in old_lines]
    pattern = r'[ \t]*' + r'[ \t]*\n+[ \t]*'.join(escaped_lines) + r'[ \t]*'
    
    new_text, count = re.subn(pattern, lambda m: new_block, text_norm)
    if count > 0:
        return new_text
    else:
        return text.replace(old_block, new_block)

def wrap_images(content):
    # Strip recursive wrappers around known guide images that already have a container
    content = re.sub(
        r'(?:<div class="bg-slate-100 p-4 border border-slate-200[^"]*">\s*)+(<img[^>]+assets/guia-despido-necesidades-empresa-161\.png[^>]*>)(?:\s*</div>)+',
        r'\1',
        content
    )
    content = re.sub(
        r'(?:<div class="bg-slate-100 p-4 border border-slate-200[^"]*">\s*)+(<img[^>]+assets/guia-calculo-finiquito-chile-2026\.png[^>]*>)(?:\s*</div>)+',
        r'\1',
        content
    )
    return content

def strip_outer_divs(body):
    while True:
        body_stripped = body.strip()
        match = re.match(r'^<div[^>]*>', body_stripped, re.IGNORECASE)
        if not match:
            break
        
        open_tag = match.group(0)
        depth = 0
        div_indices = []
        for m in re.finditer(r'</?div\b[^>]*>', body_stripped, re.IGNORECASE):
            tag = m.group(0)
            start = m.start()
            end = m.end()
            is_close = tag.startswith('</')
            div_indices.append((start, end, is_close))
        
        if not div_indices or div_indices[0][0] != 0:
            break
            
        closing_idx = -1
        depth = 0
        for i, (start, end, is_close) in enumerate(div_indices):
            if is_close:
                depth -= 1
                if depth == 0:
                    closing_idx = i
                    break
            else:
                depth += 1
                
        if closing_idx != -1:
            c_start, c_end, _ = div_indices[closing_idx]
            if c_end == len(body_stripped):
                body = body_stripped[len(open_tag):c_start]
                continue
        break
    return body

def fix_all_article_buttons(body):
    # 1. Clean up CTA buttons (guaranteeing text-white and high contrast)
    body = re.sub(
        r'<a([^>]*?)class="[^"]*cta-btn[^"]*"([^>]*?)>',
        r'<a\1class="cta-btn inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-600 !text-white font-bold rounded-xl shadow-md shadow-sky-500/15 transition-all hover:scale-[1.01] active:scale-95 !no-underline cursor-pointer"\2>',
        body
    )
    
    # 2. Clean up Lead CTA buttons (amber with dark text)
    body = re.sub(
        r'<a([^>]*?)class="[^"]*cta-lead-btn[^"]*"([^>]*?)>',
        r'<a\1class="cta-lead-btn w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-amber-500 hover:bg-amber-600 !text-slate-900 font-bold text-sm rounded-xl shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-95 whitespace-nowrap !no-underline cursor-pointer"\2>',
        body
    )
    
    # 3. Clean up mini calculator redirect buttons (e.g. Comprobar mi Liquidación, Simular mi Finiquito)
    body = re.sub(
        r'<a([^>]*?href="sueldo_liquido"[^>]*?)class="[^"]*shrink-0[^"]*"([^>]*?)>',
        r'<a\1class="inline-flex items-center justify-center shrink-0 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 !text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/15 transition-all hover:scale-105 active:scale-95 text-center whitespace-nowrap !no-underline cursor-pointer"\2>',
        body
    )
    body = re.sub(
        r'<a([^>]*?href="finiquito_calculator"[^>]*?)class="[^"]*shrink-0[^"]*"([^>]*?)>',
        r'<a\1class="inline-flex items-center justify-center shrink-0 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 !text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 text-center whitespace-nowrap !no-underline cursor-pointer"\2>',
        body
    )
    
    # 4. Remove any residual text-slate-800 or text-slate-900 inside bg-sky-500 / bg-emerald-600 / bg-blue-600 buttons
    body = body.replace('bg-sky-500 text-slate-800', 'bg-sky-500 !text-white')
    body = body.replace('bg-sky-500 text-slate-900', 'bg-sky-500 !text-white')
    body = body.replace('bg-sky-500 hover:bg-sky-600 text-slate-800', 'bg-sky-500 hover:bg-sky-600 !text-white')
    body = body.replace('bg-sky-500 hover:bg-sky-600 text-slate-900', 'bg-sky-500 hover:bg-sky-600 !text-white')
    body = body.replace('bg-emerald-600 text-slate-800', 'bg-emerald-600 !text-white')
    body = body.replace('bg-emerald-600 text-slate-900', 'bg-emerald-600 !text-white')
    body = body.replace('bg-emerald-600 hover:bg-emerald-700 text-slate-800', 'bg-emerald-600 hover:bg-emerald-700 !text-white')
    body = body.replace('bg-emerald-600 hover:bg-emerald-700 text-slate-900', 'bg-emerald-600 hover:bg-emerald-700 !text-white')
    
    # 5. Fix related guide cards
    body = body.replace('hover:border-sky-200 transition-colors group block', 'hover:border-sky-400 hover:bg-sky-50/30 hover:shadow-md transition-all group block')
    body = body.replace('hover:border-green-400 hover:bg-green-50/30 transition-colors group block', 'hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-md transition-all group block')
    
    return body

def remove_lead_cards(content):
    content = re.sub(r'<!-- FORMULARIO_LEAD_START -->[\s\S]*?<!-- FORMULARIO_LEAD_END -->', '', content)
    while True:
        idx = content.find('<!-- Formulario Lead:')
        if idx == -1:
            break
        div_start = content.find('<div', idx)
        if div_start == -1:
            break
        depth = 0
        div_pattern = re.compile(r'</?div\b[^>]*>', re.IGNORECASE)
        end_pos = -1
        for match in div_pattern.finditer(content, div_start):
            tag = match.group(0)
            if tag.startswith('</'):
                depth -= 1
            else:
                depth += 1
            if depth == 0:
                end_pos = match.end()
                break
        if end_pos != -1:
            content = content[:idx] + content[end_pos:]
        else:
            break
    return content

def extract_article_info(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        html = f.read()
    
    title_match = re.search(r'<title>(.*?)</title>', html, re.DOTALL)
    title = title_match.group(1).strip() if title_match else "Artículo | Cálculo Laboral Chile"
    
    desc_match = re.search(r'<meta[^>]*name="description"[^>]*content="(.*?)"', html, re.IGNORECASE | re.DOTALL)
    if not desc_match:
        desc_match = re.search(r'<meta[^>]*content="(.*?)"[^>]*name="description"', html, re.IGNORECASE | re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else "Guía sobre legislación y cálculos laborales chilenos."
    
    filename = os.path.basename(file_path)
    if filename == "ley-40-horas-chile-2026.html":
        title = "Ley 40 Horas Chile 2026: Tabla Horarios (42h) y Sueldo"
        description = "¿A qué hora sales con las 42 horas? Revisa la tabla 5x2 y 6x1, el valor de la hora extra ($4.613) y descarga el anexo validado por la DT."
    elif filename == "como-calcular-sueldo-liquido-paso-a-paso.html":
        title = "Cómo Calcular Sueldo Líquido Chile 2026: Fórmula y Paso a Paso"
        description = "Con $1.500.000 bruto te quedan $1.187.000 líquido. Conoce la fórmula legal paso a paso con descuentos de AFP, salud, cesantía e impuestos 2026."
    elif filename == "como-calcular-finiquito-chile.html":
        title = "Finiquito Chile 2026: Cuánto te Toca por Año + Ejemplo Real"
        description = "Con 3 años y sueldo de $800.000 te tocan $2.880.000 de finiquito. Conoce la fórmula del Art. 163, aviso previo, vacaciones y descuentos de AFC."
    elif filename == "despido-necesidades-empresa-articulo-161.html":
        title = "Despido Art. 161: Indemnización, Plazos y Cómo Reclamar"
        description = "Con 2 años te corresponden 2 meses de sueldo + recargo. Conoce los plazos legales (60 días), la carta de aviso y qué hacer si te descuentan la AFC."
    elif filename == "guia-vacaciones-proporcionales.html":
        title = "Vacaciones Proporcionales Chile 2026: Tabla de Días y Calculadora de Pago"
        description = "¿Renunciaste o te despidieron? Calcula cuántos días de vacaciones proporcionales te corresponden por mes trabajado y su valor en dinero según el Art. 73 DT."
    elif filename == "fondos-generacionales-afp-chile.html":
        title = "Fondos Generacionales AFP Chile: Qué son, Tabla por Edad y Fin de Multifondos"
        description = "Guía completa sobre los Fondos Generacionales de las AFP en Chile: qué son, tabla por año de nacimiento, qué pasará con los multifondos A, B, C, D, E y fechas clave."
    elif filename == "propuesta-indemnizacion-a-todo-evento-chile.html":
        title = "Indemnización a Todo Evento en Chile: Qué es la Propuesta, Cómo Funcionaría y Estado Actual"
        description = "Análisis informativo sobre la propuesta de indemnización a todo evento y 19 medidas laborales en Chile. Conoce qué cambiaría, el aporte de 1,8% y qué dice la ley vigente."
    
    ld_scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    custom_head = ""
    for ld in ld_scripts:
        custom_head += f'<script type="application/ld+json">{ld}</script>\n'
        
    article_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    if article_match:
        body = article_match.group(1).strip()
        body = re.sub(r'<nav[^>]*id="breadcrumb"[^>]*>.*?</nav>', '', body, flags=re.DOTALL | re.IGNORECASE)
        body = re.sub(r'<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>.*?</nav>', '', body, flags=re.DOTALL | re.IGNORECASE)
        body = remove_lead_cards(body)
        
        # 1. Unnest any accumulated outer <div class="prose-content..."> wrappers and matching closing </div>
        while True:
            m = re.match(r'^\s*<div\s+class="[^"]*prose-content[^"]*"[^>]*>', body, re.IGNORECASE)
            if not m:
                break
            body = body[m.end():].strip()
            body = re.sub(r'</div>\s*$', '', body).strip()

        # 2. Fix the Hero figure markup if corrupted by repeated wrapper builds
        if "despido-necesidades-empresa-articulo-161" in filename:
            fig_clean = '''<figure class="mb-10 max-w-[900px] mx-auto">
                <div class="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/20 flex items-center justify-center p-2 sm:p-4">
                    <img src="assets/guia-despido-necesidades-empresa-161.png"
                        alt="Documento gráfico sobre el Artículo 161 del Código del Trabajo, mostrando causales de despido e indemnizaciones."
                        title="Despido por necesidades de la empresa (Artículo 161)"
                        class="w-full h-auto max-h-[45vh] object-contain" loading="lazy" width="1280" height="720" />
                </div>
                <figcaption class="text-xs text-slate-500 text-center mt-3 leading-relaxed">
                    Principales conceptos asociados al despido por necesidades de la empresa según el Código del Trabajo.
                </figcaption>
            </figure>'''
            body = re.sub(r'<figure class="mb-10 max-w-\[900px\] mx-auto">.*?</figure>', fig_clean, body, flags=re.DOTALL)

        if "como-calcular-finiquito-chile" in filename:
            fig_clean = '''<figure class="mb-10 max-w-[900px] mx-auto">
                <div class="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/20 flex items-center justify-center p-2 sm:p-4">
                    <img src="assets/guia-calculo-finiquito-chile-2026.png"
                        alt="Ejemplo visual de cálculo de finiquito en Chile 2026 con indemnización y vacaciones proporcionales"
                        title="Simulación de finiquito en Chile: desglose de indemnización, vacaciones y aviso previo"
                        class="w-full h-auto max-h-[35vh] object-contain bg-slate-50/20" loading="lazy" width="1024" height="640" />
                </div>
                <figcaption class="text-xs text-slate-500 text-center mt-3 leading-relaxed">
                    Ejemplo didáctico de liquidación y finiquito laboral según los topes legales de 2026.
                </figcaption>
            </figure>'''
            body = re.sub(r'<figure class="mb-10 max-w-\[900px\] mx-auto">.*?</figure>', fig_clean, body, flags=re.DOTALL)

        # 3. Balance trailing </div> tags inside body
        div_tags = re.findall(r'(</?div\b[^>]*>)', body, re.IGNORECASE)
        depth = 0
        for tag in div_tags:
            depth += (-1 if tag.startswith('</') else 1)
        while depth < 0 and body.rstrip().endswith('</div>'):
            body = re.sub(r'</div>\s*$', '', body.rstrip())
            depth += 1
        while depth > 0:
            body = body + "\n            </div>"
            depth -= 1

        body = strip_outer_divs(body)
        body = clean_article_body(body, os.path.basename(file_path))
        
        body = body.replace('prose-dark', 'prose prose-slate prose-lg max-w-none text-slate-700 leading-relaxed prose-headings:text-slate-900 font-sans prose-headings:font-bold prose-a:text-sky-500 hover:prose-a:text-sky-600 prose-strong:text-slate-900')
        body = body.replace('class="inline-flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105"', 'class="cta-btn inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-500 !text-white hover:bg-sky-600 rounded-xl shadow-md shadow-sky-500/15 transition-all hover:scale-[1.01] !no-underline"')
        body = body.replace('bg-blue-600 hover:bg-blue-500 text-white font-bold', 'bg-sky-500 hover:bg-sky-600 !text-white !no-underline font-bold shadow-sm')
        body = body.replace('bg-blue-600 hover:bg-blue-500 text-white', 'bg-sky-500 hover:bg-sky-600 !text-white !no-underline shadow-sm')
        
        body = body.replace('bg-slate-800/40', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800/50', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800/60', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800/30', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800/20', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800/10', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        body = body.replace('bg-slate-800', 'bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all')
        
        body = body.replace('bg-gradient-to-r from-blue-900/50 to-purple-900/50', 'bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-8 my-6 text-center')
        
        body = body.replace('border-white/10', 'border-slate-200')
        body = body.replace('border-white/5', 'border-slate-100')
        body = body.replace('border-white/20', 'border-slate-200')
        body = body.replace('border-slate-700', 'border-slate-200')
        body = body.replace('border-slate-800', 'border-slate-200')
        body = body.replace('border-red-500/20', 'border-red-200 bg-red-50/40 rounded-2xl p-5 shadow-sm my-6')
        body = body.replace('border-emerald-500/20', 'border-emerald-200 bg-emerald-50/40 rounded-2xl p-5 shadow-sm my-6')
        body = body.replace('border-blue-500/20', 'border-sky-200 bg-sky-50/40 rounded-2xl p-5 shadow-sm my-6')
        
        body = body.replace('text-slate-300', 'text-slate-600')
        body = body.replace('text-slate-400', 'text-slate-500')
        body = body.replace('text-slate-200', 'text-slate-700')
        body = body.replace('text-blue-300', 'text-sky-700')
        body = body.replace('text-blue-400', 'text-sky-600')
        body = body.replace('text-emerald-300', 'text-emerald-700')
        body = body.replace('text-emerald-400', 'text-emerald-600')
        body = body.replace('text-red-300', 'text-red-700')
        body = body.replace('text-red-400', 'text-red-600')
        body = body.replace('text-purple-300', 'text-purple-700')
        body = body.replace('text-amber-300', 'text-amber-700')
        body = body.replace('text-indigo-300', 'text-indigo-700')
        
        body = body.replace('bg-blue-500/20', 'bg-sky-100 text-sky-700')
        body = body.replace('bg-blue-500/10', 'bg-sky-50 text-sky-600')
        body = body.replace('bg-blue-500/15', 'bg-sky-100/60 text-sky-600')
        body = body.replace('bg-emerald-500/20', 'bg-emerald-100 text-emerald-700')
        body = body.replace('bg-emerald-500/10', 'bg-emerald-50 text-emerald-600')
        body = body.replace('bg-emerald-500/15', 'bg-emerald-100/60 text-emerald-600')
        body = body.replace('bg-red-500/20', 'bg-red-100 text-red-700')
        body = body.replace('bg-red-500/10', 'bg-red-50 text-red-600')
        body = body.replace('bg-red-500/15', 'bg-red-100/60 text-red-600')
        body = body.replace('bg-slate-900/20', 'bg-slate-100/50')
        body = body.replace('bg-slate-800/80', 'bg-slate-100 text-slate-700 font-semibold')
        body = body.replace('shadow-black/20', 'shadow-sm')
        body = body.replace('shadow-black/40', 'shadow-sm')
        body = body.replace('border-white/5', 'border-slate-100')
        
        # Generic text-white cleanup protecting !text-white
        body = body.replace('!text-white', 'TEMP_WHITE_HOLDER')
        body = body.replace('text-white font-bold', 'text-slate-900 font-bold')
        body = body.replace('text-white', 'text-slate-800')
        body = body.replace('TEMP_WHITE_HOLDER', '!text-white')
        body = body.replace('hover:text-white', 'hover:text-slate-900')
        body = body.replace('hover:bg-white/5', 'hover:bg-slate-100')
        
        body = body.replace('text-slate-800 hover:text-red-400 font-semibold underline', 'text-sky-600 hover:text-sky-700 font-semibold !no-underline')
        body = body.replace('text-slate-800 font-bold text-lg', 'text-slate-900 font-bold text-lg')
        body = body.replace('hover:border-green-500/30', 'hover:border-green-400 hover:bg-green-50/30')
        body = body.replace('hover:border-blue-500/30', 'hover:border-sky-400 hover:bg-sky-50/30')
        
        body = body.replace('class="!no-underline p-4 rounded-xl bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all', 'class="!no-underline p-4 rounded-xl bg-slate-50 border border-slate-200 hover:shadow-md transition-all')
        
        body = wrap_images(body)
        body = fix_all_article_buttons(body)
    else:
        body = "<p>Contenido del artículo no encontrado en el archivo de origen.</p>"
        
    return title, description, body, custom_head

def clean_article_body(body, filename):
    # Cover image replacements
    body = body.replace('/assets/img_sueldo_liquido.png', 'assets/guia-sueldo-liquido-cover.png')
    body = body.replace('assets/img_sueldo_liquido.png', 'assets/guia-sueldo-liquido-cover.png')
    body = body.replace('/assets/img_leer_liquidacion.png', 'assets/guia-liquidacion-sueldo-cover.png')
    body = body.replace('assets/img_leer_liquidacion.png', 'assets/guia-liquidacion-sueldo-cover.png')
    body = body.replace('/assets/img_ley_40_horas.png', 'assets/guia-ley-40-horas-chile-cover.png')
    body = body.replace('assets/img_ley_40_horas.png', 'assets/guia-ley-40-horas-chile-cover.png')
    body = body.replace('/assets/img_reclamo_finiquito.png', 'assets/guia-finiquito-no-pago-cover.png')
    body = body.replace('assets/img_reclamo_finiquito.png', 'assets/guia-finiquito-no-pago-cover.png')

    # 1. File-specific manual replacements for unreadable dark infographics, tables, or boxes
    
    if filename == "como-leer-liquidacion-de-sueldo.html":
        # Polished Light Infographic for Anatomy of Payslip
        new_infographic = """<!-- Infografía HTML: Anatomía de liquidación de sueldo -->
                <div class="my-8 p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm not-prose">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Anatomía de tu liquidación de sueldo</p>
                    <div class="space-y-4 max-w-md mx-auto">
                        <!-- Haberes -->
                        <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            <div class="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex justify-between items-center">
                                <span class="text-emerald-800 text-xs font-bold uppercase tracking-wider">Haberes (Ingresos)</span>
                                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">+ Suman</span>
                            </div>
                            <div class="p-4 space-y-2.5">
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Sueldo Base</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 font-bold">Imponible</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Gratificación</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 font-bold">Imponible</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Horas Extra</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 font-bold">Imponible</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Colación</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold">No Imponible</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Movilización</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold">No Imponible</span>
                                </div>
                            </div>
                        </div>

                        <!-- Conector Flecha -->
                        <div class="flex justify-center my-0.5">
                            <div class="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sky-500 shadow-2xs">
                                <span class="material-icons text-base">arrow_downward</span>
                            </div>
                        </div>

                        <!-- Descuentos -->
                        <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            <div class="bg-rose-50 border-b border-rose-100 px-4 py-2.5 flex justify-between items-center">
                                <span class="text-rose-800 text-xs font-bold uppercase tracking-wider">Descuentos Legales</span>
                                <span class="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">− Restan</span>
                            </div>
                            <div class="p-4 space-y-2.5">
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>AFP (10% + comisión)</span>
                                    <span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">−11,27%</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Salud (Fonasa/Isapre)</span>
                                    <span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">−7%</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Seguro de Cesantía</span>
                                    <span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">−0,6%</span>
                                </div>
                                <div class="flex justify-between items-center text-slate-800 text-sm font-medium">
                                    <span>Impuesto Único</span>
                                    <span class="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">Variable</span>
                                </div>
                            </div>
                        </div>

                        <!-- Conector Flecha -->
                        <div class="flex justify-center my-0.5">
                            <div class="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sky-500 shadow-2xs">
                                <span class="material-icons text-base">arrow_downward</span>
                            </div>
                        </div>

                        <!-- Sueldo Líquido -->
                        <div class="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-white to-blue-50/60 p-5 text-center shadow-xs">
                            <p class="text-sky-600 text-base font-extrabold tracking-tight mb-1 flex items-center justify-center gap-1.5">
                                <span class="material-icons text-sky-600 text-base">payments</span> SUELDO LÍQUIDO
                            </p>
                            <p class="text-slate-500 text-xs font-medium mb-0">Lo que recibes directamente en tu cuenta bancaria</p>
                        </div>
                    </div>
                </div>"""
        infographic_pattern = re.compile(
            r'<!-- Infografía HTML: Anatomía de liquidación de sueldo -->[\s\S]*?(?:Lo que recibes (?:directamente )?en tu cuenta bancaria</p>\s*</div>\s*</div>\s*</div>)',
            re.IGNORECASE
        )
        if infographic_pattern.search(body):
            body = infographic_pattern.sub(new_infographic, body)
        
        # Also clean up the CTA card
        old_cta = """<!-- CTA -->
                <div class="mt-10 p-8 rounded-2xl bg-gradient-to-r from-emerald-900/30 to-blue-900/50 border border-emerald-500/20 text-center">
                    <h3 class="!text-white !text-xl !font-bold !mb-3 !mt-0 !border-0 !pb-0">
                        Verifica tu liquidación en segundos
                    </h3>
                    <p class="!text-slate-300 !text-sm !mb-5">
                        Ingresa tu sueldo bruto y nuestra calculadora te mostrará exactamente cuánto deberían ser tus descuentos de AFP, salud, impuesto y tu sueldo líquido final.
                    </p>
                    <a href="/sueldo_liquido"
                        class="inline-flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                        <span class="material-icons">account_balance_wallet</span>
                        Verificar mi Sueldo Líquido
                    </a>
                </div>"""
        new_cta = """<!-- CTA -->
                <div class="mt-10 p-8 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 text-center shadow-sm">
                    <h3 class="text-slate-900 text-xl font-bold mb-3 mt-0 border-0 pb-0">
                        Verifica tu liquidación en segundos
                    </h3>
                    <p class="text-slate-600 text-sm mb-5">
                        Ingresa tu sueldo bruto y nuestra calculadora te mostrará exactamente cuánto deberían ser tus descuentos de AFP, salud, impuesto y tu sueldo líquido final.
                    </p>
                    <a href="sueldo_liquido"
                        class="cta-btn inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-500 text-white hover:bg-sky-600 rounded-xl shadow-md shadow-sky-500/10 transition-all hover:scale-[1.01]">
                        <span class="material-icons">account_balance_wallet</span>
                        Verificar mi Sueldo Líquido
                    </a>
                </div>"""
        body = flexible_replace(body, old_cta, new_cta)
        
        # Legal warning
        old_warning = """<div class="mt-8 p-4 rounded-lg bg-slate-800/30 border border-white/5">
                    <p class="!text-xs !text-slate-500 !mb-0 !leading-relaxed">
                        <strong>Aviso legal:</strong> Esta guía es de carácter informativo. Los porcentajes y topes indicados están actualizados a abril 2026. Para consultas específicas sobre tu situación, contacta al departamento de recursos humanos de tu empresa o a la Dirección del Trabajo.
                    </p>
                </div>"""
        new_warning = """<div class="mt-8 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p class="!text-xs !text-slate-600 !mb-0 !leading-relaxed">
                        <strong>Aviso legal:</strong> Esta guía es de carácter informativo. Los porcentajes y topes indicados están actualizados a abril 2026. Para consultas específicas sobre tu situación, contacta al departamento de recursos humanos de tu empresa o a la Dirección del Trabajo.
                    </p>
                </div>"""
        body = flexible_replace(body, old_warning, new_warning)

    elif filename == "como-calcular-sueldo-liquido-paso-a-paso.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Basado en la normativa local</p>
                        <p class="text-xs text-slate-400 m-0">Alineado a la legislación del SII y la Superintendencia de Pensiones en Chile.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Basado en la normativa local</p>
                        <p class="text-xs text-slate-500 m-0">Alineado a la legislación del SII y la Superintendencia de Pensiones en Chile.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Flow infographic
        old_flow = """<!-- Infografía HTML: Flujo de cálculo sueldo líquido -->
                <div class="my-8 p-6 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-white/10 shadow-xl">
                    <p class="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Del sueldo bruto al sueldo líquido</p>
                    <div class="max-w-xs mx-auto space-y-2">
                        <div class="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-center">
                            <p class="!text-emerald-400 !text-xs !font-bold !mb-0 !uppercase">Sueldo Bruto</p>
                            <p class="!text-white !text-lg !font-bold !mb-0">$1.200.000</p>
                        </div>
                        <div class="flex justify-center"><span class="material-icons text-slate-600 text-sm">arrow_downward</span></div>
                        <div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 flex justify-between items-center">
                            <span class="text-slate-300 text-xs">AFP (11,27%)</span>
                            <span class="text-rose-400 text-xs font-bold">−$135.240</span>
                        </div>
                        <div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 flex justify-between items-center">
                            <span class="text-slate-300 text-xs">Salud (7%)</span>
                            <span class="text-rose-400 text-xs font-bold">−$84.000</span>
                        </div>
                        <div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 flex justify-between items-center">
                            <span class="text-slate-300 text-xs">Cesantía (0,6%)</span>
                            <span class="text-rose-400 text-xs font-bold">−$7.200</span>
                        </div>
                        <div class="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 flex justify-between items-center">
                            <span class="text-slate-300 text-xs">Impuesto Único</span>
                            <span class="text-amber-400 text-xs font-bold">−$0 (exento)</span>
                        </div>
                        <div class="flex justify-center"><span class="material-icons text-slate-600 text-sm">arrow_downward</span></div>
                        <div class="rounded-lg bg-blue-500/15 border border-blue-500/40 px-4 py-3 text-center shadow-lg shadow-blue-500/10">
                            <p class="!text-blue-400 !text-xs !font-bold !mb-0 !uppercase">Sueldo Líquido</p>
                            <p class="!text-white !text-lg !font-bold !mb-0">$973.560</p>
                        </div>
                    </div>
                </div>"""
        new_flow = """<!-- Infografía HTML: Flujo de cálculo sueldo líquido -->
                <div class="my-8 p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">Del sueldo bruto al sueldo líquido</p>
                    <div class="max-w-xs mx-auto space-y-2">
                        <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-center shadow-sm">
                            <p class="text-emerald-700 text-xs font-bold mb-0 uppercase">Sueldo Bruto</p>
                            <p class="text-slate-800 text-lg font-bold mb-0">$1.200.000</p>
                        </div>
                        <div class="flex justify-center"><span class="material-icons text-sky-500 text-sm font-bold">arrow_downward</span></div>
                        <div class="rounded-lg bg-white border border-slate-100 px-4 py-2 flex justify-between items-center shadow-sm">
                            <span class="text-slate-600 text-xs font-medium">AFP (11,27%)</span>
                            <span class="text-rose-600 text-xs font-bold">−$135.240</span>
                        </div>
                        <div class="rounded-lg bg-white border border-slate-100 px-4 py-2 flex justify-between items-center shadow-sm">
                            <span class="text-slate-600 text-xs font-medium">Salud (7%)</span>
                            <span class="text-rose-600 text-xs font-bold">−$84.000</span>
                        </div>
                        <div class="rounded-lg bg-white border border-slate-100 px-4 py-2 flex justify-between items-center shadow-sm">
                            <span class="text-slate-600 text-xs font-medium">Cesantía (0,6%)</span>
                            <span class="text-rose-600 text-xs font-bold">−$7.200</span>
                        </div>
                        <div class="rounded-lg bg-white border border-slate-100 px-4 py-2 flex justify-between items-center shadow-sm">
                            <span class="text-slate-600 text-xs font-medium">Impuesto Único</span>
                            <span class="text-amber-600 text-xs font-bold">−$0 (exento)</span>
                        </div>
                        <div class="flex justify-center"><span class="material-icons text-sky-500 text-sm font-bold">arrow_downward</span></div>
                        <div class="rounded-lg bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 px-4 py-3 text-center shadow-sm">
                            <p class="text-sky-600 text-xs font-bold mb-0 uppercase">Sueldo Líquido</p>
                            <p class="text-sky-600 text-lg font-bold mb-0">$973.560</p>
                        </div>
                    </div>
                </div>"""
        body = flexible_replace(body, old_flow, new_flow)

        # Cross links box
        old_cross = """<!-- Callout con enlaces cruzados -->
                <div class="my-6 p-5 rounded-xl bg-slate-800/60 border border-emerald-500/20 shadow-lg">
                    <h4 class="text-emerald-400 font-bold text-sm mb-2 flex items-center gap-2 m-0">
                        <span class="material-icons text-base">info</span> ¿Quieres profundizar en tus haberes y jornada laboral?
                    </h4>
                    <p class="text-xs text-slate-300 mb-3 leading-relaxed">
                        Entender tu liquidación va más allá del cálculo básico de líquido. Te recomendamos leer nuestras guías especializadas:
                    </p>
                    <ul class="text-xs text-slate-400 space-y-2 m-0 pl-4">
                        <li>
                            <a href="/como-leer-liquidacion-de-sueldo" class="text-white hover:text-emerald-400 font-semibold underline transition-colors">
                                Cómo leer tu liquidación de sueldo en Chile
                            </a>: Una explicación rubro por rubro de cada descuento previsional e impuesto.
                        </li>
                        <li>
                            <a href="/ley-40-horas-chile-2026" class="text-white hover:text-emerald-400 font-semibold underline transition-colors">
                                Ley de 40 Horas Chile 2026
                            </a>: Todo sobre la reducción gradual de jornada y cómo afecta el cálculo de tus horas extras.
                        </li>
                    </ul>
                </div>"""
        new_cross = """<!-- Callout con enlaces cruzados -->
                <div class="my-6 p-5 rounded-xl bg-emerald-50/40 border border-emerald-200 shadow-sm">
                    <h4 class="text-emerald-700 font-bold text-sm mb-2 flex items-center gap-2 m-0">
                        <span class="material-icons text-base">info</span> ¿Quieres profundizar en tus haberes y jornada laboral?
                    </h4>
                    <p class="text-xs text-slate-600 mb-3 leading-relaxed">
                        Entender tu liquidación va más allá del cálculo básico de líquido. Te recomendamos leer nuestras guías especializadas:
                    </p>
                    <ul class="text-xs text-slate-600 space-y-2 m-0 pl-4">
                        <li>
                            <a href="como-leer-liquidacion-de-sueldo" class="text-sky-600 hover:text-sky-700 font-semibold transition-colors">
                                Cómo leer tu liquidación de sueldo en Chile
                            </a>: Una explicación rubro por rubro de cada descuento previsional e impuesto.
                        </li>
                        <li>
                            <a href="ley-40-horas-chile-2026" class="text-sky-600 hover:text-sky-700 font-semibold transition-colors">
                                Ley de 40 Horas Chile 2026
                            </a>: Todo sobre la reducción gradual de jornada y cómo afecta el cálculo de tus horas extras.
                        </li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_cross, new_cross)

        # Simulation details card
        old_sim = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 my-4 shadow-lg shadow-black/20">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Haberes Imponibles base:</span> <strong class="text-white">$1.200.000</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2 text-rose-300"><span>Cotización AFP (10% + 1,27% = 11,27%):</span> <strong>-$135.240</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2 text-rose-300"><span>Salud Fonasa (7%):</span> <strong>-$84.000</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2 text-rose-300"><span>Cesantía (0,6%):</span> <strong>-$7.200</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-yellow-100/80">Total Cotizaciones Excluidas:</span> <strong>$226.440</strong></li>
                        <li class="flex justify-between font-bold text-white border-b border-white/5 pb-2 mb-2"><span>Renta Líquida Imponible:</span> <span>$973.560</span></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2 text-rose-300"><span>Impuesto Único retenido (según SII aproximado):</span> <strong>-$1.202</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2 text-emerald-300"><span>Suma de Haberes No Imponibles (Colación/Movilización):</span> <strong>+$50.000</strong></li>
                        <li class="flex justify-between text-lg font-bold text-blue-400 pt-2"><span class="text-white">SUELDO LÍQUIDO FINAL AL BOLSILLO:</span> <span>$1.022.358</span></li>
                    </ul>
                </div>"""
        new_sim = """<div class="bg-white border border-slate-200 rounded-xl p-5 my-4 shadow-sm">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Haberes Imponibles base:</span> <strong class="text-slate-800">$1.200.000</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2 text-rose-600"><span>Cotización AFP (10% + 1,27% = 11,27%):</span> <strong>-$135.240</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2 text-rose-600"><span>Salud Fonasa (7%):</span> <strong>-$84.000</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2 text-rose-600"><span>Cesantía (0,6%):</span> <strong>-$7.200</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Total Cotizaciones Excluidas:</span> <strong class="text-slate-800">$226.440</strong></li>
                        <li class="flex justify-between font-bold text-slate-800 border-b border-slate-100 pb-2 mb-2"><span>Renta Líquida Imponible:</span> <span class="text-slate-900">$973.560</span></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2 text-rose-600"><span>Impuesto Único retenido (según SII aproximado):</span> <strong>-$1.202</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2 text-emerald-600"><span>Suma de Haberes No Imponibles (Colación/Movilización):</span> <strong>+$50.000</strong></li>
                        <li class="flex justify-between text-lg font-bold text-sky-600 pt-2"><span class="text-slate-800">SUELDO LÍQUIDO FINAL AL BOLSILLO:</span> <span>$1.022.358</span></li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_sim, new_sim)

    elif filename == "ley-40-horas-chile-2026.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Normativa Ley 21.561</p>
                        <p class="text-xs text-slate-400 m-0">Reducción gradual de jornada ordinaria en Chile.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Normativa Ley 21.561</p>
                        <p class="text-xs text-slate-500 m-0">Reducción gradual de jornada ordinaria en Chile.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Timeline infographic
        old_timeline = """<!-- Infografía HTML: Timeline Ley 40 Horas -->
                <div class="my-8 p-6 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-white/10 shadow-xl">
                    <p class="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Calendario de implementación · Ley 21.561</p>
                    <div class="grid grid-cols-3 gap-3 sm:gap-6 text-center">
                        <div class="opacity-60">
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center mb-2">
                                <span class="text-lg sm:text-2xl font-bold text-slate-400">44</span>
                            </div>
                            <p class="!text-slate-500 !text-xs !mb-0 font-semibold">Abril 2024</p>
                            <p class="!text-slate-600 !text-[10px] !mb-0">Completado ✓</p>
                        </div>
                        <div>
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-2 shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10">
                                <span class="text-lg sm:text-2xl font-bold text-blue-400">42</span>
                            </div>
                            <p class="!text-blue-400 !text-xs !font-bold !mb-0 font-bold">Abril 2026</p>
                            <p class="!text-blue-300 !text-[10px] !mb-0 font-semibold">← ESTAMOS AQUÍ</p>
                        </div>
                        <div class="opacity-40">
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-slate-700/30 border-2 border-slate-700 border-dashed flex items-center justify-center mb-2">
                                <span class="text-lg sm:text-2xl font-bold text-slate-500">40</span>
                            </div>
                            <p class="!text-slate-500 !text-xs !mb-0 font-semibold">Abril 2028</p>
                            <p class="!text-slate-600 !text-[10px] !mb-0">Meta final</p>
                        </div>
                    </div>
                    <div class="relative mt-4 mb-2 mx-4 sm:mx-8">
                        <div class="h-1 bg-slate-700 rounded-full"></div>
                        <div class="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" style="width: 50%"></div>
                    </div>
                    <p class="text-center !text-[10px] !text-slate-500 !mb-0 mt-3">Horas semanales máximas de jornada ordinaria</p>
                </div>"""
        new_timeline = """<!-- Infografía HTML: Timeline Ley 40 Horas -->
                <div class="my-8 p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Calendario de implementación · Ley 21.561</p>
                    <div class="grid grid-cols-3 gap-3 sm:gap-6 text-center">
                        <div class="opacity-60">
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center mb-2">
                                <span class="text-lg sm:text-2xl font-bold text-slate-600">44</span>
                            </div>
                            <p class="text-slate-500 text-xs mb-0 font-semibold">Abril 2024</p>
                            <p class="text-slate-600 text-[10px] mb-0">Completado ✓</p>
                        </div>
                        <div>
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-sky-100 border-2 border-sky-400 flex items-center justify-center mb-2 shadow-sm ring-4 ring-sky-100/50">
                                <span class="text-lg sm:text-2xl font-bold text-sky-600">42</span>
                            </div>
                            <p class="text-sky-600 text-xs mb-0 font-bold">Abril 2026</p>
                            <p class="text-sky-500 text-[10px] mb-0 font-semibold">← ESTAMOS AQUÍ</p>
                        </div>
                        <div class="opacity-40">
                            <div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-slate-100 border-2 border-slate-200 border-dashed flex items-center justify-center mb-2">
                                <span class="text-lg sm:text-2xl font-bold text-slate-400">40</span>
                            </div>
                            <p class="text-slate-500 text-xs mb-0 font-semibold">Abril 2028</p>
                            <p class="text-slate-600 text-[10px] mb-0">Meta final</p>
                        </div>
                    </div>
                    <div class="relative mt-4 mb-2 mx-4 sm:mx-8">
                        <div class="h-1 bg-slate-200 rounded-full"></div>
                        <div class="absolute top-0 left-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500 rounded-full" style="width: 50%"></div>
                    </div>
                    <p class="text-center !text-[10px] !text-slate-500 !mb-0 mt-3">Horas semanales máximas de jornada ordinaria</p>
                </div>"""
        body = flexible_replace(body, old_timeline, new_timeline)

        # Timeline list
        old_timeline_list = """<div class="my-8 ml-4">
                    <div class="timeline-item">
                        <p class="!text-slate-400 !text-sm !mb-1"><strong class="text-slate-300">Abril 2024 — Primera reducción</strong></p>
                        <p class="!text-slate-500 !text-sm !mb-0">Jornada máxima baja de 45 a <strong class="text-white">44 horas semanales</strong></p>
                    </div>
                    <div class="timeline-item active">
                        <p class="!text-blue-400 !text-sm !mb-1"><strong>Abril 2026 — Segunda reducción ← ESTAMOS AQUÍ</strong></p>
                        <p class="!text-slate-400 !text-sm !mb-0">Jornada máxima baja de 44 a <strong class="text-white">42 horas semanales</strong></p>
                    </div>
                    <div class="timeline-item future">
                        <p class="!text-slate-400 !text-sm !mb-1"><strong class="text-slate-500">Abril 2028 — Implementación completa</strong></p>
                        <p class="!text-slate-500 !text-sm !mb-0">Jornada máxima baja de 42 a <strong>40 horas semanales</strong></p>
                    </div>
                </div>"""
        new_timeline_list = """<div class="my-8 ml-4 border-l-2 border-slate-200 pl-4 space-y-4">
                    <div class="relative">
                        <div class="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                        <p class="text-slate-400 text-sm mb-1"><strong>Abril 2024 — Primera reducción</strong></p>
                        <p class="text-slate-500 text-sm mb-0">Jornada máxima baja de 45 a <strong class="text-slate-700 font-semibold">44 horas semanales</strong> (Completado)</p>
                    </div>
                    <div class="relative bg-sky-50/50 border border-sky-100 rounded-xl p-3 -mx-3">
                        <div class="absolute -left-[13px] top-[18px] w-3 h-3 rounded-full bg-sky-500 shadow-sm ring-4 ring-sky-100"></div>
                        <p class="text-sky-600 text-sm mb-1 font-bold">Abril 2026 — Segunda reducción ← ESTAMOS AQUÍ</p>
                        <p class="text-slate-600 text-sm mb-0">Jornada máxima baja de 44 a <strong class="text-slate-800 font-bold">42 horas semanales</strong></p>
                    </div>
                    <div class="relative opacity-60">
                        <div class="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-200"></div>
                        <p class="text-slate-400 text-sm mb-1"><strong>Abril 2028 — Implementación completa</strong></p>
                        <p class="text-slate-500 text-sm mb-0">Jornada máxima baja de 42 a <strong class="text-slate-700 font-semibold">40 horas semanales</strong></p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_timeline_list, new_timeline_list)

        # Minimum wage update
        body = body.replace("el sueldo mínimo es de <strong>$539.000</strong>", "el sueldo mínimo es de <strong>$553.553</strong>")
        
        # Replace quick table with updated 42h DT formula and CTA button
        old_quick_table = """<!-- Tabla rápida: Valor hora Chile 2026 -->
                <div class="my-8 p-6 rounded-2xl bg-gradient-to-b from-sky-50 to-blue-50 border-2 border-sky-200 shadow-md">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tabla rápida · Valor hora Chile 2026</p>
                    <p class="text-center !text-slate-600 !text-sm !mb-5 !mt-0">Con el sueldo mínimo vigente de <strong class="text-slate-900">$553.553</strong> mensuales, tu hora, día y semana valen:</p>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Hora</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$2.636</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">por hora ordinaria</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Día</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$18.452</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">jornada de 7h</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Semana</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$110.712</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">42h semanales</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Mes</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$553.553</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">sueldo mínimo</p>
                        </div>
                    </div>
                    <p class="!text-xs !text-slate-500 !mt-4 !mb-0 text-center">Cálculo: $553.553 ÷ 210 horas al mes = $2.636/hora. Fuente: Dirección del Trabajo, julio 2026.</p>
                </div>"""
        new_quick_table = """<!-- Tabla rápida: Valor hora Chile 2026 -->
                <div class="my-8 p-6 rounded-2xl bg-gradient-to-b from-sky-50 to-blue-50 border-2 border-sky-200 shadow-md">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tabla rápida · Valor hora Chile 2026 (Jornada 42 Horas)</p>
                    <p class="text-center !text-slate-600 !text-sm !mb-5 !mt-0">Con el sueldo mínimo vigente de <strong class="text-slate-900">$553.553</strong> mensuales (Fórmula Oficial DT):</p>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Hora Ordinaria</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$3.075</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">divisor DT: 180 hrs</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Hora Extra 50%</p>
                            <p class="!text-2xl !font-extrabold !text-emerald-600 !font-mono !mb-1 !mt-0">$4.613</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">días hábiles (×1.5)</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Hora Extra 100%</p>
                            <p class="!text-2xl !font-extrabold !text-emerald-600 !font-mono !mb-1 !mt-0">$6.151</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">festivos/domingos</p>
                        </div>
                        <div class="bg-white rounded-xl border border-sky-100 p-4 shadow-sm">
                            <p class="!text-[10px] !text-slate-500 !uppercase !tracking-wider !font-bold !mb-1 !mt-0">Día Hábil</p>
                            <p class="!text-2xl !font-extrabold !text-sky-600 !font-mono !mb-1 !mt-0">$18.452</p>
                            <p class="!text-[10px] !text-slate-500 !mb-0 !mt-0">sueldo ÷ 30</p>
                        </div>
                    </div>
                    <div class="mt-5 text-center">
                        <a href="calculadora-horas-extras" class="cta-btn inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/20 transition-all hover:scale-105 active:scale-95 !no-underline cursor-pointer">
                            <span class="material-icons text-sm">calculate</span> Simular Mis Horas Extras con Sueldo Real →
                        </a>
                    </div>
                </div>"""
        body = flexible_replace(body, old_quick_table, new_quick_table)

    elif filename == "que-hacer-si-no-te-pagan-el-finiquito.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-red-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Información Legal de Confianza</p>
                        <p class="text-xs text-slate-400 m-0">Artículos 163, 168, 169 y 480 del Código del Trabajo de Chile. Información verificada con la Dirección del Trabajo.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Información Legal de Confianza</p>
                        <p class="text-xs text-slate-500 m-0">Artículos 163, 168, 169 y 480 del Código del Trabajo de Chile. Información verificada con la Dirección del Trabajo.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # 5 steps infographic
        old_steps = """<!-- Infografía HTML: 5 Pasos para reclamar finiquito -->
                <div class="my-8 p-6 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-white/10 shadow-xl">
                    <p class="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Proceso para reclamar tu finiquito</p>
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-1">
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-1.5">
                                <span class="material-icons text-blue-400 text-sm">calculate</span>
                            </div>
                            <p class="!text-[10px] sm:!text-xs !text-white !font-semibold !mb-0 !leading-tight">1. Calcula<br>lo adeudado</p>
                        </div>
                        <span class="material-icons text-slate-600 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-600 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-1.5">
                                <span class="material-icons text-purple-400 text-sm">email</span>
                            </div>
                            <p class="!text-[10px] sm:!text-xs !text-white !font-semibold !mb-0 !leading-tight">2. Contacta<br>al empleador</p>
                        </div>
                        <span class="material-icons text-slate-600 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-600 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-1.5">
                                <span class="material-icons text-amber-400 text-sm">account_balance</span>
                            </div>
                            <p class="!text-[10px] sm:!text-xs !text-white !font-semibold !mb-0 !leading-tight">3. Reclama<br>ante la DT</p>
                        </div>
                        <span class="material-icons text-slate-600 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-600 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-1.5">
                                <span class="material-icons text-emerald-400 text-sm">handshake</span>
                            </div>
                            <p class="!text-[10px] sm:!text-xs !text-white !font-semibold !mb-0 !leading-tight">4. Audiencia<br>conciliación</p>
                        </div>
                        <span class="material-icons text-slate-600 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-600 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-1.5">
                                <span class="material-icons text-red-400 text-sm">gavel</span>
                            </div>
                            <p class="!text-[10px] sm:!text-xs !text-white !font-semibold !mb-0 !leading-tight">5. Demanda<br>judicial</p>
                        </div>
                    </div>
                </div>"""
        new_steps = """<!-- Infografía HTML: 5 Pasos para reclamar finiquito -->
                <div class="my-8 p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <p class="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">Proceso para reclamar tu finiquito</p>
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-1">
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center mb-1.5 shadow-sm">
                                <span class="material-icons text-sky-600 text-sm">calculate</span>
                            </div>
                            <p class="text-[10px] sm:text-xs text-slate-700 font-semibold mb-0 leading-tight">1. Calcula<br>lo adeudado</p>
                        </div>
                        <span class="material-icons text-slate-400 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-400 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center mb-1.5 shadow-sm">
                                <span class="material-icons text-purple-600 text-sm">email</span>
                            </div>
                            <p class="text-[10px] sm:text-xs text-slate-700 font-semibold mb-0 leading-tight">2. Contacta<br>al empleador</p>
                        </div>
                        <span class="material-icons text-slate-400 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-400 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mb-1.5 shadow-sm">
                                <span class="material-icons text-amber-600 text-sm">account_balance</span>
                            </div>
                            <p class="text-[10px] sm:text-xs text-slate-700 font-semibold mb-0 leading-tight">3. Reclama<br>ante la DT</p>
                        </div>
                        <span class="material-icons text-slate-400 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-400 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mb-1.5 shadow-sm">
                                <span class="material-icons text-emerald-600 text-sm">handshake</span>
                            </div>
                            <p class="text-[10px] sm:text-xs text-slate-700 font-semibold mb-0 leading-tight">4. Audiencia<br>conciliación</p>
                        </div>
                        <span class="material-icons text-slate-400 text-sm hidden sm:block">arrow_forward</span>
                        <span class="material-icons text-slate-400 text-sm sm:hidden">arrow_downward</span>
                        <div class="flex flex-col items-center text-center flex-1">
                            <div class="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mb-1.5 shadow-sm">
                                <span class="material-icons text-red-600 text-sm">gavel</span>
                            </div>
                            <p class="text-[10px] sm:text-xs text-slate-700 font-semibold mb-0 leading-tight">5. Demanda<br>judicial</p>
                        </div>
                    </div>
                </div>"""
        body = flexible_replace(body, old_steps, new_steps)

        # Delay consequences
        old_delay = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 my-4 shadow-lg shadow-black/20">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Reajuste IPC:</span> <strong class="text-amber-400">Las sumas adeudadas se reajustan por inflación</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Interés máximo convencional:</span> <strong class="text-amber-400">Se acumulan intereses desde el primer día de atraso</strong></li>
                        <li class="flex justify-between text-red-300 pt-1"><span>Recargo legal (Art. 168):</span> <strong>Hasta un 150% de la última remuneración mensual</strong></li>
                    </ul>
                </div>"""
        new_delay = """<div class="bg-white border border-slate-200 rounded-xl p-5 my-4 shadow-sm">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Reajuste IPC:</span> <strong class="text-amber-700">Las sumas adeudadas se reajustan por inflación</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Interés máximo convencional:</span> <strong class="text-amber-700">Se acumulan intereses desde el primer día de atraso</strong></li>
                        <li class="flex justify-between text-rose-600 pt-1"><span>Recargo legal (Art. 168):</span> <strong class="text-rose-700">Hasta un 150% de la última remuneración mensual</strong></li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_delay, new_delay)

        # Deadlines
        old_deadlines = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 my-4">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Pago del finiquito:</span> <strong class="text-white">10 días hábiles desde la separación</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Reclamo ante la DT:</span> <strong class="text-white">Sin plazo definido (pero mejor pronto)</strong></li>
                        <li class="flex justify-between border-b border-white/5 pb-2 mb-2"><span class="text-slate-300">Demanda judicial:</span> <strong class="text-white">60 días hábiles desde el despido</strong></li>
                        <li class="flex justify-between"><span class="text-slate-300">Prescripción de derechos laborales:</span> <strong class="text-white">2 años desde que se hicieron exigibles</strong></li>
                    </ul>
                </div>"""
        new_deadlines = """<div class="bg-white border border-slate-200 rounded-xl p-5 my-4 shadow-sm">
                    <ul class="!list-none !p-0">
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Pago del finiquito:</span> <strong class="text-slate-800">10 días hábiles desde la separación</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Reclamo ante la DT:</span> <strong class="text-slate-800">Sin plazo definido (pero mejor pronto)</strong></li>
                        <li class="flex justify-between border-b border-slate-100 pb-2 mb-2"><span class="text-slate-600 font-medium">Demanda judicial:</span> <strong class="text-slate-800">60 días hábiles desde el despido</strong></li>
                        <li class="flex justify-between"><span class="text-slate-600 font-medium">Prescripción de derechos laborales:</span> <strong class="text-slate-800">2 años desde que se hicieron exigibles</strong></li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_deadlines, new_deadlines)

    elif filename == "como-calcular-finiquito-chile.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Base Legal y Normativa 2026</p>
                        <p class="text-xs text-slate-400 m-0">Artículo 177 y siguientes del Código del Trabajo en Chile. Datos actualizados a los topes de UF e IMM de 2026.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Base Legal y Normativa 2026</p>
                        <p class="text-xs text-slate-500 m-0">Artículo 177 y siguientes del Código del Trabajo en Chile. Datos actualizados a los topes de UF e IMM de 2026.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Warning callout
        old_warning = """<div class="my-6 p-5 rounded-xl bg-slate-800/60 border border-red-500/20 shadow-lg">
                    <h4 class="text-red-400 font-bold text-sm mb-2 flex items-center gap-2 m-0">
                        <span class="material-icons text-base">warning</span> ¿Tu empleador se está retrasando en el pago?
                    </h4>
                    <p class="text-xs text-slate-300 mb-3 leading-relaxed">
                        Por ley, existe un plazo máximo estricto para el pago de tu liquidación final. Te recomendamos leer nuestra guía crítica:
                    </p>
                    <p class="text-xs text-slate-400 m-0">
                        &rarr; <a href="/que-hacer-si-no-te-pagan-el-finiquito" class="text-white hover:text-red-400 font-semibold underline transition-colors">
                            Qué hacer si no te pagan el finiquito a tiempo en Chile
                        </a>: Conoce las multas, el reajuste por IPC y cómo iniciar un reclamo formal ante la Inspección del Trabajo.
                    </p>
                </div>"""
        new_warning = """<div class="my-6 p-5 rounded-xl bg-red-50 border border-red-200 shadow-sm">
                    <h4 class="text-red-700 font-bold text-sm mb-2 flex items-center gap-2 m-0">
                        <span class="material-icons text-base">warning</span> ¿Tu empleador se está retrasando en el pago?
                    </h4>
                    <p class="text-xs text-slate-600 mb-3 leading-relaxed">
                        Por ley, existe un plazo máximo estricto para el pago de tu liquidación final. Te recomendamos leer nuestra guía crítica:
                    </p>
                    <p class="text-xs text-slate-650 m-0 font-medium">
                        &rarr; <a href="que-hacer-si-no-te-pagan-el-finiquito" class="text-sky-600 hover:text-sky-700 font-semibold transition-colors">
                            Qué hacer si no te pagan el finiquito a tiempo en Chile
                        </a>: Conoce las multas, el reajuste por IPC y cómo iniciar un reclamo formal ante la Inspección del Trabajo.
                    </p>
                </div>"""
        body = flexible_replace(body, old_warning, new_warning)

        # Simulation input case card
        old_inputs = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 my-6">
                    <h3 class="!text-white !mt-0 !mb-3 !text-base">📋 Datos del caso</h3>
                    <ul class="!mb-0">
                        <li><strong>Trabajador:</strong> contrato indefinido</li>
                        <li><strong>Sueldo base:</strong> $800.000</li>
                        <li><strong>Gratificación legal:</strong> $200.000</li>
                        <li><strong>Inicio contrato:</strong> 1 de diciembre de 2020</li>
                        <li><strong>Fecha de despido:</strong> 15 de marzo de 2026</li>
                        <li><strong>Causal:</strong> Necesidades de la empresa (Art. 161)</li>
                        <li><strong>Aviso previo:</strong> No se dio con 30 días de anticipación</li>
                        <li><strong>Vacaciones pendientes:</strong> 5 días</li>
                    </ul>
                </div>"""
        new_inputs = """<div class="bg-slate-50 border border-slate-200 rounded-xl p-5 my-6 shadow-sm">
                    <h3 class="text-slate-800 font-bold mt-0 mb-3 text-base">📋 Datos del caso</h3>
                    <ul class="mb-0 text-slate-750 space-y-1 font-medium">
                        <li><strong>Trabajador:</strong> contrato indefinido</li>
                        <li><strong>Sueldo base:</strong> $800.000</li>
                        <li><strong>Gratificación legal:</strong> $200.000</li>
                        <li><strong>Inicio contrato:</strong> 1 de diciembre de 2020</li>
                        <li><strong>Fecha de despido:</strong> 15 de marzo de 2026</li>
                        <li><strong>Causal:</strong> Necesidades de la empresa (Art. 161)</li>
                        <li><strong>Aviso previo:</strong> No se dio con 30 días de anticipación</li>
                        <li><strong>Vacaciones pendientes:</strong> 5 días</li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_inputs, new_inputs)

    elif filename == "despido-necesidades-empresa-articulo-161.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Revisado por Equipo Legal</p>
                        <p class="text-xs text-slate-400 m-0">Basado estrictamente en el Código del Trabajo y
                            Jurisprudencia de la Dirección del Trabajo (2026).</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Revisado por Equipo Legal</p>
                        <p class="text-xs text-slate-500 m-0">Basado estrictamente en el Código del Trabajo y
                            Jurisprudencia de la Dirección del Trabajo (2026).</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Hero image wrapper
        old_hero_wrap = """<div class="rounded-2xl overflow-hidden border border-white/5 bg-slate-800/20">
                    <img src="assets/guia-despido-necesidades-empresa-161.png"
                        alt="Documento gráfico sobre el Artículo 161 del Código del Trabajo, mostrando causales de despido e indemnizaciones."
                        title="Despido por necesidades de la empresa (Artículo 161)"
                        class="w-full h-auto max-h-[45vh] object-contain" loading="lazy" width="1280" height="720" />
                </div>"""
        new_hero_wrap = """<div class="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src="assets/guia-despido-necesidades-empresa-161.png"
                        alt="Documento gráfico sobre el Artículo 161 del Código del Trabajo, mostrando causales de despido e indemnizaciones."
                        title="Despido por necesidades de la empresa (Artículo 161)"
                        class="w-full h-auto max-h-[45vh] object-contain" loading="lazy" width="1280" height="720" />
                </div>"""
        body = flexible_replace(body, old_hero_wrap, new_hero_wrap)

        # Simulation card
        old_sim = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 my-6">
                    <h3 class="!text-white !mt-0 !mb-3 !text-base">📋 Datos de la simulación:</h3>
                    <ul class="!mb-0">
                        <li><strong>Sueldo Bruto / Base a calcular:</strong> $1.000.000</li>
                        <li><strong>Años de vinculación laboral:</strong> 4 años y 6 meses.</li>
                        <li><strong>Notificación:</strong> Despido inmediato (sin carta 30 días antes).</li>
                    </ul>
                </div>"""
        new_sim = """<div class="bg-slate-50 border border-slate-200 rounded-xl p-5 my-6 shadow-sm">
                    <h3 class="text-slate-800 font-bold mt-0 mb-3 text-base">📋 Datos de la simulación:</h3>
                    <ul class="mb-0 text-slate-750 space-y-1 font-medium">
                        <li><strong>Sueldo Bruto / Base a calcular:</strong> $1.000.000</li>
                        <li><strong>Años de vinculación laboral:</strong> 4 años y 6 meses.</li>
                        <li><strong>Notificación:</strong> Despido inmediato (sin carta 30 días antes).</li>
                    </ul>
                </div>"""
        body = flexible_replace(body, old_sim, new_sim)

        # Comparison table
        old_table = """<div class="overflow-x-auto my-6">
                    <table
                        class="w-full text-sm border-collapse rounded-xl overflow-hidden border border-white/5 bg-slate-800/20">
                        <thead class="bg-slate-800/80">
                            <tr>
                                <th class="text-left p-4 text-white font-semibold border-b border-white/10">Aspecto</th>
                                <th
                                    class="text-center p-4 text-emerald-400 font-semibold border-b border-white/10 border-l border-white/5">
                                    Artículo 161 (Necesidades de la empresa)</th>
                                <th
                                    class="text-center p-4 text-rose-400 font-semibold border-b border-white/10 border-l border-white/5">
                                    Artículo 160 (Causales y faltas graves)</th>
                            </tr>
                        </thead>
                        <tbody class="text-slate-300 text-center">
                            <tr class="border-b border-white/5">
                                <td class="p-4 text-left font-medium">¿Hay indemnización años servicio?</td>
                                <td class="p-4 border-l border-white/5">Sí, siempre que pase de un año.</td>
                                <td class="p-4 border-l border-white/5">No, bajo ninguna circunstancia inicial.</td>
                            </tr>
                            <tr class="border-b border-white/5">
                                <td class="p-4 text-left font-medium">¿Hay aviso previo?</td>
                                <td class="p-4 border-l border-white/5">Sí, 30 días o el pago sustitutivo a un sueldo.
                                </td>
                                <td class="p-4 border-l border-white/5">No requiere aviso ni mes compensador.</td>
                            </tr>
                            <tr>
                                <td class="p-4 text-left font-medium">¿Puede impugnarse?</td>
                                <td class="p-4 border-l border-white/5">Sí, pidiendo recargos por despido injustificado
                                    (30%).</td>
                                <td class="p-4 border-l border-white/5">Sí, pero peleando despido indebido para
                                    revertirlo a Art. 161.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>"""
        new_table = """<div class="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm">
                    <table class="w-full text-sm border-collapse bg-white">
                        <thead class="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th class="text-left p-4 text-slate-800 font-semibold">Aspecto</th>
                                <th class="text-center p-4 text-emerald-700 font-semibold border-l border-slate-200">Artículo 161 (Necesidades de la empresa)</th>
                                <th class="text-center p-4 text-rose-700 font-semibold border-l border-slate-200">Artículo 160 (Causales y faltas graves)</th>
                            </tr>
                        </thead>
                        <tbody class="text-slate-600 text-center">
                            <tr class="border-b border-slate-100">
                                <td class="p-4 text-left font-medium text-slate-700">¿Hay indemnización años servicio?</td>
                                <td class="p-4 border-l border-slate-100">Sí, siempre que pase de un año.</td>
                                <td class="p-4 border-l border-slate-100">No, bajo ninguna circunstancia inicial.</td>
                            </tr>
                            <tr class="border-b border-slate-100">
                                <td class="p-4 text-left font-medium text-slate-700">¿Hay aviso previo?</td>
                                <td class="p-4 border-l border-slate-100">Sí, 30 días o el pago sustitutivo a un sueldo.</td>
                                <td class="p-4 border-l border-slate-100">No requiere aviso ni mes compensador.</td>
                            </tr>
                            <tr>
                                <td class="p-4 text-left font-medium text-slate-700">¿Puede impugnarse?</td>
                                <td class="p-4 border-l border-slate-100">Sí, pidiendo recargos por despido injustificado (30%).</td>
                                <td class="p-4 border-l border-slate-100">Sí, pero peleando despido indebido para revertirlo a Art. 161.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>"""
        body = flexible_replace(body, old_table, new_table)

    elif filename == "guia-vacaciones-proporcionales.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Normativa Artículo 73</p>
                        <p class="text-xs text-slate-400 m-0">Regulado por el Código del Trabajo de Chile. Información sobre cálculo de feriado proporcional e indemnizaciones.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Normativa Artículo 73</p>
                        <p class="text-xs text-slate-500 m-0">Regulado por el Código del Trabajo de Chile. Información sobre cálculo de feriado proporcional e indemnizaciones.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Formula box
        old_formula = """<div class="bg-slate-800/50 rounded-xl p-5 border border-white/10 font-mono text-sm text-blue-300 my-6">
                    <p class="!text-blue-300 !mb-2">Días proporcionales = 15 × (meses trabajados en el período / 12)
                    </p>
                    <p class="!text-blue-300 !mb-2">Monto = (Sueldo diario) × Días proporcionales</p>
                    <p class="!text-slate-500 !mb-0 text-xs">Donde sueldo diario = Remuneración íntegra ÷ 30</p>
                </div>"""
        new_formula = """<div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 my-6 shadow-sm">
                    <div class="font-mono text-xs sm:text-sm text-sky-800 space-y-1.5 mb-4">
                        <p class="font-bold text-slate-800 mb-2">📐 Fórmula Oficial (Art. 73 Código del Trabajo):</p>
                        <p class="text-sky-700">Días proporcionales = 1,25 días × meses trabajados en el año</p>
                        <p class="text-sky-700">Monto a Pago = Días proporcionales × (Sueldo Base ÷ 30)</p>
                        <p class="text-slate-500 text-xs mt-1 font-sans">Donde 1,25 días = 15 días anuales ÷ 12 meses.</p>
                    </div>
                    <div class="pt-3 border-t border-slate-200 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span class="text-xs text-slate-600 font-medium">¿Quieres calcular el monto exacto en pesos con tus fechas?</span>
                        <a href="finiquito_calculator" class="cta-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95 !no-underline cursor-pointer">
                            <span class="material-icons text-sm">calculate</span> Calcular en Simulador DT →
                        </a>
                    </div>
                </div>"""
        body = flexible_replace(body, old_formula, new_formula)

    elif filename == "seguro-de-cesantia-chile-como-cobrar.html":
        # EEAT badge
        old_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-white/10 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-blue-400">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-white font-semibold m-0">Normativa Ley 19.728</p>
                        <p class="text-xs text-slate-400 m-0">Regulación legal sobre AFC, cotizaciones y Fondo Solidario en Chile.</p>
                    </div>
                </div>"""
        new_eeat = """<div class="flex items-center gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100 mb-8 mt-2">
                    <div class="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-icons text-sky-600">gavel</span>
                    </div>
                    <div>
                        <p class="text-sm text-slate-800 font-semibold m-0">Normativa Ley 19.728</p>
                        <p class="text-xs text-slate-500 m-0">Regulación legal sobre AFC, cotizaciones y Fondo Solidario en Chile.</p>
                    </div>
                </div>"""
        body = flexible_replace(body, old_eeat, new_eeat)

        # Infographic banner
        old_banner = """<div class="mb-10 rounded-2xl overflow-hidden border border-white/10 shadow-2xl" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 40px 30px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0; position: relative;">
                    <!-- Connecting line -->
                    <div style="position: absolute; top: 50%; left: 15%; right: 15%; height: 2px; background: linear-gradient(90deg, #10b981, #0ea5e9, #10b981); opacity: 0.3; transform: translateY(-50%); z-index: 0;"></div>
                    
                    <!-- Pillar 1: Protection -->
                    <div style="flex: 1; text-align: center; position: relative; z-index: 1;">
                        <div style="width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 50%; background: rgba(16,185,129,0.12); border: 2px solid rgba(16,185,129,0.25); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 36px; color: #10b981;">shield</span>
                        </div>
                        <h4 style="color: #f1f5f9; font-size: 13px; font-weight: 700; margin: 0 0 4px;">Protección Laboral</h4>
                        <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.4; max-width: 160px; margin: 0 auto;">Derecho de seguridad social para todo trabajador en Chile</p>
                    </div>

                    <!-- Arrow 1 -->
                    <div style="color: #334155; font-size: 24px; z-index: 1; margin: 0 -8px;">→</div>

                    <!-- Pillar 2: CIC Account -->
                    <div style="flex: 1; text-align: center; position: relative; z-index: 1;">
                        <div style="width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 50%; background: rgba(14,165,233,0.12); border: 2px solid rgba(14,165,233,0.25); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 36px; color: #0ea5e9;">savings</span>
                        </div>
                        <h4 style="color: #f1f5f9; font-size: 13px; font-weight: 700; margin: 0 0 4px;">Cuenta Individual (CIC)</h4>
                        <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.4; max-width: 160px; margin: 0 auto;">Aportes de trabajador (0,6%) y empleador (2,4%)</p>
                    </div>

                    <!-- Arrow 2 -->
                    <div style="color: #334155; font-size: 24px; z-index: 1; margin: 0 -8px;">→</div>

                    <!-- Pillar 3: Benefits -->
                    <div style="flex: 1; text-align: center; position: relative; z-index: 1;">
                        <div style="width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 50%; background: rgba(16,185,129,0.12); border: 2px solid rgba(16,185,129,0.25); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 36px; color: #10b981;">payments</span>
                        </div>
                        <h4 style="color: #f1f5f9; font-size: 13px; font-weight: 700; margin: 0 0 4px;">Beneficio de Cesantía</h4>
                        <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.4; max-width: 160px; margin: 0 auto;">Pagos mensuales del 70% al 35% del sueldo</p>
                    </div>
                </div>
            </div>"""
        new_banner = """<div class="mb-10 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm" style="padding: 40px 30px;">
                <div class="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-2 relative">
                    <!-- Connecting line -->
                    <div class="hidden md:block absolute top-[36px] left-[15%] right-[15%] h-[2px] bg-slate-200 z-0"></div>
                    
                    <!-- Pillar 1: Protection -->
                    <div class="flex-1 text-center relative z-10">
                        <div class="w-18 h-18 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-3 shadow-sm" style="width: 72px; height: 72px;">
                            <span class="material-icons text-3xl text-emerald-600">shield</span>
                        </div>
                        <h4 class="text-slate-800 text-sm font-bold mb-1">Protección Laboral</h4>
                        <p class="text-slate-500 text-xs max-w-[160px] mx-auto leading-relaxed">Derecho de seguridad social para todo trabajador en Chile</p>
                    </div>

                    <!-- Arrow 1 -->
                    <div class="hidden md:block text-slate-300 text-2xl z-10 font-bold">→</div>

                    <!-- Pillar 2: CIC Account -->
                    <div class="flex-1 text-center relative z-10">
                        <div class="w-18 h-18 mx-auto rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center mb-3 shadow-sm" style="width: 72px; height: 72px;">
                            <span class="material-icons text-3xl text-sky-500">savings</span>
                        </div>
                        <h4 class="text-slate-800 text-sm font-bold mb-1">Cuenta Individual (CIC)</h4>
                        <p class="text-slate-500 text-xs max-w-[160px] mx-auto leading-relaxed">Aportes de trabajador (0,6%) y empleador (2,4%)</p>
                    </div>

                    <!-- Arrow 2 -->
                    <div class="hidden md:block text-slate-300 text-2xl z-10 font-bold">→</div>

                    <!-- Pillar 3: Benefits -->
                    <div class="flex-1 text-center relative z-10">
                        <div class="w-18 h-18 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-3 shadow-sm" style="width: 72px; height: 72px;">
                            <span class="material-icons text-3xl text-emerald-600">payments</span>
                        </div>
                        <h4 class="text-slate-800 text-sm font-bold mb-1">Beneficio de Cesantía</h4>
                        <p class="text-slate-500 text-xs max-w-[160px] mx-auto leading-relaxed">Pagos mensuales del 70% al 35% del sueldo</p>
                    </div>
                </div>
            </div>"""
        body = flexible_replace(body, old_banner, new_banner)

        # Warning card
        old_warning = """<div class="my-6 p-5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <h4 class="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                            <span class="material-icons text-red-400 text-sm">warning</span>
                            ¡Importante sobre el Descuento AFC!
                        </h4>
                        <p class="text-xs text-slate-400 leading-relaxed mb-0">
                            Este descuento solo es legal si la causal aplicada es <strong>Art. 161 (Necesidades de la empresa)</strong>. No aplica en casos de renuncia voluntaria, mutuo acuerdo, vencimiento de plazo o despidos disciplinarios. Además, el descuento solo resta sobre el monto final de la <strong>indemnización por años de servicio</strong>, nunca sobre las vacaciones proporcionales ni sobre las remuneraciones pendientes.
                        </p>
                    </div>"""
        new_warning = """<div class="my-6 p-5 rounded-xl bg-red-50 border border-red-200 shadow-sm">
                        <h4 class="text-sm font-bold text-red-800 mb-2 flex items-center gap-1.5">
                            <span class="material-icons text-red-600 text-sm">warning</span>
                            ¡Importante sobre el Descuento AFC!
                        </h4>
                        <p class="text-xs text-slate-650 leading-relaxed mb-0">
                            Este descuento solo es legal si la causal aplicada es <strong>Art. 161 (Necesidades de la empresa)</strong>. No aplica en casos de renuncia voluntaria, mutuo acuerdo, vencimiento de plazo o despidos disciplinarios. Además, el descuento solo resta sobre el monto final de la <strong>indemnización por años de servicio</strong>, nunca sobre las vacaciones proporcionales ni sobre las remuneraciones pendientes.
                        </p>
                    </div>"""
        body = flexible_replace(body, old_warning, new_warning)

        # AFC table
        old_table = """<div class="overflow-x-auto my-6 border border-white/10 rounded-xl">
                        <table class="w-full text-sm text-left text-slate-400">
                            <thead class="bg-slate-900 text-white text-xs uppercase font-bold border-b border-white/10">
                                <tr>
                                    <th class="px-4 py-3">Giro Mensual</th>
                                    <th class="px-4 py-3 text-right">Porcentaje del Sueldo</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-white">1° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-400 font-mono">70%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-white">2° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-400 font-mono">55%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-white">3° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-400 font-mono">45%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-white">4° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-400 font-mono">40%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-white">5° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-400 font-mono">35%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>"""
        new_table = """<div class="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm">
                        <table class="w-full text-sm text-left text-slate-650 bg-white">
                            <thead class="bg-slate-50 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th class="px-4 py-3">Giro Mensual</th>
                                    <th class="px-4 py-3 text-right">Porcentaje del Sueldo</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-slate-700">1° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-600 font-mono font-bold">70%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-slate-700">2° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-600 font-mono font-bold">55%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-slate-700">3° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-600 font-mono font-bold">45%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-slate-700">4° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-600 font-mono font-bold">40%</td>
                                </tr>
                                <tr>
                                    <td class="px-4 py-3 font-semibold text-slate-700">5° Mes</td>
                                    <td class="px-4 py-3 text-right text-emerald-600 font-mono font-bold">35%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>"""
        body = flexible_replace(body, old_table, new_table)

        # Calculator promo card
        old_promo = """<div class="glass-panel p-6 rounded-2xl border border-primary/20 shadow-2xl relative overflow-hidden bg-slate-900/60 backdrop-blur-md">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none"></div>
                        <h4 class="text-sm font-bold text-primary uppercase tracking-widest mb-2">Simulador de Finiquito</h4>
                        <h3 class="text-lg font-bold text-white mb-3">Revisa tu descuento de la AFC</h3>
                        <p class="text-xs text-slate-400 leading-relaxed mb-5">
                            ¿Te despidieron por necesidades de la empresa? Usa nuestra calculadora gratuita con el descuento legal AFC actualizado a la normativa 2026.
                        </p>
                        <a href="/finiquito_calculator"
                            class="block w-full text-center bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-full text-xs transition-all shadow-lg shadow-primary/20 hover:scale-[1.02]">
                            Ir a la Calculadora
                        </a>
                    </div>"""
        new_promo = """<div class="p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden bg-white">
                        <h4 class="text-sm font-bold text-sky-600 uppercase tracking-widest mb-2">Simulador de Finiquito</h4>
                        <h3 class="text-lg font-bold text-slate-900 mb-3">Revisa tu descuento de la AFC</h3>
                        <p class="text-xs text-slate-655 leading-relaxed mb-5">
                            ¿Te despidieron por necesidades de la empresa? Usa nuestra calculadora gratuita con el descuento legal AFC actualizado a la normativa 2026.
                        </p>
                        <a href="finiquito_calculator"
                            class="cta-btn block w-full text-center bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-sm">
                            Ir a la Calculadora
                        </a>
                    </div>"""
        body = flexible_replace(body, old_promo, new_promo)

        # AFC info card
        old_info = """<div class="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-950/30 space-y-4">
                        <h3 class="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">Datos AFC Chile</h3>
                        <ul class="space-y-2.5 text-xs text-slate-400 leading-relaxed">
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-400 text-sm mt-0.5">location_on</span>
                                <div><strong>Administradora:</strong> AFC Chile S.A.</div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-400 text-sm mt-0.5">link</span>
                                <div><strong>Sitio oficial:</strong> <a href="https://www.afc.cl" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.afc.cl</a></div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-400 text-sm mt-0.5">phone</span>
                                <div><strong>Call Center:</strong> 600 584 3000</div>
                            </li>
                        </ul>
                    </div>"""
        new_info = """<div class="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-4 shadow-sm">
                        <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">Datos AFC Chile</h3>
                        <ul class="space-y-2.5 text-xs text-slate-650 leading-relaxed">
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-600 text-sm mt-0.5">location_on</span>
                                <div class="text-slate-700"><strong>Administradora:</strong> AFC Chile S.A.</div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-600 text-sm mt-0.5">link</span>
                                <div class="text-slate-700"><strong>Sitio oficial:</strong> <a href="https://www.afc.cl" class="text-sky-600 hover:underline" target="_blank" rel="noopener noreferrer">www.afc.cl</a></div>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="material-icons text-emerald-600 text-sm mt-0.5">phone</span>
                                <div class="text-slate-700"><strong>Call Center:</strong> 600 584 3000</div>
                            </li>
                        </ul>
                    </div>"""
        body = flexible_replace(body, old_info, new_info)

    # 2. General Cleanups across all pages (relative paths, stray classes, etc.)
    body = body.replace('href="/sueldo_liquido"', 'href="sueldo_liquido"')
    body = body.replace('href="/finiquito_calculator"', 'href="finiquito_calculator"')
    body = body.replace('href="/como-leer-liquidacion-de-sueldo"', 'href="como-leer-liquidacion-de-sueldo"')
    body = body.replace('href="/ley-40-horas-chile-2026"', 'href="ley-40-horas-chile-2026"')
    body = body.replace('href="/que-hacer-si-no-te-pagan-el-finiquito"', 'href="que-hacer-si-no-te-pagan-el-finiquito"')
    body = body.replace('href="/como-calcular-sueldo-liquido-paso-a-paso"', 'href="como-calcular-sueldo-liquido-paso-a-paso"')
    body = body.replace('href="/como-calcular-finiquito-chile"', 'href="como-calcular-finiquito-chile"')
    body = body.replace('href="/despido-necesidades-empresa-articulo-161"', 'href="despido-necesidades-empresa-articulo-161"')
    body = body.replace('href="/guia-vacaciones-proporcionales"', 'href="guia-vacaciones-proporcionales"')
    body = body.replace('href="/seguro-de-cesantia-chile-como-cobrar"', 'href="seguro-de-cesantia-chile-como-cobrar"')

    # Let's clean some residual text color issues
    body = body.replace('text-rose-300', 'text-rose-700')
    body = body.replace('text-rose-450', 'text-rose-700')
    body = body.replace('text-yellow-100/80', 'text-amber-800')
    body = body.replace('text-emerald-300', 'text-emerald-700')
    body = body.replace('text-green-400', 'text-emerald-600')
    body = body.replace('text-blue-300', 'text-sky-700')
    body = body.replace('text-blue-400', 'text-sky-600')
    
    # Avoid duplicated classes on alert boxes from naive replaces
    body = body.replace('bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all border border-slate-100', 'bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm my-6')
    body = body.replace('bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all border border-slate-200', 'bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm my-6')
    body = body.replace('bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-sm my-6 transition-all border border-white/5', 'bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm my-6')
    # Guide-specific CTA anchor and text fixes
    if "despido-necesidades-empresa-articulo-161" in filename:
        body = body.replace('href="#lead-form"', 'href="#lead-form-art161"')
        body = body.replace('Revisar mi caso gratis', 'Revisar mi caso')
        body = body.replace('Un abogado laboral puede revisarlo sin costo.', 'Un abogado laboral aliado puede orientarte.')
        body = body.replace('Un abogado laboral puede revisar tu caso sin costo.', 'Un abogado laboral aliado puede orientarte en tu caso.')
    elif "carta-de-despido-chile" in filename:
        body = body.replace('href="#lead-form"', 'href="#lead-form-carta"')
        body = body.replace('Permítenos conectar tu caso con un especialista de forma gratuita.', 'Permítenos conectar tu caso con un especialista para evaluar tus antecedentes.')
    elif "finiquito-por-renuncia-voluntaria" in filename:
        body = body.replace('href="#lead-form"', 'href="#lead-form-renuncia"')

    # Return cleaned body
    return body


# List of articles to build
articles = [
    "como-calcular-finiquito-chile.html",
    "como-calcular-sueldo-liquido-paso-a-paso.html",
    "como-leer-liquidacion-de-sueldo.html",
    "despido-necesidades-empresa-articulo-161.html",
    "ley-40-horas-chile-2026.html",
    "guia-vacaciones-proporcionales.html",
    "seguro-de-cesantia-chile-como-cobrar.html",
    "que-hacer-si-no-te-pagan-el-finiquito.html",
    "reclamar-despido-injustificado-chile.html",
    "finiquito-por-renuncia-voluntaria.html",
    "carta-de-despido-chile.html",
    "fondos-generacionales-afp-chile.html",
    "propuesta-indemnizacion-a-todo-evento-chile.html"
]

def get_lead_card_for_article(filename):
    if filename == "despido-necesidades-empresa-articulo-161.html":
        return """
        <!-- FORMULARIO_LEAD_START -->
        <!-- Formulario Lead: Necesidades de la Empresa -->
        <div id="lead-form-art161" class="my-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 shadow-sm relative overflow-hidden not-prose">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                        <span class="material-icons text-amber-700 text-sm">gavel</span>
                        Evaluación Legal Inicial
                    </div>
                    <h3 class="text-xl sm:text-2xl font-bold text-slate-900 !mt-0 !mb-1">
                        ¿Te despidieron por Necesidades de la Empresa?
                    </h3>
                    <p class="text-sm text-slate-600 !mb-0">
                        Revisa si tienes derecho al <strong>recargo legal del 30%</strong> en tu indemnización y a la <strong>devolución del descuento de AFC</strong> con un abogado laboralista aliado.
                    </p>
                </div>
            </div>

            <form id="lead-form-art161-form" onsubmit="enviarLeadArticulo(event, 'lead-form-art161-form', 'Guía: Art. 161 Necesidades de la Empresa')" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tu Nombre y Apellido *</label>
                        <input type="text" name="nombre" placeholder="Ej: Marcela Soto" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Correo Electrónico *</label>
                        <input type="email" name="correo" placeholder="tu@correo.com" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp (Opcional)</label>
                        <input type="tel" name="telefono" placeholder="+56 9 1234 5678"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">¿Cuándo te despidieron o fecha finiquito?</label>
                        <input type="text" name="consulta" placeholder="Ej: Hace 3 días, aún no firmo finiquito"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="pt-1">
                    <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" name="privacy_consent" required class="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-amber-600">Política de Privacidad</a> y autorizo expresamente el tratamiento de mis antecedentes y su remisión a abogados laborales colaboradores para la evaluación de mi caso.</span>
                    </label>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row items-center gap-4">
                    <button type="submit"
                        class="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
                        <span class="material-icons text-base">outgoing_mail</span>
                        Solicitar Revisión de mi Caso
                    </button>
                    <span class="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                        <span class="material-icons text-emerald-600 text-xs">lock</span>
                        100% Confidencial · Sin cobros ocultos
                    </span>
                </div>
            </form>

            <div id="lead-form-art161-form-confirmacion" class="hidden p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">✓</div>
                <h4 class="text-lg font-bold text-emerald-950 mb-1">¡Solicitud recibida correctamente!</h4>
                <p class="text-sm text-emerald-800 max-w-md mx-auto">
                    Hemos recibido tus antecedentes. Un abogado especialista en despidos por Art. 161 revisará tu caso y te contactará a la brevedad.
                </p>
            </div>
        </div>
        <!-- FORMULARIO_LEAD_END -->
        """
    elif filename == "reclamar-despido-injustificado-chile.html":
        return """
        <!-- FORMULARIO_LEAD_START -->
        <!-- Formulario Lead: Despido Injustificado -->
        <div id="lead-form-injustificado" class="my-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 shadow-sm relative overflow-hidden not-prose">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                        <span class="material-icons text-amber-700 text-sm">gavel</span>
                        Orientación Legal Inicial
                    </div>
                    <h3 class="text-xl sm:text-2xl font-bold text-slate-900 !mt-0 !mb-1">
                        ¿Dudas sobre demandar despido injustificado?
                    </h3>
                    <p class="text-sm text-slate-600 !mb-0">
                        El plazo legal es de <strong>solo 60 días hábiles</strong>. Envía tus antecedentes para que un abogado laboralista aliado evalúe la viabilidad de tu reclamo y el cálculo del recargo legal.
                    </p>
                </div>
            </div>

            <form id="lead-form-injustificado-form" onsubmit="enviarLeadArticulo(event, 'lead-form-injustificado-form', 'Guía: Despido Injustificado')" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tu Nombre y Apellido *</label>
                        <input type="text" name="nombre" placeholder="Ej: Juan Silva" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Correo Electrónico *</label>
                        <input type="email" name="correo" placeholder="tu@correo.com" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp (Opcional)</label>
                        <input type="tel" name="telefono" placeholder="+56 9 1234 5678"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">¿Cuál fue el motivo alegado por tu empleador?</label>
                        <input type="text" name="consulta" placeholder="Ej: Art. 161 sin justificación real / Art. 160"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="pt-1">
                    <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" name="privacy_consent" required class="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-amber-600">Política de Privacidad</a> y autorizo el tratamiento de mis datos para la orientación legal.</span>
                    </label>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row items-center gap-4">
                    <button type="submit"
                        class="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
                        <span class="material-icons text-base">outgoing_mail</span>
                        Evaluar Demanda / Reclamo
                    </button>
                    <span class="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                        <span class="material-icons text-emerald-600 text-xs">lock</span>
                        100% Confidencial · Respuesta en 24h hábiles
                    </span>
                </div>
            </form>

            <div id="lead-form-injustificado-form-confirmacion" class="hidden p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">✓</div>
                <h4 class="text-lg font-bold text-emerald-950 mb-1">¡Antecedentes recibidos!</h4>
                <p class="text-sm text-emerald-800 max-w-md mx-auto">
                    Un abogado laboralista aliado examinará los antecedentes de tu despido y los plazos aplicables para orientarte oportunamente.
                </p>
            </div>
        </div>
        <!-- FORMULARIO_LEAD_END -->
        """
    elif filename == "carta-de-despido-chile.html":
        return """
        <!-- FORMULARIO_LEAD_START -->
        <!-- Formulario Lead: Carta de Despido -->
        <div id="lead-form-carta" class="my-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 shadow-sm relative overflow-hidden not-prose">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                        <span class="material-icons text-amber-700 text-sm">gavel</span>
                        Revisión Legal de Carta
                    </div>
                    <h3 class="text-xl sm:text-2xl font-bold text-slate-900 !mt-0 !mb-1">
                        ¿Tu carta de despido tiene errores o hechos vagos?
                    </h3>
                    <p class="text-sm text-slate-600 !mb-0">
                        Si la carta no detalla claramente los hechos o no adjunta comprobante de cotizaciones previsionales al día (<strong>Ley Bustos</strong>), el despido puede ser nulo o improcedente.
                    </p>
                </div>
            </div>

            <form id="lead-form-carta-form" onsubmit="enviarLeadArticulo(event, 'lead-form-carta-form', 'Guía: Carta de Despido')" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tu Nombre y Apellido *</label>
                        <input type="text" name="nombre" placeholder="Ej: Carlos Gómez" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Correo Electrónico *</label>
                        <input type="email" name="correo" placeholder="tu@correo.com" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp (Opcional)</label>
                        <input type="tel" name="telefono" placeholder="+56 9 1234 5678"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">¿Qué causal invocaron en tu carta?</label>
                        <input type="text" name="consulta" placeholder="Ej: Art. 161 Necesidades / Art. 160 Incumplimiento"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="pt-1">
                    <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" name="privacy_consent" required class="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-amber-600">Política de Privacidad</a> y autorizo expresamente el tratamiento de mis antecedentes y su remisión a abogados laborales colaboradores para la evaluación de mi caso.</span>
                    </label>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row items-center gap-4">
                    <button type="submit"
                        class="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
                        <span class="material-icons text-base">outgoing_mail</span>
                        Revisar Validez de mi Carta
                    </button>
                    <span class="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                        <span class="material-icons text-emerald-600 text-xs">lock</span>
                        Confidencial · Orientación personalizada
                    </span>
                </div>
            </form>

            <div id="lead-form-carta-form-confirmacion" class="hidden p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">✓</div>
                <h4 class="text-lg font-bold text-emerald-950 mb-1">¡Consulta enviada!</h4>
                <p class="text-sm text-emerald-800 max-w-md mx-auto">
                    Revisaremos la información sobre tu carta de despido y te responderemos con las alternativas legales disponibles.
                </p>
            </div>
        </div>
        <!-- FORMULARIO_LEAD_END -->
        """
    elif filename == "finiquito-por-renuncia-voluntaria.html":
        return """
        <!-- FORMULARIO_LEAD_START -->
        <!-- Formulario Lead: Renuncia Forzada / Autodespido -->
        <div id="lead-form-renuncia" class="my-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 shadow-sm relative overflow-hidden not-prose">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                        <span class="material-icons text-amber-700 text-sm">gavel</span>
                        Orientación Legal Autodespido
                    </div>
                    <h3 class="text-xl sm:text-2xl font-bold text-slate-900 !mt-0 !mb-1">
                        ¿Te presionaron o forzaron a renunciar?
                    </h3>
                    <p class="text-sm text-slate-600 !mb-0">
                        Si tu empleador incurrió en faltas graves o te obligó indebidamente a dimitir, podrías interponer un <strong>despido indirecto (autodespido)</strong> para demandar indemnizaciones por años de servicio con recargo legal. Un abogado laboralista aliado puede evaluar tu caso.
                    </p>
                </div>
            </div>

            <form id="lead-form-renuncia-form" onsubmit="enviarLeadArticulo(event, 'lead-form-renuncia-form', 'Guía: Renuncia Forzada / Autodespido')" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tu Nombre y Apellido *</label>
                        <input type="text" name="nombre" placeholder="Ej: Ana Morales" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Correo Electrónico *</label>
                        <input type="email" name="correo" placeholder="tu@correo.com" required
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Teléfono / WhatsApp (Opcional)</label>
                        <input type="tel" name="telefono" placeholder="+56 9 1234 5678"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">¿Qué situación estás viviendo?</label>
                        <input type="text" name="consulta" placeholder="Ej: No pagan cotizaciones / Hostigamiento / Presión"
                            class="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-slate-800 placeholder-slate-400">
                    </div>
                </div>

                <div class="pt-1">
                    <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" name="privacy_consent" required class="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer">
                        <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-amber-600">Política de Privacidad</a> y autorizo el tratamiento de mis datos para la evaluación legal.</span>
                    </label>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row items-center gap-4">
                    <button type="submit"
                        class="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer">
                        <span class="material-icons text-base">outgoing_mail</span>
                        Solicitar Evaluación de mi Caso
                    </button>
                    <span class="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                        <span class="material-icons text-emerald-600 text-xs">lock</span>
                        100% Confidencial · Respuesta en 24h hábiles
                    </span>
                </div>
            </form>

            <div id="lead-form-renuncia-form-confirmacion" class="hidden p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">✓</div>
                <h4 class="text-lg font-bold text-emerald-950 mb-1">¡Solicitud recibida correctamente!</h4>
                <p class="text-sm text-emerald-800 max-w-md mx-auto">
                    Hemos recibido tus antecedentes. Un abogado laboralista aliado examinará la viabilidad de un autodespido o reclamo y te contactará a la brevedad.
                </p>
            </div>
        </div>
        <!-- FORMULARIO_LEAD_END -->
        """
    return ""

print("Starting page migration to light theme...")

for filename in articles:
    source_path = os.path.join(SOURCE_DIR, filename)
    dest_path = os.path.join(DEST_DIR, filename)
    
    if not os.path.exists(source_path):
        print(f"ERROR: Source file {filename} not found.")
        continue
        
    print(f"Processing: {filename}...")
    title, description, body, custom_head = extract_article_info(source_path)
    
    # Inject lead card if applicable
    lead_card_html = get_lead_card_for_article(filename)
    if lead_card_html:
        placed = False
        for marker in ['<!-- Cross-links -->', '<!-- E-E-A-T Disclaimer -->', '<!-- E-E-A-T Reinforcement -->', '<!-- Disclaimer -->']:
            if marker in body:
                body = body.replace(marker, lead_card_html + "\n\n" + marker, 1)
                placed = True
                break
        if not placed:
            body = body + "\n\n" + lead_card_html

    breadcrumbs = f"""
    <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6 max-w-3xl mx-auto">
        <a href="./" class="hover:text-sky-500 transition-colors font-medium">Inicio</a>
        <span class="material-icons text-xs">chevron_right</span>
        <a href="blog" class="hover:text-sky-500 transition-colors font-medium">Blog</a>
        <span class="material-icons text-xs">chevron_right</span>
        <span class="text-slate-600 font-semibold">{title.split("|")[0].strip()}</span>
    </nav>
    """
    
    article_content = f"""
    <div class="max-w-4xl mx-auto px-6 pt-6">
        {breadcrumbs}
        
        <article class="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 sm:p-12 mb-8 relative overflow-hidden">
            <div class="prose-content max-w-none">
                {body.strip()}
            </div>
        </article>
    </div>
    """
    
    canonical_url, og_tags, json_ld = generate_seo_tags(filename, title, description, page_type="article")
    
    html_out = HTML_LAYOUT.format(
        title=title,
        description=description,
        canonical_url=canonical_url,
        og_tags=og_tags,
        json_ld=json_ld,
        custom_head="",
        header=HEADER_HTML,
        indicator_bar=INDICATOR_BAR_HTML,
        content=article_content,
        footer=FOOTER_HTML,
        history_modal=HISTORY_MODAL_HTML,
        custom_scripts=""
    )
    
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(html_out)

print("Migration of guide articles complete.")

# 2. Institutional and Legal Pages (sobre-nosotros, terminos, privacidad, disclaimer)
LEGAL_PAGES = {'sobre-nosotros.html': {'title': 'Sobre Nosotros | Cálculo Laboral Chile', 'h1': 'Sobre Nosotros', 'description': 'Conoce la misión, equipo y metodología técnica de Cálculo Laboral Chile, la plataforma cívica independiente y gratuita para trabajadores y pymes.', 'badge': 'Transparencia & Metodología E-E-A-T', 'tldr_title': 'Resumen en 30 segundos', 'tldr_bullets': ['<strong>Iniciativa cívica independiente:</strong> Creada para eliminar la asimetría informativa en las relaciones laborales de Chile.', '<strong>Privacidad total:</strong> Todos los cálculos se ejecutan en tu propio navegador. No almacenamos sueldos, RUTs ni datos bancarios.', '<strong>Normativa 2026 auditada:</strong> Fórmulas basadas en las directrices de la Dirección del Trabajo (DT), SII, Superintendencia de Pensiones y Ley de 40 Horas.'], 'content_html': '\n        <section>\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">flag</span> ¿Por qué existe este proyecto?\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Comprender una liquidación de sueldo o calcular un finiquito en Chile puede ser un proceso complejo y confuso. Conceptos como la <strong>gratificación legal con tope de 4,75 IMM</strong>, los <strong>topes imponibles en UF</strong>, los tramos progresivos del <strong>Impuesto Único de Segunda Categoría</strong> o el nuevo divisor de jornada para <strong>horas extras bajo la Ley de 40 Horas</strong> suelen generar incertidumbre tanto en los trabajadores como en las micro y pequeñas empresas.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Cada año, miles de personas firman finiquitos sin la certeza de si los montos de vacaciones proporcionales o indemnizaciones por años de servicio fueron calculados conforme a derecho. <strong>Cálculo Laboral</strong> nació con una misión elemental: democratizar el acceso a herramientas laborales de máxima precisión, 100% gratuitas, intuitivas y rigurosamente apegadas a la legislación chilena.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">groups</span> ¿Quiénes estamos detrás?\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Somos un equipo independiente de <strong>ingenieros de software, analistas de datos y entusiastas del derecho laboral chileno</strong> con sede en Santiago de Chile. El proyecto no recibe financiamiento estatal ni mantiene filiación política ni gremial alguna, lo que nos permite actuar con total imparcialidad técnica.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Nuestro compromiso es auditar continuamente los simuladores frente a cada nuevo dictamen de la Dirección del Trabajo, reajuste del Sueldo Mínimo o actualización de tablas tributarias del Servicio de Impuestos Internos.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">menu_book</span> Fuentes oficiales y metodología técnica\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                No inventamos fórmulas ni utilizamos estimaciones arbitrarias. Cada cálculo matemático implementado en nuestros simuladores está referenciado a cuerpos legales e instituciones de la República de Chile:\n            </p>\n            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">\n                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">\n                    <h3 class="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">\n                        <span class="material-icons text-emerald-600 text-base">gavel</span> Código del Trabajo\n                    </h3>\n                    <p class="text-xs text-slate-600">Artículos 41 y 42 (remuneraciones), 50 (gratificación), 67 y 73 (feriado anual y proporcional), 159, 160, 161, 162 y 163 (término de contrato e indemnizaciones) y 172 (base de cálculo de última remuneración devengada).</p>\n                </div>\n                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">\n                    <h3 class="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">\n                        <span class="material-icons text-sky-600 text-base">account_balance</span> Dirección del Trabajo (DT)\n                    </h3>\n                    <p class="text-xs text-slate-600">Dictámenes oficiales, circulares interpretativas sobre jornada de trabajo, días inhábiles (sábados de feriado) y directrices de la Ley 21.561 (40 Horas laborales).</p>\n                </div>\n                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">\n                    <h3 class="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">\n                        <span class="material-icons text-indigo-600 text-base">receipt_long</span> Servicio de Impuestos Internos (SII)\n                    </h3>\n                    <p class="text-xs text-slate-600">Tabla mensual de retención del Impuesto Único de Segunda Categoría (Art. 43 LIR), factores de exención de 13,5 UTM y rebajas por tramo.</p>\n                </div>\n                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">\n                    <h3 class="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">\n                        <span class="material-icons text-amber-600 text-base">savings</span> Superintendencia de Pensiones\n                    </h3>\n                    <p class="text-xs text-slate-600">Topes imponibles para AFP y Salud (84,3 UF o valor vigente) y Seguro de Cesantía (126,6 UF), junto con las tasas de cotización obligatoria de las 7 AFPs.</p>\n                </div>\n            </div>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">volunteer_activism</span> Gratuidad y modelo de sostenibilidad\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                El acceso a todas las herramientas de cálculo, comparadores y guías didácticas de Cálculo Laboral es y continuará siendo <strong>completamente libre y gratuito</strong>.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Para financiar los costos operacionales de servidores, infraestructura en la nube y tiempo de desarrollo editorial, el sitio incorpora alianzas transparentes de valor agregado y publicidad digital respetuosa. Jamás comercializamos datos de usuarios ni condicionamos resultados a pagos ocultos.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">\n                <div>\n                    <h3 class="font-bold text-slate-900 text-sm sm:text-base">¿Tienes sugerencias, consultas o feedback?</h3>\n                    <p class="text-xs sm:text-sm text-slate-600 mt-1">Escríbenos directamente y responderemos a la brevedad.</p>\n                </div>\n                <a href="mailto:contacto@calculolaboral.cl" class="cta-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 !text-white !no-underline font-semibold text-xs transition-colors shadow-sm shrink-0" style="color: #ffffff !important; text-decoration: none !important;">\n                    <span class="material-icons text-sm" style="color: #ffffff !important;">mail</span> <span style="color: #ffffff !important;">contacto@calculolaboral.cl</span>\n                </a>\n            </div>\n        </section>\n        '}, 'privacidad.html': {'title': 'Política de Privacidad | Cálculo Laboral Chile', 'h1': 'Política de Privacidad', 'description': 'Conoce cómo protegemos tu privacidad en Cálculo Laboral Chile conforme a la Ley 19.628. Tus sueldos y cálculos nunca se envían a servidores.', 'badge': 'Cumplimiento Ley N° 19.628 & Privacidad por Diseño', 'tldr_title': 'Resumen en 30 segundos', 'tldr_bullets': ['<strong>Cero almacenamiento de sueldos o RUT:</strong> Los cálculos se procesan exclusivamente en la memoria de tu navegador (Client-Side).', '<strong>Sin cuentas obligatorias:</strong> No necesitas registrarte ni ingresar datos bancarios o números telefónicos para utilizar las herramientas.', '<strong>Cookies y transparencia:</strong> Empleamos cookies estadísticas (Google Analytics 4) y publicitarias (Google AdSense), las cuales puedes desactivar libremente.'], 'content_html': '\n        <section>\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">lock</span> 1. Principio fundamental: Privacidad por diseño\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                En <strong>Cálculo Laboral</strong> creemos que la privacidad de tus finanzas personales y relaciones laborales es sagrada. A diferencia de otras plataformas web que transmiten los datos que ingresas a bases de datos remotas, <strong>nuestros simuladores funcionan 100% en el lado del cliente (Client-Side)</strong>.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Esto significa que los valores de tu sueldo base, gratificaciones, bonos, fechas de ingreso o causales de despido son procesados únicamente por el motor JavaScript que corre en tu navegador (computador o teléfono móvil). Dichos montos nunca viajan a nuestros servidores ni quedan grabados en ningún registro externo.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">shield</span> 2. Marco legal: Ley N° 19.628 de Chile\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Nuestra política y prácticas de tratamiento de datos cumplen con los más altos estándares éticos y se ajustan rigurosamente a las disposiciones de la <strong>Ley N° 19.628 sobre Protección de la Vida Privada</strong> de la República de Chile y sus directrices complementarias.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Garantizamos que cualquier información residual recabada a través de la navegación general del sitio web será tratada con confidencialidad y estricta sujeción a las finalidades aquí declaradas.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">visibility_off</span> 3. Datos que NO recopilamos\n            </h2>\n            <ul class="space-y-2 text-sm sm:text-base text-slate-600 pl-2">\n                <li class="flex items-start gap-2">\n                    <span class="material-icons text-emerald-600 text-base mt-0.5">check_circle</span>\n                    <span><strong>No solicitamos tu RUT / RUN:</strong> Puedes calcular tu sueldo líquido o finiquito de manera completamente anónima.</span>\n                </li>\n                <li class="flex items-start gap-2">\n                    <span class="material-icons text-emerald-600 text-base mt-0.5">check_circle</span>\n                    <span><strong>No solicitamos cuentas bancarias:</strong> Jamás pediremos números de Cuenta Corriente, Cuenta RUT o tarjetas de crédito.</span>\n                </li>\n                <li class="flex items-start gap-2">\n                    <span class="material-icons text-emerald-600 text-base mt-0.5">check_circle</span>\n                    <span><strong>No exigimos contraseñas:</strong> No requerimos claves de Previred, ClaveÚnica ni credenciales de Mi DT.</span>\n                </li>\n                <li class="flex items-start gap-2">\n                    <span class="material-icons text-emerald-600 text-base mt-0.5">check_circle</span>\n                    <span><strong>No almacenamos archivos de liquidación:</strong> Si descargas el reporte PDF de tu cálculo, este se renderiza directamente en tu dispositivo sin pasar por la nube.</span>\n                </li>\n            </ul>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">analytics</span> 4. Datos recopilados automáticamente (Telemetría agregada)\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Con el exclusivo fin de monitorear el desempeño técnico del sitio, resolver errores de navegación y entender qué calculadoras son las más utilizadas, utilizamos herramientas de analítica web como <strong>Google Analytics 4 (GA4)</strong>.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Estos sistemas recopilan métricas de tráfico disociadas y anonimizadas: tipo de navegador, sistema operativo, país o ciudad aproximada, páginas visitadas y tiempo de permanencia. En ningún caso estos registros se asocian a identidades individuales.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">data_usage</span> 5. Memoria local del navegador (Local Storage)\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                El sitio puede utilizar la función <code>localStorage</code> de tu navegador para permitirte revisar el historial reciente de cálculos o recordar preferencias visuales (como indicadores económicos favoritos). Estos registros se guardan exclusivamente en el almacenamiento interno de tu navegador y puedes borrarlos en cualquier momento limpiando el historial o datos del sitio.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">cookie</span> 6. Cookies y publicidad de terceros (Google AdSense)\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Para financiar el mantenimiento gratuito de la plataforma, Cálculo Laboral puede mostrar anuncios publicitarios a través de la red de <strong>Google AdSense</strong> y socios de confianza:\n            </p>\n            <ul class="list-disc pl-5 space-y-2 text-sm sm:text-base text-slate-600 mb-4">\n                <li>Proveedores externos, incluido Google, utilizan cookies para publicar anuncios basados en las visitas previas del usuario a este sitio web o a otros sitios web de internet.</li>\n                <li>El uso de cookies publicitarias permite a Google y a sus socios mostrar anuncios basados en los sitios web que has visitado en la web.</li>\n                <li>Los usuarios pueden optar por <strong>inhabilitar la publicidad personalizada</strong> visitando la <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" class="text-sky-600 hover:text-sky-700 font-semibold underline decoration-sky-300">Configuración de Anuncios de Google</a>.</li>\n                <li>Alternativamente, puedes inhabilitar el uso de cookies para publicidad personalizada de terceros visitando <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" class="text-sky-600 hover:text-sky-700 font-semibold underline decoration-sky-300">www.aboutads.info</a> o <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer" class="text-sky-600 hover:text-sky-700 font-semibold underline decoration-sky-300">www.youronlinechoices.eu</a>.</li>\n            </ul>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">gavel</span> 7. Solicitud de asistencia y remisión voluntaria a abogados laborales (Ley N° 19.628)\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Si decides solicitar voluntariamente la evaluación letrada de tu caso, liquidación de sueldo, finiquito o carta de despido a través de nuestros formularios de <strong>"Revisión Legal"</strong> o contacto, autorizas expresamente a <strong>Cálculo Laboral</strong> a comunicar tus datos de contacto (nombre, correo electrónico y teléfono/WhatsApp) y antecedentes laborales básicos a abogados laboralistas o estudios jurídicos aliados independientes.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Conforme al artículo 4° de la <strong>Ley N° 19.628 sobre Protección de la Vida Privada</strong> de la República de Chile, dicha remisión se funda en tu autorización previa, inequívoca y expresa otorgada al marcar la casilla de verificación en los formularios. La información suministrada se destinará exclusivamente a contactarte para orientarte de forma preliminar y evaluar la viabilidad de tu caso.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Tus datos no serán vendidos, arrendados ni transferidos a empresas comerciales ni a terceros no autorizados. Podrás revocar tu consentimiento en cualquier momento escribiendo a <a href="mailto:contacto@calculolaboral.cl" class="text-sky-600 font-semibold underline">contacto@calculolaboral.cl</a>.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200">\n                <h3 class="font-bold text-slate-900 text-sm sm:text-base">Ejercicio de derechos y contacto de privacidad</h3>\n                <p class="text-xs sm:text-sm text-slate-600 mt-1 mb-3">\n                    Conforme a la Ley 19.628, puedes solicitar información, modificación o cancelación de cualquier comunicación voluntaria escribiendo a nuestro oficial de contacto:\n                </p>\n                <a href="mailto:contacto@calculolaboral.cl" class="text-sky-600 hover:text-sky-700 font-semibold text-sm underline decoration-sky-300">contacto@calculolaboral.cl</a>\n            </div>\n        </section>\n        '}, 'terminos.html': {'title': 'Términos de Servicio | Cálculo Laboral Chile', 'h1': 'Términos de Servicio', 'description': 'Términos y condiciones de uso de Cálculo Laboral Chile. Reglas de uso, alcance informativo referencial y jurisdicción legal aplicable.', 'badge': 'Condiciones de Servicio & Marco Legal', 'tldr_title': 'Resumen en 30 segundos', 'tldr_bullets': ['<strong>Herramientas estrictamente informativas:</strong> Las calculadoras entregan estimaciones técnicas y pedagógicas; no constituyen asesoría legal o contable vinculante.', '<strong>Sin reemplazo del finiquito oficial:</strong> El único documento jurídicamente definitivo y cancelatorio es el finiquito suscrito y ratificado ante ministro de fe.', '<strong>Jurisdicción chilena:</strong> El uso del portal y cualquier controversia quedan sometidos a las leyes y tribunales de la República de Chile.'], 'content_html': '\n        <section>\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">description</span> 1. Aceptación de los términos\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                El acceso, navegación y utilización del portal web <strong>calculolaboral.cl</strong> (en adelante, "el Sitio") atribuye la condición de Usuario a quien lo visite, e implica la aceptación total y sin reservas de los presentes Términos de Servicio.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Si no estás de acuerdo con alguna de las estipulaciones contenidas en este documento, te solicitamos abstenerte de utilizar las calculadoras y contenidos ofrecidos.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">school</span> 2. Naturaleza del servicio y ausencia de relación profesional\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Cálculo Laboral es una plataforma digital de acceso abierto con fines <strong>exclusivamente educativos, informativos y de orientación práctica</strong>.\n            </p>\n            <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 my-3 text-xs sm:text-sm leading-relaxed">\n                <strong>Aviso importante:</strong> El uso de nuestros simuladores, tablas y guías no constituye la prestación de servicios de asesoría jurídica, tributaria, contable ni laboral personalizada, ni genera relación alguna de abogado-cliente, mandante-mandatario o relación contractual vinculante entre el Usuario y Cálculo Laboral.\n            </div>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">calculate</span> 3. Carácter referencial de las estimaciones\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Los cálculos arrojados por las herramientas (Finiquito, Sueldo Líquido, Horas Extras, Part-Time, Vacaciones Proporcionales) corresponden a simulaciones teóricas estructuradas conforme a los lineamientos generales del Código del Trabajo de Chile.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-2">\n                El Usuario reconoce que los resultados definitivos pueden presentar variaciones justificadas derivadas de:\n            </p>\n            <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 mb-3">\n                <li>Cláusulas o pactos específicos estipulados en contratos individuales o colectivos de trabajo.</li>\n                <li>Bonos variables, comisiones no devengadas, semanas corridas o asignaciones no imponibles complejas.</li>\n                <li>Descuentos judiciales (pensiones alimenticias) o convenios con Cajas de Compensación (CCAF).</li>\n                <li>Criterios administrativos de cálculo utilizados por el software de remuneraciones de la empresa o por fiscalizadores de la Dirección del Trabajo en auditorías puntuales.</li>\n            </ul>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">verified_user</span> 4. Uso aceptable y propiedad intelectual\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Se autoriza al Usuario a consultar el sitio, realizar simulaciones personales o laborales internas y descargar reportes PDF de sus resultados. Sin embargo, queda expresamente prohibido:\n            </p>\n            <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 mb-3">\n                <li>Realizar extracción masiva no autorizada de datos mediante scraping, bots o spiders automatizados.</li>\n                <li>Replicar, descompilar, vender o redistribuir el código fuente, la lógica algorítmica o los elementos de interfaz del Sitio atribuyéndose su autoría.</li>\n                <li>Utilizar el portal para fines contrarios a la moral, el orden público o la legislación chilena.</li>\n            </ul>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">warning</span> 5. Limitación de responsabilidad\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                En ningún caso Cálculo Laboral, sus administradores, desarrolladores o colaboradores serán responsables por daños y perjuicios de cualquier naturaleza —directos, indirectos o emergentes— derivados de:\n            </p>\n            <ul class="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">\n                <li>Decisiones laborales, financieras o judiciales adoptadas por el Usuario con base en la información del Sitio.</li>\n                <li>Firma o ratificación de finiquitos o contratos sin previa revisión letrada o mediación formal ante la Dirección del Trabajo.</li>\n                <li>Discrepancias entre las simulaciones del Sitio y las liquidaciones oficiales extendidas por los empleadores.</li>\n            </ul>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">balance</span> 6. Legislación aplicable y jurisdicción\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Estos Términos de Servicio se interpretan y rigen conforme a las leyes de la <strong>República de Chile</strong>.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Cualquier duda, controversia o conflicto suscitado con motivo de la validez, aplicación o interpretación de este acuerdo será sometido al conocimiento y jurisdicción exclusiva de los tribunales ordinarios de justicia de la ciudad de Santiago de Chile.\n            </p>\n        </section>\n        '}, 'disclaimer.html': {'title': 'Disclaimer Legal | Cálculo Laboral Chile', 'h1': 'Disclaimer Legal y Limitaciones', 'description': 'Aviso de responsabilidad legal y limitaciones técnicas de los simuladores y guías de Cálculo Laboral Chile conforme al Código del Trabajo.', 'badge': 'Aviso Legal & Alcance Normativo', 'tldr_title': 'Resumen en 30 segundos', 'tldr_bullets': ['<strong>Carácter no vinculante:</strong> Los valores generados son estimaciones matemáticas generales y carecen de valor judicial per se.', '<strong>Casos complejos y despidos:</strong> Situaciones de vulneración de derechos, despidos injustificados o fueros requieren asistencia de un abogado laboral o acudir a la Inspección del Trabajo.', '<strong>Reserva de derechos:</strong> Si existen discrepancias con tu empleador, tienes el derecho legal irrenunciable a estampar reserva de derechos en el finiquito.'], 'content_html': '\n        <section>\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">warning_amber</span> 1. Los cálculos son simulaciones estimativas\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Las herramientas interactivas provistas en <strong>Cálculo Laboral</strong> tienen por propósito principal brindar claridad, transparencia y educación sobre los mecanismos habituales de cálculo previstos en el Código del Trabajo y la normativa previsional chilena.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                Los resultados emitidos constituyen <strong>aproximaciones orientativas</strong> basadas en fórmulas legales estándar y parámetros económicos oficiales vigentes a la fecha de la simulación. No constituyen una pericia contable, una liquidación formal ni un instrumento público ratificado ante ministro de fe.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">gavel</span> 2. No sustituye la asesoría profesional ni el dictamen de la DT\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                El contenido de este portal <strong>no reemplaza bajo ninguna circunstancia el consejo profesional de un abogado laboralista, un contador auditor colegiado ni la resolución de la Inspección del Trabajo</strong>.\n            </p>\n            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 my-3 text-xs sm:text-sm leading-relaxed space-y-2">\n                <p>Te recomendamos enfáticamente acudir a la Inspección del Trabajo (presencial o en <a href="https://www.dt.gob.cl" target="_blank" rel="noopener noreferrer" class="text-sky-600 font-semibold underline">dt.gob.cl</a>) o consultar con un abogado si enfrentas:</p>\n                <ul class="list-disc pl-5 space-y-1">\n                    <li>Un despido bajo la causal de Necesidades de la Empresa (Art. 161) que consideres injustificado o desproporcionado.</li>\n                    <li>Un despido disciplinario (Art. 160) con imputación de faltas que niegues haber cometido.</li>\n                    <li>Situaciones de acoso laboral, acoso sexual o vulneración de garantías fundamentales (Tutela Laboral).</li>\n                    <li>Terminación de contrato gozando de fuero laboral (maternal, sindical o de comité paritario).</li>\n                    <li>Cotizaciones previsionales impagas (Ley Bustos / nulidad del despido).</li>\n                </ul>\n            </div>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">edit_note</span> 3. El derecho a estampar reserva de derechos\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Recordamos a todos los trabajadores que, conforme a la <strong>Ley N° 21.361</strong> que modificó el artículo 177 del Código del Trabajo, el trabajador tiene el derecho irrenunciable de estampar de su puño y letra una <strong>reserva de derechos</strong> en el finiquito al momento de firmarlo ante notario o en el portal Mi DT.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                El empleador está legalmente obligado a pagar de inmediato todas las sumas líquidas no controvertidas que figuren en el documento, sin que pueda condicionar dicho pago a que el trabajador renuncie a sus reservas.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <h2 class="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">\n                <span class="material-icons text-sky-500 text-lg">update</span> 4. Frecuencia de actualización de parámetros\n            </h2>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">\n                Los parámetros macroeconómicos y previsionales (valor de la UF, UTM, Sueldo Mínimo, tasas de cotización de AFP y topes imponibles de la Superintendencia de Pensiones) se actualizan en base a las publicaciones oficiales de los organismos competentes.\n            </p>\n            <p class="text-slate-600 text-sm sm:text-base leading-relaxed">\n                A pesar de nuestros esfuerzos constantes de supervisión, Cálculo Laboral no garantiza la inmediata ausencia de desfases técnicos transitorios derivados de caídas en APIs de proveedores de datos externos o promulgaciones legales de última hora.\n            </p>\n        </section>\n\n        <section class="border-t border-slate-100 pt-6">\n            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200">\n                <h3 class="font-bold text-slate-900 text-sm sm:text-base">Dudas o consultas sobre este aviso legal</h3>\n                <p class="text-xs sm:text-sm text-slate-600 mt-1 mb-3">\n                    Para sugerencias, reporte de errores en fórmulas o aclaraciones normativas, contáctanos a:\n                </p>\n                <a href="mailto:contacto@calculolaboral.cl" class="text-sky-600 hover:text-sky-700 font-semibold text-sm underline decoration-sky-300">contacto@calculolaboral.cl</a>\n            </div>\n        </section>\n        '}}

for filename, data in LEGAL_PAGES.items():
    dest_path = os.path.join(DEST_DIR, filename)
    print(f"Generating legal page: {filename}...")
    
    bullets_html = "\n".join([f'<li class="flex items-start gap-2"><span class="material-icons text-sky-600 text-sm mt-0.5 shrink-0">check_circle</span><div>{b}</div></li>' for b in data['tldr_bullets']])
    
    page_content = f"""
    <div class="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <div class="text-center mb-8">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 mb-3">
                <span class="material-icons text-[14px]">verified</span> {data['badge']}
            </span>
            <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{data['h1']}</h1>
            <p class="text-xs text-slate-500 font-medium">Actualizado: Enero 2026 • República de Chile</p>
        </div>

        <article class="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-10 mb-8 relative">
            <div class="p-5 rounded-2xl bg-sky-50/70 border border-sky-100 text-sky-950 mb-8 space-y-2.5">
                <div class="flex items-center gap-2 font-bold text-sky-900 text-sm">
                    <span class="material-icons text-sky-600 text-base">info</span> {data['tldr_title']}
                </div>
                <ul class="space-y-2 text-xs sm:text-sm text-slate-700">
                    {bullets_html}
                </ul>
            </div>

            <div class="prose-content max-w-none text-slate-700 leading-relaxed space-y-8">
                {data['content_html']}
            </div>
        </article>
    </div>
    """
    
    canonical_url, og_tags, json_ld = generate_seo_tags(filename, data['title'], data['description'], page_type="website")
    
    html_out = HTML_LAYOUT.format(
        title=data['title'],
        description=data['description'],
        canonical_url=canonical_url,
        og_tags=og_tags,
        json_ld=json_ld,
        custom_head="",
        header=HEADER_HTML,
        indicator_bar=INDICATOR_BAR_HTML,
        content=page_content,
        footer=FOOTER_HTML,
        history_modal=HISTORY_MODAL_HTML,
        custom_scripts=""
    )
    
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(html_out)

print("Institutional and legal pages generation complete.")

# 3. Blog List page
blog_title = "Blog Laboral Chile 2026 | Guías y Consejos | Cálculo Laboral"
blog_desc = "Guías detalladas y consejos expertos sobre legislación laboral, contratos, remuneraciones y finiquitos en Chile."

blog_content = """
<div class="max-w-[1200px] mx-auto px-6 pt-6">
    <div class="text-center mb-12">
        <h1 class="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Blog Laboral Informativo</h1>
        <p class="text-slate-500 text-base max-w-2xl mx-auto">
            Guías didácticas y actualizadas conforme al Código del Trabajo de Chile para comprender tus liquidaciones, finiquitos y derechos.
        </p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- 000. Checklist Fiscalización DT (Pymes) -->
        <a href="checklist-fiscalizacion-dt-pymes-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-fiscalizacion-dt-pymes-cover.png" alt="Checklist Fiscalización DT Pymes Chile 2026" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs">Guía Pymes & DT</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Checklist Fiscalización DT 2026: 10 Documentos que Pide la Inspección a Pymes</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Guía oficial con los 10 documentos obligatorios, tabla de multas por tamaño de empresa (hasta 60 UTM) y cómo evitar sanciones.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Septiembre 2026</span>
                    <span>8 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 00. Indemnización a Todo Evento (Propuesta) -->
        <a href="propuesta-indemnizacion-a-todo-evento-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-indemnizacion-todo-evento-chile.jpg" alt="Indemnización a Todo Evento Chile" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Actualidad y Reformas</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Indemnización a Todo Evento en Chile: Qué es la propuesta y cómo funcionaría</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Análisis informativo sobre las 19 medidas laborales en estudio técnico: indemnización por renuncia, cotización patronal del 1,8% y qué dice la ley actual.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Septiembre 2026</span>
                    <span>6 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 0. Fondos Generacionales AFP -->
        <a href="fondos-generacionales-afp-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-fondos-generacionales-afp-cover.png" alt="Fondos Generacionales AFP Chile" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Reforma Previsional</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Fondos Generacionales AFP Chile: Qué son y tabla por edad</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">El fin de los multifondos A, B, C, D, E. Conoce cómo funcionan los fondos por ciclo de vida y en cuál quedarás según tu año de nacimiento.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Septiembre 2026</span>
                    <span>7 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 1. Sueldo Líquido -->
        <a href="como-calcular-sueldo-liquido-paso-a-paso" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-sueldo-liquido-cover.png" alt="Guía Sueldo Líquido" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-sky-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Paso a paso</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Cómo calcular sueldo líquido paso a paso</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Aprende a convertir tu sueldo bruto a líquido identificando descuentos e impuestos aplicables.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Marzo 2026</span>
                    <span>5 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 2. Vacaciones Proporcionales -->
        <a href="guia-vacaciones-proporcionales" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-vacaciones-proporcionales-cover.png" alt="Vacaciones Proporcionales" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Cálculo Legal</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Cómo calcular vacaciones proporcionales en Chile</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Fórmulas y ejemplos reales para calcular los días acumulados que te corresponden por ley.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Febrero 2026</span>
                    <span>4 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 3. Finiquito paso a paso -->
        <a href="como-calcular-finiquito-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-calculo-finiquito-chile-2026.png" alt="Cómo Calcular Finiquito" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Completo</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Cómo calcular tu finiquito en Chile (Guía 2026)</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Indemnizaciones por años de servicio, aviso previo, feriado proporcional y desgloses paso a paso.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Febrero 2026</span>
                    <span>6 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 4. Cómo leer liquidación -->
        <a href="como-leer-liquidacion-de-sueldo" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-liquidacion-sueldo-cover.png" alt="Anatomía Liquidación de Sueldo" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-slate-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Anatomía</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Cómo leer tu liquidación de sueldo</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Haberes imponibles, no imponibles, descuentos previsionales, de salud y tributarios de forma simple.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Enero 2026</span>
                    <span>5 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 5. Art 161 Despido -->
        <a href="despido-necesidades-empresa-articulo-161" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-despido-necesidades-empresa-161.png" alt="Despido Necesidades Empresa" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Legal</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Despido por Necesidades de la Empresa (Art 161)</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Conoce las formalidades, tus derechos, la carta de aviso y la reserva de derechos para reclamar.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Enero 2026</span>
                    <span>8 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 6. Ley 40 Horas -->
        <a href="ley-40-horas-chile-2026" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-ley-40-horas-chile-cover.png" alt="Ley 40 Horas" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Novedad</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Ley 40 Horas en Chile: Implementación 2026</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Infografía y cronograma sobre la reducción de jornada laboral y el impacto en tus cálculos diarios.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Enero 2026</span>
                    <span>6 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 7. Seguro de Cesantía -->
        <a href="seguro-de-cesantia-chile-como-cobrar" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-seguro-cesantia-chile.png" alt="Seguro de Cesantía" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Seguridad</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">Seguro de Cesantía: Requisitos y cómo cobrarlo</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Aprende a tramitar tu seguro ante la AFC, simular giros mensuales y el impacto de los descuentos.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Diciembre 2025</span>
                    <span>5 min lectura</span>
                </div>
            </div>
        </a>

        <!-- 8. No te pagan finiquito -->
        <a href="que-hacer-si-no-te-pagan-el-finiquito" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div class="aspect-video bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src="assets/guia-finiquito-no-pago-cover.png" alt="No te Pagan Finiquito" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <span class="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Alerta</span>
            </div>
            <div class="p-6">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2">¿Qué hacer si no te pagan el finiquito a tiempo?</h3>
                <p class="text-slate-500 text-xs leading-relaxed mb-4">Conoce los plazos obligatorios de pago (10 días), multas de la DT y cómo interponer un reclamo.</p>
                <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Noviembre 2025</span>
                    <span>7 min lectura</span>
                </div>
            </div>
        </a>
    </div>
</div>
"""

canonical_url, og_tags, json_ld = generate_seo_tags("blog.html", blog_title, blog_desc, page_type="website")

html_out = HTML_LAYOUT.format(
    title=blog_title,
    description=blog_desc,
    canonical_url=canonical_url,
    og_tags=og_tags,
    json_ld=json_ld,
    custom_head="",
    header=HEADER_HTML,
    indicator_bar=INDICATOR_BAR_HTML,
    content=blog_content,
    footer=FOOTER_HTML,
    history_modal=HISTORY_MODAL_HTML,
    custom_scripts=""
)

with open(os.path.join(DEST_DIR, "blog.html"), "w", encoding="utf-8") as f:
    f.write(html_out)

print("Blog List page complete.")

# 4. Contact page
contact_content = """
<div class="max-w-[800px] mx-auto px-6">
    <div class="text-center mb-12 animate-fade-in">
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Contacto</h1>
        <p class="text-slate-500 text-sm max-w-lg mx-auto">
            Si tienes dudas sobre tus cálculos o la legislación laboral en Chile, escríbenos directamente. Respondemos a todas las consultas de forma gratuita.
        </p>
    </div>

    <!-- Contact Box -->
    <div class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm mb-12 relative overflow-hidden">
        <div class="flex flex-col items-center justify-center mb-8 pb-8 border-b border-slate-100">
            <div class="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                <span class="material-icons text-sky-500">mail</span>
            </div>
            <a href="mailto:contacto@calculolaboral.cl" class="text-xl sm:text-2xl font-bold text-slate-900 hover:text-sky-500 transition-colors">
                contacto@calculolaboral.cl
            </a>
            <p class="text-[11px] text-slate-400 font-semibold mt-1">Plazo de respuesta: 24 a 48 horas hábiles</p>
        </div>

        <!-- Success Message (Hidden by default) -->
        <div id="success-message" class="hidden flex flex-col items-center justify-center text-center py-8">
            <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
                <span class="material-icons text-3xl">check_circle</span>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-1.5">¡Mensaje Enviado!</h3>
            <p class="text-xs text-slate-500 max-w-sm">
                Hemos recibido tu consulta y te responderemos a la brevedad. Gracias por comunicarte con nosotros.
            </p>
            <button id="send-another-btn" class="mt-6 px-4 py-2.5 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                Enviar otro mensaje
            </button>
        </div>

        <!-- Form -->
        <form id="contact-form" action="https://formsubmit.co/ajax/contacto@calculolaboral.cl" method="POST" class="space-y-4">
            <input type="hidden" name="_subject" value="Nuevo mensaje desde CalculoLaboral.cl">
            <input type="hidden" name="_template" value="table">
            <input type="hidden" name="_captcha" value="true">

            <div class="space-y-1">
                <label for="name" class="block text-xs font-bold text-slate-600 uppercase ml-1">Nombre Completo</label>
                <input type="text" id="name" name="name" required placeholder="Ej. Juan Pérez" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-medium">
            </div>

            <div class="space-y-1">
                <label for="email" class="block text-xs font-bold text-slate-600 uppercase ml-1">Correo Electrónico</label>
                <input type="email" id="email" name="email" required placeholder="tu@correo.com" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-medium">
            </div>

            <div class="space-y-1">
                <label for="message" class="block text-xs font-bold text-slate-600 uppercase ml-1">Mensaje o Consulta</label>
                <textarea id="message" name="message" rows="5" required placeholder="Escribe aquí tu consulta en detalle (menciona tu tipo de contrato, sueldo base u otros datos relevantes si deseas una ayuda más precisa)." class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-medium resize-none"></textarea>
            </div>

            <div class="pt-1">
                <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" id="contact-privacy" name="privacy_consent" required class="w-4 h-4 mt-0.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 cursor-pointer">
                    <span>He leído y acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-sky-600">Política de Privacidad</a> y autorizo expresamente el tratamiento de mis datos y su remisión a profesionales colaboradores para responder y evaluar mi consulta.</span>
                </label>
            </div>

            <div class="pt-2">
                <button type="submit" id="submit-btn" class="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md shadow-sky-500/10 transition-all hover:scale-[1.01] active:scale-[0.99] duration-100 flex items-center justify-center gap-2">
                    <span class="btn-text">Enviar Mensaje</span>
                    <span class="material-icons text-sm btn-icon">send</span>
                    <svg class="animate-spin h-5 w-5 text-white hidden loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </button>
            </div>
        </form>
    </div>

    <!-- FAQ Accordions (Contacto) -->
    <div class="max-w-2xl mx-auto mt-16">
        <h2 class="text-xl font-bold text-slate-900 text-center mb-6">Preguntas Frecuentes de Soporte</h2>
        <div class="space-y-4">
            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-4 font-bold text-xs text-slate-700 flex justify-between items-center uppercase tracking-wider outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Son fidedignos los cálculos de este sitio?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-4 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100">
                    Sí, todas nuestras calculadoras están calibradas conforme al Código del Trabajo de Chile y las normativas vigentes del Servicio de Impuestos Internos (SII), Dirección del Trabajo (DT) y AFC para el año 2026. Sin embargo, recuerda que este sitio es una herramienta referencial y no constituye asesoría legal formal.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-4 font-bold text-xs text-slate-700 flex justify-between items-center uppercase tracking-wider outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Tiene algún costo usar los simuladores?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-4 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100">
                    No, todos nuestros servicios, calculadoras, guías paso a paso y artículos informativos son 100% gratuitos y de libre acceso para todos los trabajadores y empleadores de Chile.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-4 font-bold text-xs text-slate-700 flex justify-between items-center uppercase tracking-wider outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Cómo puedo reportar un error en los cálculos?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-4 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100">
                    Si detectas alguna diferencia o anomalía en las fórmulas de liquidación o finiquito, puedes escribirnos describiendo tu caso (con valores de sueldo base, causal y fechas) a nuestro correo oficial <a href="mailto:contacto@calculolaboral.cl" class="text-sky-500 font-bold hover:underline">contacto@calculolaboral.cl</a>. Nuestro equipo técnico lo revisará a la brevedad.
                </div>
            </details>
        </div>
    </div>
</div>
"""

contacto_custom_script = """
    <script>
        const form = document.getElementById('contact-form');
        const successMessage = document.getElementById('success-message');
        const submitBtn = document.getElementById('submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnIcon = submitBtn.querySelector('.btn-icon');
        const loadingSpinner = submitBtn.querySelector('.loading-spinner');
        const sendAnotherBtn = document.getElementById('send-another-btn');

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                submitBtn.disabled = true;
                btnText.textContent = 'Enviando...';
                btnIcon.classList.add('hidden');
                loadingSpinner.classList.remove('hidden');

                const formData = new FormData(form);

                fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                })
                .then(response => {
                    if (response.ok) {
                        form.classList.add('hidden');
                        successMessage.classList.remove('hidden');
                        form.reset();
                    } else {
                        alert("Hubo un error al enviar el mensaje. Intente escogiéndonos directamente a contacto@calculolaboral.cl");
                    }
                })
                .catch(error => {
                    alert("Error de conexión. Intente nuevamente.");
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    btnText.textContent = 'Enviar Mensaje';
                    btnIcon.classList.remove('hidden');
                    loadingSpinner.classList.add('hidden');
                });
            });
        }

        if (sendAnotherBtn) {
            sendAnotherBtn.addEventListener('click', () => {
                successMessage.classList.add('hidden');
                form.classList.remove('hidden');
            });
        }
    </script>
"""

canonical_url, og_tags, json_ld = generate_seo_tags("contacto.html", "Contacto | Cálculo Laboral Chile", "Contáctanos ante cualquier duda sobre tus remuneraciones, finiquitos o indemnizaciones laborales en Chile. Respuestas rápidas.", page_type="website")

html_out = HTML_LAYOUT.format(
    title="Contacto | Cálculo Laboral Chile",
    description="Contáctanos ante cualquier duda sobre tus remuneraciones, finiquitos o indemnizaciones laborales en Chile. Respuestas rápidas.",
    canonical_url=canonical_url,
    og_tags=og_tags,
    json_ld=json_ld,
    custom_head="",
    header=HEADER_HTML,
    indicator_bar=INDICATOR_BAR_HTML,
    content=contact_content,
    footer=FOOTER_HTML,
    history_modal=HISTORY_MODAL_HTML,
    custom_scripts=contacto_custom_script
)

with open(os.path.join(DEST_DIR, "contacto.html"), "w", encoding="utf-8") as f:
    f.write(html_out)

print("Contact page complete.")

# 5. Integrated Calculator Page (index.html) Markup
# This page contains both calculators in layout
INDEX_CONTENT = """
<div class="max-w-[1200px] mx-auto px-6">
    <!-- Trending Notice Banner -->
    <div class="max-w-3xl mx-auto mt-3 mb-2 no-print">
        <a href="fondos-generacionales-afp-chile" class="group flex items-center justify-between gap-3 p-2.5 px-4 rounded-2xl bg-amber-50/90 hover:bg-amber-100/80 border border-amber-200/90 text-amber-950 transition-all shadow-sm">
            <div class="flex items-center gap-2.5 min-w-0">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                    <span class="material-icons text-xs">campaign</span> Novedad 2026
                </span>
                <span class="text-xs font-semibold truncate text-slate-800 group-hover:text-amber-950 transition-colors">
                    Reforma Previsional: Conoce los nuevos Fondos Generacionales AFP y en cuál quedarás según tu edad
                </span>
            </div>
            <span class="inline-flex items-center text-xs font-bold text-amber-800 group-hover:translate-x-0.5 transition-transform shrink-0">
                Ver Guía <span class="material-icons text-xs ml-0.5">arrow_forward</span>
            </span>
        </a>
    </div>

    <!-- H1 Header Section for SEO -->
    <div class="text-center my-4 max-w-2xl mx-auto no-print">
        <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/70 text-[10px] font-bold uppercase tracking-wider mb-2 shadow-xs">
            <span class="material-icons text-xs text-sky-500">verified</span> Suite Gratuita • Normativa DT 2026
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Plataforma de Herramientas y Calculadoras Laborales Chile
        </h1>
        <p class="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">
            Simula gratis tu finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time conforme a la Dirección del Trabajo (DT). Sin registro.
        </p>
    </div>

    <!-- Suite of 4 Tools Selector -->
    <div class="max-w-3xl mx-auto mb-6 no-print">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <!-- 1. Finiquito -->
            <button id="tab-btn-finiquito" onclick="switchCalculatorTab('finiquito')" class="py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white bg-sky-500 shadow-md shadow-sky-500/20 active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5">
                <span class="flex items-center gap-1"><span class="material-icons text-sm">gavel</span> Finiquito</span>
                <span class="text-[9px] font-normal opacity-90 lowercase">simulador en vivo</span>
            </button>
            
            <!-- 2. Sueldo Líquido -->
            <button id="tab-btn-sueldo" onclick="switchCalculatorTab('sueldo')" class="py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-slate-600 hover:text-slate-900 hover:bg-white active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5">
                <span class="flex items-center gap-1"><span class="material-icons text-sm">payments</span> Sueldo Líquido</span>
                <span class="text-[9px] font-normal opacity-75 lowercase">simulador en vivo</span>
            </button>
            
            <!-- 3. Horas Extras -->
            <a href="calculadora-horas-extras" class="py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-white text-slate-700 hover:text-sky-600 hover:bg-sky-50/60 border border-slate-200/80 active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5 group shadow-xs">
                <span class="flex items-center gap-1">
                    <span class="material-icons text-sm text-amber-500">schedule</span> Horas Extras
                    <span class="text-[8px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">Top</span>
                </span>
                <span class="text-[9px] font-normal text-slate-400 group-hover:text-sky-500 transition-colors lowercase">ley 40 horas</span>
            </a>
            
            <!-- 4. Sueldo Part-Time -->
            <a href="calculadora-sueldo-part-time" class="py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-white text-slate-700 hover:text-sky-600 hover:bg-sky-50/60 border border-slate-200/80 active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5 group shadow-xs">
                <span class="flex items-center gap-1">
                    <span class="material-icons text-sm text-indigo-500">hourglass_bottom</span> Part-Time
                </span>
                <span class="text-[9px] font-normal text-slate-400 group-hover:text-sky-500 transition-colors lowercase">30h y 20h</span>
            </a>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- FINIQUITO CALCULATOR CONTAINER (DESKTOP BALANCED)     -->
    <!-- ---------------------------------------------------- -->
    <div id="finiquito-calc-container" class="space-y-6">
        <!-- 1. Two-Column Calculation Grid (Simétrico en PC) -->
        <div class="flex flex-col lg:flex-row gap-6 items-start">
            <!-- Inputs Column (Left, 480px) -->
            <div class="w-full lg:w-[480px] shrink-0 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm no-print space-y-4">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900">Datos de tu Finiquito</h2>
                        <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ejemplo editable en vivo
                        </span>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" id="btnLoadExample" class="px-2.5 py-1 text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors active:scale-95 duration-100">Restablecer</button>
                        <button type="button" id="btnClear" class="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors active:scale-95 duration-100">Limpiar</button>
                    </div>
                </div>

                <!-- BLOQUE 1: CONTRATO Y CAUSAL -->
                <div class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div class="space-y-1">
                            <label class="block text-xs font-bold text-slate-600 uppercase ml-0.5">Fecha de Inicio</label>
                            <input id="startDate" class="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-xs sm:text-sm font-medium" type="date">
                        </div>
                        <div class="space-y-1">
                            <div class="flex justify-between items-center ml-0.5">
                                <label class="block text-xs font-bold text-slate-600 uppercase">Fecha Término</label>
                                <button type="button" id="btnDateToday" class="text-[10px] font-bold text-sky-600 hover:text-sky-700 underline cursor-pointer">Poner Hoy</button>
                            </div>
                            <input id="endDate" class="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-xs sm:text-sm font-medium" type="date">
                        </div>
                    </div>

                    <!-- Chips de Antigüedad Rápida (1 toque) -->
                    <div class="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
                        <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Antigüedad rápida:</span>
                        <div class="grid grid-cols-4 gap-1.5">
                            <button type="button" data-years="1" class="btn-preset-year py-1 px-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-slate-700 hover:text-sky-700 text-xs font-bold transition-all text-center active:scale-95 duration-100 shadow-xs">1 año</button>
                            <button type="button" data-years="2" class="btn-preset-year py-1 px-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-slate-700 hover:text-sky-700 text-xs font-bold transition-all text-center active:scale-95 duration-100 shadow-xs">2 años</button>
                            <button type="button" data-years="3" class="btn-preset-year py-1 px-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-slate-700 hover:text-sky-700 text-xs font-bold transition-all text-center active:scale-95 duration-100 shadow-xs">3 años</button>
                            <button type="button" data-years="5" class="btn-preset-year py-1 px-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-slate-700 hover:text-sky-700 text-xs font-bold transition-all text-center active:scale-95 duration-100 shadow-xs">5 años</button>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="block text-xs font-bold text-slate-600 uppercase ml-0.5">Causal de Término</label>
                        <select id="cause" class="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-xs sm:text-sm font-medium cursor-pointer">
                            <option value="161" selected>Art. 161 - Necesidades de la Empresa (Con indemnizaciones)</option>
                            <option value="159-1">Art. 159 N°1 - Mutuo Acuerdo</option>
                            <option value="159-2">Art. 159 N°2 - Renuncia Voluntaria</option>
                            <option value="160">Art. 160 - Despido Disciplinario (Sin indemnización)</option>
                        </select>
                    </div>

                    <div class="pt-0.5 flex items-center justify-between">
                        <label class="flex items-center gap-2.5 cursor-pointer group select-none">
                            <input id="noticeGiven" class="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500/35 cursor-pointer" type="checkbox">
                            <span class="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">¿Avisaron por escrito con 30 días de anticipación?</span>
                        </label>
                    </div>
                </div>

                <!-- BLOQUE 2: SUELDO Y VACACIONES (Compacto en 2 columnas en Desktop) -->
                <div class="pt-3 border-t border-slate-100 space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div class="space-y-1">
                            <div class="flex justify-between items-center ml-0.5">
                                <label class="block text-xs font-bold text-slate-600 uppercase">Sueldo Base</label>
                                <button type="button" id="btnMinSalary" class="text-[9px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded transition-colors active:scale-95 duration-100">
                                    $553.553 Mín.
                                </button>
                            </div>
                            <input id="baseSalary" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-mono text-right" placeholder="$ 0">
                        </div>

                        <div class="space-y-1">
                            <div class="flex justify-between items-center ml-0.5">
                                <label class="block text-xs font-bold text-slate-600 uppercase">Gratificación</label>
                                <span class="text-[9px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Art. 50 (25%)</span>
                            </div>
                            <input id="gratification" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold outline-none text-sm font-mono text-right" placeholder="$ 0">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <div class="flex justify-between items-center ml-0.5">
                            <label class="block text-xs font-bold text-slate-600 uppercase">Vacaciones Pendientes (Días)</label>
                            <span class="text-[10px] text-slate-400">Si dudas, déjalo en 0</span>
                        </div>
                        <div class="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 w-full justify-between">
                            <button id="btnVacationMinus" aria-label="Restar día de vacaciones" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center transition-all hover:bg-slate-100 active:scale-90 duration-100" type="button">
                                <span class="material-icons text-sm font-bold">remove</span>
                            </button>
                            <input id="vacationPending" class="w-16 bg-transparent border-none text-center text-slate-800 focus:ring-0 font-bold text-sm" type="text" value="5">
                            <button id="btnVacationPlus" aria-label="Sumar día de vacaciones" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center transition-all hover:bg-slate-100 active:scale-90 duration-100" type="button">
                                <span class="material-icons text-sm font-bold">add</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- BLOQUE 3: OPCIONES AVANZADAS (ACORDEÓN COLAPSABLE) -->
                <div class="pt-3 border-t border-slate-100">
                    <button type="button" id="btnToggleAdvanced" class="w-full flex justify-between items-center py-2 px-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-all group select-none">
                        <span class="flex items-center gap-1.5">
                            <span class="material-icons text-sm text-slate-400 group-hover:text-sky-500 transition-colors">tune</span>
                            Opciones avanzadas y otros haberes (opcional)
                        </span>
                        <span id="iconToggleAdvanced" class="material-icons text-base text-slate-400 group-hover:text-slate-700 transition-transform">expand_more</span>
                    </button>

                    <div id="containerAdvancedOptions" class="hidden mt-3 space-y-3 pt-1">
                        <!-- Asignaciones no imponibles -->
                        <div class="space-y-1">
                            <label class="block text-xs font-bold text-slate-600 uppercase ml-0.5">Asignaciones Fijas (Colación/Movilización)</label>
                            <input id="assignments" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-mono text-right" placeholder="$ 0">
                            <div class="pt-0.5">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="includeAssignmentsInVacation" class="w-4 h-4 text-sky-500 border-slate-200 rounded focus:ring-sky-500" checked>
                                    <span class="text-[10px] font-semibold text-slate-500">Incluir en Vacaciones (Criterio Judicial)</span>
                                </label>
                            </div>
                        </div>

                        <!-- Sueldo variable / comisiones -->
                        <div class="pt-0.5">
                            <label class="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" id="hasVariableSalary" class="w-4 h-4 text-sky-500 bg-white border-slate-200 rounded focus:ring-sky-500">
                                <span class="text-xs font-bold text-slate-700">¿Tienes Sueldo Variable o Comisiones?</span>
                            </label>
                        </div>

                        <div id="variableSalaryContainer" class="hidden space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <p class="text-[10px] text-slate-500 font-semibold leading-relaxed">Últimos 3 meses imponibles variables:</p>
                            <div class="grid grid-cols-3 gap-2">
                                <div>
                                    <label class="text-[9px] font-bold text-slate-500 ml-0.5">Mes 1</label>
                                    <input id="varMonth1" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" placeholder="$ 0">
                                </div>
                                <div>
                                    <label class="text-[9px] font-bold text-slate-500 ml-0.5">Mes 2</label>
                                    <input id="varMonth2" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" placeholder="$ 0">
                                </div>
                                <div>
                                    <label class="text-[9px] font-bold text-slate-500 ml-0.5">Mes 3</label>
                                    <input id="varMonth3" data-type="currency" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" placeholder="$ 0">
                                </div>
                            </div>
                            <div class="flex justify-between items-center pt-1.5 border-t border-slate-200">
                                <span class="text-[10px] font-bold text-slate-400 uppercase">Promedio</span>
                                <span id="variableAverageOutput" class="text-xs font-bold text-sky-500 font-mono">$0</span>
                            </div>
                        </div>

                        <!-- Checkboxes legales -->
                        <div class="space-y-1.5 pt-1.5 border-t border-slate-100 text-xs">
                            <label class="flex items-start gap-2 cursor-pointer select-none">
                                <input id="enableIAS" class="w-3.5 h-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 mt-0.5" type="checkbox" checked />
                                <span class="text-slate-600"><strong>Años de Servicio (IAS):</strong> 1 sueldo por año (tope 11).</span>
                            </label>
                            <label class="flex items-start gap-2 cursor-pointer select-none">
                                <input id="enableNotice" class="w-3.5 h-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 mt-0.5" type="checkbox" checked />
                                <span class="text-slate-600"><strong>Aviso Previo:</strong> 1 sueldo si no hubo 30 días de aviso.</span>
                            </label>
                            <label class="flex items-start gap-2 cursor-pointer select-none">
                                <input id="simulateAFC" class="w-3.5 h-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 mt-0.5" type="checkbox" checked />
                                <span class="text-slate-600"><strong>Descontar AFC Empleador:</strong> Seguro cesantía (Art. 161).</span>
                            </label>
                            <label class="flex items-start gap-2 cursor-pointer select-none">
                                <input id="enablePending" class="w-3.5 h-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 mt-0.5" type="checkbox" checked />
                                <span class="text-slate-600"><strong>Días Trabajados en el Mes:</strong> Salario proporcional.</span>
                            </label>
                            <label class="flex items-start gap-2 cursor-pointer select-none">
                                <input id="includeAssignmentsInIndemnity" class="w-3.5 h-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 mt-0.5" type="checkbox" checked />
                                <span class="text-slate-600"><strong>Incluir Asignaciones en Base Diaria:</strong> Colación/mov.</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Botón Móvil para Scroll Asistido al Resultado -->
                <div class="pt-2 lg:hidden">
                    <button type="button" id="btnScrollToResults" class="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <span>Ver Desglose de Finiquito</span>
                        <span class="material-icons text-sm">arrow_downward</span>
                    </button>
                </div>
            </div>

            <!-- Results Column (Right, ~500px, Sticky) -->
            <div id="resultados-finiquito" class="flex-grow bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm lg:sticky lg:top-20 space-y-4 scroll-mt-20">
                <div class="text-center sm:text-left border-b border-slate-100 pb-4">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Monto Total del Finiquito</h3>
                    <div class="flex items-baseline gap-2 justify-center sm:justify-start">
                        <span id="totalAmount" class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">$ —</span>
                        <span class="text-xs font-semibold text-slate-400">CLP</span>
                    </div>
                    <div class="mt-1 text-[11px] text-slate-400 font-medium flex items-center gap-1 justify-center sm:justify-start">
                        <span class="material-icons text-[12px] text-sky-500">info_outline</span>
                        Desglose referencial oficial DT
                    </div>
                </div>

                <!-- Detailed Breakdown items -->
                <div class="space-y-2.5">
                    <!-- IAS Row -->
                    <div id="yearsRow" class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-600 font-medium flex items-center gap-1">
                            Años de Servicio
                            <span class="material-icons text-[12px] text-slate-400 cursor-help" title="Un mes de remuneración imponible habitual por cada año trabajado (tope 11 años).">help_outline</span>
                        </span>
                        <span id="yearsServiceAmount" class="font-bold text-slate-800 font-mono">$ —</span>
                    </div>

                    <!-- Notice Row -->
                    <div id="noticeRow" class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-600 font-medium flex items-center gap-1">
                            Aviso Previo
                            <span class="material-icons text-[12px] text-slate-400 cursor-help" title="Equivale a un mes de remuneración si el empleador no dio el aviso con 30 días de anticipación.">help_outline</span>
                        </span>
                        <span id="noticeAmount" class="font-bold text-slate-800 font-mono">$ —</span>
                    </div>

                    <!-- Vacación Prop Row -->
                    <div class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-600 font-medium flex items-center gap-1">
                            Vacaciones Proporcionales
                            <span class="material-icons text-[12px] text-slate-400 cursor-help" title="Pago por los días hábiles acumulados generados durante la fracción del año laboral en curso.">help_outline</span>
                        </span>
                        <span id="vacationPropAmount" class="font-bold text-slate-800 font-mono">$ —</span>
                    </div>

                    <!-- Vacación Pendiente Row -->
                    <div class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-600 font-medium flex items-center gap-1">
                            Vacaciones Pendientes
                            <span class="material-icons text-[12px] text-slate-400 cursor-help" title="Pago por días de vacaciones de años anteriores acumulados que no fueron usados por el trabajador.">help_outline</span>
                        </span>
                        <span id="vacationPendingAmount" class="font-bold text-slate-800 font-mono">$ —</span>
                    </div>

                    <!-- Pending Salary Row -->
                    <div class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <span class="text-slate-600 font-medium flex items-center gap-1">
                            Remuneraciones Pendientes
                            <span id="daysWorkedOutput" class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase font-mono tracking-wider ml-1">— DÍAS</span>
                        </span>
                        <span id="pendingSalaryAmount" class="font-bold text-slate-800 font-mono">$ —</span>
                    </div>

                    <!-- AFC Deduction Row -->
                    <div id="afcRow" class="flex justify-between items-center text-xs py-1 border-b border-slate-50 text-red-500 hidden">
                        <span class="font-medium flex items-center gap-1">
                            Aporte AFC Descontable
                            <span class="material-icons text-[12px] text-slate-400 cursor-help" title="Descuento correspondiente al aporte del empleador a la cuenta individual del seguro de cesantía.">help_outline</span>
                        </span>
                        <span id="afcAmount" class="font-bold font-mono">-$0</span>
                    </div>
                </div>

                <!-- Dynamic Non-monetary Data -->
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
                    <div>
                        <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Antigüedad</span>
                        <span id="antiquityOutput" class="text-xs font-bold text-slate-700 font-mono">— años, — meses</span>
                    </div>
                    <div>
                        <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Vacaciones Totales</span>
                        <span id="totalVacationDaysOutput" class="text-xs font-bold text-slate-700 font-mono">— días hábiles</span>
                    </div>
                </div>

                <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between text-[10px] text-slate-400 font-medium gap-1">
                    <span id="lastUpdateDate">Última actualización legal: Febrero 2026</span>
                    <span class="flex items-center gap-0.5">
                        Tope Legal: 
                        <span id="ufCapValue" class="font-bold text-slate-600 font-mono">90 UF</span>
                    </span>
                </div>

                <!-- PDF and WhatsApp Share section -->
                <div id="pdf-section" class="pt-1 space-y-2 no-print">
                    <div class="flex flex-col sm:flex-row gap-2">
                        <button id="download-pdf-btn" 
                            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                            <span class="material-icons text-sm">picture_as_pdf</span> Descargar PDF
                        </button>
                        <button type="button" onclick="shareFiniquitoWhatsApp()" id="share-fini-wsp"
                            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                            <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                            WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. Full-Width Legal Advisory & Partner Banner (Horizontal 2 cols en Desktop) -->
        <div id="lead-section" class="w-full bg-gradient-to-br from-amber-50/90 via-white to-amber-50/60 border-2 border-amber-300 rounded-3xl p-6 sm:p-8 shadow-sm no-print hidden">
            <div class="flex flex-col lg:flex-row gap-8 items-start">
                <!-- Columna Izquierda: Información de derechos y recargo 30% -->
                <div class="w-full lg:w-7/12 space-y-3.5">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-200/90 text-amber-950 border border-amber-300">
                            <span class="material-icons text-xs">gavel</span> Evaluación Legal Inicial
                        </span>
                        <span class="text-xs font-semibold text-amber-800">Abogados Laborales Aliados</span>
                    </div>

                    <h3 id="lead-title" class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                        ¿Despido por Necesidades de la Empresa (Art. 161)?
                    </h3>

                    <p id="lead-desc" class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        Si los motivos económicos de tu carta de despido no están debidamente acreditados en tribunales, puedes exigir el <strong>recargo legal del 30%</strong> sobre tus años de servicio y evitar el descuento indebido de tu seguro de cesantía (AFC).
                    </p>

                    <!-- Tarjeta de Recargo Estimable (Art. 161) -->
                    <div id="art161ResultAlert" class="p-3.5 bg-amber-100/60 border border-amber-300/80 rounded-2xl flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <span class="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                                <span class="material-icons text-sm">trending_up</span>
                            </span>
                            <div>
                                <span class="block text-[10px] font-bold text-amber-900 uppercase">Recargo Adicional 30% Estimable</span>
                                <span class="text-[11px] text-amber-800">Suma a tu indemnización por años de servicio</span>
                            </div>
                        </div>
                        <span id="art161RecargoAmount" class="text-base sm:text-lg font-black text-emerald-700 font-mono">+$0</span>
                    </div>

                    <div class="flex flex-wrap gap-2 pt-1 text-[11px] font-medium text-slate-500">
                        <span class="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                            <span class="material-icons text-[13px] text-emerald-600">check_circle</span> Sin cobro inicial
                        </span>
                        <span class="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                            <span class="material-icons text-[13px] text-emerald-600">check_circle</span> Plazo 60 días DT
                        </span>
                        <span class="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                            <span class="material-icons text-[13px] text-emerald-600">check_circle</span> Devolución AFC
                        </span>
                    </div>
                </div>

                <!-- Columna Derecha: Formulario de Contacto -->
                <div class="w-full lg:w-5/12 bg-white p-5 sm:p-6 rounded-2xl border border-amber-200 shadow-sm">
                    <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span class="material-icons text-sm text-amber-500">contact_mail</span> Consulta Confidencial
                    </h4>
                    <form id="lead-form" class="space-y-2.5" onsubmit="event.preventDefault(); enviarLead();">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-600 mb-0.5 ml-0.5">Tu Nombre y Apellido</label>
                            <input type="text" id="lead-nombre" placeholder="Ej: Juan Pérez" required
                                class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/80 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-400 text-slate-800 placeholder-slate-400 font-medium transition-all">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-600 mb-0.5 ml-0.5">Correo Electrónico</label>
                            <input type="email" id="lead-correo" placeholder="tu@email.com" required
                                class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/80 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-400 text-slate-800 placeholder-slate-400 font-medium transition-all">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-600 mb-0.5 ml-0.5">Teléfono / WhatsApp</label>
                            <input type="tel" id="lead-telefono" placeholder="+56 9..." required
                                class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/80 outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-400 text-slate-800 placeholder-slate-400 font-medium font-mono transition-all">
                        </div>
                        <div class="pt-0.5">
                            <label class="flex items-start gap-2 text-[10px] text-slate-500 cursor-pointer select-none leading-tight">
                                <input type="checkbox" id="lead-privacy" required class="w-3.5 h-3.5 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0">
                                <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-700 hover:text-amber-600">Política de Privacidad</a> y autorizo la evaluación legal con un abogado aliado.</span>
                            </label>
                        </div>
                        <button type="submit"
                            class="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 mt-1">
                            <span class="material-icons text-sm">outgoing_mail</span>
                            <span id="lead-btn-text">Solicitar Revisión Legal</span>
                        </button>
                    </form>
                    <div id="lead-confirmacion" class="hidden p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center mt-2">
                        <span class="material-icons text-emerald-600 text-lg block mb-0.5">check_circle</span>
                        <p class="text-xs font-bold text-emerald-950">¡Solicitud recibida!</p>
                        <p class="text-[11px] text-emerald-800">Un abogado aliado revisará tus antecedentes a la brevedad.</p>
                    </div>
                    <p class="text-[9px] text-amber-900/80 text-center flex items-center justify-center gap-1 mt-2 font-medium">
                        <span class="material-icons text-[11px] text-emerald-600">lock</span>
                        100% Confidencial · Sin cobros ocultos
                    </p>
                </div>
            </div>
        </div>

        <!-- 3. Contextual Link Booster Finiquito (Full-Width abajo) -->
        <div class="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl no-print">
            <p class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <span class="material-icons text-sm text-sky-500">menu_book</span> Guías legales sobre término de contrato:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <a href="como-calcular-finiquito-chile" class="p-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-700 hover:text-sky-600 hover:border-sky-300 flex items-center gap-2 transition-all shadow-2xs group">
                    <span class="material-icons text-xs text-sky-500 group-hover:scale-110 transition-transform">article</span>
                    <span>Cómo calcular finiquito ($800k)</span>
                </a>
                <a href="despido-necesidades-empresa-articulo-161" class="p-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-700 hover:text-amber-600 hover:border-amber-300 flex items-center gap-2 transition-all shadow-2xs group">
                    <span class="material-icons text-xs text-amber-500 group-hover:scale-110 transition-transform">gavel</span>
                    <span>Despido Art. 161 y plazos DT</span>
                </a>
                <a href="calculadora-vacaciones-proporcionales" class="p-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-700 hover:text-emerald-600 hover:border-emerald-300 flex items-center gap-2 transition-all shadow-2xs group">
                    <span class="material-icons text-xs text-emerald-500 group-hover:scale-110 transition-transform">beach_access</span>
                    <span>Vacaciones proporcionales</span>
                </a>
            </div>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- SUELDO LIQUIDO CALCULATOR CONTAINER                  -->
    <!-- ---------------------------------------------------- -->
    <div id="sueldo-calc-container" class="flex flex-col lg:flex-row gap-8 items-start hidden">
        <!-- Inputs Column (Left, 420px) -->
        <div class="w-full lg:w-[420px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 no-print">
            <div class="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                <h2 class="text-lg font-bold text-slate-900">Datos Remuneración</h2>
                <span class="px-2.5 py-1 text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-100 rounded-md">Real-time</span>
            </div>

            <!-- Base & Overtime -->
            <div class="space-y-4">
                <div class="space-y-1">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs font-bold text-slate-600 uppercase ml-1" for="salary">Sueldo Base Mensual</label>
                        <button type="button" onclick="var s=document.getElementById('salary');if(s){s.value='$ 553.553';s.dispatchEvent(new Event('input',{bubbles:true}));}" class="text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer active:scale-95 duration-100">Usar Mínimo ($553.553)</button>
                    </div>
                    <input id="salary" name="salary" placeholder="$ 553.553" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-right font-mono text-base" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="block text-xs font-bold text-slate-600 uppercase ml-1">Horas Extras</label>
                        <input id="overtime" type="number" placeholder="0" min="0" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-semibold text-right" />
                    </div>
                    <div class="space-y-1">
                        <label class="block text-xs font-bold text-slate-600 uppercase ml-1">Bonos / Comisiones</label>
                        <input id="bonuses" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-semibold text-right font-mono" />
                    </div>
                </div>
            </div>

            <!-- Gratificación & Contrato -->
            <div class="space-y-4 pt-4 border-t border-slate-100">
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-slate-600 uppercase ml-1">Gratificación Legal</label>
                    <select id="gratificationType" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-semibold cursor-pointer">
                        <option value="legal_tope">Tope Legal (25% / 4.75 IMM)</option>
                        <option value="manual">Monto Fijo Manual</option>
                        <option value="none">Sin Gratificación</option>
                    </select>
                    <!-- Manual input container (hidden on load) -->
                    <div id="manualGratInput" class="hidden relative pt-2">
                        <input id="gratificationManual" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-mono text-right" />
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="block text-xs font-bold text-slate-600 uppercase ml-1">Tipo de Contrato</label>
                    <div class="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button id="btn-indefinido" class="flex-1 py-2 px-3 rounded-lg bg-sky-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all outline-none">Indefinido</button>
                        <button id="btn-plazo" class="flex-1 py-2 px-3 rounded-lg text-slate-400 hover:text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors outline-none">Plazo Fijo</button>
                    </div>
                </div>
            </div>

            <!-- AFP & Salud -->
            <div class="space-y-4 pt-4 border-t border-slate-100">
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-slate-600 uppercase ml-1">AFP (Administradora)</label>
                    <select id="afpSelect" class="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all outline-none text-sm font-semibold cursor-pointer">
                        <option value="Capital">Capital (11,44%)</option>
                        <option value="Cuprum">Cuprum (11,44%)</option>
                        <option value="Habitat">Habitat (11,27%)</option>
                        <option value="Modelo" selected>Modelo (10,58%)</option>
                        <option value="Planvital">Planvital (11,16%)</option>
                        <option value="Provida">Provida (11,45%)</option>
                        <option value="Uno">Uno (10,69%)</option>
                    </select>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-600 uppercase ml-1">Previsión de Salud</label>
                    <div class="flex items-center gap-6">
                        <label class="flex items-center cursor-pointer group text-sm text-slate-600 font-semibold select-none">
                            <input class="form-radio text-sky-500 focus:ring-sky-500/35 border-slate-300 h-4.5 w-4.5 cursor-pointer mr-2" name="salud" type="radio" value="fonasa" checked />
                            Fonasa (7%)
                        </label>
                        <label class="flex items-center cursor-pointer group text-sm text-slate-600 font-semibold select-none">
                            <input class="form-radio text-sky-500 focus:ring-sky-500/35 border-slate-300 h-4.5 w-4.5 cursor-pointer mr-2" name="salud" type="radio" value="isapre" />
                            Isapre
                        </label>
                    </div>
                    <!-- Isapre Input (hidden on load) -->
                    <div id="isapreInput" class="hidden relative pt-2">
                        <div class="flex border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all bg-white">
                            <input id="isapreValue" type="text" inputmode="decimal" class="border-none bg-transparent text-slate-800 w-full px-4 py-2.5 outline-none text-sm font-semibold text-left" placeholder="Cotización pactada (Ej: 2.5)" />
                            <div class="bg-slate-100 border-l border-slate-200 px-4 flex items-center justify-center">
                                <span class="text-xs font-bold text-slate-600">UF</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Non-Taxable Incomes -->
            <div class="space-y-4 pt-4 border-t border-slate-100">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <span class="material-icons text-sm text-sky-500">payments</span>
                    Haberes No Imponibles
                </h4>
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 ml-1">Colación</label>
                        <input id="colacion" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 ml-1">Movilización</label>
                        <input id="movilizacion" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 ml-1">Viáticos</label>
                        <input id="viaticos" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                </div>
            </div>

            <!-- Accordion Discounts -->
            <details class="p-1 bg-slate-50 border border-slate-200 rounded-2xl transition-colors">
                <summary class="cursor-pointer p-3.5 font-bold text-xs text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center justify-between outline-none list-none [&::-webkit-details-marker]:hidden">
                    <div class="flex items-center gap-1.5">
                        <span class="material-icons text-sky-500 text-sm">playlist_add</span>
                        Descuentos Opcionales
                    </div>
                    <span class="material-icons text-sky-500">expand_more</span>
                </summary>
                <div class="px-3 pb-3.5 pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">CCAF (Imponible)</label>
                        <input id="ccaf" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">APV (Imponible)</label>
                        <input id="apv" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">Préstamos</label>
                        <input id="prestamos" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">Pensión Alimenticia</label>
                        <input id="pension" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">Sindicato</label>
                        <input id="sindicato" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase ml-1">Otros Descuentos</label>
                        <input id="otrosDescuentos" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="$ 0" class="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-right font-semibold" />
                    </div>
                    <div class="col-span-2 pt-2 border-t border-slate-100 flex items-center">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input id="toggleReduceSS" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500/35 cursor-pointer">
                            <span class="text-[10px] text-slate-500 font-semibold">CCAF/APV reduce base de AFP/Salud</span>
                        </label>
                    </div>
                </div>
            </details>
        </div>

        <!-- Results Column (Right, Sticky) -->
        <div id="resultados-sueldo" class="flex-grow bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm lg:sticky lg:top-24 space-y-6 scroll-mt-20">
            <div class="text-center sm:text-left border-b border-slate-100 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tu Sueldo Líquido Estimado</h3>
                    <div class="flex items-baseline gap-2 justify-center sm:justify-start">
                        <span id="headerNetSalary" class="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">$ —</span>
                        <span id="headerPercentage" class="text-sm font-bold text-slate-400">0%</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Descuentos</span>
                    <span id="headerTotalDiscounts" class="text-lg font-bold text-red-500 font-mono">-$ —</span>
                </div>
            </div>

            <!-- Interactive Donut Chart Segment -->
            <div class="flex flex-col sm:flex-row gap-6 items-center justify-center border-b border-slate-100 pb-6">
                <!-- Conic styled div chart -->
                <div id="distribution-chart" class="w-44 h-44 rounded-full border border-slate-100 flex items-center justify-center relative shadow-inner shrink-0" style="background: conic-gradient(#10b981 0% 100%);">
                    <div class="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center z-10 shadow-sm">
                        <span id="chart-liquid-percent" class="text-3xl font-extrabold text-slate-800 font-mono">—</span>
                        <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Líquido</span>
                    </div>
                </div>

                <!-- Custom Dynamic Legend -->
                <div class="space-y-2.5 flex-grow w-full max-w-[220px]">
                    <div class="flex items-center justify-between text-xs font-medium">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded bg-emerald-500 shrink-0"></span>
                            <span class="text-slate-500">Sueldo Líquido</span>
                        </div>
                        <span id="legend-liquido-percent" class="font-bold text-slate-800 font-mono">0%</span>
                    </div>
                    <div class="flex items-center justify-between text-xs font-medium">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded bg-blue-500 shrink-0"></span>
                            <span class="text-slate-500">AFP + AFC</span>
                        </div>
                        <span id="legend-afp-percent" class="font-bold text-slate-800 font-mono">0%</span>
                    </div>
                    <div class="flex items-center justify-between text-xs font-medium">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded bg-rose-500 shrink-0"></span>
                            <span class="text-slate-500">Previsión Salud</span>
                        </div>
                        <span id="legend-health-percent" class="font-bold text-slate-800 font-mono">0%</span>
                    </div>
                    <div class="flex items-center justify-between text-xs font-medium">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded bg-purple-500 shrink-0"></span>
                            <span class="text-slate-500">Impuesto SII</span>
                        </div>
                        <span id="legend-tax-percent" class="font-bold text-slate-800 font-mono">0%</span>
                    </div>
                    <div id="legend-otros-container" class="flex items-center justify-between text-xs font-medium hidden">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded bg-orange-500 shrink-0"></span>
                            <span class="text-slate-500">Otros Descuentos</span>
                        </div>
                        <span id="legend-otros-percent" class="font-bold text-slate-800 font-mono">0%</span>
                    </div>
                </div>
            </div>

            <!-- Detailed Breakdown values -->
            <div class="space-y-3 pt-2">
                <div class="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                    <span class="text-slate-600 font-semibold" id="labelAFP">AFP</span>
                    <span id="resultAFP" class="font-bold text-slate-800 font-mono">$0</span>
                </div>
                <div class="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                    <span class="text-slate-600 font-semibold" id="labelHealth">Salud</span>
                    <span id="resultHealth" class="font-bold text-slate-800 font-mono">$0</span>
                </div>
                <div class="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                    <span class="text-slate-600 font-semibold">Seguro Cesantía (AFC)</span>
                    <span id="resultAFC" class="font-bold text-slate-800 font-mono">$0</span>
                </div>
                <div class="flex justify-between items-center text-sm py-1 border-b border-slate-50">
                    <span class="text-slate-600 font-semibold">Impuesto Único (Segunda Categoría)</span>
                    <span id="resultTax" class="font-bold text-slate-800 font-mono">$0</span>
                </div>

                <!-- CCAF / APV Breakdown Container -->
                <div id="section-imponibles" class="bg-amber-600/5 border border-amber-600/10 rounded-2xl p-3 hidden space-y-2 mt-2">
                    <div class="flex justify-between items-center text-xs font-semibold text-amber-800">
                        <span>CCAF Descontado</span>
                        <span id="resultCCAF" class="font-mono">$0</span>
                    </div>
                    <div class="flex justify-between items-center text-xs font-semibold text-amber-800">
                        <span>APV Descontado</span>
                        <span id="resultAPV" class="font-mono">$0</span>
                    </div>
                </div>

                <!-- Non-imponibles and cash deductions container -->
                <div id="section-no-imponibles" class="bg-slate-50 border border-slate-100 rounded-2xl p-3 hidden space-y-2 mt-2 text-xs font-medium text-slate-600">
                    <div class="flex justify-between items-center">
                        <span>Préstamos</span>
                        <span id="resultPrestamos" class="font-mono">$0</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Pensión Alimenticia</span>
                        <span id="resultPension" class="font-mono">$0</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Sindicato</span>
                        <span id="resultSindicato" class="font-mono">$0</span>
                    </div>
                    <div class="flex justify-between items-center text-slate-700 font-bold">
                        <span>Otros</span>
                        <span id="resultOtros" class="font-mono">$0</span>
                    </div>
                </div>
            </div>

            <!-- Inline Alert Box -->
            <div id="global-notifications" class="hidden space-y-2 pt-2">
                <!-- Alerts are injected dynamically by salary_ui.js -->
            </div>

            <!-- PDF and WhatsApp Share section -->
            <div id="pdf-section" class="mt-4 hidden no-print space-y-2">
              <div class="flex flex-col sm:flex-row gap-2">
                <button id="download-pdf-btn-sueldo" 
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                  <span class="material-icons text-sm">picture_as_pdf</span> Descargar PDF
                </button>
                <button type="button" onclick="shareSueldoWhatsApp()" id="share-sueldo-wsp"
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer">
                  <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                  WhatsApp
                </button>
              </div>
              <p class="text-[11px] text-slate-400">Descarga instantánea o comparte tu desglose.</p>
            </div>

            <!-- Contextual Link Booster Sueldo -->
            <div class="mt-4 pt-3 border-t border-slate-100 no-print">
              <p class="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <span class="material-icons text-xs text-sky-500">lightbulb</span> ¿Quieres profundizar en tu jornada y remuneración?
              </p>
              <div class="flex flex-col gap-1.5 text-xs">
                <a href="ley-40-horas-chile-2026" class="text-slate-600 hover:text-sky-600 flex items-center gap-1.5 transition-colors">
                  <span class="material-icons text-xs text-slate-400">schedule</span> Ley 40 Horas: Horarios 5x2 y 6x1 con sueldo mínimo
                </a>
                <a href="calculadora-horas-extras" class="text-slate-600 hover:text-sky-600 flex items-center gap-1.5 transition-colors">
                  <span class="material-icons text-xs text-amber-500">more_time</span> Calculadora de Horas Extras al 50% y 100%
                </a>
                <a href="como-calcular-sueldo-liquido-paso-a-paso" class="text-slate-600 hover:text-sky-600 flex items-center gap-1.5 transition-colors">
                  <span class="material-icons text-xs text-emerald-500">school</span> Guía paso a paso: Fórmula de descuentos e impuestos
                </a>
              </div>
            </div>
        </div>
    </div>

    <!-- Mobile Result Bar shared at the bottom -->
    <div id="mobile-result-bar" class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xl translate-y-full transition-transform duration-300 no-print">
        <div>
            <span id="mobile-result-label" class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Líquido a pago</span>
            <div class="flex items-baseline gap-1.5">
                <span id="mobile-result-value" class="text-xl font-black text-slate-900 tracking-tight font-mono">$0</span>
                <span id="mobile-result-percentage" class="text-xs font-bold text-slate-400">0%</span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button id="mobile-pdf-btn" onclick="var fini=document.getElementById('finiquito-calc-container');if(fini&&!fini.classList.contains('hidden')){var b=document.getElementById('download-pdf-btn');if(b)b.click();}else{var s=document.getElementById('download-pdf-btn-sueldo');if(s)s.click();}" class="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-all">
                <span class="material-icons text-sm">picture_as_pdf</span> PDF
            </button>
                            <button onclick="var fini=document.getElementById('finiquito-calc-container');var target=fini&&!fini.classList.contains('hidden')?document.getElementById('resultados-finiquito'):document.getElementById('resultados-sueldo');if(target)target.scrollIntoView({behavior:'smooth',block:'start'})" class="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/10 cursor-pointer active:scale-95 transition-all">Ver desglose</button>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- TRUST & E-E-A-T PILLARS (3 Cards)                    -->
    <!-- ---------------------------------------------------- -->
    <div class="max-w-[1200px] mx-auto my-16 no-print">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 shadow-xs">
                    <span class="material-icons text-2xl">verified_user</span>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-900 mb-1">Normativa DT & SII 2026</h3>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Fórmulas calibradas con el Código del Trabajo de Chile, divisores de 42h (Ley 40 Horas), y topes legales de 89.9 UF y 90 UF.
                    </p>
                </div>
            </div>

            <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                    <span class="material-icons text-2xl">lock</span>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-900 mb-1">Privacidad y Sin Registro</h3>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Tus datos se calculan de manera 100% privada y local en tu navegador. Jamás solicitamos RUT ni guardamos remuneraciones personales.
                    </p>
                </div>
            </div>

            <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                    <span class="material-icons text-2xl">picture_as_pdf</span>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-900 mb-1">Exportación Oficial en PDF</h3>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Descarga e imprime reportes desglosados en formato legal estándar con un solo clic, sin marcas de agua y de libre uso.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- EDUCATIONAL ACCORDIONS (Below the fold)              -->
    <!-- ---------------------------------------------------- -->
    <div class="max-w-4xl mx-auto my-12 no-print">
        <h2 class="text-2xl font-bold text-slate-900 text-center mb-8">Información y Preguntas Frecuentes</h2>
        
        <div class="space-y-4">
            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-5 font-bold text-sm text-slate-800 flex justify-between items-center outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Cómo funciona el cálculo de Sueldo Líquido en Chile?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-5 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                    El sueldo líquido corresponde al total de tus haberes menos las deducciones legales obligatorias: AFP (10% + comisión de tu administradora), Salud (7% obligatorio para Fonasa o el monto pactado en UF para Isapre), Seguro de Cesantía (0.6% de la base imponible para contratos indefinidos) y el Impuesto Único de Segunda Categoría (aplicable según la tabla progresiva mensual del SII). Los haberes no imponibles como colación y movilización se suman íntegros al líquido final.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-5 font-bold text-sm text-slate-800 flex justify-between items-center outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Qué conceptos integran el Finiquito Legal?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-5 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                    Un finiquito conforme al Código del Trabajo debe incluir: remuneraciones adeudadas por días trabajados en el mes, feriado proporcional y pendiente (vacaciones legales compensadas en dinero), indemnización por años de servicio (si el despido es por Necesidades de la Empresa, Art. 161, equivalente a un sueldo por año con tope de 11) e indemnización sustitutiva del aviso previo si no se comunicó la desvinculación con 30 días de antelación.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-5 font-bold text-sm text-slate-800 flex justify-between items-center outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Cómo funciona la indemnización por años de servicio?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-5 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                    Acorde al artículo 163 del Código del Trabajo, si el contrato es indefinido y termina por Necesidades de la Empresa (Art. 161), el empleador debe abonar una indemnización equivalente a un mes de la última remuneración imponible por cada año completo de servicio continuado. Las fracciones iguales o superiores a 6 meses se computan como un año completo adicional. Existe un tope legal de 11 años computables, y una limitación económica mensual máxima de 90 UF.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-5 font-bold text-sm text-slate-800 flex justify-between items-center outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Cómo se calculan las vacaciones proporcionales en el finiquito?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-5 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                    Todo trabajador acumula por ley 1.25 días hábiles de feriado por cada mes completo trabajado (15 días hábiles anuales). Al desvincularse, el empleador debe compensar monetariamente los días de vacaciones proporcionales generados en el año actual que no alcanzaron a gozarse. Para valorizarlos, se proyectan los días hábiles sobre el calendario corrido incluyendo fines de semana y feriados, multiplicando dichos días calendario por la remuneración diaria del trabajador.
                </div>
            </details>

            <details class="bg-white border border-slate-200 rounded-2xl group transition-all duration-200 overflow-hidden">
                <summary class="cursor-pointer p-5 font-bold text-sm text-slate-800 flex justify-between items-center outline-none list-none [&::-webkit-details-marker]:hidden">
                    ¿Cuál es el plazo legal de pago de un finiquito?
                    <span class="material-icons transition-transform group-open:rotate-180 text-sky-500">expand_more</span>
                </summary>
                <div class="px-5 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                    De conformidad con el artículo 177 del Código del Trabajo, el empleador dispone de un plazo máximo improrrogable de 10 días hábiles (contados de lunes a sábado, sin incluir domingos ni festivos) a partir del término efectivo del contrato de trabajo para confeccionar el documento de finiquito y poner a disposición del trabajador los montos resultantes. El no pago oportuno faculta a demandar con reajustes por IPC y multas de hasta 150%.
                </div>
            </details>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- RELATED GUIDES SECTION (6 Cards)                     -->
    <!-- ---------------------------------------------------- -->
    <div class="max-w-[1200px] mx-auto mt-20 mb-12 no-print">
        <div class="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Guías y Actualidad Laboral 2026</h2>
                <p class="text-slate-500 text-xs mt-1">Artículos prácticos y actualizados conforme al Código del Trabajo de Chile.</p>
            </div>
            <a href="blog" class="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3.5 py-2 rounded-xl transition-colors">
                Ver todo el Blog <span class="material-icons text-xs">arrow_forward</span>
            </a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <!-- Card 1: Fondos Generacionales AFP -->
            <a href="fondos-generacionales-afp-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-fondos-generacionales-afp-cover.png" alt="Fondos Generacionales AFP Chile" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <span class="absolute top-3 left-3 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">Reforma Previsional</span>
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Fondos Generacionales AFP Chile: Qué son y tabla por edad</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">El fin de los multifondos A, B, C, D, E. Conoce cómo funcionan los fondos por ciclo de vida y en cuál quedarás según tu año de nacimiento.</p>
                </div>
            </a>
            <!-- Card 2: Ley 40 Horas -->
            <a href="ley-40-horas-chile-2026" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-ley-40-horas-chile-cover.png" alt="Ley 40 Horas" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <span class="absolute top-3 left-3 bg-sky-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">Laboral 2026</span>
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Implementación de la Ley de 40 Horas (42h)</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">Infografía detallada y cronograma legal sobre la reducción paulatina de la jornada ordinaria en Chile y su valor hora extra.</p>
                </div>
            </a>
            <!-- Card 3: Sueldo Líquido -->
            <a href="como-calcular-sueldo-liquido-paso-a-paso" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-sueldo-liquido-cover.png" alt="Calcular sueldo líquido" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Cómo Calcular Sueldo Líquido Paso a Paso</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">Entiende al detalle cómo pasar tu renta bruta mensual a líquida restando las retenciones obligatorias de AFP, Fonasa o Isapre.</p>
                </div>
            </a>
            <!-- Card 4: Finiquito -->
            <a href="como-calcular-finiquito-chile" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-calculo-finiquito-chile-2026.png" alt="Cálculo de Finiquito" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Cómo Calcular tu Finiquito en Chile</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">Guía didáctica completa con fórmulas, indemnización por años de servicio, aviso previo y un ejemplo práctico resuelto.</p>
                </div>
            </a>
            <!-- Card 5: Vacaciones Proporcionales -->
            <a href="guia-vacaciones-proporcionales" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-vacaciones-proporcionales-cover.png" alt="Vacaciones Proporcionales" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Cálculo de Vacaciones Proporcionales</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">Aprende la fórmula del feriado proporcional y comprende por qué a veces aparece valorizado en $0 en tu liquidación de término.</p>
                </div>
            </a>
            <!-- Card 6: Despido Art 161 -->
            <a href="despido-necesidades-empresa-articulo-161" class="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300">
                <div class="aspect-video bg-slate-100 overflow-hidden relative">
                    <img src="assets/guia-despido-necesidades-empresa-161.png" alt="Artículo 161" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h3 class="font-bold text-slate-900 group-hover:text-sky-500 transition-colors mb-2 text-sm">Despido por Necesidades de la Empresa</h3>
                    <p class="text-slate-500 text-[11px] leading-relaxed line-clamp-2">Conoce qué causales se consideran válidas en el Artículo 161 y qué hacer si consideras que tu despido es injustificado.</p>
                </div>
            </a>
        </div>
    </div>

    <!-- ---------------------------------------------------- -->
    <!-- PRINT-ONLY TEMPLATES FOR PROFESSIONAL PDF            -->
    <!-- ---------------------------------------------------- -->
    
    <!-- Finiquito Print Template -->
    <div id="print-template-finiquito" class="print-only hidden font-sans text-slate-800 p-8 max-w-4xl mx-auto">
      <!-- Header with Logo and Brand -->
      <div class="flex justify-between items-center border-b-2 border-slate-200 pb-6 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20">
            <svg class="w-6 h-6 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
                            <!-- Pedestal Base -->
                            <path d="M30 84h40M38 79h24"></path>
                            <!-- Vertical Pillar -->
                            <path d="M50 22v57"></path>
                            <!-- Center pointer tip -->
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <!-- Balance Beam -->
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <!-- Left Pan strings and dish -->
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Right Pan strings and dish -->
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Monogram C wrapping left side -->
                            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                            <!-- Monogram L wrapping right side -->
                            <path d="M58 43.5v20h10"></path>
                        </svg>
          </div>
          <div>
            <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span class="text-sky-500">Laboral</span></span>
            <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulación Legal de Finiquito</span>
          </div>
        </div>
        <div class="text-right">
          <h2 class="text-base font-bold text-slate-800 uppercase tracking-wider">Reporte de Finiquito</h2>
          <p class="text-[10px] text-slate-400 font-semibold mt-0.5">Fecha de emisión: <span id="print-date-finiquito" class="font-mono">—</span></p>
        </div>
      </div>

      <!-- Summary of Inputs -->
      <div class="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 mb-6">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Parámetros de la Simulación</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Fecha de Inicio:</span>
            <span id="print-input-start-date" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Fecha de Término:</span>
            <span id="print-input-end-date" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Antigüedad:</span>
            <span id="print-input-antiquity" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Causal de Término:</span>
            <span id="print-input-cause" class="font-bold text-slate-700">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Sueldo Base:</span>
            <span id="print-input-base-salary" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Gratificación:</span>
            <span id="print-input-gratification" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Asignaciones Fijas:</span>
            <span id="print-input-assignments" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Vac. Pendientes:</span>
            <span id="print-input-vacation-pending" class="font-bold text-slate-700 font-mono">—</span>
          </div>
        </div>
      </div>

      <!-- Main Breakdown Table -->
      <div class="border border-slate-200 rounded-2xl overflow-hidden mb-6">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <th class="py-3 px-4">Concepto Liquidado</th>
              <th class="py-3 px-4 text-right">Monto CLP</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr>
              <td class="py-3.5 px-4 font-semibold text-slate-700">Indemnización por Años de Servicio (IAS)</td>
              <td id="print-row-ias" class="py-3.5 px-4 text-right font-mono font-bold">$ —</td>
            </tr>
            <tr>
              <td class="py-3.5 px-4 font-semibold text-slate-700">Indemnización Sustitutiva de Aviso Previo</td>
              <td id="print-row-notice" class="py-3.5 px-4 text-right font-mono font-bold">$ —</td>
            </tr>
            <tr>
              <td class="py-3.5 px-4 font-semibold text-slate-700">Vacaciones Proporcionales</td>
              <td id="print-row-vacation-prop" class="py-3.5 px-4 text-right font-mono font-bold">$ —</td>
            </tr>
            <tr>
              <td class="py-3.5 px-4 font-semibold text-slate-700">Vacaciones Pendientes</td>
              <td id="print-row-vacation-pending" class="py-3.5 px-4 text-right font-mono font-bold">$ —</td>
            </tr>
            <tr>
              <td class="py-3.5 px-4 font-semibold text-slate-700">Remuneraciones Pendientes (Días del Mes)</td>
              <td id="print-row-pending-salary" class="py-3.5 px-4 text-right font-mono font-bold">$ —</td>
            </tr>
            <tr id="print-row-afc-container" class="text-red-600 bg-red-500/5">
              <td class="py-3.5 px-4 font-semibold">Descuento AFC Aporte Empleador</td>
              <td id="print-row-afc" class="py-3.5 px-4 text-right font-mono font-bold">-$ —</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-900 text-white font-bold text-sm">
              <td class="py-4 px-4 rounded-bl-2xl">Total Neto del Finiquito Estimado</td>
              <td id="print-row-total" class="py-4 px-4 text-right font-mono rounded-br-2xl text-base">$ —</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer Disclaimer -->
      <div class="text-[9px] text-slate-400 space-y-2 mt-8 leading-relaxed border-t border-slate-100 pt-4">
        <p><strong>Nota legal explicativa:</strong> Esta simulación de finiquito es de carácter meramente ilustrativo e informativo y no constituye asesoría legal ni vinculante para ninguna de las partes. El cálculo ha sido efectuado de acuerdo con las normativas legales de la Dirección del Trabajo (DT) vigentes en la República de Chile para el año 2026. Los valores definitivos pueden variar dependiendo de la revisión detallada de liquidaciones históricas y variables específicas de la relación laboral.</p>
        <p>© 2026 Cálculo Laboral Chile (calculolaboral.cl) — Herramientas gratuitas para el trabajador.</p>
      </div>
    </div>

    <!-- Sueldo Liquido Print Template -->
    <div id="print-template-sueldo" class="print-only hidden font-sans text-slate-800 p-8 max-w-4xl mx-auto">
      <!-- Header with Logo and Brand -->
      <div class="flex justify-between items-center border-b-2 border-slate-200 pb-6 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shadow-md shadow-sky-500/20">
            <svg class="w-6 h-6 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
                            <!-- Pedestal Base -->
                            <path d="M30 84h40M38 79h24"></path>
                            <!-- Vertical Pillar -->
                            <path d="M50 22v57"></path>
                            <!-- Center pointer tip -->
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <!-- Balance Beam -->
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <!-- Left Pan strings and dish -->
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Right Pan strings and dish -->
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <!-- Monogram C wrapping left side -->
                            <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                            <!-- Monogram L wrapping right side -->
                            <path d="M58 43.5v20h10"></path>
                        </svg>
          </div>
          <div>
            <span class="font-bold text-xl tracking-tight text-slate-900">Cálculo<span class="text-sky-500">Laboral</span></span>
            <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulación Legal de Sueldo Líquido</span>
          </div>
        </div>
        <div class="text-right">
          <h2 class="text-base font-bold text-slate-800 uppercase tracking-wider">Detalle de Liquidación</h2>
          <p class="text-[10px] text-slate-400 font-semibold mt-0.5">Fecha de emisión: <span id="print-date-sueldo" class="font-mono">—</span></p>
        </div>
      </div>

      <!-- Summary of Inputs -->
      <div class="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 mb-6">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Haberes e Ingresos</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Sueldo Base Mensual:</span>
            <span id="print-input-salary-base" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Horas Extraordinarias:</span>
            <span id="print-input-salary-ot" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Gratificación Legal:</span>
            <span id="print-input-salary-grat" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Bonos Imponibles:</span>
            <span id="print-input-salary-bonuses" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Asignación Colación:</span>
            <span id="print-input-salary-colacion" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Asignación Movilización:</span>
            <span id="print-input-salary-movilizacion" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">Viáticos / Otros No Imp:</span>
            <span id="print-input-salary-viaticos" class="font-bold text-slate-700 font-mono">—</span>
          </div>
          <div>
            <span class="block text-slate-400 font-semibold mb-0.5">AFP Seleccionada:</span>
            <span id="print-input-salary-afp-name" class="font-bold text-slate-700">—</span>
          </div>
        </div>
      </div>

      <!-- Main Breakdown Table -->
      <div class="border border-slate-200 rounded-2xl overflow-hidden mb-6">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <th class="py-3 px-4">Concepto Descontado / Liquidado</th>
              <th class="py-3 px-4 text-right">Monto CLP</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr>
              <td class="py-3 px-4 font-semibold text-slate-700">Cotización Previsional Obligatoria (AFP)</td>
              <td id="print-row-salary-afp" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr>
              <td class="py-3 px-4 font-semibold text-slate-700">Cotización Legal de Salud (7% Fonasa / Isapre)</td>
              <td id="print-row-salary-health" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr>
              <td class="py-3 px-4 font-semibold text-slate-700">Seguro de Cesantía (AFC Trabajador)</td>
              <td id="print-row-salary-afc" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr>
              <td class="py-3 px-4 font-semibold text-slate-700">Impuesto de Segunda Categoría (SII)</td>
              <td id="print-row-salary-tax" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-ccaf-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Descuento CCAF (Caja de Compensación)</td>
              <td id="print-row-salary-ccaf" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-apv-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Descuento APV (Ahorro Previsional Voluntario)</td>
              <td id="print-row-salary-apv" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-loans-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Descuento por Préstamos / Mutuales</td>
              <td id="print-row-salary-loans" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-pension-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Descuento por Pensión Alimenticia</td>
              <td id="print-row-salary-pension" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-sindicato-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Cuota Sindical</td>
              <td id="print-row-salary-sindicato" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
            <tr id="print-row-salary-other-container" class="hidden bg-red-500/5">
              <td class="py-3 px-4 font-semibold text-slate-700">Otros Descuentos Autorizados</td>
              <td id="print-row-salary-other" class="py-3 px-4 text-right font-mono font-bold text-red-600">-$ —</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-900 text-white font-bold text-sm">
              <td class="py-4 px-4 rounded-bl-2xl">Sueldo Líquido Final Estimado (Líquido a Pago)</td>
              <td id="print-row-salary-net" class="py-4 px-4 text-right font-mono rounded-br-2xl text-base">$ —</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer Disclaimer -->
      <div class="text-[9px] text-slate-400 space-y-2 mt-8 leading-relaxed border-t border-slate-100 pt-4">
        <p><strong>Nota legal explicativa:</strong> Este cálculo de sueldo líquido es referencial e ilustrativo y se ha elaborado conforme a los topes imponibles y tasas previsionales vigentes para el año 2026 en Chile. Las liquidaciones definitivas extendidas por el empleador pueden tener variaciones específicas derivadas de comisiones exactas de AFP, tramos de seguro de cesantía o descuentos particulares pactados colectivamente.</p>
        <p>© 2026 Cálculo Laboral Chile (calculolaboral.cl) — Herramientas gratuitas para el trabajador.</p>
      </div>
    </div>
</div>
"""

INDEX_SCRIPTS = """
    <!-- Calculator Scripts -->
    <script src="/js/validation.js?v=2.0.5"></script>
    <script src="/js/salary_logic.js?v=2.0.3"></script>
    <script src="/js/salary_ui.js?v=2.0.7"></script>
    <script src="/js/logic.js?v=2.0.3"></script>
    <script src="/js/ui.js?v=2.0.9"></script>
    <script>
        // High-end tab system switching between both calculators
        function switchCalculatorTab(tab) {
            const btnFiniquito = document.getElementById('tab-btn-finiquito');
            const btnSueldo = document.getElementById('tab-btn-sueldo');
            const containerFiniquito = document.getElementById('finiquito-calc-container');
            const containerSueldo = document.getElementById('sueldo-calc-container');
            const mobileBar = document.getElementById('mobile-result-bar');
            const mobilePercentage = document.getElementById('mobile-result-percentage');
            const mobileLabel = document.getElementById('mobile-result-label');

            if (tab === 'finiquito') {
                if (containerFiniquito) containerFiniquito.classList.remove('hidden');
                if (containerSueldo) containerSueldo.classList.add('hidden');
                if (btnFiniquito) btnFiniquito.className = "py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white bg-sky-500 shadow-md shadow-sky-500/20 active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5";
                if (btnSueldo) btnSueldo.className = "py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-slate-600 hover:text-slate-900 hover:bg-white active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5";
                
                if (mobileLabel) mobileLabel.textContent = 'Total Finiquito';
                if (mobilePercentage) {
                    mobilePercentage.textContent = '';
                    mobilePercentage.classList.add('hidden');
                }
                if (typeof updateCalculations === 'function') updateCalculations();
            } else {
                if (containerFiniquito) containerFiniquito.classList.add('hidden');
                if (containerSueldo) containerSueldo.classList.remove('hidden');
                if (btnSueldo) btnSueldo.className = "py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white bg-sky-500 shadow-md shadow-sky-500/20 active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5";
                if (btnFiniquito) btnFiniquito.className = "py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-slate-600 hover:text-slate-900 hover:bg-white active:scale-[0.98] duration-100 flex flex-col items-center justify-center text-center gap-0.5";
                
                if (mobileLabel) mobileLabel.textContent = 'Líquido a pago';
                if (mobilePercentage) {
                    mobilePercentage.classList.remove('hidden');
                }
                // Trigger sueldo calculations
                const salaryInput = document.getElementById('salary');
                if (salaryInput) salaryInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
        // Tab routing support
        document.addEventListener('DOMContentLoaded', () => {
            const hash = window.location.hash || '';
            const path = window.location.pathname || '';
            
            if (hash === '#sueldo' || path.includes('sueldo_liquido')) {
                switchCalculatorTab('sueldo');
            } else {
                switchCalculatorTab('finiquito');
            }
        });
    </script>
"""

# Generate index.html
print("Generating: index.html...")
canonical_url, og_tags, json_ld = generate_seo_tags("index.html", "Plataforma y Calculadoras Laborales Chile 2026 | Finiquito, Sueldo y Horas Extras", "Calcula gratis finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time en Chile. Simuladores oficiales 2026 conformes a la Dirección del Trabajo (DT). Sin registro.", page_type="website")
index_html_out = HTML_LAYOUT.format(
    title="Plataforma y Calculadoras Laborales Chile 2026 | Finiquito, Sueldo y Horas Extras",
    description="Calcula gratis finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time en Chile. Simuladores oficiales 2026 conformes a la Dirección del Trabajo (DT). Sin registro.",
    canonical_url=canonical_url,
    og_tags=og_tags,
    json_ld=json_ld,
    custom_head="",
    header=HEADER_HTML,
    indicator_bar=INDICATOR_BAR_HTML,
    content=INDEX_CONTENT,
    footer=FOOTER_HTML,
    history_modal=HISTORY_MODAL_HTML,
    custom_scripts=INDEX_SCRIPTS
)
with open(os.path.join(DEST_DIR, "index.html"), "w", encoding="utf-8") as f:
    f.write(index_html_out)

# Generate sueldo_liquido.html (Specialized H1, SEO metadata and redirects tab on load)
print("Generating: sueldo_liquido.html...")
canonical_url, og_tags, json_ld = generate_seo_tags("sueldo_liquido.html", "Calculadora de Sueldo Líquido Chile 2026 | De Bruto a Neto", "Calcula tu sueldo líquido exacto en Chile 2026. Pasa de bruto a neto con descuentos al día de AFP, Fonasa/Isapre, AFC e Impuesto Único. 100% gratis.", page_type="website")
sueldo_content = INDEX_CONTENT.replace(
    '<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">\n            Plataforma de Herramientas y Calculadoras Laborales Chile\n        </h1>\n        <p class="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">\n            Simula gratis tu finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time conforme a la Dirección del Trabajo (DT). Sin registro.\n        </p>',
    '<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">\n            Calculadora de Sueldo Líquido Chile 2026\n        </h1>\n        <p class="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">\n            Pasa de sueldo bruto a líquido exacto con retenciones oficiales de AFP, Fonasa/Isapre, AFC e Impuesto de 2ª Categoría.\n        </p>'
).replace(
    '<h2 class="text-2xl font-bold text-slate-900 text-center mb-8">Información y Preguntas Frecuentes</h2>',
    '<h2 class="text-2xl font-bold text-slate-900 text-center mb-8">Preguntas Frecuentes sobre el Sueldo Líquido y Descuentos Legales</h2>'
)
sueldo_html_out = HTML_LAYOUT.format(
    title="Calculadora de Sueldo Líquido Chile 2026 | De Bruto a Neto",
    description="Calcula tu sueldo líquido exacto en Chile 2026. Pasa de bruto a neto con descuentos al día de AFP, Fonasa/Isapre, AFC e Impuesto Único. 100% gratis.",
    canonical_url=canonical_url,
    og_tags=og_tags,
    json_ld=json_ld,
    custom_head="",
    header=HEADER_HTML,
    indicator_bar=INDICATOR_BAR_HTML,
    content=sueldo_content,
    footer=FOOTER_HTML,
    history_modal=HISTORY_MODAL_HTML,
    custom_scripts=INDEX_SCRIPTS + """
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            switchCalculatorTab('sueldo');
        });
    </script>
    """
)
with open(os.path.join(DEST_DIR, "sueldo_liquido.html"), "w", encoding="utf-8") as f:
    f.write(sueldo_html_out)

# Generate finiquito_calculator.html (Specialized H1, SEO metadata and redirects tab on load)
print("Generating: finiquito_calculator.html...")
canonical_url, og_tags, json_ld = generate_seo_tags("finiquito_calculator.html", "Calculadora de Finiquito Chile 2026 | Simulador Legal [PDF]", "Calcula tu finiquito en 1 minuto según las causales del Código del Trabajo (Art. 161, 159 y renuncia). Años de servicio y vacaciones con PDF gratis.", page_type="website")
finiquito_content = INDEX_CONTENT.replace(
    '<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">\n            Plataforma de Herramientas y Calculadoras Laborales Chile\n        </h1>\n        <p class="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">\n            Simula gratis tu finiquito legal, sueldo líquido, horas extras con Ley 40 Horas y contratos part-time conforme a la Dirección del Trabajo (DT). Sin registro.\n        </p>',
    '<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">\n            Calculadora de Finiquito Chile 2026\n        </h1>\n        <p class="text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed">\n            Simula tu finiquito con formato oficial de la Dirección del Trabajo (DT). Indemnización por años de servicio, vacaciones y aviso previo.\n        </p>'
).replace(
    '<h2 class="text-2xl font-bold text-slate-900 text-center mb-8">Información y Preguntas Frecuentes</h2>',
    '<h2 class="text-2xl font-bold text-slate-900 text-center mb-8">Preguntas Frecuentes sobre el Finiquito Laboral e Indemnizaciones</h2>'
)
finiquito_html_out = HTML_LAYOUT.format(
    title="Calculadora de Finiquito Chile 2026 | Simulador Legal [PDF]",
    description="Calcula tu finiquito en 1 minuto según las causales del Código del Trabajo (Art. 161, 159 y renuncia). Años de servicio y vacaciones con PDF gratis.",
    canonical_url=canonical_url,
    og_tags=og_tags,
    json_ld=json_ld,
    custom_head="",
    header=HEADER_HTML,
    indicator_bar=INDICATOR_BAR_HTML,
    content=finiquito_content,
    footer=FOOTER_HTML,
    history_modal=HISTORY_MODAL_HTML,
    custom_scripts=INDEX_SCRIPTS + """
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            switchCalculatorTab('finiquito');
        });
    </script>
    """
)
with open(os.path.join(DEST_DIR, "finiquito_calculator.html"), "w", encoding="utf-8") as f:
    f.write(finiquito_html_out)

HORAS_EXTRAS_CONTENT = """
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
            <a href="./" class="hover:text-sky-500 transition-colors font-medium">Inicio</a>
            <span class="material-icons text-xs">chevron_right</span>
            <span class="text-slate-600 font-semibold">Calculadora de Horas Extras</span>
        </nav>

        <!-- Hero Header Section -->
        <div class="text-center my-8 max-w-2xl mx-auto no-print">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 mb-3">
                <span class="material-icons text-xs text-sky-600">schedule</span> Actualizado Ley 40 Horas (Jornada 42h)
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
                Calculadora de Horas Extras Chile 2026
            </h1>
            <p class="text-slate-500 text-sm mt-1">
                Calcula el valor exacto de tu hora ordinaria y horas extraordinarias con recargo legal del <strong>50%</strong> y <strong>100%</strong> según las fórmulas oficiales de la Dirección del Trabajo.
            </p>
        </div>

        <!-- Two Column Interactive Layout (440px Inputs Left, Flexible Results Right) -->
        <div class="flex flex-col lg:flex-row gap-8 items-start mb-16">
            
            <!-- Left Column: Form Controls (440px Fixed) -->
            <div class="w-full lg:w-[440px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span class="material-icons text-sky-500">tune</span> Datos para el cálculo
                    </h2>
                    <span class="text-[11px] font-mono text-slate-400 font-semibold" id="he-divisor-badge">Divisor DT: 180 hrs</span>
                </div>

                <!-- 1. Sueldo Base -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label for="he-sueldo-base" class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Sueldo Base Mensual
                        </label>
                        <button type="button" onclick="setHEMinimo()" class="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                            Usar Mínimo ($553.553)
                        </button>
                    </div>
                    <div class="relative rounded-2xl shadow-sm">
                        <input type="text" id="he-sueldo-base" value="$ 553.553" inputmode="numeric" pattern="[0-9]*" autocomplete="off" oninput="formatHEInput(this); calculateHorasExtras();" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Sueldo fijo pactado en tu contrato de trabajo.</p>
                </div>

                <!-- 2. Jornada Semanal Pactada -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Jornada Semanal Pactada
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="he-jornada" value="42" checked onchange="calculateHorasExtras()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                42 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Legal 2026 (÷180)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="he-jornada" value="40" onchange="calculateHorasExtras()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                40 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Sello 40h (÷171.4)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="he-jornada" value="44" onchange="calculateHorasExtras()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                44 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Etapa 2024 (÷188.6)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="he-jornada" value="45" onchange="calculateHorasExtras()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                45 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Histórica (÷192.9)</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 3. Horas Extras Realizadas -->
                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <!-- Horas al 50% -->
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div class="flex justify-between items-center mb-1">
                            <label for="he-cant-50" class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Horas Extras al 50%
                            </label>
                            <span class="text-[10px] font-semibold text-sky-600 font-mono" id="he-live-unit-50">$4.613 c/u</span>
                        </div>
                        <span class="block text-[10px] text-slate-400 mb-2">Días hábiles normales (lunes a sábado)</span>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustHE('he-cant-50', -1)" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">-</button>
                            <input type="number" id="he-cant-50" value="10" min="0" max="100" step="0.5" oninput="calculateHorasExtras()" class="w-full text-center py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <button type="button" onclick="adjustHE('he-cant-50', 1)" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">+</button>
                        </div>
                    </div>

                    <!-- Horas al 100% -->
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div class="flex justify-between items-center mb-1">
                            <label for="he-cant-100" class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Horas Extras al 100%
                            </label>
                            <span class="text-[10px] font-semibold text-emerald-600 font-mono" id="he-live-unit-100">$6.151 c/u</span>
                        </div>
                        <span class="block text-[10px] text-slate-400 mb-2">Domingos, festivos o pacto especial</span>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="adjustHE('he-cant-100', -1)" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">-</button>
                            <input type="number" id="he-cant-100" value="0" min="0" max="100" step="0.5" oninput="calculateHorasExtras()" class="w-full text-center py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <button type="button" onclick="adjustHE('he-cant-100', 1)" class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">+</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Results Summary (Light Theme matching index.html) -->
            <div class="w-full flex-grow bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm lg:sticky lg:top-24 space-y-6">
                
                <!-- Main Header / Totals Section -->
                <div class="text-center sm:text-left border-b border-slate-100 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Bruto a Pago</h3>
                        <div class="flex items-baseline gap-2 justify-center sm:justify-start">
                            <span id="he-total-bruto" class="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">$46.130</span>
                        </div>
                        <p class="text-xs text-emerald-600 font-semibold mt-1 flex items-center justify-center sm:justify-start gap-1">
                            <span class="material-icons text-xs">payments</span> Líquido adicional aprox: <strong id="he-total-neto" class="font-mono text-slate-800">$36.904</strong>
                        </p>
                    </div>
                    <div class="text-center sm:text-right bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Horas</span>
                        <span id="he-total-horas" class="text-lg font-bold text-sky-600 font-mono">10.0 hrs</span>
                    </div>
                </div>

                <!-- Unit Values Grid (Light Theme) -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <span class="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Hora Ordinaria</span>
                        <span class="font-mono font-bold text-base text-slate-900" id="he-unit-ordinaria">$3.075</span>
                    </div>
                    <div class="bg-sky-50/60 border border-sky-200 rounded-2xl p-4">
                        <span class="text-sky-700 block text-[10px] font-bold uppercase tracking-wider mb-1">Hora Extra 50%</span>
                        <span class="font-mono font-bold text-base text-sky-700" id="he-unit-50">$4.613</span>
                    </div>
                    <div class="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4">
                        <span class="text-emerald-700 block text-[10px] font-bold uppercase tracking-wider mb-1">Hora Extra 100%</span>
                        <span class="font-mono font-bold text-base text-emerald-700" id="he-unit-100">$6.151</span>
                    </div>
                </div>

                <!-- Detailed Breakdown List -->
                <div class="space-y-3 pt-2">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Desglose de Liquidación</h4>
                    <div class="space-y-2 text-xs divide-y divide-slate-100">
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-600">Subtotal 50% (<span id="he-desc-cant-50">10</span> hrs):</span>
                            <span class="font-mono font-semibold text-slate-900" id="he-subtotal-50">$46.130</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Subtotal 100% (<span id="he-desc-cant-100">0</span> hrs):</span>
                            <span class="font-mono font-semibold text-slate-900" id="he-subtotal-100">$0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 font-bold text-sm">
                            <span class="text-slate-900">Total Imponible Horas Extras:</span>
                            <span class="font-mono text-sky-600" id="he-breakdown-total">$46.130</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="pt-4 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
                    <button type="button" onclick="copyHEResults()" id="he-copy-btn" class="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <span class="material-icons text-sm">content_copy</span> <span id="he-copy-text">Copiar Resumen</span>
                    </button>
                    <button type="button" onclick="shareHEWhatsApp()" class="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer">
                        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        Compartir en WhatsApp
                    </button>
                    <a href="sueldo_liquido" class="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-md shadow-sky-500/10 active:scale-95">
                        <span class="material-icons text-sm">payments</span> Ver en Sueldo
                    </a>
                </div>
            </div>
        </div>

        <!-- Explanatory SEO Content Section -->
        <article class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 max-w-4xl mx-auto">
            
            <div>
                <h2 class="text-2xl font-bold text-slate-900 mb-4">¿Cómo se calculan las horas extras en Chile en 2026?</h2>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    Con la entrada en vigencia de la segunda etapa de la <strong>Ley 40 Horas (Ley 21.561)</strong>, la jornada laboral ordinaria máxima en Chile se redujo a <strong>42 horas semanales</strong>. Esto incrementó automáticamente el valor de la hora de trabajo para todos los trabajadores dependientes.
                </p>
                
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 my-6">
                    <h3 class="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                        <span class="material-icons text-sky-500 text-base">functions</span> Fórmula Oficial de la Dirección del Trabajo (DT)
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-600 font-mono bg-white p-3 rounded-xl border border-slate-200 mb-3">
                        Valor Hora Ordinaria = (Sueldo Base / 30) × (7 / Jornada Semanal) = Sueldo Base / Divisor Mensual
                    </p>
                    <ul class="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                        <li><strong>Para jornada de 42 horas:</strong> Factor DT = <strong>0,0055555...</strong> (Divisor mensual exacto: <strong>180 horas</strong>).</li>
                        <li><strong>Para jornada de 40 horas:</strong> Factor DT = <strong>0,0058333...</strong> (Divisor mensual: <strong>171,43 horas</strong>).</li>
                        <li><strong>Para jornada de 44 horas:</strong> Factor DT = <strong>0,0053030...</strong> (Divisor mensual: <strong>188,57 horas</strong>).</li>
                        <li><strong>Para jornada de 45 horas (antigua):</strong> Factor DT = <strong>0,0051851...</strong> (Divisor mensual: <strong>192,86 horas</strong>).</li>
                    </ul>
                </div>
            </div>

            <!-- Table 1: Quick Reference by Number of Extra Hours -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">Tabla de Pago de Horas Extras con Sueldo Mínimo ($553.553 CLP - 42h)</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-4">Valores oficiales con hora ordinaria a <strong>$3.075</strong>, hora 50% a <strong>$4.613</strong> y hora 100% a <strong>$6.151</strong>:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl mb-6">
                    <table class="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <th class="p-3.5">Cantidad de Horas</th>
                                <th class="p-3.5 text-sky-600">Total al 50% (Días Hábiles)</th>
                                <th class="p-3.5 text-emerald-600">Total al 100% (Festivos / Domingos)</th>
                                <th class="p-3.5 text-slate-700">Líquido Aprox. en Bolsillo (~80%)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-mono">
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">1 Hora Extra</td>
                                <td class="p-3.5 text-sky-600 font-bold">$4.613</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$6.151</td>
                                <td class="p-3.5 text-slate-700">~$3.690</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">2 Horas Extras</td>
                                <td class="p-3.5 text-sky-600 font-bold">$9.226</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$12.301</td>
                                <td class="p-3.5 text-slate-700">~$7.381</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">5 Horas Extras</td>
                                <td class="p-3.5 text-sky-600 font-bold">$23.065</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$30.753</td>
                                <td class="p-3.5 text-slate-700">~$18.452</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">10 Horas Extras</td>
                                <td class="p-3.5 text-sky-600 font-bold">$46.130</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$61.506</td>
                                <td class="p-3.5 text-slate-700">~$36.904</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">15 Horas Extras</td>
                                <td class="p-3.5 text-sky-600 font-bold">$69.195</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$92.259</td>
                                <td class="p-3.5 text-slate-700">~$55.356</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">20 Horas Extras</td>
                                <td class="p-3.5 text-sky-600 font-bold">$92.260</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$123.012</td>
                                <td class="p-3.5 text-slate-700">~$73.808</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Table 2: Comparison by Salary Level -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">Tabla Oficial según Nivel de Sueldo Base (Jornada 42 Horas)</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-4">Valores unitarios y ejemplo de 10 horas extras mensuales:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table class="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <th class="p-3.5">Sueldo Base</th>
                                <th class="p-3.5">Hora Ordinaria (÷180)</th>
                                <th class="p-3.5 text-sky-600">Hora 50%</th>
                                <th class="p-3.5 text-emerald-600">Hora 100%</th>
                                <th class="p-3.5 text-slate-800">Total 10 Horas (50%)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-mono">
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$553.553 (Mínimo)</td>
                                <td class="p-3.5 text-slate-600">$3.075</td>
                                <td class="p-3.5 text-sky-600 font-bold">$4.613</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$6.151</td>
                                <td class="p-3.5 text-slate-900 font-bold">$46.130</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$700.000</td>
                                <td class="p-3.5 text-slate-600">$3.889</td>
                                <td class="p-3.5 text-sky-600 font-bold">$5.833</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$7.778</td>
                                <td class="p-3.5 text-slate-900 font-bold">$58.333</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$850.000</td>
                                <td class="p-3.5 text-slate-600">$4.722</td>
                                <td class="p-3.5 text-sky-600 font-bold">$7.083</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$9.444</td>
                                <td class="p-3.5 text-slate-900 font-bold">$70.833</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$1.000.000</td>
                                <td class="p-3.5 text-slate-600">$5.556</td>
                                <td class="p-3.5 text-sky-600 font-bold">$8.333</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$11.111</td>
                                <td class="p-3.5 text-slate-900 font-bold">$83.333</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$1.200.000</td>
                                <td class="p-3.5 text-slate-600">$6.667</td>
                                <td class="p-3.5 text-sky-600 font-bold">$10.000</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$13.333</td>
                                <td class="p-3.5 text-slate-900 font-bold">$100.000</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$1.500.000</td>
                                <td class="p-3.5 text-slate-600">$8.333</td>
                                <td class="p-3.5 text-sky-600 font-bold">$12.500</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$16.667</td>
                                <td class="p-3.5 text-slate-900 font-bold">$125.000</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">$2.000.000</td>
                                <td class="p-3.5 text-slate-600">$11.111</td>
                                <td class="p-3.5 text-sky-600 font-bold">$16.667</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$22.222</td>
                                <td class="p-3.5 text-slate-900 font-bold">$166.667</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Legal Limits -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-3">Límites y requisitos legales según el Código del Trabajo</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <strong class="block text-slate-900 mb-1">⏱️ Máximo 2 horas al día</strong>
                        <p class="text-slate-600 text-xs">La ley prohíbe realizar más de 2 horas extraordinarias diarias para proteger la salud del trabajador (Art. 31).</p>
                    </div>
                    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <strong class="block text-slate-900 mb-1">📝 Pacto escrito obligatorio</strong>
                        <p class="text-slate-600 text-xs">Debe existir un acuerdo firmado por escrito con vigencia máxima de 3 meses, renovable si persisten las faenas temporales.</p>
                    </div>
                    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <strong class="block text-slate-900 mb-1">💵 Pago en la liquidación</strong>
                        <p class="text-slate-600 text-xs">Deben liquidarse y pagarse conjuntamente con las remuneraciones ordinarias del respectivo período mensual.</p>
                    </div>
                </div>
            </div>

            <!-- FAQs -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-4">Preguntas Frecuentes sobre Horas Extras</h3>
                <div class="space-y-3">
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Las horas extras pagan impuestos y cotizaciones previsionales?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Sí. Las horas extraordinarias son consideradas <strong>remuneración imponible y tributable</strong>. Por tanto, se les descuenta AFP (10,58% a 11,45%), Salud (7%) y Seguro de Cesantía (0,6%). Si tu total imponible supera las 13,5 UTM mensuales, también tributan impuesto único.
                        </p>
                    </details>
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Cuándo corresponde pagar horas extras al 100%?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            El recargo legal mínimo del Código del Trabajo es del 50%. Sin embargo, se paga el 100% (o más) cuando las horas extras se realizan en días domingos o festivos en empresas que no tienen turnos continuos, o cuando se pactó contractualmente un recargo superior mediante convenio individual o colectivo.
                        </p>
                    </details>
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Puedo compensar las horas extras con días de descanso?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Con la Ley 21.561 (40 Horas), las partes pueden acordar por escrito que las horas extraordinarias se compensen con hasta 5 días hábiles de feriado adicional al año, debiendo otorgarse 1,5 horas de descanso por cada hora extra trabajada.
                        </p>
                    </details>
                </div>
            </div>
        </article>
"""

HORAS_EXTRAS_SCRIPTS = """
    <script>
        function parseCleanNumber(val) {
            if (!val) return 0;
            return parseInt(val.toString().replace(/[^0-9]/g, ''), 10) || 0;
        }

        function formatCurrency(num) {
            return '$' + Math.round(num).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
        }

        function formatHEInput(input) {
            var raw = input.value || '';
            var oldSel = input.selectionStart || 0;
            var digitsBefore = 0;
            for (var i = 0; i < oldSel; i++) {
                if (/\\d/.test(raw[i])) digitsBefore++;
            }
            var digits = raw.replace(/\\D/g, '');
            if (!digits) { input.value = ''; return; }
            var cleanDigits = digits.slice(0, 11);
            var formatted = '$ ' + parseInt(cleanDigits, 10).toLocaleString('es-CL');
            input.value = formatted;
            var newPos = formatted.length;
            var counted = 0;
            for (var j = 0; j < formatted.length; j++) {
                if (/\\d/.test(formatted[j])) {
                    counted++;
                    if (counted === digitsBefore) { newPos = j + 1; break; }
                }
            }
            if (digitsBefore === 0) newPos = 2;
            try { input.setSelectionRange(newPos, newPos); } catch (e) {}
        }

        function setHEMinimo() {
            var input = document.getElementById('he-sueldo-base');
            input.value = '$ 553.553';
            calculateHorasExtras();
        }

        function adjustHE(id, delta) {
            var input = document.getElementById(id);
            var val = Math.max(0, (parseFloat(input.value) || 0) + delta);
            input.value = val;
            calculateHorasExtras();
        }

        function calculateHorasExtras() {
            var sueldoBase = parseCleanNumber(document.getElementById('he-sueldo-base').value);
            var jornadaEl = document.querySelector('input[name="he-jornada"]:checked');
            var jornada = jornadaEl ? parseFloat(jornadaEl.value) : 42;
            
            var cant50 = parseFloat(document.getElementById('he-cant-50').value) || 0;
            var cant100 = parseFloat(document.getElementById('he-cant-100').value) || 0;

            // Official DT Formula: Valor Hora Ordinaria = (Sueldo / 30) * (7 / Jornada)
            var valorOrdinaria = (sueldoBase / 30) * (7 / jornada);
            var valor50 = valorOrdinaria * 1.50;
            var valor100 = valorOrdinaria * 2.00;

            var subtotal50 = cant50 * valor50;
            var subtotal100 = cant100 * valor100;
            var totalBruto = subtotal50 + subtotal100;
            var totalNeto = totalBruto * 0.80; // Aprox after AFP & Salud (~20%)

            // Divisor descriptor
            var divisor = (30 / 7) * jornada;
            var badge = document.getElementById('he-divisor-badge');
            if (badge) badge.innerText = 'Divisor DT: ' + (divisor % 1 === 0 ? divisor.toFixed(0) : divisor.toFixed(1)) + ' hrs';

            // Render unit values
            var uOrd = document.getElementById('he-unit-ordinaria'); if (uOrd) uOrd.innerText = formatCurrency(valorOrdinaria);
            var u50 = document.getElementById('he-unit-50'); if (u50) u50.innerText = formatCurrency(valor50);
            var u100 = document.getElementById('he-unit-100'); if (u100) u100.innerText = formatCurrency(valor100);
            var lu50 = document.getElementById('he-live-unit-50'); if (lu50) lu50.innerText = formatCurrency(valor50) + ' c/u';
            var lu100 = document.getElementById('he-live-unit-100'); if (lu100) lu100.innerText = formatCurrency(valor100) + ' c/u';
            var tHoras = document.getElementById('he-total-horas'); if (tHoras) tHoras.innerText = (cant50 + cant100).toFixed(1) + ' hrs';

            // Render totals
            var tBruto = document.getElementById('he-total-bruto'); if (tBruto) tBruto.innerText = formatCurrency(totalBruto);
            var tNeto = document.getElementById('he-total-neto'); if (tNeto) tNeto.innerText = formatCurrency(totalNeto);

            // Render breakdown
            var dc50 = document.getElementById('he-desc-cant-50'); if (dc50) dc50.innerText = cant50;
            var dc100 = document.getElementById('he-desc-cant-100'); if (dc100) dc100.innerText = cant100;
            var st50 = document.getElementById('he-subtotal-50'); if (st50) st50.innerText = formatCurrency(subtotal50);
            var st100 = document.getElementById('he-subtotal-100'); if (st100) st100.innerText = formatCurrency(subtotal100);
            var bTotal = document.getElementById('he-breakdown-total'); if (bTotal) bTotal.innerText = formatCurrency(totalBruto);
        }

        function copyHEResults() {
            var sueldoBase = document.getElementById('he-sueldo-base').value;
            var total = document.getElementById('he-total-bruto').innerText;
            var unit50 = document.getElementById('he-unit-50').innerText;
            var horas = document.getElementById('he-total-horas').innerText;

            var text = "Calculo de Horas Extras (calculolaboral.cl):\\n" +
                       "Sueldo Base: $" + sueldoBase + "\\n" +
                       "Horas Extras Realizadas: " + horas + "\\n" +
                       "Valor Unitario 50%: " + unit50 + "\\n" +
                       "Total Bruto a Pago: " + total;

            navigator.clipboard.writeText(text).then(function() {
                var btnText = document.getElementById('he-copy-text');
                if (btnText) {
                    btnText.innerText = '¡Copiado!';
                    setTimeout(function() { btnText.innerText = 'Copiar Resumen'; }, 2000);
                }
            });
        }

        document.addEventListener('DOMContentLoaded', calculateHorasExtras);
    </script>
"""

PART_TIME_CONTENT = """
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
            <a href="./" class="hover:text-sky-500 transition-colors font-medium">Inicio</a>
            <span class="material-icons text-xs">chevron_right</span>
            <span class="text-slate-600 font-semibold">Calculadora de Sueldo Part-Time</span>
        </nav>

        <!-- Hero Header Section -->
        <div class="text-center my-8 max-w-2xl mx-auto no-print">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-3">
                <span class="material-icons text-xs text-emerald-600">verified</span> Art. 40 bis Código del Trabajo · Sueldo Mínimo $553.553
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
                Calculadora de Sueldo Part-Time Chile 2026
            </h1>
            <p class="text-slate-500 text-sm mt-1">
                Simula tu sueldo líquido para jornadas de <strong>30h, 20h o fines de semana</strong>. Incluye comisiones variables, semana corrida y verificación de beneficios para estudiantes (Gratuidad y Carga Familiar).
            </p>
        </div>

        <!-- Two Column Interactive Layout (440px Inputs Left, Flexible Results Right) -->
        <div class="flex flex-col lg:flex-row gap-8 items-start mb-16">
            
            <!-- Left Column: Form Controls (440px Fixed) -->
            <div class="w-full lg:w-[440px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <h2 class="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span class="material-icons text-sky-500">tune</span> Parámetros del Contrato
                </h2>

                <!-- 1. Jornada Semanal -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Jornada Semanal (Máximo 30 Horas)
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="pt-jornada" value="30" checked onchange="setPTJornada(30)" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                30 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Tope Legal</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="pt-jornada" value="20" onchange="setPTJornada(20)" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                20 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Media Jornada</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="pt-jornada" value="15" onchange="setPTJornada(15)" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                15 horas <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Fin de Semana</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 2. Sueldo Base Mensual -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label for="pt-sueldo-base" class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Sueldo Base Ofrecido / Pactado
                        </label>
                        <button type="button" onclick="setPTMinimoLegal()" class="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                            Usar Mínimo (<span id="pt-minimo-btn-val">$395.395</span>)
                        </button>
                    </div>
                    <div class="relative rounded-2xl shadow-sm">
                        <input type="text" id="pt-sueldo-base" value="$ 395.395" inputmode="numeric" pattern="[0-9]*" autocomplete="off" oninput="formatPTInput(this); calculatePartTime();" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1" id="pt-legal-hint">Mínimo legal proporcional para 30 horas: <strong>$395.395</strong>.</p>
                </div>

                <!-- 3. Comisiones Variables y Semana Corrida -->
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <label for="pt-comisiones" class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span class="material-icons text-amber-500 text-sm">trending_up</span> Comisiones / Bonos del Mes
                        </label>
                        <span class="text-[10px] text-slate-400 font-medium">Opcional</span>
                    </div>
                    <div class="relative rounded-xl shadow-sm">
                        <input type="text" id="pt-comisiones" value="$ 0" inputmode="numeric" pattern="[0-9]*" autocomplete="off" oninput="formatPTInput(this); calculatePartTime();" placeholder="$ 0" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-sky-500">
                    </div>
                    
                    <label class="flex items-center gap-2 cursor-pointer pt-1">
                        <input type="checkbox" id="pt-semana-corrida" checked onchange="calculatePartTime()" class="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300">
                        <span class="text-xs text-slate-600 select-none">Calcular <strong>Semana Corrida</strong> automática (~18% sobre comisiones)</span>
                    </label>
                </div>

                <!-- 4. Parámetros Previsionales -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label for="pt-afp" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">AFP</label>
                        <select id="pt-afp" onchange="calculatePartTime()" class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="0.1058">AFP Modelo (10,58%)</option>
                            <option value="0.1069">AFP Uno (10,69%)</option>
                            <option value="0.1127">AFP Habitat (11,27%)</option>
                            <option value="0.1116">AFP Planvital (11,16%)</option>
                            <option value="0.1144">AFP Capital (11,44%)</option>
                            <option value="0.1144">AFP Cuprum (11,44%)</option>
                            <option value="0.1145">AFP Provida (11,45%)</option>
                        </select>
                    </div>

                    <div>
                        <label for="pt-salud" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Salud</label>
                        <select id="pt-salud" onchange="calculatePartTime()" class="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="0.07">Fonasa (7%)</option>
                            <option value="0.07">Isapre (7% Legal)</option>
                        </select>
                    </div>
                </div>

                <!-- 5. Toggle Estudiante Trabajador (Art. 40 bis E) -->
                <div class="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl flex items-center justify-between gap-4">
                    <div class="space-y-0.5">
                        <span class="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                            <span class="material-icons text-sky-600 text-base">school</span> ¿Eres Estudiante de 18 a 24 años?
                        </span>
                        <p class="text-[11px] text-sky-700">Verifica que tus ingresos no superen 2 IMM ($1.107.106) para proteger Gratuidad y Carga Familiar.</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="pt-is-student" checked onchange="calculatePartTime()" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                </div>
            </div>

            <!-- Right Column: Results Summary (Light Theme matching index.html) -->
            <div class="w-full flex-grow bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm lg:sticky lg:top-24 space-y-6">
                
                <!-- Main Header / Totals Section -->
                <div class="text-center sm:text-left border-b border-slate-100 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sueldo Líquido Estimado</h3>
                        <div class="flex items-baseline gap-2 justify-center sm:justify-start">
                            <span id="pt-sueldo-liquido" class="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-mono">$323.512</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-1 font-mono">
                            Total Imponible: <strong id="pt-total-imponible" class="text-sky-600">$395.395</strong>
                        </p>
                    </div>
                    <div class="text-center sm:text-right bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Jornada</span>
                        <span id="pt-jornada-badge" class="text-lg font-bold text-slate-800 font-mono">30 Horas/Sem</span>
                    </div>
                </div>

                <!-- Minimum Wage Compliance Alert -->
                <div id="pt-compliance-box" class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <span class="material-icons text-emerald-600 text-base">check_circle</span>
                    <span id="pt-compliance-text">Cumple con el mínimo legal proporcional ($395.395).</span>
                </div>

                <!-- Student Status Gauge (Light Theme) -->
                <div id="pt-student-box" class="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2">
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-sky-900 flex items-center gap-1">
                            <span class="material-icons text-sky-600 text-sm">school</span> Tope Gratuidad (2 IMM):
                        </span>
                        <span class="font-mono text-sky-900" id="pt-student-percent">35.7%</span>
                    </div>
                    <div class="w-full bg-sky-200/60 rounded-full h-2.5 overflow-hidden">
                        <div id="pt-student-bar" class="bg-emerald-500 h-2.5 rounded-full transition-all duration-300" style="width: 35.7%"></div>
                    </div>
                    <p class="text-[11px] text-emerald-800 font-medium" id="pt-student-status">
                        ✅ Gratuidad y Carga Familiar Médica 100% protegidas (Menor a $1.107.106).
                    </p>
                </div>

                <!-- Detailed Breakdown List -->
                <div class="space-y-3 pt-2">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Desglose de Liquidación</h4>
                    <div class="space-y-2 text-xs divide-y divide-slate-100">
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-600">Sueldo Base:</span>
                            <span class="font-mono font-semibold text-slate-900" id="pt-desc-base">$395.395</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Comisiones + Semana Corrida:</span>
                            <span class="font-mono font-semibold text-slate-900" id="pt-desc-comisiones">$0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 text-rose-700">
                            <span id="pt-afp-label">Descuento AFP (10,58%):</span>
                            <span class="font-mono font-semibold" id="pt-desc-afp">-$41.833</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 text-rose-700">
                            <span>Descuento Salud (7%):</span>
                            <span class="font-mono font-semibold" id="pt-desc-salud">-$27.678</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 text-rose-700">
                            <span>Seguro de Cesantía (0,6%):</span>
                            <span class="font-mono font-semibold" id="pt-desc-afc">-$2.372</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 font-bold text-sm">
                            <span class="text-slate-900">Sueldo Líquido Final:</span>
                            <span class="font-mono text-emerald-600" id="pt-desc-liquido">$323.512</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="pt-4 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
                    <button type="button" onclick="copyPTResults()" id="pt-copy-btn" class="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <span class="material-icons text-sm">content_copy</span> <span id="pt-copy-text">Copiar Resumen</span>
                    </button>
                    <button type="button" onclick="sharePTWhatsApp()" class="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer">
                        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        Compartir en WhatsApp
                    </button>
                    <a href="sueldo_liquido" class="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-md shadow-sky-500/10 active:scale-95">
                        <span class="material-icons text-sm">receipt_long</span> Sueldo Completo
                    </a>
                </div>
            </div>
        </div>

        <!-- Explanatory SEO Content Section -->
        <article class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 max-w-4xl mx-auto">
            
            <div>
                <h2 class="text-2xl font-bold text-slate-900 mb-4">¿Cómo funciona el Contrato de Trabajo Part-Time en Chile?</h2>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    En la legislación laboral chilena (<strong>Artículo 40 bis del Código del Trabajo</strong>), se define como <em>jornada parcial</em> o <em>part-time</em> a todo contrato de trabajo cuya duración semanal <strong>no exceda las 30 horas</strong>.
                </p>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed">
                    A diferencia de mitos comunes, los trabajadores part-time gozan de los <strong>mismos derechos fundamentales</strong> que un trabajador de jornada completa: descanso dominical, gratificación legal proporcional, derecho a licencias médicas y <strong>15 días hábiles de vacaciones anuales completas</strong> (no proporcionales a las horas).
                </p>
            </div>

            <!-- Minimum Wage Table -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-4">Tabla de Sueldo Mínimo Proporcional Part-Time 2026</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-3">Con base en el Sueldo Mínimo mensual de $553.553 y jornada ordinaria de 42 horas:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table class="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <th class="p-3.5">Jornada Semanal</th>
                                <th class="p-3.5 text-sky-600">Sueldo Base Mínimo Bruto</th>
                                <th class="p-3.5 text-emerald-600">Líquido Estimado (Fonasa+Modelo)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-mono">
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">30 Horas (Tope Part-Time)</td>
                                <td class="p-3.5 text-sky-600 font-bold">$395.395</td>
                                <td class="p-3.5 text-emerald-600 font-bold">~$323.512</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">20 Horas (Media Jornada)</td>
                                <td class="p-3.5 text-sky-600 font-bold">$263.596</td>
                                <td class="p-3.5 text-emerald-600 font-bold">~$215.675</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">15 Horas (Fin de Semana)</td>
                                <td class="p-3.5 text-sky-600 font-bold">$197.697</td>
                                <td class="p-3.5 text-emerald-600 font-bold">~$161.756</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800">10 Horas (Turno Reducido)</td>
                                <td class="p-3.5 text-sky-600 font-bold">$131.798</td>
                                <td class="p-3.5 text-emerald-600 font-bold">~$107.837</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Student Worker Law -->
            <div class="bg-sky-50/70 border border-sky-200 rounded-2xl p-6">
                <h3 class="text-lg font-bold text-sky-900 mb-2 flex items-center gap-2">
                    <span class="material-icons text-sky-600">school</span> Ley del Estudiante Trabajador (Ley 21.155 - Art. 40 bis E)
                </h3>
                <p class="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                    Si eres estudiante de educación superior (Universidad, Instituto Profesional o CFT) entre <strong>18 y 24 años</strong>, la ley te protege especialmente para que puedas trabajar sin perder tus beneficios socioeconómicos:
                </p>
                <ul class="text-xs sm:text-sm text-slate-700 space-y-2 list-disc list-inside">
                    <li><strong>Tope de 2 Ingresos Mínimos ($1.107.106):</strong> Mientras tus ingresos mensuales (sueldo base + comisiones) no superen este monto, <strong>no pierdes la Gratuidad, Beca Bicentenario ni otros beneficios estatales</strong>.</li>
                    <li><strong>Carga Familiar Médica:</strong> Puedes continuar como beneficiario de salud (carga) en el plan de Fonasa o Isapre de tus padres.</li>
                    <li><strong>Exención Tributaria:</strong> No se aplica retención de impuesto a la renta.</li>
                </ul>
            </div>

            <!-- FAQs -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-4">Preguntas Frecuentes sobre Trabajo Part-Time</h3>
                <div class="space-y-3">
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Cómo se calcula la semana corrida si gano comisiones en un part-time?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Si tu remuneración incluye un sueldo base más comisiones diarias o por hora, tienes derecho al pago de la <strong>Semana Corrida</strong> (Art. 45 del Código del Trabajo). Se calcula dividiendo el total de comisiones ganadas en la semana por los días efectivamente trabajados en ella, y ese valor promedio diario se multiplica por los domingos y festivos del mes.
                        </p>
                    </details>
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Los trabajadores part-time pueden hacer horas extras?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Sí, pero con un límite muy estricto: la suma de la jornada pactada más las horas extraordinarias <strong>nunca puede exceder las 12 horas diarias ni sobrepasar el límite de la jornada ordinaria máxima legal</strong>. Las horas extras se pagan con el recargo legal mínimo del 50%.
                        </p>
                    </details>
                    <details class="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                        <summary class="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center text-sm">
                            ¿Cuántos días de vacaciones le corresponden a un contrato part-time?
                            <span class="material-icons text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <p class="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Le corresponden exactamente los mismos <strong>15 días hábiles al año</strong> que a un trabajador de jornada completa. Durante su feriado anual, el trabajador part-time recibirá la remuneración íntegra equivalente al promedio de lo que percibía habitualmente.
                        </p>
                    </details>
                </div>
            </div>
        </article>
"""

PART_TIME_SCRIPTS = """
    <script>
        var SUELDO_MINIMO_NACIONAL = 553553;
        var JORNADA_ORDINARIA_LEGAL = 42;
        var TOPE_ESTUDIANTE_2_IMM = 1107106;

        function parseCleanNumber(val) {
            if (!val) return 0;
            return parseInt(val.toString().replace(/[^0-9]/g, ''), 10) || 0;
        }

        function formatCurrency(num) {
            return '$' + Math.round(num).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
        }

        function formatPTInput(input) {
            var raw = input.value || '';
            var oldSel = input.selectionStart || 0;
            var digitsBefore = 0;
            for (var i = 0; i < oldSel; i++) {
                if (/\\d/.test(raw[i])) digitsBefore++;
            }
            var digits = raw.replace(/\\D/g, '');
            if (!digits) { input.value = ''; return; }
            var cleanDigits = digits.slice(0, 11);
            var formatted = '$ ' + parseInt(cleanDigits, 10).toLocaleString('es-CL');
            input.value = formatted;
            var newPos = formatted.length;
            var counted = 0;
            for (var j = 0; j < formatted.length; j++) {
                if (/\\d/.test(formatted[j])) {
                    counted++;
                    if (counted === digitsBefore) { newPos = j + 1; break; }
                }
            }
            if (digitsBefore === 0) newPos = 2;
            try { input.setSelectionRange(newPos, newPos); } catch (e) {}
        }

        function getSelectedJornada() {
            var el = document.querySelector('input[name="pt-jornada"]:checked');
            return el ? parseFloat(el.value) : 30;
        }

        function getMinimoProporcional(horas) {
            return Math.round((SUELDO_MINIMO_NACIONAL / JORNADA_ORDINARIA_LEGAL) * horas);
        }

        function setPTJornada(horas) {
            var minProp = getMinimoProporcional(horas);
            var btnVal = document.getElementById('pt-minimo-btn-val');
            if (btnVal) btnVal.innerText = formatCurrency(minProp);
            var hint = document.getElementById('pt-legal-hint');
            if (hint) hint.innerHTML = 'Mínimo legal proporcional para ' + horas + ' horas: <strong>' + formatCurrency(minProp) + '</strong>.';
            var jBadge = document.getElementById('pt-jornada-badge');
            if (jBadge) jBadge.innerText = horas + ' Horas/Sem';
            
            // Auto-update base if it was set to old minimum
            var currentBase = parseCleanNumber(document.getElementById('pt-sueldo-base').value);
            if (currentBase === 395395 || currentBase === 263596 || currentBase === 197697 || currentBase === 0) {
                document.getElementById('pt-sueldo-base').value = '$ ' + minProp.toLocaleString('es-CL');
            }

            calculatePartTime();
        }

        function setPTMinimoLegal() {
            var horas = getSelectedJornada();
            var minProp = getMinimoProporcional(horas);
            document.getElementById('pt-sueldo-base').value = '$ ' + minProp.toLocaleString('es-CL');
            calculatePartTime();
        }

        function calculatePartTime() {
            var horas = getSelectedJornada();
            var minLegal = getMinimoProporcional(horas);
            var sueldoBase = parseCleanNumber(document.getElementById('pt-sueldo-base').value);
            var comisiones = parseCleanNumber(document.getElementById('pt-comisiones').value);
            var semCorridaEl = document.getElementById('pt-semana-corrida');
            var hasSemanaCorrida = semCorridaEl ? semCorridaEl.checked : true;

            // Semana Corrida estimation (~18% over commissions based on 4 domingos/month)
            var semanaCorrida = (hasSemanaCorrida && comisiones > 0) ? (comisiones * 0.18) : 0;
            var totalComisiones = comisiones + semanaCorrida;

            var totalImponible = sueldoBase + totalComisiones;

            // Previsional deductions
            var afpSelect = document.getElementById('pt-afp');
            var afpRate = afpSelect ? parseFloat(afpSelect.value) : 0.1058;
            var saludSelect = document.getElementById('pt-salud');
            var saludRate = saludSelect ? parseFloat(saludSelect.value) : 0.07;
            var afcRate = 0.006; // 0.6% standard

            var descAFP = totalImponible * afpRate;
            var descSalud = totalImponible * saludRate;
            var descAFC = totalImponible * afcRate;

            var totalDescuentos = descAFP + descSalud + descAFC;
            var sueldoLiquido = Math.max(0, totalImponible - totalDescuentos);

            // Minimum wage compliance check
            var compBox = document.getElementById('pt-compliance-box');
            var compText = document.getElementById('pt-compliance-text');
            if (compBox && compText) {
                if (sueldoBase >= minLegal) {
                    compBox.className = "p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2";
                    compText.innerText = "Cumple con el mínimo legal proporcional (" + formatCurrency(minLegal) + ").";
                } else {
                    compBox.className = "p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2";
                    compText.innerText = "⚠️ Sueldo base bajo el mínimo legal (" + formatCurrency(minLegal) + ").";
                }
            }

            // Student Status calculation
            var studentEl = document.getElementById('pt-is-student');
            var isStudent = studentEl ? studentEl.checked : false;
            var studentBox = document.getElementById('pt-student-box');
            if (studentBox) {
                if (isStudent) {
                    studentBox.classList.remove('hidden');
                    var studentPercent = Math.min(100, (totalImponible / TOPE_ESTUDIANTE_2_IMM) * 100);
                    var pPercent = document.getElementById('pt-student-percent');
                    if (pPercent) pPercent.innerText = studentPercent.toFixed(1) + '%';
                    var bar = document.getElementById('pt-student-bar');
                    if (bar) bar.style.width = studentPercent + '%';

                    var statusText = document.getElementById('pt-student-status');
                    if (statusText && bar) {
                        if (totalImponible <= TOPE_ESTUDIANTE_2_IMM) {
                            bar.className = "bg-emerald-500 h-2.5 rounded-full transition-all duration-300";
                            statusText.className = "text-[11px] text-emerald-800 font-medium";
                            statusText.innerText = "✅ Gratuidad y Carga Familiar Médica 100% protegidas (Menor a " + formatCurrency(TOPE_ESTUDIANTE_2_IMM) + ").";
                        } else {
                            bar.className = "bg-rose-500 h-2.5 rounded-full transition-all duration-300";
                            statusText.className = "text-[11px] text-rose-800 font-medium";
                            statusText.innerText = "⚠️ Supera el tope de 2 IMM. Este mes el ingreso tributa y computa normalmente.";
                        }
                    }
                } else {
                    studentBox.classList.add('hidden');
                }
            }

            // Render Output values
            var outLiq = document.getElementById('pt-sueldo-liquido'); if (outLiq) outLiq.innerText = formatCurrency(sueldoLiquido);
            var outImp = document.getElementById('pt-total-imponible'); if (outImp) outImp.innerText = formatCurrency(totalImponible);

            // Render Breakdown
            var dBase = document.getElementById('pt-desc-base'); if (dBase) dBase.innerText = formatCurrency(sueldoBase);
            var dCom = document.getElementById('pt-desc-comisiones'); if (dCom) dCom.innerText = formatCurrency(totalComisiones);
            var dAFP = document.getElementById('pt-desc-afp'); if (dAFP) dAFP.innerText = '-' + formatCurrency(descAFP);
            var dSal = document.getElementById('pt-desc-salud'); if (dSal) dSal.innerText = '-' + formatCurrency(descSalud);
            var dAFC = document.getElementById('pt-desc-afc'); if (dAFC) dAFC.innerText = '-' + formatCurrency(descAFC);
            var dLiq = document.getElementById('pt-desc-liquido'); if (dLiq) dLiq.innerText = formatCurrency(sueldoLiquido);

            if (afpSelect) {
                var afpLbl = document.getElementById('pt-afp-label');
                if (afpLbl) afpLbl.innerText = 'Descuento ' + afpSelect.options[afpSelect.selectedIndex].text + ':';
            }
        }

        function copyPTResults() {
            var horas = getSelectedJornada();
            var base = document.getElementById('pt-sueldo-base').value;
            var imponible = document.getElementById('pt-total-imponible').innerText;
            var liquido = document.getElementById('pt-sueldo-liquido').innerText;

            var text = "Calculo de Sueldo Part-Time (" + horas + "h) - calculolaboral.cl:\\n" +
                       "Sueldo Base: $" + base + "\\n" +
                       "Total Imponible: " + imponible + "\\n" +
                       "Sueldo Líquido a Pago: " + liquido;

            navigator.clipboard.writeText(text).then(function() {
                var btnText = document.getElementById('pt-copy-text');
                if (btnText) {
                    btnText.innerText = '¡Copiado!';
                    setTimeout(function() { btnText.innerText = 'Copiar Resumen'; }, 2000);
                }
            });
        }

        document.addEventListener('DOMContentLoaded', calculatePartTime);
    </script>
"""


VACACIONES_PROPORCIONALES_CONTENT = """
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
            <a href="./" class="hover:text-sky-500 transition-colors font-medium">Inicio</a>
            <span class="material-icons text-xs">chevron_right</span>
            <span class="text-slate-600 font-semibold">Calculadora de Vacaciones Proporcionales</span>
        </nav>

        <!-- Hero Header Section -->
        <div class="text-center my-8 max-w-2xl mx-auto no-print">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 mb-3">
                <span class="material-icons text-xs text-sky-600">beach_access</span> Art. 67 y 73 Código del Trabajo • Fórmulas Oficiales DT
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
                Calculadora de Vacaciones Proporcionales Chile 2026
            </h1>
            <p class="text-slate-500 text-sm mt-1">
                Calcula gratis tus <strong>días hábiles acumulados</strong>, la <strong>proyección obligatoria de días inhábiles</strong> (sábados, domingos y festivos) y el monto total en dinero a liquidar en tu finiquito según la Dirección del Trabajo.
            </p>
        </div>

        <!-- Two Column Interactive Layout (440px Inputs Left, Flexible Results Right) -->
        <div class="flex flex-col lg:flex-row gap-8 items-start mb-16">
            
            <!-- Left Column: Form Controls (440px Fixed) -->
            <div class="w-full lg:w-[440px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span class="material-icons text-sky-500">tune</span> Datos para el cálculo
                    </h2>
                    <span class="text-[11px] font-mono text-slate-400 font-semibold">Dictamen DT N° 4535/209</span>
                </div>

                <!-- 1. Fechas de Contrato -->
                <div class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="vac-fecha-inicio" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Fecha de Inicio
                            </label>
                            <input type="date" id="vac-fecha-inicio" onchange="calculateVacaciones()" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                        </div>
                        <div>
                            <label for="vac-fecha-termino" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Fecha de Término
                            </label>
                            <input type="date" id="vac-fecha-termino" onchange="calculateVacaciones()" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                        </div>
                    </div>
                    <!-- Presets rápidos -->
                    <div class="flex items-center gap-1.5 pt-1">
                        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Rango rápido:</span>
                        <button type="button" onclick="setVacRangeMonths(6)" class="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">6 Meses</button>
                        <button type="button" onclick="setVacRangeMonths(12)" class="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">1 Año</button>
                        <button type="button" onclick="setVacRangeMonths(24)" class="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">2 Años</button>
                    </div>
                </div>

                <!-- 2. Sueldo Base Mensual + Fijos -->
                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label for="vac-sueldo-base" class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Sueldo Base Mensual
                        </label>
                        <button type="button" onclick="setVacSueldoMinimo()" class="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer active:scale-95">
                            Usar Mínimo ($553.553)
                        </button>
                    </div>
                    <div class="relative rounded-2xl shadow-sm">
                        <input type="text" id="vac-sueldo-base" value="$ 553.553" inputmode="numeric" pattern="[0-9]*" autocomplete="off" oninput="formatVacInput(this); calculateVacaciones();" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Remuneración fija mensual para el cálculo diario (Sueldo / 30 según Art. 71 CT).</p>
                </div>

                <!-- 3. Días ya Tomados / Anticipados -->
                <div>
                    <label for="vac-dias-tomados" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Días Hábiles ya Disfrutados / Tomados
                    </label>
                    <div class="flex items-center gap-3">
                        <input type="number" id="vac-dias-tomados" value="0" min="0" max="60" step="0.5" oninput="calculateVacaciones()" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all">
                        <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">días hábiles</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Días de vacaciones que ya te tomaste durante este contrato.</p>
                </div>

                <!-- 4. Régimen de Vacaciones (General vs Zona Extrema) -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Régimen Geográfico
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="vac-regimen" value="general" checked onchange="calculateVacaciones()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                Régimen General <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">15 días/año (1.25/mes)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="vac-regimen" value="extrema" onchange="calculateVacaciones()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                Zona Extrema <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">20 días/año (1.67/mes)</span>
                            </div>
                        </label>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Zona extrema aplica a Regiones de Aysén, Magallanes y Provincia de Palena (Art. 67 CT).</p>
                </div>

                <!-- 5. Distribución de Jornada (5 o 6 días) -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Jornada Semanal de Trabajo
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="vac-jornada" value="5" checked onchange="calculateVacaciones()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                Lunes a Viernes <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Sábado inhábil (DT)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="vac-jornada" value="6" onchange="calculateVacaciones()" class="peer sr-only">
                            <div class="p-3 text-center border border-slate-200 rounded-xl peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:text-sky-700 font-bold text-xs hover:bg-slate-50 transition-all">
                                Lunes a Sábado <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-sky-600">Sábado hábil laboral</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 6. Feriado Progresivo Adicional (Opcional) -->
                <div class="pt-2 border-t border-slate-100">
                    <div class="flex justify-between items-center mb-1.5">
                        <label for="vac-dias-progresivos" class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Feriado Progresivo (Opcional)
                        </label>
                        <span class="text-[10px] font-mono text-slate-400">+1 día c/3 años tras 10 años</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="number" id="vac-dias-progresivos" value="0" min="0" max="15" step="1" oninput="calculateVacaciones()" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all">
                        <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">días hábiles extras</span>
                    </div>
                </div>

            </div>

            <!-- Right Column: Interactive Results (Flexible) -->
            <div class="flex-1 w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                
                <!-- Primary Hero Result Card -->
                <div class="p-6 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent border-2 border-sky-400/40 rounded-2xl relative overflow-hidden">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                        <span class="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span class="material-icons text-sm">payments</span> Total Feriado Proporcional a Pagar
                        </span>
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            Monto Bruto en Finiquito
                        </span>
                    </div>
                    <div class="mt-2 mb-3">
                        <span id="vac-monto-total" class="text-3xl sm:text-5xl font-extrabold text-slate-900 font-mono tracking-tight">$ 0</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Este monto corresponde a la compensación íntegra en dinero del feriado legal y proporcional pendiente. <strong>No está afecto a cotizaciones previsionales de AFP ni Salud</strong> (Dictamen DT N° 2399/112).
                    </p>
                </div>

                <!-- 3 Stat KPI Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center sm:text-left">
                        <span class="text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-1">Días Hábiles Netos</span>
                        <div class="flex items-baseline justify-center sm:justify-start gap-1">
                            <span class="font-mono font-bold text-xl text-slate-900" id="vac-habiles-netos">0.00</span>
                            <span class="text-xs text-slate-500 font-semibold">días</span>
                        </div>
                        <span class="text-[10px] text-slate-400 block mt-1">Devengados menos tomados</span>
                    </div>
                    <div class="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-center sm:text-left">
                        <span class="text-amber-800 block text-[10px] font-bold uppercase tracking-wider mb-1">Inhábiles Proyectados</span>
                        <div class="flex items-baseline justify-center sm:justify-start gap-1">
                            <span class="font-mono font-bold text-xl text-amber-700" id="vac-inhabiles-proyectados">+0.00</span>
                            <span class="text-xs text-amber-800 font-semibold">días</span>
                        </div>
                        <span class="text-[10px] text-amber-700/80 block mt-1">Fines de semana y festivos DT</span>
                    </div>
                    <div class="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 text-center sm:text-left">
                        <span class="text-emerald-800 block text-[10px] font-bold uppercase tracking-wider mb-1">Total Días a Liquidar</span>
                        <div class="flex items-baseline justify-center sm:justify-start gap-1">
                            <span class="font-mono font-bold text-xl text-emerald-700" id="vac-total-dias">0.00</span>
                            <span class="text-xs text-emerald-800 font-semibold">días corridos</span>
                        </div>
                        <span class="text-[10px] text-emerald-700/80 block mt-1">Multiplicados por sueldo diario</span>
                    </div>
                </div>

                <!-- Detailed Breakdown List -->
                <div class="space-y-3 pt-2">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Desglose Técnico de la Liquidación</h4>
                    <div class="space-y-2 text-xs divide-y divide-slate-100">
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-600">Tiempo trabajado computable:</span>
                            <span class="font-semibold text-slate-800" id="vac-tiempo-computable">0 meses y 0 días</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Días hábiles acumulados brutos:</span>
                            <span class="font-mono font-semibold text-slate-800" id="vac-habiles-devengados">0.00 días</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Días hábiles ya disfrutados (descuento):</span>
                            <span class="font-mono font-semibold text-slate-800" id="vac-dias-tomados-res">-0.00 días</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Remuneración diaria íntegra (Sueldo / 30):</span>
                            <span class="font-mono font-semibold text-slate-800" id="vac-sueldo-diario">$ 18.452 / día</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Proyección DT en calendario corrido:</span>
                            <span class="font-semibold text-slate-800 text-right" id="vac-proyeccion-detalle">Calculando proyección...</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 font-bold text-sm">
                            <span class="text-slate-900">Total Indemnización Feriado Proporcional:</span>
                            <span class="font-mono text-sky-600 text-base" id="vac-breakdown-total">$ 0</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="pt-4 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
                    <button type="button" onclick="copyVacResults()" id="vac-copy-btn" class="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <span class="material-icons text-sm">content_copy</span> <span id="vac-copy-text">Copiar Resumen</span>
                    </button>
                    <button type="button" onclick="shareVacWhatsApp()" class="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer">
                        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        Compartir en WhatsApp
                    </button>
                    <a href="finiquito_calculator" class="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-md shadow-sky-500/10 active:scale-95">
                        <span class="material-icons text-sm">calculate</span> Finiquito Completo
                    </a>
                </div>

            </div>
        </div>

        <!-- Explanatory SEO Content Section -->
        <article class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 max-w-4xl mx-auto">
            
            <div>
                <h2 class="text-2xl font-bold text-slate-900 mb-4">¿Cómo se calculan las vacaciones proporcionales en Chile en 2026?</h2>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    En la legislación laboral chilena, el derecho al descanso anual es irrenunciable. Conforme al <strong>artículo 67 del Código del Trabajo</strong>, todo trabajador con más de un año de servicio tiene derecho a un feriado anual de <strong>15 días hábiles</strong> con remuneración íntegra (20 días en la zona extrema del país).
                </p>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    Cuando el contrato de trabajo termina antes de cumplir la anualidad, o si existen días de descanso acumulados que no alcanzaron a tomarse, el <strong>artículo 73 del Código del Trabajo</strong> establece la obligación patronal de indemnizar dichos días en dinero dentro del finiquito.
                </p>
                
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 my-6">
                    <h3 class="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                        <span class="material-icons text-sky-500 text-base">functions</span> Regla Oficial de la Dirección del Trabajo (DT)
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-600 font-mono bg-white p-3 rounded-xl border border-slate-200 mb-3">
                        Días Hábiles = (Meses Trabajados × 1,25) + (Días de Fracción × 0,04167)
                    </p>
                    <ul class="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                        <li><strong>Factor Régimen General:</strong> 1,25 días hábiles por mes corrido completo (15 días / 12 meses).</li>
                        <li><strong>Factor Fracción Diaria:</strong> 0,04167 días hábiles por cada día adicional de contrato (1,25 / 30).</li>
                        <li><strong>Zona Extrema (Aysén, Magallanes y Palena):</strong> Factor mensual de <strong>1,67 días hábiles</strong> (20 días / 12 meses).</li>
                        <li><strong>Sueldo Diario:</strong> Sueldo Base mensual dividido por 30 (Art. 71 CT).</li>
                    </ul>
                </div>
            </div>

            <!-- Por qué se pagan los fines de semana (Inhábiles) -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">¿Por qué se suman los días sábados y domingos al finiquito?</h3>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    Uno de los errores más comunes cometidos por empleadores al liquidar finiquitos es pagar únicamente los días hábiles acumulados. La Dirección del Trabajo, mediante reiterados dictámenes (como el <strong>Dictamen N° 4535/209 y N° 581/15</strong>), ha establecido la <em>regla de la proyección del feriado en días corridos</em>.
                </p>
                <div class="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed space-y-2">
                    <p class="font-bold flex items-center gap-1.5 text-amber-900">
                        <span class="material-icons text-amber-600 text-base">gavel</span> Criterio Vinculante de la Dirección del Trabajo:
                    </p>
                    <p>
                        Para pagar el feriado proporcional, se debe situar al trabajador en el día siguiente hábil al término de su contrato de trabajo y computar correlativamente los días hábiles de vacaciones que le corresponden. <strong>Todos los días inhábiles (sábados, domingos y festivos) que queden comprendidos dentro de ese período ficticio de descanso deben sumarse y pagarse en el finiquito.</strong>
                    </p>
                </div>
            </div>

            <!-- Table: Quick Reference by Months -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">Tabla de Referencia Rápida de Vacaciones Proporcionales (Régimen General)</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-4">Estimación basada en jornada de lunes a viernes con sueldo mínimo ($553.553 CLP - $18.452 diario):</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl mb-6">
                    <table class="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <th class="p-3.5">Tiempo Trabajado</th>
                                <th class="p-3.5 text-slate-800">Días Hábiles</th>
                                <th class="p-3.5 text-amber-700">Inhábiles Aprox.</th>
                                <th class="p-3.5 text-sky-600">Total Días Corridos</th>
                                <th class="p-3.5 text-emerald-600">Monto Aprox. (Mínimo)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-mono">
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800 font-sans">1 Mes</td>
                                <td class="p-3.5 text-slate-700">1,25 días</td>
                                <td class="p-3.5 text-amber-700">+0 días</td>
                                <td class="p-3.5 text-sky-600 font-bold">1,25 días</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$23.065</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800 font-sans">3 Meses</td>
                                <td class="p-3.5 text-slate-700">3,75 días</td>
                                <td class="p-3.5 text-amber-700">+1 día</td>
                                <td class="p-3.5 text-sky-600 font-bold">4,75 días</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$87.647</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800 font-sans">6 Meses</td>
                                <td class="p-3.5 text-slate-700">7,50 días</td>
                                <td class="p-3.5 text-amber-700">+3 días</td>
                                <td class="p-3.5 text-sky-600 font-bold">10,50 días</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$193.746</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800 font-sans">9 Meses</td>
                                <td class="p-3.5 text-slate-700">11,25 días</td>
                                <td class="p-3.5 text-amber-700">+4 días</td>
                                <td class="p-3.5 text-sky-600 font-bold">15,25 días</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$281.393</td>
                            </tr>
                            <tr>
                                <td class="p-3.5 font-bold text-slate-800 font-sans">12 Meses (1 Año)</td>
                                <td class="p-3.5 text-slate-700">15,00 días</td>
                                <td class="p-3.5 text-amber-700">+6 días</td>
                                <td class="p-3.5 text-sky-600 font-bold">21,00 días</td>
                                <td class="p-3.5 text-emerald-600 font-bold">$387.492</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Preguntas Frecuentes Didácticas -->
            <div class="space-y-4">
                <h3 class="text-xl font-bold text-slate-900">Preguntas Frecuentes sobre Vacaciones Proporcionales</h3>
                
                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <h4 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span class="material-icons text-sky-500 text-base">help_outline</span> ¿Las vacaciones proporcionales descuentan AFP y Fonasa?
                    </h4>
                    <p class="text-xs sm:text-sm text-slate-600">
                        No. La indemnización por feriado proporcional tiene carácter indemnizatorio e indemniza el descanso no gozado. El <strong>Dictamen DT N° 2399/112</strong> y la Superintendencia de Pensiones ratifican que no constituye remuneración imponible, por lo que <strong>no se le descuenta AFP, Salud ni AFC</strong>. Solo está afecta al Impuesto Único de Segunda Categoría si sobrepasa los tramos exentos en conjunto con la liquidación del mes.
                    </p>
                </div>

                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <h4 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span class="material-icons text-sky-500 text-base">help_outline</span> ¿Me pagan las vacaciones si renuncio voluntariamente?
                    </h4>
                    <p class="text-xs sm:text-sm text-slate-600">
                        Sí, de manera obligatoria. El feriado proporcional es un derecho adquirido e irrenunciable. Independientemente de si la relación laboral terminó por renuncia voluntaria, despido disciplinario (Art. 160), despido por necesidades de la empresa (Art. 161) o mutuo acuerdo, el empleador debe pagar la totalidad de los días devengados.
                    </p>
                </div>

                <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <h4 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span class="material-icons text-sky-500 text-base">help_outline</span> ¿Prescriben las vacaciones acumuladas si no me las tomé?
                    </h4>
                    <p class="text-xs sm:text-sm text-slate-600">
                        El Código del Trabajo permite acumular un máximo de 2 períodos consecutivos antes de que el empleador esté obligado a otorgar el descanso. Al momento del finiquito, los tribunales y la Dirección del Trabajo exigen el pago de todos los períodos adeudados pendientes dentro del plazo de prescripción laboral general (2 años desde que se hicieron exigibles según el Art. 510 CT).
                    </p>
                </div>
            </div>

        </article>
"""

VACACIONES_PROPORCIONALES_SCRIPTS = """
    <script>
        const CHILE_HOLIDAYS = [
            '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21', '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18', '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
            '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-21', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
            '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21', '2027-06-21', '2027-06-29', '2027-07-16', '2027-08-15', '2027-09-18', '2027-09-19', '2027-10-12', '2027-10-31', '2027-11-01', '2027-12-08', '2027-12-25'
        ];

        function formatVacCurrency(amount) {
            return '$ ' + Math.round(amount).toLocaleString('es-CL');
        }

        function parseVacCurrency(str) {
            if (!str) return 0;
            return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
        }

        function formatVacInput(input) {
            let val = parseVacCurrency(input.value);
            input.value = formatVacCurrency(val);
        }

        function setVacSueldoMinimo() {
            var el = document.getElementById('vac-sueldo-base');
            if (el) {
                el.value = '$ 553.553';
                calculateVacaciones();
            }
        }

        function setVacRangeMonths(months) {
            var end = new Date();
            var start = new Date();
            start.setMonth(start.getMonth() - months);

            var endStr = end.toISOString().split('T')[0];
            var startStr = start.toISOString().split('T')[0];

            var inStart = document.getElementById('vac-fecha-inicio');
            var inEnd = document.getElementById('vac-fecha-termino');
            if (inStart && inEnd) {
                inStart.value = startStr;
                inEnd.value = endStr;
                calculateVacaciones();
            }
        }

        function calculateVacaciones() {
            var inStart = document.getElementById('vac-fecha-inicio');
            var inEnd = document.getElementById('vac-fecha-termino');
            if (!inStart || !inEnd) return;

            var startStr = inStart.value;
            var endStr = inEnd.value;
            if (!startStr || !endStr) return;

            var partsS = startStr.split('-').map(Number);
            var partsE = endStr.split('-').map(Number);
            var startDate = new Date(partsS[0], partsS[1] - 1, partsS[2]);
            var endDate = new Date(partsE[0], partsE[1] - 1, partsE[2]);

            var sueldoBase = parseVacCurrency(document.getElementById('vac-sueldo-base').value) || 0;
            var diasTomados = parseFloat(document.getElementById('vac-dias-tomados').value) || 0;
            var diasProgresivos = parseFloat(document.getElementById('vac-dias-progresivos')?.value || 0) || 0;
            var regimen = document.querySelector('input[name="vac-regimen"]:checked')?.value || 'general';
            var jornada = document.querySelector('input[name="vac-jornada"]:checked')?.value || '5';

            if (endDate <= startDate) {
                document.getElementById('vac-monto-total').textContent = '$ 0';
                document.getElementById('vac-habiles-netos').textContent = '0.00';
                document.getElementById('vac-inhabiles-proyectados').textContent = '+0.00';
                document.getElementById('vac-total-dias').textContent = '0.00';
                document.getElementById('vac-tiempo-computable').textContent = 'La fecha de término debe ser posterior a la de inicio';
                document.getElementById('vac-breakdown-total').textContent = '$ 0';
                return;
            }

            // Days difference inclusive
            var diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            var monthsWorked = Math.floor(diffDays / 30);
            var remDaysWorked = diffDays % 30;

            var factorMensual = (regimen === 'extrema') ? (20.0 / 12.0) : 1.25;
            var factorDiario = factorMensual / 30.0;

            var habilesBrutos = (monthsWorked * factorMensual) + (remDaysWorked * factorDiario) + diasProgresivos;
            var habilesNetos = Math.max(0, habilesBrutos - diasTomados);

            // DT Projection: project habilesNetos forward from the day following termination
            var inhabilesCount = 0;
            var habilesRemaining = habilesNetos;
            var curr = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            curr.setDate(curr.getDate() + 1);

            var iterations = 0;
            while (habilesRemaining > 0 && iterations < 180) {
                iterations++;
                var dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
                var isSat = (dayOfWeek === 6);
                var isSun = (dayOfWeek === 0);
                
                var mm = String(curr.getMonth() + 1).padStart(2, '0');
                var dd = String(curr.getDate()).padStart(2, '0');
                var dateKey = curr.getFullYear() + '-' + mm + '-' + dd;
                var isHoliday = CHILE_HOLIDAYS.includes(dateKey);

                var isWorkDay = true;
                if (jornada === '5') {
                    if (isSat || isSun || isHoliday) isWorkDay = false;
                } else {
                    if (isSun || isHoliday) isWorkDay = false;
                }

                if (isWorkDay) {
                    if (habilesRemaining >= 1.0) {
                        habilesRemaining -= 1.0;
                    } else {
                        // fraction
                        habilesRemaining = 0;
                    }
                } else {
                    inhabilesCount += 1.0;
                }
                curr.setDate(curr.getDate() + 1);
            }

            var totalDiasLiquidables = habilesNetos + inhabilesCount;
            var sueldoDiario = sueldoBase / 30.0;
            var totalMonto = Math.round(totalDiasLiquidables * sueldoDiario);

            // Update DOM
            document.getElementById('vac-monto-total').textContent = formatVacCurrency(totalMonto);
            document.getElementById('vac-habiles-netos').textContent = habilesNetos.toFixed(2);
            document.getElementById('vac-inhabiles-proyectados').textContent = '+' + inhabilesCount.toFixed(2);
            document.getElementById('vac-total-dias').textContent = totalDiasLiquidables.toFixed(2);

            document.getElementById('vac-tiempo-computable').textContent = monthsWorked + ' meses y ' + remDaysWorked + ' días';
            document.getElementById('vac-habiles-devengados').textContent = habilesBrutos.toFixed(2) + ' días';
            document.getElementById('vac-dias-tomados-res').textContent = '-' + diasTomados.toFixed(1) + ' días';
            document.getElementById('vac-sueldo-diario').textContent = formatVacCurrency(sueldoDiario) + ' / día';
            document.getElementById('vac-proyeccion-detalle').textContent = inhabilesCount.toFixed(0) + ' días inhábiles proyectados (DT)';
            document.getElementById('vac-breakdown-total').textContent = formatVacCurrency(totalMonto);
        }

        function copyVacResults() {
            var total = document.getElementById('vac-monto-total').textContent;
            var netos = document.getElementById('vac-habiles-netos').textContent;
            var inhab = document.getElementById('vac-inhabiles-proyectados').textContent;
            var dias = document.getElementById('vac-total-dias').textContent;
            var tiempo = document.getElementById('vac-tiempo-computable').textContent;

            var lines = [
                "RESUMEN DE VACACIONES PROPORCIONALES (calculolaboral.cl)",
                "Tiempo computable: " + tiempo,
                "Días hábiles netos: " + netos + " días",
                "Inhábiles proyectados (DT): " + inhab + " días",
                "Total días corridos a pagar: " + dias + " días",
                "TOTAL A PAGAR EN FINIQUITO: " + total,
                "Calculado gratis según normativa DT en https://calculolaboral.cl/calculadora-vacaciones-proporcionales"
            ];
            var txt = lines.join(String.fromCharCode(10));

            navigator.clipboard.writeText(txt).then(function() {
                var btnText = document.getElementById('vac-copy-text');
                if (btnText) {
                    btnText.textContent = '¡Copiado!';
                    setTimeout(function() { btnText.textContent = 'Copiar Resumen'; }, 2000);
                }
            });
        }

        function shareVacWhatsApp() {
            var total = document.getElementById('vac-monto-total').textContent;
            var dias = document.getElementById('vac-total-dias').textContent;
            var lines = [
                "Calculé mis Vacaciones Proporcionales en Cálculo Laboral:",
                "Total a pagar en finiquito: " + total + " (" + dias + " días corridos según DT).",
                "Revisa el tuyo gratis aquí: https://calculolaboral.cl/calculadora-vacaciones-proporcionales"
            ];
            var msg = encodeURIComponent(lines.join(String.fromCharCode(10)));
            window.open("https://api.whatsapp.com/send?text=" + msg, "_blank");
        }

        function initVacaciones() {
            var now = new Date();
            var past = new Date();
            past.setFullYear(now.getFullYear() - 1);

            var inStart = document.getElementById('vac-fecha-inicio');
            var inEnd = document.getElementById('vac-fecha-termino');
            if (inStart && inEnd) {
                if (!inStart.value) inStart.value = past.toISOString().split('T')[0];
                if (!inEnd.value) inEnd.value = now.toISOString().split('T')[0];
            }
            calculateVacaciones();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initVacaciones);
        } else {
            initVacaciones();
        }
    </script>
"""

DESPIDO_ART160_CONTENT = """
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
            <a href="./" class="hover:text-sky-500 transition-colors font-medium">Inicio</a>
            <span class="material-icons text-xs">chevron_right</span>
            <span class="text-slate-600 font-semibold">Calculadora Despido Art. 160</span>
        </nav>

        <!-- Hero Header Section -->
        <div class="text-center my-8 max-w-2xl mx-auto no-print">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 mb-3">
                <span class="material-icons text-xs text-amber-700">gavel</span> Art. 160 & 168 letra c • Código del Trabajo
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
                Calculadora de Finiquito por Despido Art. 160 y Demanda Laboral
            </h1>
            <p class="text-slate-500 text-sm mt-1">
                ¿Te despidieron por el Artículo 160? Tus <strong>días trabajados y vacaciones son irrenunciables</strong> (a pagar en 10 días). Además, si la causal es infundada, simula cuánto puedes ganar en tribunales con el <strong>recargo legal del 50% al 100%</strong>.
            </p>
        </div>

        <!-- Two Column Interactive Layout (440px Inputs Left, Flexible Results Right) -->
        <div class="flex flex-col lg:flex-row gap-8 items-start mb-16">
            
            <!-- Left Column: Form Controls (440px Fixed) -->
            <div class="w-full lg:w-[440px] shrink-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span class="material-icons text-amber-600">assignment_late</span> Datos de tu despido
                    </h2>
                    <span class="text-[11px] font-mono text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Plazo Pago: 10 Días</span>
                </div>

                <!-- 1. Causal Invocada del Art. 160 -->
                <div>
                    <label for="art160-causal" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Causal Invocada en la Carta de Despido
                    </label>
                    <select id="art160-causal" onchange="updateCausalAdvice(); calculateArt160();" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                        <option value="7" selected>Art. 160 N° 7: Incumplimiento grave de las obligaciones</option>
                        <option value="1">Art. 160 N° 1: Falta de probidad, acoso o conductas inmorales</option>
                        <option value="3">Art. 160 N° 3: No concurrencia al trabajo (inasistencias)</option>
                        <option value="4">Art. 160 N° 4: Abandono del trabajo o negativa a laborar</option>
                        <option value="5">Art. 160 N° 5: Actos u omisiones temerarias que afecten seguridad</option>
                        <option value="6">Art. 160 N° 6: Daño material intencional a maquinarias/bienes</option>
                        <option value="2">Art. 160 N° 2: Negociaciones incompatibles con el giro</option>
                    </select>
                    
                    <!-- Contextual Legal Badge / Advice -->
                    <div id="art160-causal-alert" class="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
                        <span class="font-bold block mb-0.5">⚠️ Sobre el Art. 160 N° 7 (Incumplimiento Grave):</span>
                        Es la causal más utilizada y la que con mayor frecuencia declaran injustificada los tribunales chilenos. El empleador debe probar la gravedad extrema del hecho; de lo contrario, debe pagar todas las indemnizaciones con recargo judicial.
                    </div>
                </div>

                <!-- 2. Fechas de Contrato (Antigüedad) -->
                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="art160-fecha-inicio" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Fecha de Ingreso
                            </label>
                            <input type="date" id="art160-fecha-inicio" onchange="calculateArt160()" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                        </div>
                        <div>
                            <label for="art160-fecha-termino" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Fecha de Despido
                            </label>
                            <input type="date" id="art160-fecha-termino" onchange="calculateArt160()" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                        </div>
                    </div>
                </div>

                <!-- 3. Última Remuneración Mensual Devengada -->
                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label for="art160-sueldo" class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Última Remuneración Mensual Devengada
                        </label>
                        <button type="button" onclick="setArt160Minimo()" class="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer active:scale-95">
                            Usar Mínimo ($553.553)
                        </button>
                    </div>
                    <div class="relative rounded-2xl shadow-sm">
                        <input type="text" id="art160-sueldo" value="$ 850.000" inputmode="numeric" pattern="[0-9]*" autocomplete="off" oninput="formatArt160Input(this); calculateArt160();" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all">
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Sueldo base + gratificación + comisiones promedio (tope legal 90 UF: ~$3.680.000).</p>
                </div>

                <!-- 4. Días trabajados del mes y Días de Vacaciones Pendientes -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                        <label for="art160-dias-mes" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Días trabajados del mes
                        </label>
                        <input type="number" id="art160-dias-mes" value="15" min="1" max="30" oninput="calculateArt160()" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                        <span class="text-[10px] text-slate-400 mt-1 block">Días del mes de término</span>
                    </div>
                    <div>
                        <label for="art160-dias-vac" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Vacaciones Pendientes
                        </label>
                        <input type="number" id="art160-dias-vac" value="8" min="0" step="0.5" oninput="calculateArt160()" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                        <span class="text-[10px] text-slate-400 mt-1 block">Días hábiles acumulados</span>
                    </div>
                </div>

                <!-- 5. Recargo Judicial por Demanda (Art. 168 letra c) -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Recargo Judicial Estimado (Art. 168 c)
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="art160-recargo" value="50" onchange="calculateArt160()" class="peer sr-only">
                            <div class="p-2.5 text-center border border-slate-200 rounded-xl peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-800 font-bold text-xs hover:bg-slate-50 transition-all">
                                50% <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-amber-700">Mínimo legal</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="art160-recargo" value="80" checked onchange="calculateArt160()" class="peer sr-only">
                            <div class="p-2.5 text-center border border-slate-200 rounded-xl peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-800 font-bold text-xs hover:bg-slate-50 transition-all">
                                80% <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-amber-700">Promedio DT</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="art160-recargo" value="100" onchange="calculateArt160()" class="peer sr-only">
                            <div class="p-2.5 text-center border border-slate-200 rounded-xl peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-800 font-bold text-xs hover:bg-slate-50 transition-all">
                                100% <span class="block text-[10px] font-normal text-slate-400 peer-checked:text-amber-700">Máximo legal</span>
                            </div>
                        </label>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">El recargo legal para despidos Art. 160 injustificados va del 50% al 100% según el juez.</p>
                </div>

            </div>

            <!-- Right Column: Results & Lawsuit Simulator (Flexible) -->
            <div class="flex-1 w-full space-y-6">
                
                <!-- CARD 1: Pago Obligatorio Inmediato (Derechos Irrenunciables) -->
                <div class="bg-white border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <div class="flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">1</span>
                            <h3 class="text-base sm:text-lg font-bold text-slate-900">
                                Finiquito Obligatorio Inmediato (Derechos Irrenunciables)
                            </h3>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Plazo Legal: 10 Días Hábiles
                        </span>
                    </div>

                    <div class="my-4 p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                        <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">Total Mínimo a Cobrar Sí o Sí</span>
                        <div class="flex items-baseline gap-2">
                            <span id="art160-monto-inmediato" class="text-3xl sm:text-4xl font-extrabold text-emerald-700 font-mono tracking-tight">$ 0</span>
                        </div>
                        <p class="text-xs text-emerald-900/80 mt-2 leading-relaxed">
                            <strong>Aunque te despidan por el Art. 160, el empleador NO puede quitarte este dinero.</strong> Son remuneraciones ya devengadas y descanso acumulado que deben pagarse ante notario o en Mi DT (Art. 177).
                        </p>
                    </div>

                    <!-- Desglose de derechos inmediatos -->
                    <div class="space-y-2 text-xs divide-y divide-slate-100">
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-600">Días trabajados del mes (<span id="art160-lbl-dias-mes">15</span> días):</span>
                            <span class="font-mono font-bold text-slate-800" id="art160-subtotal-mes">$ 0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Vacaciones proporcionales y pendientes (<span id="art160-lbl-dias-vac">8</span> días):</span>
                            <span class="font-mono font-bold text-slate-800" id="art160-subtotal-vac">$ 0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 text-slate-400">
                            <span>Indemnización por Años de Servicio:</span>
                            <span class="font-mono">$ 0 (Sin derecho por Art. 160)</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 text-slate-400">
                            <span>Indemnización Sustitutiva de Aviso Previo:</span>
                            <span class="font-mono">$ 0 (Sin derecho por Art. 160)</span>
                        </div>
                    </div>
                </div>

                <!-- CARD 2: Simulador de Demanda Judicial con Recargo (Art. 168 c) -->
                <div class="bg-white border-2 border-sky-500/40 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <div class="flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">2</span>
                            <h3 class="text-base sm:text-lg font-bold text-slate-900">
                                Si demandas por Despido Injustificado (Art. 168 letra c)
                            </h3>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                            Tribunales del Trabajo
                        </span>
                    </div>

                    <div class="my-4 p-5 rounded-2xl bg-sky-50/70 border border-sky-200">
                        <span class="text-xs font-bold text-sky-800 uppercase tracking-wider block mb-1">Monto Adicional Recuperable en Juicio</span>
                        <div class="flex items-baseline gap-2">
                            <span id="art160-monto-demanda" class="text-3xl sm:text-4xl font-extrabold text-sky-700 font-mono tracking-tight">$ 0</span>
                        </div>
                        <p class="text-xs text-sky-950/80 mt-2 leading-relaxed">
                            Si el empleador no prueba fehacientemente la gravedad de la falta ante el juez, el despido se declara <strong>injustificado o improcedente</strong>, obligándolo a pagar tus años de servicio y aviso previo con un <strong>recargo especial del 50% al 100%</strong>.
                        </p>
                    </div>

                    <!-- Desglose de demanda -->
                    <div class="space-y-2 text-xs divide-y divide-slate-100">
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-600">Años de servicio computables (<span id="art160-lbl-anios">0</span> años):</span>
                            <span class="font-mono font-bold text-slate-800" id="art160-subtotal-ias">$ 0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Aviso previo (1 mes de remuneración):</span>
                            <span class="font-mono font-bold text-slate-800" id="art160-subtotal-aviso">$ 0</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <span class="text-slate-600">Recargo legal judicial (<span id="art160-lbl-recargo-pct">80%</span> sobre Años de Servicio):</span>
                            <span class="font-mono font-bold text-amber-600 text-sm" id="art160-subtotal-recargo">$ 0</span>
                        </div>
                        <div class="flex justify-between items-center pt-3 font-bold text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span class="text-slate-900">Total Potencial Acumulado (Inmediato + Demanda):</span>
                            <span class="font-mono text-sky-600 text-base" id="art160-gran-total">$ 0</span>
                        </div>
                    </div>
                </div>

                <!-- CARD 3: Formulario de Evaluación de Carta de Despido -->
                <div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 shadow-sm relative overflow-hidden">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="material-icons text-amber-600 text-lg">gavel</span>
                        <h4 class="text-base sm:text-lg font-bold text-slate-900">
                            ¿Quieres que un abogado laboralista revise tu carta de despido?
                        </h4>
                    </div>
                    <p class="text-xs text-slate-600 mb-4 leading-relaxed">
                        En despidos por el Art. 160, la redacción de la carta de despido es decisiva. Si el empleador fue vago o no detalló los hechos con fecha y hora exactas, el juicio se gana prácticamente de inmediato.
                    </p>

                    <form id="art160-lead-form" onsubmit="enviarLeadArt160(event)" class="space-y-3">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Nombre y Apellido *</label>
                                <input type="text" id="art160-lead-nombre" name="nombre" required placeholder="Ej: Roberto Muñoz" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Correo Electrónico *</label>
                                <input type="email" id="art160-lead-correo" name="correo" required placeholder="roberto@correo.com" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">WhatsApp / Teléfono *</label>
                                <input type="tel" id="art160-lead-telefono" name="telefono" required placeholder="+56 9 8765 4321" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Fecha de la carta o finiquito</label>
                                <input type="text" id="art160-lead-detalle" name="detalle" placeholder="Ej: Recibí la carta ayer, aún no firmo" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-800">
                            </div>
                        </div>

                        <div class="pt-1">
                            <label class="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                                <input type="checkbox" id="art160-lead-consent" name="privacy_consent" required class="w-3.5 h-3.5 mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer">
                                <span>Acepto la <a href="/privacidad" target="_blank" class="underline font-semibold text-slate-800 hover:text-amber-600">Política de Privacidad</a> y autorizo expresamente el tratamiento de mis antecedentes y su remisión a abogados laborales colaboradores para la evaluación de mi caso.</span>
                            </label>
                        </div>

                        <div class="pt-1 flex flex-col sm:flex-row items-center gap-3">
                            <button type="submit" id="art160-lead-btn"
                                style="background-color: #d97706 !important; color: #ffffff !important; display: inline-flex !important; box-shadow: 0 4px 14px 0 rgba(217, 119, 6, 0.35) !important;"
                                class="w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-amber-700">
                                <span class="material-icons text-sm" style="color: #ffffff !important;">send</span>
                                <span style="color: #ffffff !important; font-weight: 700;">Solicitar Revisión de Carta</span>
                            </button>
                            <span class="text-[11px] text-slate-500">Evaluación confidencial • Respuesta en menos de 24 hrs hábiles</span>
                        </div>
                    </form>

                    <div id="art160-lead-success" class="hidden p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                        <div class="flex items-center gap-2 font-bold text-emerald-800 mb-1">
                            <span class="material-icons text-emerald-600 text-base">check_circle</span> Solicitud enviada exitosamente
                        </div>
                        <p>Tus antecedentes han sido remitidos de forma segura a nuestro equipo de abogados laborales colaboradores. Te contactaremos a la brevedad por WhatsApp o correo.</p>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="pt-2 flex flex-col sm:flex-row gap-3">
                    <button type="button" onclick="copyArt160Results()" id="art160-copy-btn" class="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <span class="material-icons text-sm">content_copy</span> <span id="art160-copy-text">Copiar Resumen Completo</span>
                    </button>
                    <button type="button" onclick="shareArt160WhatsApp()" class="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer">
                        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.882 2.796.883 3.18 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.77-5.768-5.77zm3.394 8.204c-.146.415-.85.766-1.177.812-.328.047-.751.066-2.197-.533-1.848-.767-3.04-2.646-3.133-2.769-.092-.122-.743-.99-.743-1.89 0-.899.469-1.343.636-1.527.167-.184.364-.23.486-.23.121 0 .243.002.348.007.111.005.259-.042.404.307.149.358.508 1.238.552 1.329.045.091.076.197.015.318-.061.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.471.777 1.01 1.258.694.619 1.28.81 1.462.901.182.091.289.076.395-.046.106-.122.456-.532.577-.714.122-.182.243-.152.408-.091.167.061 1.062.5 1.244.591.182.091.304.137.348.213.045.076.045.441-.101.856zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.442 5.176L2 22l4.98-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        Compartir en WhatsApp
                    </button>
                    <a href="despido-necesidades-empresa-articulo-161" class="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-center shadow-md shadow-sky-500/10 active:scale-95">
                        <span class="material-icons text-sm">help_outline</span> Ver Art. 161
                    </a>
                </div>

            </div>
        </div>

        <!-- Explanatory SEO Content Section -->
        <article class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8 max-w-4xl mx-auto">
            
            <div>
                <h2 class="text-2xl font-bold text-slate-900 mb-4">¿Qué es el despido por el Artículo 160 del Código del Trabajo?</h2>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    El <strong>Artículo 160 del Código del Trabajo</strong> agrupa las causales de despido disciplinario o imputables a la conducta del trabajador. Cuando un empleador invoca esta causal, pretende dar término al contrato <strong>sin derecho a indemnización por años de servicio ni a indemnización sustitutiva del aviso previo</strong>.
                </p>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                    Sin embargo, en Chile el legislador laboral protegió de forma estricta los derechos de los trabajadores mediante dos salvaguardas esenciales:
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                    <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                        <h4 class="font-bold text-emerald-900 text-sm mb-1 flex items-center gap-1.5">
                            <span class="material-icons text-emerald-600 text-base">check_circle</span> Derechos Irrenunciables
                        </h4>
                        <p class="text-xs text-slate-600">
                            Los días trabajados del mes en curso y las vacaciones proporcionales y acumuladas son propiedad del trabajador. El empleador está obligado por ley a pagarlos en un plazo fatal de 10 días hábiles (Art. 177 CT).
                        </p>
                    </div>
                    <div class="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
                        <h4 class="font-bold text-sky-900 text-sm mb-1 flex items-center gap-1.5">
                            <span class="material-icons text-sky-600 text-base">gavel</span> La Carga de la Prueba
                        </h4>
                        <p class="text-xs text-slate-600">
                            En tribunales laborales, el empleador está obligado a probar con pruebas contundentes y testigos cada hecho de la carta. No bastan sospechas ni acusaciones genéricas.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Las 7 Causales del Art. 160 Explicadas -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-4">Las 7 Causales de Despido del Artículo 160</h3>
                <div class="space-y-3 text-xs sm:text-sm">
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 1. Conductas indebidas graves y debidamente comprobadas</h4>
                        <p class="text-slate-600">Incluye falta de probidad en el desempeño de funciones, conductas de acoso sexual, acoso laboral o agresiones verbales y físicas contra el empleador o compañeros de trabajo.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 2. Negociaciones que ejecute el trabajador dentro del giro</h4>
                        <p class="text-slate-600">Aplica únicamente si las negociaciones fueron expresamente prohibidas por escrito en el contrato de trabajo individual.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 3. No concurrencia del trabajador a sus labores sin causa justificada</h4>
                        <p class="text-slate-600">Exige faltar dos días seguidos, dos lunes en el mes o tres días en total durante el mes calendario. Si tenías licencia médica o causa de fuerza mayor debidamente comunicada, el despido es injustificado.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 4. Abandono del trabajo</h4>
                        <p class="text-slate-600">Salida intempestiva e injustificada del sitio de la faena durante las horas de trabajo o la negativa a trabajar en las faenas convenidas sin causa legal.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 5. Actos, omisiones o imprudencias temerarias</h4>
                        <p class="text-slate-600">Que afecten a la seguridad o al funcionamiento del establecimiento, o a la salud de los trabajadores.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 6. El perjuicio material causado intencionalmente</h4>
                        <p class="text-slate-600">En las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías.</p>
                    </div>
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <h4 class="font-bold text-slate-900 mb-1">N° 7. Incumplimiento grave de las obligaciones del contrato</h4>
                        <p class="text-slate-600">La causal más invocada en Chile. Los jueces laborales exigen una <em>gravedad calificada</em> que haga insostenible la mantención de la relación laboral. Las faltas menores o amonestaciones previas no bastan.</p>
                    </div>
                </div>
            </div>

            <!-- Cómo poner la Reserva de Derechos -->
            <div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">¿Cómo firmar el finiquito para no perder el derecho a demandar?</h3>
                <p class="text-slate-600 text-sm sm:text-base leading-relaxed mb-3">
                    Conforme al <strong>artículo 177 del Código del Trabajo</strong> (modificado por la Ley N° 21.361), tienes el derecho legal de estampar una <strong>reserva de derechos</strong> de tu puño y letra antes de firmar ante notario o al ratificar en el portal de la Dirección del Trabajo (Mi DT).
                </p>
                <div class="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs sm:text-sm leading-relaxed mb-3">
                    "Me reservo el derecho a demandar despido injustificado e improcedente conforme al Art. 168 del Código del Trabajo, recargos legales, restitución de prestaciones y cobro de indemnizaciones adeudadas."
                </div>
                <p class="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    <strong>Importante:</strong> El notario o ministro de fe no puede negarse a registrar la reserva, y el empleador está legalmente forzado a pagar de inmediato los montos de vacaciones y días trabajados reconocidos.
                </p>
            </div>

            <!-- Plazos Legales -->
            <div class="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed space-y-2">
                <h4 class="font-bold flex items-center gap-1.5 text-amber-900">
                    <span class="material-icons text-amber-600 text-base">alarm</span> Plazos fatales para demandar:
                </h4>
                <p>
                    Tienes un plazo de <strong>60 días hábiles judiciales</strong> desde la separación para interponer la demanda por despido injustificado. Si antes ingresas un reclamo administrativo ante la Inspección del Trabajo, el plazo se suspende, con un tope máximo total de <strong>90 días hábiles</strong>.
                </p>
            </div>

        </article>
"""

DESPIDO_ART160_SCRIPTS = """
    <script>
        function formatArt160Currency(amount) {
            return '$ ' + Math.round(amount).toLocaleString('es-CL');
        }

        function parseArt160Currency(str) {
            if (!str) return 0;
            return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
        }

        function formatArt160Input(input) {
            let val = parseArt160Currency(input.value);
            input.value = formatArt160Currency(val);
        }

        function setArt160Minimo() {
            var el = document.getElementById('art160-sueldo');
            if (el) {
                el.value = '$ 553.553';
                calculateArt160();
            }
        }

        function updateCausalAdvice() {
            var causal = document.getElementById('art160-causal').value;
            var box = document.getElementById('art160-causal-alert');
            if (!box) return;

            if (causal === '7') {
                box.innerHTML = '<span class="font-bold block mb-0.5">⚠️ Sobre el Art. 160 N° 7 (Incumplimiento Grave):</span>' +
                                'Es la causal más utilizada en Chile y la que con mayor frecuencia declaran injustificada los tribunales. El empleador debe probar la gravedad extrema del hecho; de lo contrario, el despido es calificado como improcedente con recargo legal.';
            } else if (causal === '3') {
                box.innerHTML = '<span class="font-bold block mb-0.5">⚠️ Sobre el Art. 160 N° 3 (Inasistencias):</span>' +
                                'El empleador debe acreditar que las ausencias fueron sin causa justificada. Si tenías reposo médico, fuerza mayor o diste aviso oportuno, la demanda por despido injustificado se gana con alta probabilidad.';
            } else if (causal === '1') {
                box.innerHTML = '<span class="font-bold block mb-0.5">⚠️ Sobre el Art. 160 N° 1 (Falta de Probidad / Acoso):</span>' +
                                'Es una acusación gravísima que daña tu honra. La ley exige que el hecho esté debidamente comprobado con una investigación formal y pruebas irrefutables. Si no las tienen, puedes demandar indemnizaciones y tutela laboral.';
            } else {
                box.innerHTML = '<span class="font-bold block mb-0.5">⚠️ Carga de la prueba en Art. 160:</span>' +
                                'Cualquiera sea la causal invocada, el empleador tiene la obligación legal de probar los hechos ante el tribunal. Si la carta es ambigua o no tiene sustento probatorio, tienes derecho al cobro total con recargo.';
            }
        }

        function calculateArt160() {
            var inStart = document.getElementById('art160-fecha-inicio');
            var inEnd = document.getElementById('art160-fecha-termino');
            if (!inStart || !inEnd) return;

            var startStr = inStart.value;
            var endStr = inEnd.value;
            if (!startStr || !endStr) return;

            var partsS = startStr.split('-').map(Number);
            var partsE = endStr.split('-').map(Number);
            var startDate = new Date(partsS[0], partsS[1] - 1, partsS[2]);
            var endDate = new Date(partsE[0], partsE[1] - 1, partsE[2]);

            var sueldoMensual = parseArt160Currency(document.getElementById('art160-sueldo').value) || 0;
            var diasMes = parseInt(document.getElementById('art160-dias-mes').value, 10) || 0;
            var diasVac = parseFloat(document.getElementById('art160-dias-vac').value) || 0;
            var recargoPct = parseInt(document.querySelector('input[name="art160-recargo"]:checked')?.value || '80', 10);

            var sueldoDiario = sueldoMensual / 30.0;

            // 1. Inmediato Obligatorio
            var subtotalMes = Math.round(diasMes * sueldoDiario);
            var subtotalVac = Math.round(diasVac * sueldoDiario);
            var totalInmediato = subtotalMes + subtotalVac;

            // 2. Demanda Judicial (Art. 168 c)
            // Años de servicio: 1 mes por año y fracción superior a 6 meses, tope 11 años
            var totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
            var rawYears = Math.floor(totalDays / 365);
            var remDays = totalDays % 365;

            var computedYears = rawYears;
            if (remDays > 182) {
                computedYears += 1;
            }
            if (computedYears > 11) computedYears = 11;
            if (computedYears < 0) computedYears = 0;

            // Base para IAS tiene tope de 90 UF (aprox $3.680.000)
            var topeUF90 = 3680000;
            var baseIAS = Math.min(sueldoMensual, topeUF90);

            var subtotalIAS = (computedYears >= 1) ? Math.round(computedYears * baseIAS) : 0;
            var subtotalAviso = Math.round(baseIAS);
            var subtotalRecargo = Math.round(subtotalIAS * (recargoPct / 100.0));
            var totalDemanda = subtotalIAS + subtotalAviso + subtotalRecargo;

            var granTotal = totalInmediato + totalDemanda;

            // Update DOM
            document.getElementById('art160-monto-inmediato').textContent = formatArt160Currency(totalInmediato);
            document.getElementById('art160-lbl-dias-mes').textContent = diasMes;
            document.getElementById('art160-subtotal-mes').textContent = formatArt160Currency(subtotalMes);
            document.getElementById('art160-lbl-dias-vac').textContent = diasVac;
            document.getElementById('art160-subtotal-vac').textContent = formatArt160Currency(subtotalVac);

            document.getElementById('art160-monto-demanda').textContent = formatArt160Currency(totalDemanda);
            document.getElementById('art160-lbl-anios').textContent = computedYears;
            document.getElementById('art160-subtotal-ias').textContent = formatArt160Currency(subtotalIAS);
            document.getElementById('art160-subtotal-aviso').textContent = formatArt160Currency(subtotalAviso);
            document.getElementById('art160-lbl-recargo-pct').textContent = recargoPct + '%';
            document.getElementById('art160-subtotal-recargo').textContent = formatArt160Currency(subtotalRecargo);
            document.getElementById('art160-gran-total').textContent = formatArt160Currency(granTotal);
        }

        function copyArt160Results() {
            var inmediato = document.getElementById('art160-monto-inmediato').textContent;
            var demanda = document.getElementById('art160-monto-demanda').textContent;
            var total = document.getElementById('art160-gran-total').textContent;

            var lines = [
                "RESUMEN DESPIDO ART. 160 (calculolaboral.cl)",
                "1. Finiquito Obligatorio Inmediato (10 días): " + inmediato,
                "2. Demanda por Despido Injustificado (Art. 168 c): " + demanda,
                "POTENCIAL TOTAL RECUPERABLE: " + total,
                "Calcula tu caso gratis en: https://calculolaboral.cl/calculadora-despido-articulo-160"
            ];
            var txt = lines.join(String.fromCharCode(10));

            navigator.clipboard.writeText(txt).then(function() {
                var btn = document.getElementById('art160-copy-text');
                if (btn) {
                    btn.textContent = '¡Copiado!';
                    setTimeout(function() { btn.textContent = 'Copiar Resumen Completo'; }, 2000);
                }
            });
        }

        function shareArt160WhatsApp() {
            var inmediato = document.getElementById('art160-monto-inmediato').textContent;
            var demanda = document.getElementById('art160-monto-demanda').textContent;
            var lines = [
                "Simulé mi despido por el Art. 160 en Cálculo Laboral:",
                "- Finiquito obligatorio inmediato: " + inmediato,
                "- Monto recuperable en demanda con recargo: " + demanda,
                "Calcula el tuyo gratis aquí: https://calculolaboral.cl/calculadora-despido-articulo-160"
            ];
            var msg = encodeURIComponent(lines.join(String.fromCharCode(10)));
            window.open("https://api.whatsapp.com/send?text=" + msg, "_blank");
        }

        function enviarLeadArt160(event) {
            event.preventDefault();
            var form = document.getElementById('art160-lead-form');
            var btn = document.getElementById('art160-lead-btn');
            var success = document.getElementById('art160-lead-success');

            var nombre = document.getElementById('art160-lead-nombre').value.trim();
            var correo = document.getElementById('art160-lead-correo').value.trim();
            var telefono = document.getElementById('art160-lead-telefono').value.trim();
            var detalle = document.getElementById('art160-lead-detalle').value.trim();
            var consent = document.getElementById('art160-lead-consent').checked;

            if (!consent) {
                alert('Debes aceptar la Política de Privacidad para continuar.');
                return;
            }

            var causalText = document.getElementById('art160-causal').options[document.getElementById('art160-causal').selectedIndex].text;
            var infoCompleta = "Causal: " + causalText + " | Detalle: " + detalle;

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-icons text-sm animate-spin">autorenew</span> Enviando...';
            }

            fetch('/api/send-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    correo: correo,
                    telefono: telefono,
                    tipo: 'Despido Art. 160',
                    fuente: 'Calculadora Despido Art. 160',
                    detalle: infoCompleta
                })
            }).then(function(res) {
                if (res.ok) {
                    form.classList.add('hidden');
                    success.classList.remove('hidden');
                } else {
                    throw new Error('Error en el servidor');
                }
            }).catch(function() {
                alert('Hubo un inconveniente al enviar tu solicitud. Por favor intenta nuevamente o escríbenos a contacto@calculolaboral.cl');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-icons text-sm" style="color: #ffffff !important;">send</span> <span style="color: #ffffff !important; font-weight: 700;">Solicitar Revisión de Carta</span>';
                }
            });
        }

        function initArt160() {
            var now = new Date();
            var past = new Date();
            past.setFullYear(now.getFullYear() - 2);

            var inStart = document.getElementById('art160-fecha-inicio');
            var inEnd = document.getElementById('art160-fecha-termino');
            if (inStart && inEnd) {
                if (!inStart.value) inStart.value = past.toISOString().split('T')[0];
                if (!inEnd.value) inEnd.value = now.toISOString().split('T')[0];
            }
            updateCausalAdvice();
            calculateArt160();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initArt160);
        } else {
            initArt160();
        }
    </script>
"""

# Generate standalone custom calculators (Horas Extras & Part-Time)
def build_custom_calculator(filename, title, description, content_html, scripts_html):
    print(f"Generating: {filename}...")
    canonical_url, og_tags, json_ld = generate_seo_tags(filename, title, description, page_type="website")
    
    html_out = HTML_LAYOUT.format(
        title=title,
        description=description,
        canonical_url=canonical_url,
        og_tags=og_tags,
        json_ld=json_ld,
        custom_head="",
        header=HEADER_HTML,
        indicator_bar=INDICATOR_BAR_HTML,
        content=f'<div class="max-w-[1200px] mx-auto px-6">{content_html}</div>',
        footer=FOOTER_HTML,
        history_modal=HISTORY_MODAL_HTML,
        custom_scripts=scripts_html
    )
    
    dest_file = os.path.join(DEST_DIR, filename)
    with open(dest_file, "w", encoding="utf-8") as f:
        f.write(html_out)
    
    # Also sync compiled version to root directory
    root_file = os.path.join(SOURCE_DIR, filename)
    with open(root_file, "w", encoding="utf-8") as f:
        f.write(html_out)

build_custom_calculator(
    "calculadora-horas-extras.html",
    "Calculadora de Horas Extras Chile 2026: Valor Hora 50% y 100% (Ley 40 Horas DT)",
    "Calcula gratis el valor de tus horas extras en Chile con la Ley 40 Horas (42h en 2026). Hora 50% a $4.613 y 100% a $6.151 con sueldo mínimo. Fórmulas oficiales DT.",
    HORAS_EXTRAS_CONTENT,
    HORAS_EXTRAS_SCRIPTS
)

build_custom_calculator(
    "calculadora-sueldo-part-time.html",
    "Calculadora de Sueldo Part-Time Chile 2026 | 30h, 20h y Comisiones",
    "Calcula tu sueldo líquido part-time en Chile 2026 (30h, 20h o personalizado). Incluye comisiones, semana corrida, descuentos y protección de Gratuidad para estudiantes (Art. 40 bis).",
    PART_TIME_CONTENT,
    PART_TIME_SCRIPTS
)

build_custom_calculator(
    "calculadora-vacaciones-proporcionales.html",
    "Calculadora de Vacaciones Proporcionales Chile 2026: Días Hábiles y Pago DT",
    "Calcula gratis tus vacaciones proporcionales y días de feriado legal pendiente en Chile conforme al Art. 73 del Código del Trabajo y dictámenes DT. Conoce cuántos días hábiles, inhábiles y monto en dinero te corresponden.",
    VACACIONES_PROPORCIONALES_CONTENT,
    VACACIONES_PROPORCIONALES_SCRIPTS
)

build_custom_calculator(
    "calculadora-despido-articulo-160.html",
    "Calculadora de Finiquito por Despido Art. 160 Chile 2026: Derechos y Demanda",
    "Calcula cuánto te deben pagar en el finiquito por despido con Artículo 160. Derechos irrenunciables garantizados y simulador de demanda por despido injustificado con recargo legal del 50% al 100% (Art. 168 letra c).",
    DESPIDO_ART160_CONTENT,
    DESPIDO_ART160_SCRIPTS
)


# Generate vercel.json in DEST_DIR and in root directory
print("Generating: vercel.json...")
vercel_json_content = """{
  "cleanUrls": true,
  "redirects": [
    { "source": "/index.html", "destination": "/", "permanent": true },
    { "source": "/:page.html", "destination": "/:page", "permanent": true }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://challenges.cloudflare.com 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://mindicador.cl https://www.google-analytics.com https://*.analytics.google.com https://formsubmit.co https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'; form-action 'self' https://formsubmit.co; base-uri 'self'; object-src 'none'; upgrade-insecure-requests"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/js/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}"""

with open(os.path.join(DEST_DIR, "vercel.json"), "w", encoding="utf-8") as f:
    f.write(vercel_json_content)
with open(os.path.join(SOURCE_DIR, "vercel.json"), "w", encoding="utf-8") as f:
    f.write(vercel_json_content)

# Copy Articulos, js, and assets folders to DEST_DIR
import shutil

def copy_dir_clean(src_name):
    src_path = os.path.join(SOURCE_DIR, src_name)
    dest_path = os.path.join(DEST_DIR, src_name)
    if os.path.exists(src_path):
        print(f"Copying {src_name} directory...")
        if os.path.exists(dest_path):
            shutil.rmtree(dest_path)
        shutil.copytree(src_path, dest_path)

copy_dir_clean("Articulos")
copy_dir_clean("js")
copy_dir_clean("assets")

# Copy sitemap.xml and robots.txt
for static_file in ["sitemap.xml", "robots.txt"]:
    src_f = os.path.join(SOURCE_DIR, static_file)
    dst_f = os.path.join(DEST_DIR, static_file)
    if os.path.exists(src_f):
        shutil.copy2(src_f, dst_f)
        print(f"Copied {static_file} to output directory.")

# Sync standalone tools from SOURCE_DIR to DEST_DIR so both are identical
for tool_file in ["carta-de-renuncia-chile.html", "para-empleadores.html", "generador-anexo-40-horas.html", "kit-cumplimiento-laboral-pymes.html", "reconsideracion-multas-dt-art-511.html", "checklist-fiscalizacion-dt-pymes-chile.html"]:
    src_tool = os.path.join(SOURCE_DIR, tool_file)
    dst_tool = os.path.join(DEST_DIR, tool_file)
    if os.path.exists(src_tool):
        shutil.copy2(src_tool, dst_tool)

# Sync all generated HTML files to root repository for Vercel production deployment
print("Syncing all generated HTML files to root repository...")
for item in os.listdir(DEST_DIR):
    if item.endswith(".html"):
        src_item = os.path.join(DEST_DIR, item)
        dst_item = os.path.join(SOURCE_DIR, item)
        shutil.copy2(src_item, dst_item)
        print(f"Synced {item} to root directory.")

print("Redesign complete! All HTML files have been compiled and synchronized to root and calculolaboral-v2.")
