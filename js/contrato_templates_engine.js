/**
 * Motor de Generación Paramétrica de Contratos de Trabajo a la Medida (Chile 2026)
 * Cumple con: Código del Trabajo (Art. 10), Ley 21.561 (40 Horas / 42h), Ley 21.643 (Ley Karin / DS 44),
 * Ley 21.220 (Teletrabajo) y Dictámenes de la Dirección del Trabajo (DT).
 * Producto Digital: $12.990 CLP (Cálculo Laboral Chile)
 */

(function () {
    'use strict';

    var FLOW_TOKEN = 'l9a58c097adddec2d1e2ffe7626f032ab7fd195f';
    var FLOW_CHECKOUT_URL = 'https://www.flow.cl/btn.php?token=' + FLOW_TOKEN;

    // Catálogo de Sectores y Cargos con Funciones Tipo
    var SECTORES = {
        oficina: {
            nombre: 'Oficinas, Administración & Tecnología',
            cargos: [
                {
                    nombre: 'Asistente Administrativo(a)',
                    funciones: [
                        'Gestión y archivo de documentación contable, facturas y correspondencia de la empresa.',
                        'Atención de llamados telefónicos, recepción de clientes y coordinación de reuniones corporativas.',
                        'Registro y control de compras, rendición de gastos menores e inventario de útiles de oficina.',
                        'Apoyo operativo en la preparación de planillas de personal y trámites en entidades públicas y privadas.'
                    ]
                },
                {
                    nombre: 'Desarrollador(a) de Software / Programador(a)',
                    funciones: [
                        'Análisis, diseño, desarrollo, pruebas e implementación de aplicaciones web, móviles y sistemas internos.',
                        'Mantenimiento de bases de datos, refactorización de código y resolución de incidencias en entornos de producción.',
                        'Documentación técnica de arquitecturas y seguimiento de buenas prácticas de ciberseguridad y control de versiones.',
                        'Integración continua y colaboración con equipos de diseño y producto para entrega oportuna de entregables.'
                    ]
                },
                {
                    nombre: 'Contador(a) General / Analista Contable',
                    funciones: [
                        'Registro de compras y ventas, conciliaciones bancarias y confección de balances tributarios y financieros.',
                        'Declaración de impuestos mensuales (Formulario 29) y apoyo en la operación de Renta anual ante el SII.',
                        'Cálculo y emisión de liquidaciones de sueldo, pago de leyes sociales en Previred y gestión de contratos y finiquitos.',
                        'Atención de requerimientos tributarios, laborales y auditorías internas del negocio.'
                    ]
                },
                {
                    nombre: 'Diseñador(a) Gráfico(a) / Diseñador(a) UI/UX',
                    funciones: [
                        'Creación de piezas gráficas para canales digitales, redes sociales, catálogos y presentaciones corporativas.',
                        'Diseño de interfaces de usuario (UI), wireframes y prototipos de experiencia de usuario (UX) para plataformas web.',
                        'Custodia y desarrollo del manual de marca e identidad visual de la empresa.',
                        'Edición y producción de material audiovisual y publicitario según directrices del equipo comercial.'
                    ]
                }
            ],
            jornadaDefault: '5x2_viernes_corto',
            clausulaEspecial: 'confidencialidad_ip'
        },
        comercio: {
            nombre: 'Comercio, Retail & Tiendas',
            cargos: [
                {
                    nombre: 'Vendedor(a) de Tienda / Dependiente',
                    funciones: [
                        'Atención cordial, asesoría al cliente y cierre de ventas en sala de exhibición según protocolos de la empresa.',
                        'Recepción, revisión, etiquetado y exhibición de mercadería en vitrinas y estanterías del local comercial.',
                        'Mantenimiento del orden, limpieza y reposición constante del stock en el punto de venta.',
                        'Participación periódica en inventarios físicos y control de mermas de productos.'
                    ]
                },
                {
                    nombre: 'Cajero(a) de Local Comercial',
                    funciones: [
                        'Cobro de productos y servicios mediante efectivo, tarjetas de débito/crédito y medios de pago electrónicos.',
                        'Apertura, cuadratura diaria y cierre de caja con rendición formal de valores ante la jefatura de local.',
                        'Custodia del fondo fijo asignado, evitando faltantes de dinero bajo las reglas del Código del Trabajo.',
                        'Emisión de boletas, facturas electrónicas y notas de crédito con estricto apego a normativas del SII.'
                    ]
                },
                {
                    nombre: 'Jefe(a) de Local / Encargado(a) de Tienda',
                    funciones: [
                        'Supervisión directa del personal de ventas y cajas, asignación de turnos y cumplimiento de metas comerciales.',
                        'Control del inventario de sala y bodega, supervisión de recepciones de mercadería y prevención de pérdidas.',
                        'Apertura y cierre seguro de la sucursal comercial, activación de alarmas y custodia de llaves.',
                        'Atención de reclamos de clientes, cumplimiento de normas SERNAC y fiscalizaciones de la Dirección del Trabajo.'
                    ]
                }
            ],
            jornadaDefault: '6x1_comercio',
            clausulaEspecial: 'art38_caja'
        },
        gastronomia: {
            nombre: 'Gastronomía, Restaurantes & Eventos',
            cargos: [
                {
                    nombre: 'Garzón(a) / Mesero(a)',
                    funciones: [
                        'Recepción cordial de comensales, toma de pedidos mediante comanderas o sistemas de punto de venta y servicio de mesas.',
                        'Transporte seguro y presentación higiénica de platos, bebidas y postres desde la cocina a la mesa.',
                        'Presentación de la cuenta, procesamiento de pagos y cumplimiento estricto del régimen legal de propinas (Art. 64).',
                        'Limpieza, sanitización, montaje y desmontaje de mesas, vajilla y cristalería del salón.'
                    ]
                },
                {
                    nombre: 'Cocinero(a) / Maestro(a) de Cocina',
                    funciones: [
                        'Preparación, cocción y emplatado de recetas y menú conforme a los estándares de calidad y tiempos del establecimiento.',
                        'Cumplimiento irrestricto de las normas higiénico-sanitarias (BPM y Reglamento Sanitario de los Alimentos).',
                        'Recepción, porcionamiento, etiquetado y rotación adecuada de materias primas e insumos perecibles (FIFO).',
                        'Limpieza y desinfección de mesones, cuchillos, freidoras, fogones y utensilios de la cocina al término del turno.'
                    ]
                },
                {
                    nombre: 'Bartender / Barman',
                    funciones: [
                        'Preparación de coctelería clásica y de autor, cafés y expendio de bebidas conforme a las recetas del bar.',
                        'Control diario de stock de licores, insumos, cristalería y hielo de la barra.',
                        'Cobro o registro de comandas en la barra manteniendo un servicio rápido y ordenado.',
                        'Sanitización de la estación de bar y lavado riguroso de cristalería.'
                    ]
                }
            ],
            jornadaDefault: 'turnos_rotativos',
            clausulaEspecial: 'propinas_sanidad'
        },
        ventas: {
            nombre: 'Fuerza de Ventas & Ejecutivos Comerciales',
            cargos: [
                {
                    nombre: 'Ejecutivo(a) Comercial / Ventas Terreno',
                    funciones: [
                        'Prospección activa, contacto y visita a clientes potenciales para colocación de productos y servicios de la empresa.',
                        'Elaboración y presentación de propuestas comerciales, cotizaciones y negociación de condiciones de venta.',
                        'Cierre formal de contratos comerciales, seguimiento de cobranza y cumplimiento mensual de metas asignadas.',
                        'Reporte oportuno en sistema CRM de las gestiones, reuniones y estado del pipeline de ventas.'
                    ]
                },
                {
                    nombre: 'Captador(a) / Televentas (Inside Sales)',
                    funciones: [
                        'Llamadas telefónicas y contacto digital a bases de prospectos calificados para agendamiento o venta directa.',
                        'Calificación de leads, detección de necesidades de compra y derivación o cierre comercial.',
                        'Actualización rigurosa de base de datos de clientes y cumplimiento de KPIs de llamados y conversiones.',
                        'Seguimiento post-venta inicial para garantizar la satisfacción y fidelización del cliente.'
                    ]
                }
            ],
            jornadaDefault: '5x2_viernes_corto',
            clausulaEspecial: 'semana_corrida'
        },
        logistica: {
            nombre: 'Logística, Bodega & Reparto',
            cargos: [
                {
                    nombre: 'Chofer de Reparto / Distribución',
                    funciones: [
                        'Conducción segura de vehículos de transporte de la empresa respetando estrictamente la Ley de Tránsito (Ley 18.290).',
                        'Carga, estiba, transporte y entrega de pedidos en los domicilios o bodegas de clientes conforme a la hoja de ruta.',
                        'Recaudación de firmas en guías de despacho, cobro de facturas y rendición diaria de entregas y valores.',
                        'Revisión diaria de niveles de fluidos, neumáticos, documentación al día y aseo del vehículo a su cargo.'
                    ]
                },
                {
                    nombre: 'Operario(a) de Bodega & Picking',
                    funciones: [
                        'Recepción, descarga, verificación física y almacenamiento ordenado de mercaderías e insumos en racks de bodega.',
                        'Preparación de pedidos (picking y packing), etiquetado, embalaje y armado de pallets para despacho.',
                        'Participación activa en tomas de inventarios cíclicos y generales de la empresa.',
                        'Uso permanente y obligatorio de elementos de protección personal (calzado de seguridad, guantes, chaleco reflectante).'
                    ]
                },
                {
                    nombre: 'Operador(a) de Grúa Horquilla / Apilador',
                    funciones: [
                        'Operación segura de maquinaria de levante (grúa horquilla o apilador eléctrico) contando con Licencia Clase D vigente.',
                        'Traslado, apilamiento y almacenamiento de carga en altura maximizando el espacio de bodega.',
                        'Carga y descarga de camiones de proveedores y transportistas respetando límites de tonelaje y velocidad.',
                        'Checklist diario de operatividad de la maquinaria (baterías, frenos, horquillas y fuga hidráulica).'
                    ]
                }
            ],
            jornadaDefault: '5x2_viernes_corto',
            clausulaEspecial: 'asistencia_movil_epp'
        },
        construccion: {
            nombre: 'Construcción, Obras & Maestranzas',
            cargos: [
                {
                    nombre: 'Maestro(a) Mayor / Albañil / Carpintero',
                    funciones: [
                        'Ejecución de faenas constructivas (enfierradura, hormigonado, moldajes, albañilería o terminaciones) según planos y especificaciones.',
                        'Uso y cuidado de herramientas manuales y eléctricas de la obra asignadas a su cuadrilla.',
                        'Cumplimiento estricto del protocolo de seguridad en faena, charlas de 5 minutos y trabajo seguro en altura.',
                        'Coordinación con el capataz y profesional de terreno para avance según programa físico de la obra.'
                    ]
                },
                {
                    nombre: 'Jornalero(a) de Faena / Ayudante',
                    funciones: [
                        'Apoyo operativo a los maestros en mezcla de materiales, acopio, acarreo de escombros y limpieza de frentes de trabajo.',
                        'Descarga y traslado de sacos de cemento, fierro, cerámicas y materiales hasta los puntos de instalación.',
                        'Mantenimiento del orden, despeje de vías de evacuación y retiro de residuos de la obra.',
                        'Uso irrestricto de casco, barbiquejo, calzado de seguridad, antiparras y protección auditiva.'
                    ]
                }
            ],
            jornadaDefault: '5x2_uniforme',
            clausulaEspecial: 'por_obra_faena'
        },
        salud: {
            nombre: 'Salud, Cuidados & Estética',
            cargos: [
                {
                    nombre: 'Técnico en Enfermería (TENS)',
                    funciones: [
                        'Atención y cuidado directo de pacientes, control de signos vitales y administración de tratamientos según indicación médica.',
                        'Preparación de box de atención, esterilización de instrumental y reposición de insumos clínicos.',
                        'Registro fidedigno de evolución de pacientes en ficha clínica física o electrónica con estricto apego a Ley 20.584.',
                        'Cumplimiento irrestricto de normas de bioseguridad, manejo de REAS (residuos hospitalarios) y lavado de manos clínico.'
                    ]
                },
                {
                    nombre: 'Cuidador(a) de Adulto Mayor / Paciente en Domicilio',
                    funciones: [
                        'Asistencia en actividades de la vida diaria: aseo y confort personal, alimentación, movilización y cambios de postura.',
                        'Supervisión y administración puntual de medicamentos orales según receta médica y pauta entregada por la familia.',
                        'Acompañamiento, estimulación cognitiva y monitoreo permanente del estado de salud físico y anímico.',
                        'Informar de inmediato cualquier anomalía, caída o cambio en el estado de salud al contacto de emergencia familiar.'
                    ]
                }
            ],
            jornadaDefault: 'turnos_rotativos',
            clausulaEspecial: 'bioseguridad_confidencialidad'
        },
        seguridad: {
            nombre: 'Seguridad Privada & Conserjería',
            cargos: [
                {
                    nombre: 'Guardia de Seguridad (Acreditación OS-10)',
                    funciones: [
                        'Vigilancia, control de accesos peatonales y vehiculares e inspección de instalaciones conforme a directiva de funcionamiento OS-10.',
                        'Rondas periódicas de fiscalización, verificación de cerraduras, portones y funcionamiento de sistemas de alarma.',
                        'Registro riguroso en el libro de novedades de todo evento relevante, incidentes o visitas al recinto.',
                        'Actuación disuasiva y oportuna comunicación con Carabineros de Chile o seguridad municipal en caso de ilícitos.'
                    ]
                },
                {
                    nombre: 'Conserje de Edificio o Condominio',
                    funciones: [
                        'Control de acceso de residentes, visitas y personal de encomiendas o servicios al condominio (Ley 21.442).',
                        'Monitoreo del circuito cerrado de televisión (CCTV), luces comunes, bombas de agua y ascensores del edificio.',
                        'Recepción y entrega de paquetería y correspondencia para los copropietarios en conserjería.',
                        'Mantener la tranquilidad y orden de los espacios comunes haciendo cumplir el Reglamento de Copropiedad.'
                    ]
                }
            ],
            jornadaDefault: 'turnos_rotativos',
            clausulaEspecial: 'os10_copropiedad'
        },
        educacion: {
            nombre: 'Educación & Capacitación',
            cargos: [
                {
                    nombre: 'Profesor(a) / Docente / Instructor(a)',
                    funciones: [
                        'Planificación, preparación y dictado de clases conforme a los planes de estudio y mallas curriculares de la institución.',
                        'Evaluación y corrección de pruebas, trabajos prácticos y entrega oportuna de calificaciones en el libro de clases.',
                        'Atención de apoderados o alumnos en horarios asignados para resolución de dudas pedagógicas.',
                        'Participación en consejos de profesores, reuniones de coordinación técnica y jornadas de capacitación institucional.'
                    ]
                },
                {
                    nombre: 'Asistente de Aula / Tutor Educativo',
                    funciones: [
                        'Apoyo pedagógico y disciplinario al docente titular en la sala de clases durante el desarrollo de las lecciones.',
                        'Supervisión y cuidado de los alumnos durante los recreos, ingresos, salidas y actividades extracurriculares.',
                        'Preparación y distribución de materiales didácticos, guías de trabajo y orden de recursos pedagógicos.',
                        'Promoción activa de la sana convivencia escolar y protocolos de protección infantil.'
                    ]
                }
            ],
            jornadaDefault: '5x2_uniforme',
            clausulaEspecial: 'pedagogica_convivencia'
        },
        agro: {
            nombre: 'Agroindustria & Temporeros',
            cargos: [
                {
                    nombre: 'Temporero(a) de Cosecha / Packing',
                    funciones: [
                        'Cosecha manual de frutas u hortalizas respetando los calibres, madurez y cuidado de la planta según instrucciones.',
                        'Selección, limpieza, pesaje, embalaje y rotulado de productos agrícolas en línea de packing de exportación.',
                        'Cuidado de cajas cosecheras, bins y herramientas manuales de corte entregadas por la empresa.',
                        'Cumplimiento de las normas de inocuidad alimentaria, lavado de manos e higiene en el predio agrícola.'
                    ]
                }
            ],
            jornadaDefault: '5x2_uniforme',
            clausulaEspecial: 'temporada_agricola'
        },
        directivo: {
            nombre: 'Cargos Directivos & Gerenciales (Art. 22)',
            cargos: [
                {
                    nombre: 'Gerente General / Administrador(a) General',
                    funciones: [
                        'Planificación estratégica, toma de decisiones ejecutivas y representación legal o comercial de la empresa.',
                        'Gestión y supervisión integral de los recursos financieros, operacionales y humanos de la organización.',
                        'Aprobación de contrataciones, presupuestos anuales, inversiones de capital y contratos con clientes clave.',
                        'Rendición de cuentas ante el Directorio o Junta de Socios sobre los estados financieros y metas corporativas.'
                    ]
                },
                {
                    nombre: 'Subgerente de Operaciones / Comercial',
                    funciones: [
                        'Liderazgo y coordinación de las distintas jefaturas de área para el cumplimiento eficiente de los procesos clave.',
                        'Evaluación continua de indicadores de desempeño (KPIs), costos operacionales y optimización de recursos.',
                        'Negociación de acuerdos estratégicos con proveedores corporativos y clientes de alta envergadura.',
                        'Subrogación del Gerente General en caso de ausencia o delegación de facultades de administración.'
                    ]
                }
            ],
            jornadaDefault: 'art_22_estricto',
            clausulaEspecial: 'fidelidad_directiva'
        }
    };

    // Matriz de Horarios según Ley 40 Horas (42 horas vigentes en 2026)
    var JORNADAS = {
        '5x2_viernes_corto': {
            nombre: 'Jornada 5x2 de Oficina: Lunes a Viernes (42h - Salida Viernes Corto)',
            descripcion: '42 horas semanales: Lunes a Jueves de 08:30 a 18:00 (1h colación = 8,5h efectivas) y Viernes de 08:30 a 16:30 (1h colación = 7h efectivas). Opción favorita para oficinas.',
            textoLegal: `La jornada ordinaria de trabajo será de 42 HORAS SEMANALES, conforme a la vigencia legal de la Ley Nº 21.561, distribuida de lunes a viernes de la siguiente forma:
a) Lunes a Jueves: desde las 08:30 horas hasta las 18:00 horas, con un descanso de 60 minutos destinado a colación.
b) Viernes: desde las 08:30 horas hasta las 16:30 horas, con un descanso de 60 minutos destinado a colación.
El tiempo destinado a colación será de cargo exclusivo del Trabajador y no formará parte de la jornada ordinaria laboral (Art. 34 del Código del Trabajo).`
        },
        '5x2_uniforme': {
            nombre: 'Jornada 5x2 Uniforme: Lunes a Viernes (42h - 8h 24m diarias)',
            descripcion: '42 horas semanales distribuidas en partes iguales de 8 horas y 24 minutos diarios de lunes a viernes.',
            textoLegal: `La jornada ordinaria de trabajo será de 42 HORAS SEMANALES, conforme a la Ley Nº 21.561, distribuida de lunes a viernes en jornada de 8 horas y 24 minutos diarios, con ingreso a las 08:30 horas y salida a las 17:54 horas, mediando un descanso intermedio de 60 minutos para colación imputable al Trabajador (Art. 34 del Código del Trabajo).`
        },
        '6x1_comercio': {
            nombre: 'Jornada 6x1 Comercio: Lunes a Sábado (42h - Art. 38)',
            descripcion: '42 horas semanales: 7 horas diarias continuas de lunes a sábado conforme al Artículo 38. Incluye régimen de 7 domingos obligatorios al año.',
            textoLegal: `La jornada ordinaria de trabajo será de 42 HORAS SEMANALES, conforme a la Ley Nº 21.561, distribuida en seis días a la semana de lunes a sábado, en turnos de 7 horas diarias efectivas, con un descanso intermedio de 60 minutos para colación fuera de la jornada laboral. 
En atención a que las actividades de la empresa se encuentran exceptuadas del descanso en domingos y festivos conforme al Artículo 38 Nº 2 o Nº 7 del Código del Trabajo, el Trabajador tendrá derecho a un día de descanso compensatorio a la semana en compensación de las labores realizadas en domingo o festivo. Asimismo, en el caso de trabajadores de comercio, tendrán derecho a gozar de al menos 7 domingos de descanso dentro de cada año calendario (Art. 38 bis del Código del Trabajo).`
        },
        'turnos_rotativos': {
            nombre: 'Sistema de Turnos Rotativos Continuos (Art. 38)',
            descripcion: 'Para faenas de proceso continuo, restaurantes o vigilancia. Turnos rotativos diurnos y nocturnos con descansos semanales compensatorios.',
            textoLegal: `La jornada ordinaria de trabajo será de 42 HORAS SEMANALES en promedio, estructurada bajo un sistema de turnos rotativos continuos conforme al Artículo 38 del Código del Trabajo, distribuidos en turnos de mañana, tarde y noche según el rol que el Empleador publicará con al menos una semana de anticipación en el mural de la empresa.
Ningún turno diario podrá exceder de 10 horas de trabajo efectivo, debiendo mediar un descanso de al menos 12 horas continuas entre el término de una jornada y el inicio de la siguiente. El Empleador otorgará los días de descanso compensatorio correspondientes según la ley.`
        },
        'part_time_20h': {
            nombre: 'Jornada Parcial (Part-Time): 20 Horas Semanales (Art. 40 bis)',
            descripcion: 'Especial para estudiantes o fines de semana. Máximo 20 horas semanales.',
            textoLegal: `La jornada ordinaria de trabajo será de carácter PARCIAL (Part-Time) conforme al Artículo 40 bis del Código del Trabajo, y no excederá de 20 HORAS SEMANALES. La jornada se distribuirá los días [Días pactados, ej: sábados y domingos de 09:00 a 19:30 horas], con un descanso intermedio de 30 minutos de colación. Las partes acuerdan que las horas extraordinarias se regirán por el límite especial del 30% fijado en el artículo 40 bis C del Código del Trabajo.`
        },
        'part_time_30h': {
            nombre: 'Jornada Parcial (Part-Time): 30 Horas Semanales (Tope Legal Art. 40 bis)',
            descripcion: '30 horas semanales (tope legal para gozar del estatuto de jornada parcial).',
            textoLegal: `La jornada ordinaria de trabajo será de carácter PARCIAL conforme a los Artículos 40 bis y siguientes del Código del Trabajo, fijándose en 30 HORAS SEMANALES. Dicha jornada se distribuirá en [Días convenidos], con un lapso diario de colación no inferior a 30 minutos ni superior a 60 minutos.`
        },
        'teletrabajo_hibrido': {
            nombre: 'Teletrabajo Híbrido: Presencial + Remoto (Ley 21.220)',
            descripcion: 'Combina días de trabajo presencial en oficina y días de trabajo a distancia con derecho a desconexión y asignación de internet.',
            textoLegal: `Las partes convienen expresamente prestar servicios bajo la modalidad combinada de TELETRABAJO y trabajo presencial, de conformidad a los Artículos 152 quáter G y siguientes del Código del Trabajo (Ley Nº 21.220).
a) Distribución: El Trabajador prestará servicios presenciales [X días, ej: lunes y miércoles] en las oficinas de la empresa, y prestará servicios bajo modalidad de teletrabajo en su domicilio [X días, ej: martes, jueves y viernes].
b) Jornada y Desconexión: La jornada total será de 42 HORAS SEMANALES. El Empleador garantiza el irrestricto respeto al DERECHO A DESCONEXIÓN del Trabajador de al menos 12 horas continuas en un período de 24 horas (Art. 152 quáter J).
c) Asignación Operativa: El Empleador proporcionará los equipos de trabajo (computador) y pagará mensualmente la suma no imponible de $[30.000] pesos por concepto de asignación compensatoria de costos de internet y energía eléctrica (Art. 152 quáter L).`
        },
        'teletrabajo_100': {
            nombre: 'Teletrabajo 100% Remoto (Ley 21.220)',
            descripcion: 'Trabajo íntegramente a distancia desde el domicilio del colaborador con provisión de equipos y derecho a desconexión.',
            textoLegal: `Las partes pactan que los servicios se prestarán de manera 100% remota bajo la modalidad de TRABAJO A DISTANCIA (TELETRABAJO), conforme al Capítulo IX del Código del Trabajo.
El Trabajador desempeñará sus funciones desde su domicilio particular individualizado en la comparecencia. La jornada semanal será de 42 HORAS. Se estipula el derecho obligatorio de desconexión de 12 horas continuas. El Empleador proveerá las herramientas computacionales y asumirá los costos de conexión e insumos mediante una asignación compensatoria de gastos de teletrabajo de $[35.000] pesos mensuales no imponibles.`
        },
        'chofer_carga': {
            nombre: 'Jornada de Choferes de Carga Terrestre (Art. 25 bis)',
            descripcion: '180 horas mensuales con descanso mínimo ininterrumpido en cabina de 8 horas.',
            textoLegal: `En atención a la naturaleza de las labores de transporte de carga interurbana, la jornada ordinaria se regirá por el Artículo 25 bis del Código del Trabajo, siendo de 180 HORAS MENSUALES, la que no podrá distribuirse en menos de 21 días al mes. El Trabajador tendrá derecho a un descanso ininterrumpido de 8 horas dentro de cada 24 horas y el tiempo de conducción continua no podrá superar las 5 horas continuas. Los tiempos de espera serán compensados conforme a la ley.`
        },
        'art_22_estricto': {
            nombre: 'Exclusión de Jornada (Art. 22 inciso 2 - Solo Gerentes y Cargos con Poder de Mando)',
            descripcion: 'Reservado taxativamente por la Ley 40 Horas solo a gerentes y administradores con facultades de mando. (No aplicable a personal operativo).',
            textoLegal: `De conformidad con el Artículo 22 inciso segundo del Código del Trabajo, modificado por la Ley Nº 21.561, las partes dejan expresa constancia de que, atendida la jerarquía del cargo directivo de [Nombre del Cargo] y que cuenta con facultades generales de administración, dirección y representación de la empresa, actuando sin fiscalización superior inmediata en razón de la naturaleza de sus altas responsabilidades, queda EXCLUIDO de la limitación de jornada de trabajo.`
        }
    };

    // Utilidades numéricas
    function formatCLP(amount) {
        if (isNaN(amount)) return '$0';
        return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function getFolioContrato() {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var rand = Math.floor(1000 + Math.random() * 9000);
        return 'CL-CONTRATO-' + y + m + d + '-' + rand;
    }

    function getFechaHoyTexto() {
        var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        var d = new Date();
        return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Conversor riguroso de cifras a palabras en español jurídico (pesos chilenos)
    function numeroALetras(num) {
        var n = Math.round(Math.abs(Number(num) || 0));
        if (n === 0) return 'cero pesos';
        if (n === 1) return 'un peso';

        var units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
        var tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        var teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
        var twenties = ['veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
        var hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

        function convertGroup(g) {
            if (g === 0) return '';
            if (g === 100) return 'cien';
            var h = Math.floor(g / 100);
            var rem = g % 100;
            var words = [];
            if (h > 0) words.push(hundreds[h]);
            if (rem > 0) {
                if (rem < 10) {
                    words.push(units[rem]);
                } else if (rem >= 10 && rem <= 19) {
                    words.push(teens[rem - 10]);
                } else if (rem >= 20 && rem <= 29) {
                    words.push(twenties[rem - 20]);
                } else {
                    var t = Math.floor(rem / 10);
                    var u = rem % 10;
                    if (u === 0) {
                        words.push(tens[t]);
                    } else {
                        words.push(tens[t] + ' y ' + units[u]);
                    }
                }
            }
            return words.join(' ');
        }

        var millions = Math.floor(n / 1000000);
        var remainder = n % 1000000;
        var thousands = Math.floor(remainder / 1000);
        var unitsGroup = remainder % 1000;

        var parts = [];
        if (millions > 0) {
            if (millions === 1) {
                parts.push('un millón');
            } else {
                parts.push(convertGroup(millions) + ' millones');
            }
        }

        if (thousands > 0) {
            if (thousands === 1) {
                parts.push('mil');
            } else {
                parts.push(convertGroup(thousands) + ' mil');
            }
        }

        if (unitsGroup > 0) {
            parts.push(convertGroup(unitsGroup));
        }

        var text = parts.join(' ').trim();
        if (millions > 0 && thousands === 0 && unitsGroup === 0) {
            return text + ' de pesos';
        } else {
            return text + ' pesos';
        }
    }

    // ENSAMBLADOR LEGAL DEL CONTRATO DINÁMICO (BASADO EN CONTRATOS REALES CHILENOS)
    function generarContratoCompleto(datos) {
        var fechaContrato = datos.fechaContrato || getFechaHoyTexto();
        var ciudad = datos.ciudadEmpresa || 'Santiago';
        var folio = datos.folio || getFolioContrato();

        // 1. Duración del contrato (Art. 159 Nº 4 y Nº 5 del Código del Trabajo)
        var clausulaDuracion = '';
        if (datos.tipoContrato === 'plazo') {
            clausulaDuracion = `El presente contrato comenzará a regir con fecha ${escapeHtml(datos.fechaInicio || 'de su suscripción')} y tendrá una duración a PLAZO FIJO hasta el día ${escapeHtml(datos.fechaTerminoPlazo || '[Fecha Término]')}, fecha en la cual terminará en forma automática y de pleno derecho de conformidad con el artículo 159 Nº 4 del Código del Trabajo, sin necesidad de aviso previo ni derecho a indemnización por años de servicio, salvo acuerdo expreso de prórroga suscrito por escrito por ambas partes con anterioridad a su vencimiento.`;
        } else if (datos.tipoContrato === 'obra') {
            clausulaDuracion = `El presente contrato es POR OBRA O FAENA DETERMINADA al tenor del artículo 159 Nº 5 del Código del Trabajo, y se celebra exclusivamente para la ejecución de las labores convenidas en la obra o faena denominada "${escapeHtml(datos.nombreObra || 'Obra Principal')}", ubicada en ${escapeHtml(datos.ubicacionObra || ciudad)}. La relación laboral se extinguirá de pleno derecho al concluir de manera natural las funciones específicas del Trabajador o al terminarse la etapa constructiva o de servicio para la cual fue expresamente contratado, devengándose las indemnizaciones legales procedentes en virtud de la Ley Nº 20.880.`;
        } else {
            clausulaDuracion = `El presente contrato comenzará a regir a contar del día ${escapeHtml(datos.fechaInicio || 'de su suscripción')} y tendrá una duración de carácter INDEFINIDO, pudiendo terminar únicamente por las causales legales contempladas en el Código del Trabajo.`;
        }

        // 2. Funciones del Cargo (Art. 10 Nº 3 del Código del Trabajo)
        var listaFuncionesHtml = '';
        var listaFuncionesDoc = '';
        if (Array.isArray(datos.funciones) && datos.funciones.length > 0) {
            datos.funciones.forEach(function (f, idx) {
                listaFuncionesHtml += `<li class="mb-1">${escapeHtml(f)}</li>`;
                listaFuncionesDoc += `<p style="margin-left: 20pt; margin-bottom: 3pt;">${idx + 1}. ${escapeHtml(f)}</p>`;
            });
        } else {
            listaFuncionesHtml = `<li>Desempeñar diligentemente las funciones propias de su cargo y aquellas análogas que le encomiende su jefatura.</li>`;
            listaFuncionesDoc += `<p style="margin-left: 20pt;">1. Desempeñar diligentemente las funciones inherentes al cargo convenido.</p>`;
        }

        // 3. Jornada de Trabajo Oficial 2026 (Ley 21.561)
        var jornadaObj = JORNADAS[datos.jornadaClave] || JORNADAS['5x2_viernes_corto'];
        var textoJornada = datos.textoJornadaPersonalizado || jornadaObj.textoLegal;

        // 4. Remuneración Formal (Cifras en Números y Palabras)
        var sueldoBase = datos.sueldoBase || 850000;
        var sueldoBasePalabras = numeroALetras(sueldoBase);

        var textoGratif = '';
        if (datos.tipoGratificacion === 'art47') {
            textoGratif = `Las partes convienen el sistema de gratificación anual conforme al artículo 47 del Código del Trabajo, liquidándose y pagándose de acuerdo con el 30% de las utilidades líquidas que arroje el balance comercial auditado del ejercicio respectivo.`;
        } else if (datos.tipoGratificacion === 'sin_gratif') {
            textoGratif = `Las partes dejan constancia que la remuneración pactada no contempla anticipo mensual de gratificación legal, rigiéndose las eventuales utilidades líquidas por las normas generales supletorias del Código del Trabajo.`;
        } else {
            // Art. 50 (Modalidad estándar recomendada por la Dirección del Trabajo)
            textoGratif = `El Empleador dará cumplimiento a la obligación legal de gratificar a sus trabajadores mediante el sistema contemplado en el artículo 50 del Código del Trabajo, pagando mensualmente el 25% de la remuneración mensual devengada, con el tope legal equivalente a 4,75 Ingresos Mínimos Mensuales (IMM) prorrateados al mes ($219.115 en 2026).`;
        }

        // Comisiones y semana corrida (Art. 45 del Código del Trabajo)
        var textoComisiones = '';
        if (datos.tieneComisiones) {
            textoComisiones = `
            <p><strong>Comisiones y Semana Corrida (Art. 45):</strong> Además del sueldo base, el Trabajador devengará una comisión variable consistente en ${escapeHtml(datos.detalleComision || 'un porcentaje convenido sobre las ventas netas efectivamente facturadas y percibidas')}. De conformidad con el artículo 45 del Código del Trabajo, el Trabajador tendrá derecho al pago de la SEMANA CORRIDA por los días domingos y festivos devengados en el período, calculada sobre el promedio diario de las comisiones devengadas en el respectivo mes calendario.</p>`;
        }

        // Asignaciones no imponibles (Art. 41 inc. 2 del Código del Trabajo)
        var colacion = datos.asignacionColacion || 0;
        var movilizacion = datos.asignacionMovilizacion || 0;
        var teletrabajoAsig = datos.asignacionTeletrabajo || 0;
        var textoAsignaciones = '';
        if (colacion > 0 || movilizacion > 0 || teletrabajoAsig > 0) {
            textoAsignaciones = `<p><strong>Asignaciones Compensatorias No Imponibles (Art. 41 Código del Trabajo):</strong>`;
            if (colacion > 0) textoAsignaciones += ` Asignación de Colación: ${formatCLP(colacion)} (${numeroALetras(colacion)}) mensuales;`;
            if (movilizacion > 0) textoAsignaciones += ` Asignación de Movilización: ${formatCLP(movilizacion)} (${numeroALetras(movilizacion)}) mensuales;`;
            if (teletrabajoAsig > 0) textoAsignaciones += ` Asignación de Teletrabajo / Conectividad: ${formatCLP(teletrabajoAsig)} (${numeroALetras(teletrabajoAsig)}) mensuales;`;
            textoAsignaciones += ` las que por su naturaleza compensatoria no constituirán remuneración para ningún efecto legal ni previsional.</p>`;
        }

        // 5. Cláusulas de Blindaje Pyme con Numeración Ordinal
        var clausulaLeyKarin = `
        <div class="clausula-block">
            <h4 class="clausula-titulo">SÉPTIMO: DEL PROTOCOLO OBLIGATORIO DE PREVENCIÓN DE LA VIOLENCIA Y EL ACOSO (LEY KARIN - LEY Nº 21.643 Y D.S. Nº 44 MINTRAB)</h4>
            <p>Las partes declaran expresamente que las relaciones laborales en la empresa deben fundarse en un trato digno, respetuoso y libre de violencia. Queda estrictamente prohibido cualquier acto que constituya acoso laboral, acoso sexual o violencia en el trabajo ejercida por terceros ajenos a la relación laboral. El Trabajador declara recibir en este acto copia íntegra del Protocolo de Prevención de la Violencia y Acoso Laboral regulado por el Decreto Supremo Nº 44 del Ministerio del Trabajo y Previsión Social. El incurrir en conductas de acoso o violencia debidamente acreditadas se considerará falta gravísima y facultará al Empleador para poner término inmediato al contrato sin derecho a indemnización alguna, de conformidad con el artículo 160 Nº 1 letras b), c) y f) del Código del Trabajo.</p>
        </div>`;

        var clausulaConfidencialidad = datos.incluirConfidencialidad !== false ? `
        <div class="clausula-block">
            <h4 class="clausula-titulo">OCTAVO: DE LA CONFIDENCIALIDAD, PROPIEDAD INTELECTUAL Y NO CONCURRENCIA</h4>
            <p>El Trabajador se obliga a guardar estricta reserva y secreto profesional respecto de toda información técnica, financiera, contable, datos de clientes, tarifas, fórmulas, métodos operativos, software y secretos comerciales del Empleador a los que tenga acceso con motivo de sus funciones. Asimismo, todas las creaciones, obras, programas computacionales, bases de datos e invenciones que el Trabajador desarrolle durante su jornada serán de propiedad exclusiva y total del Empleador conforme a la Ley Nº 17.336 de Propiedad Intelectual. Durante la vigencia del contrato, el Trabajador no podrá realizar negociaciones ni prestar servicios dentro del mismo giro comercial de la empresa, sea por cuenta propia o para terceros competidores.</p>
        </div>` : '';

        var clausulaHerramientas = `
        <div class="clausula-block">
            <h4 class="clausula-titulo">NOVENO: DE LA CUSTODIA Y RESTITUCIÓN DE EQUIPOS Y HERRAMIENTAS</h4>
            <p>Los equipos computacionales, teléfonos móviles, vehículos, herramientas manuales o especializadas, uniformes, software corporativo y credenciales de acceso que el Empleador proporcione al Trabajador son para uso exclusiva y estrictamente laboral. El Trabajador asume la obligación de velar por su debida conservación y buen uso, debiendo restituirlos en buen estado (salvo el desgaste legítimo por el uso natural) inmediatamente al momento de terminar la relación laboral o en cualquier oportunidad en que el Empleador así lo requiera.</p>
        </div>`;

        var numClausula = 10;
        var clausulaBandasHorarias = '';
        if (datos.incluirBandaHoraria) {
            clausulaBandasHorarias = `
            <div class="clausula-block">
                <h4 class="clausula-titulo">DÉCIMO: DE LA BANDA HORARIA PARA TRABAJADORES CON CUIDADOS FAMILIARES (ART. 27 LEY Nº 21.561)</h4>
                <p>De conformidad con el artículo 27 del Código del Trabajo incorporado por la Ley Nº 21.561, y habiendo acreditado el Trabajador el cuidado personal de un menor de doce años mediante el respectivo certificado de nacimiento, las partes acuerdan una banda horaria de hasta dos horas, pudiendo el Trabajador anticipar o postergar el inicio de su jornada diaria en hasta sesenta minutos, debiendo compensar proporcionalmente dicho tiempo al término de la respectiva jornada.</p>
            </div>`;
            numClausula = 11;
        }

        var ordinalMiDT = numClausula === 11 ? 'DÉCIMO PRIMERO' : 'DÉCIMO';
        var ordinalEjemplares = numClausula === 11 ? 'DÉCIMO SEGUNDO' : 'DÉCIMO PRIMERO';

        var clausulaMiDT = `
        <div class="clausula-block">
            <h4 class="clausula-titulo">${ordinalMiDT}: DEL REGISTRO LABORAL ELECTRÓNICO OBLIGATORIO (PORTAL MI DT)</h4>
            <p>En cumplimiento de lo preceptuado en el artículo 9º inciso 3º del Código del Trabajo y en el Decreto Supremo Nº 37 del Ministerio del Trabajo y Previsión Social, el Empleador registrará electrónicamente el presente contrato individual de trabajo en el sitio web de la Dirección del Trabajo (portal Mi DT: www.direcciondeltrabajo.cl) dentro del plazo improrrogable de quince días hábiles contados desde su suscripción.</p>
        </div>`;

        var clausulaEjemplares = `
        <div class="clausula-block">
            <h4 class="clausula-titulo">${ordinalEjemplares}: DE LA JURISDICCIÓN, DOMICILIO Y EJEMPLARES</h4>
            <p>Para todos los efectos legales y judiciales derivados del presente contrato, las partes fijan su domicilio en la comuna de ${escapeHtml(ciudad)} y se someten a la competencia de sus Tribunales de Letras del Trabajo. El presente contrato se extiende y suscribe en dos ejemplares de un mismo tenor y fecha, declarando el Trabajador haber recibido en este acto un ejemplar de su texto íntegro a su entera conformidad.</p>
        </div>`;

        return {
            folio: folio,
            fecha: fechaContrato,
            ciudad: ciudad,
            datos: datos,
            clausulaDuracion: clausulaDuracion,
            listaFuncionesHtml: listaFuncionesHtml,
            listaFuncionesDoc: listaFuncionesDoc,
            textoJornada: textoJornada,
            sueldoBase: sueldoBase,
            sueldoBasePalabras: sueldoBasePalabras,
            textoGratif: textoGratif,
            textoComisiones: textoComisiones,
            textoAsignaciones: textoAsignaciones,
            clausulaLeyKarin: clausulaLeyKarin,
            clausulaConfidencialidad: clausulaConfidencialidad,
            clausulaHerramientas: clausulaHerramientas,
            clausulaBandasHorarias: clausulaBandasHorarias,
            clausulaMiDT: clausulaMiDT,
            clausulaEjemplares: clausulaEjemplares
        };
    }

    // RENDERIZADO VISUAL EN HTML (A4 PARA PREVIEW Y PRINT)
    function generarHTMLVisual(res, esVistaPrevia) {
        var d = res.datos;
        var marcaAguaClase = esVistaPrevia ? 'con-marca-agua' : '';

        return `
        <div class="contrato-a4-document ${marcaAguaClase}">
            ${esVistaPrevia ? `
            <div class="watermark-contrato-stamp watermark-stamp-top">
                <div class="watermark-stamp-title">VISTA PREVIA NO VÁLIDA PARA FIRMAR</div>
                <div class="watermark-stamp-sub">BORRADOR REFERENCIAL • CÁLCULO LABORAL CHILE</div>
                <div class="watermark-stamp-foot">DESCARGA EDITABLE EN WORD + PDF DISPONIBLE TRAS EL PAGO ($12.990)</div>
            </div>
            <div class="watermark-contrato-stamp watermark-stamp-mid">
                <div class="watermark-stamp-title">DOCUMENTO DE VISTA PREVIA</div>
                <div class="watermark-stamp-sub">PROHIBIDA SU REPRODUCCIÓN O PRESENTACIÓN ANTE LA DT</div>
                <div class="watermark-stamp-foot">FOLIO BORRADOR: ${res.folio} • CÁLCULO LABORAL CHILE</div>
            </div>
            <div class="watermark-contrato-stamp watermark-stamp-bot">
                <div class="watermark-stamp-title">NO VÁLIDO PARA FIRMAR</div>
                <div class="watermark-stamp-sub">VISTA PREVIA SIN VALIDEZ JURÍDICA</div>
                <div class="watermark-stamp-foot">OBTÉN TU VERSIÓN FINAL EDITABLE EN WORD + PDF</div>
            </div>
            ` : ''}
            
            <div class="text-center mb-6 border-b border-slate-300 pb-4">
                <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                    Instrumento Contractual Conforme al Código del Trabajo (Edición 2026) • Folio: ${res.folio}
                </div>
                <h1 class="text-xl font-black text-slate-900 uppercase tracking-tight">
                    Contrato Individual de Trabajo
                </h1>
                <div class="text-xs text-slate-600 font-semibold mt-0.5">
                    Modalidad: ${d.tipoContrato === 'plazo' ? 'A Plazo Fijo' : (d.tipoContrato === 'obra' ? 'Por Obra o Faena' : 'Indefinido')} • Jornada: 42 Horas Ley 21.561
                </div>
            </div>

            <div class="contrato-cuerpo text-xs leading-relaxed text-slate-800 space-y-3.5 text-justify">
                <p>
                    En <strong>${escapeHtml(res.ciudad)}</strong>, República de Chile, a <strong>${escapeHtml(res.fecha)}</strong>, entre las partes que a continuación se individualizan, se ha acordado celebrar el presente Contrato Individual de Trabajo:
                </p>

                <p class="pl-3 border-l-2 border-slate-300">
                    <strong>1. EMPLEADOR:</strong> <strong>${escapeHtml(d.empresaRazonSocial || '[Razón Social de la Empresa]')}</strong>, 
                    RUT Nº <strong>${escapeHtml(d.empresaRut || '[XX.XXX.XXX-X]')}</strong>, 
                    representada legalmente por don(ña) <strong>${escapeHtml(d.empresaRepresentante || '[Nombre Representante Legal]')}</strong>, 
                    cédula de identidad Nº <strong>${escapeHtml(d.empresaRepRut || '[XX.XXX.XXX-X]')}</strong>, 
                    ambos domiciliados para estos efectos en calle <strong>${escapeHtml(d.empresaDireccion || '[Dirección Comercial]')}</strong>, 
                    comuna de <strong>${escapeHtml(res.ciudad)}</strong>, correo electrónico <strong>${escapeHtml(d.empresaEmail || '[email@empresa.cl]')}</strong>, 
                    en adelante denominado "el Empleador"; y
                </p>

                <p class="pl-3 border-l-2 border-slate-300">
                    <strong>2. TRABAJADOR:</strong> Don(ña) <strong>${escapeHtml(d.trabajadorNombre || '[Nombre Completo del Trabajador]')}</strong>, 
                    de nacionalidad <strong>${escapeHtml(d.trabajadorNacionalidad || 'chilena')}</strong>, 
                    estado civil <strong>${escapeHtml(d.trabajadorEstadoCivil || 'soltero(a)')}</strong>, 
                    nacido(a) con fecha <strong>${escapeHtml(d.trabajadorFechaNac || '[DD/MM/AAAA]')}</strong>, 
                    cédula nacional de identidad Nº <strong>${escapeHtml(d.trabajadorRut || '[XX.XXX.XXX-X]')}</strong>, 
                    domiciliado(a) en <strong>${escapeHtml(d.trabajadorDireccion || '[Domicilio Particular]') }</strong>, 
                    comuna de <strong>${escapeHtml(d.trabajadorComuna || res.ciudad)}</strong>, 
                    correo electrónico <strong>${escapeHtml(d.trabajadorEmail || '[email@trabajador.cl]')}</strong>, 
                    en adelante denominado "el Trabajador", se ha convenido el siguiente contrato de trabajo:
                </p>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">PRIMERO: DE LA NATURALEZA DE LOS SERVICIOS (CARGO Y FUNCIONES)</h4>
                    <p>
                        De conformidad con el artículo 10 Nº 3 del Código del Trabajo, el Trabajador se compromete y obliga a prestar servicios personales bajo subordinación y dependencia en el cargo de 
                        <strong>${escapeHtml(d.cargoNombre || '[Nombre del Cargo]')}</strong>, debiendo desempeñar con diligencia, lealtad, esmero y eficiencia las siguientes funciones específicas:
                    </p>
                    <ul class="list-disc pl-5 mt-1.5 space-y-1 text-slate-700">
                        ${res.listaFuncionesHtml}
                    </ul>
                    <p class="mt-1.5">
                        Asimismo, el Trabajador desempeñará todas aquellas labores análogas, conexas o complementarias que guarden estrecha relación con la naturaleza de su cargo y que le sean encomendadas por su jefatura directa para el normal desarrollo de las operaciones de la empresa, acatando las órdenes de sus superiores y cumpliendo fielmente las disposiciones del Reglamento Interno de Orden, Higiene y Seguridad del cual declara recibir copia en este acto.
                    </p>
                </div>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">SEGUNDO: DEL LUGAR DE PRESTACIÓN DE LOS SERVICIOS Y FACULTAD DE TRASLADO</h4>
                    <p>
                        El Trabajador desempeñará sus funciones en las dependencias o instalaciones de la empresa ubicadas en 
                        <strong>${escapeHtml(d.lugarTrabajo || d.empresaDireccion || res.ciudad)}</strong>. 
                        De conformidad con el artículo 12 del Código del Trabajo, el Empleador podrá alterar el sitio o recinto en que deban prestarse los servicios, a condición de que se trate de labores similares, que el nuevo sitio quede dentro de la misma localidad o ciudad y sin que ello importe menoscabo económico ni moral para el Trabajador.
                    </p>
                </div>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">TERCERO: DE LA JORNADA DE TRABAJO Y HORARIO LEGAL (LEY Nº 21.561 DE 40 HORAS)</h4>
                    <p>${res.textoJornada.replace(/\n/g, '<br>')}</p>
                    <p class="mt-1">
                        El sistema de control y registro de asistencia se regirá estrictamente por lo dispuesto en el artículo 33 del Código del Trabajo.
                    </p>
                </div>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">CUARTO: DE LAS REMUNERACIONES Y FORMA DE PAGO</h4>
                    <p>
                        El Empleador pagará al Trabajador las siguientes remuneraciones mensuales:
                    </p>
                    <p class="pl-3 mt-1">
                        a) <strong>Sueldo Base Mensual:</strong> La suma fija e imponible de <strong>${formatCLP(res.sueldoBase)} (${res.sueldoBasePalabras} moneda de curso legal)</strong> mensuales.
                    </p>
                    <p class="pl-3 mt-1">
                        b) <strong>Gratificación Legal:</strong> ${res.textoGratif}
                    </p>
                    ${res.textoComisiones ? `<div class="pl-3 mt-1">${res.textoComisiones}</div>` : ''}
                    ${res.textoAsignaciones ? `<div class="pl-3 mt-1">${res.textoAsignaciones}</div>` : ''}
                    <p class="mt-1.5">
                        Las remuneraciones se liquidarán y pagarán por mensualidades vencidas el último día hábil de cada mes calendario, mediante transferencia bancaria a la cuenta bancaria del Trabajador o pago en dinero efectivo contra firma de la liquidación de sueldo respectiva, conforme al artículo 54 del Código del Trabajo.
                    </p>
                </div>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">QUINTO: DE LA DURACIÓN Y VIGENCIA DEL CONTRATO</h4>
                    <p>${res.clausulaDuracion}</p>
                </div>

                <div class="clausula-block">
                    <h4 class="clausula-titulo">SEXTO: DE LAS OBLIGACIONES, PREVISIÓN, HIGIENE Y SEGURIDAD LABORAL (ART. 184)</h4>
                    <p>
                        De conformidad con el artículo 184 del Código del Trabajo y la Ley Nº 16.744 sobre Accidentes del Trabajo y Enfermedades Profesionales, el Empleador adoptará todas las medidas necesarias para proteger eficazmente la vida y salud del Trabajador. Asimismo, de las remuneraciones devengadas, el Empleador retendrá y enterará oportunamente en los organismos de seguridad social respectivos (Previred) las cotizaciones previsionales obligatorias de cargo del Trabajador para pensión (AFP), salud (Fonasa o Isapre), Seguro de Cesantía (AFC) e impuestos que graven la renta (Art. 58 del Código del Trabajo).
                    </p>
                </div>

                ${res.clausulaLeyKarin}
                ${res.clausulaConfidencialidad}
                ${res.clausulaHerramientas}
                ${res.clausulaBandasHorarias}
                ${res.clausulaMiDT}
                ${res.clausulaEjemplares}

                <!-- TABLA OFICIAL DE FIRMAS (ESTÁNDAR NOTARIAL / LABORAL) -->
                <table class="tabla-firmas w-full mt-10 text-center text-xs" style="width: 100%; border-collapse: collapse; margin-top: 35px; border: none;">
                    <tr>
                        <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 15px;">
                            <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; font-weight: bold; text-transform: uppercase;">
                                ${escapeHtml(d.empresaRazonSocial || 'EL EMPLEADOR')}
                            </div>
                            <div style="font-family: monospace; font-size: 11px; color: #475569;">
                                RUT: ${escapeHtml(d.empresaRut || 'XX.XXX.XXX-X')}
                            </div>
                            <div style="font-size: 10px; color: #64748b;">
                                Rep. Legal: ${escapeHtml(d.empresaRepresentante || '')}
                            </div>
                            <div style="font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-top: 2px;">
                                Firma del Empleador
                            </div>
                        </td>
                        <td style="width: 4%; border: none;"></td>
                        <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 15px;">
                            <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; font-weight: bold; text-transform: uppercase;">
                                ${escapeHtml(d.trabajadorNombre || 'EL TRABAJADOR')}
                            </div>
                            <div style="font-family: monospace; font-size: 11px; color: #475569;">
                                C.I. Nº: ${escapeHtml(d.trabajadorRut || 'XX.XXX.XXX-X')}
                            </div>
                            <div style="font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-top: 2px;">
                                Firma y Huella del Trabajador(a)
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- ANEXO OBLIGATORIO: CONSTANCIA RECEPCIÓN LEY KARIN -->
                <div class="page-break-before mt-12 pt-8 border-t-2 border-dashed border-slate-300" style="page-break-before: always;">
                    <div class="text-center mb-5">
                        <span class="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                            Documento Anexo Obligatorio (Decreto Supremo Nº 44 Mintrab)
                        </span>
                        <h3 class="text-base font-extrabold text-slate-900 mt-2 uppercase tracking-tight">
                            Constancia de Entrega y Recepción de Protocolo Ley Karin
                        </h3>
                        <p class="text-[10px] text-slate-500 font-mono mt-0.5">
                            En cumplimiento de la Ley Nº 21.643 y el Decreto Supremo Nº 44 del Ministerio del Trabajo y Previsión Social
                        </p>
                    </div>
                    <p class="text-[11px] leading-relaxed text-slate-700 text-justify">
                        En la ciudad de <strong>${escapeHtml(res.ciudad)}</strong>, a <strong>${escapeHtml(res.fecha)}</strong>, el(la) Trabajador(a) don(ña) 
                        <strong>${escapeHtml(d.trabajadorNombre || '[Nombre Trabajador]')}</strong>, cédula nacional de identidad Nº 
                        <strong>${escapeHtml(d.trabajadorRut || '[RUT]')}</strong>, deja constancia expresa y bajo su firma que, en este acto y de manera previa al inicio de sus funciones, ha recibido formalmente de parte de su empleador 
                        <strong>${escapeHtml(d.empresaRazonSocial || '[Razón Social Empleador]')}</strong>, RUT Nº <strong>${escapeHtml(d.empresaRut || '[RUT]')}</strong>, un ejemplar íntegro, impreso y en soporte electrónico de los siguientes instrumentos laborales:
                    </p>
                    <ol class="list-decimal pl-6 mt-3 space-y-1.5 text-[11px] text-slate-800 font-semibold">
                        <li><strong>Reglamento Interno de Orden, Higiene y Seguridad</strong> de la empresa, debidamente actualizado con las directrices de la Ley Nº 21.643 (Ley Karin).</li>
                        <li><strong>Protocolo de Prevención de la Violencia y el Acoso en el Trabajo</strong>, elaborado de conformidad con los estándares del Decreto Supremo Nº 44 del Ministerio del Trabajo.</li>
                        <li><strong>Procedimiento Formal y Canales de Denuncia, Investigación y Medidas de Resguardo</strong> vigentes para denuncias internas ante la empresa o ante la Inspección del Trabajo.</li>
                    </ol>
                    <p class="text-[10.5px] text-slate-600 mt-3 text-justify">
                        El Trabajador declara haber sido debidamente informado de los canales de denuncia, de las medidas de resguardo y del derecho de acogerse a la atención psicológica temprana ante la respectiva mutualidad administradora del seguro de la Ley Nº 16.744.
                    </p>
                    
                    <table class="tabla-firmas-anexo w-full mt-10 text-center text-xs" style="width: 100%; border-collapse: collapse; margin-top: 40px; border: none;">
                        <tr>
                            <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 15px;">
                                <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; font-weight: bold; text-transform: uppercase;">
                                    ${escapeHtml(d.empresaRazonSocial || 'EL EMPLEADOR')}
                                </div>
                                <div style="font-family: monospace; font-size: 11px; color: #475569;">
                                    RUT: ${escapeHtml(d.empresaRut || 'XX.XXX.XXX-X')}
                                </div>
                                <div style="font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-top: 2px;">
                                    Firma Entrega Empleador
                                </div>
                            </td>
                            <td style="width: 4%; border: none;"></td>
                            <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 15px;">
                                <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; font-weight: bold; text-transform: uppercase;">
                                    ${escapeHtml(d.trabajadorNombre || 'EL TRABAJADOR')}
                                </div>
                                <div style="font-family: monospace; font-size: 11px; color: #475569;">
                                    C.I. Nº: ${escapeHtml(d.trabajadorRut || 'XX.XXX.XXX-X')}
                                </div>
                                <div style="font-size: 9.5px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-top: 2px;">
                                    Firma y Huella de Recepción
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        `;
    }

    // EXPORTADOR A WORD (.DOCX COMPATIBLE CON XML OFICIAL Y FORMALIDAD LEGAL)
    function descargarWordDoc(datos) {
        var res = generarContratoCompleto(datos);
        var d = res.datos;

        // Construcción de documento Word con formalidad notarial / jurídica
        var wordBodyHtml = `
        <div class="Section1">
            <p style="text-align: center; font-size: 9pt; font-family: 'Times New Roman', serif; color: #555555; margin-bottom: 2pt;">
                INSTRUMENTO CONTRACTUAL CONFORME AL CÓDIGO DEL TRABAJO DE CHILE (EDICIÓN 2026) • FOLIO: ${res.folio}
            </p>
            <h1 style="text-align: center; font-size: 14pt; font-family: 'Times New Roman', serif; font-weight: bold; text-transform: uppercase; margin-top: 6pt; margin-bottom: 2pt;">
                CONTRATO INDIVIDUAL DE TRABAJO
            </h1>
            <p style="text-align: center; font-size: 10pt; font-family: 'Times New Roman', serif; font-weight: bold; color: #333333; margin-bottom: 16pt;">
                (Modalidad: ${d.tipoContrato === 'plazo' ? 'A Plazo Fijo' : (d.tipoContrato === 'obra' ? 'Por Obra o Faena Determinada' : 'Indefinido')} • Jornada Legal: 42 Horas Semanales Ley Nº 21.561)
            </p>

            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                En <strong>${escapeHtml(res.ciudad)}</strong>, República de Chile, a <strong>${escapeHtml(res.fecha)}</strong>, entre las partes que a continuación se individualizan, se ha acordado celebrar el presente Contrato Individual de Trabajo:
            </p>

            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt; margin-left: 15pt;">
                <strong>1. EMPLEADOR:</strong> <strong>${escapeHtml(d.empresaRazonSocial || '[Razón Social de la Empresa]')}</strong>, 
                RUT Nº <strong>${escapeHtml(d.empresaRut || '[XX.XXX.XXX-X]')}</strong>, 
                representada legalmente por don(ña) <strong>${escapeHtml(d.empresaRepresentante || '[Nombre Representante Legal]')}</strong>, 
                cédula de identidad Nº <strong>${escapeHtml(d.empresaRepRut || '[XX.XXX.XXX-X]')}</strong>, 
                ambos domiciliados para estos efectos en calle <strong>${escapeHtml(d.empresaDireccion || '[Dirección Comercial]')}</strong>, 
                comuna de <strong>${escapeHtml(res.ciudad)}</strong>, correo electrónico <strong>${escapeHtml(d.empresaEmail || '[email@empresa.cl]')}</strong>, 
                en adelante denominado "el Empleador"; y
            </p>

            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 12pt; margin-left: 15pt;">
                <strong>2. TRABAJADOR:</strong> Don(ña) <strong>${escapeHtml(d.trabajadorNombre || '[Nombre Completo del Trabajador]')}</strong>, 
                de nacionalidad <strong>${escapeHtml(d.trabajadorNacionalidad || 'chilena')}</strong>, 
                estado civil <strong>${escapeHtml(d.trabajadorEstadoCivil || 'soltero(a)')}</strong>, 
                nacido(a) con fecha <strong>${escapeHtml(d.trabajadorFechaNac || '[DD/MM/AAAA]')}</strong>, 
                cédula nacional de identidad Nº <strong>${escapeHtml(d.trabajadorRut || '[XX.XXX.XXX-X]')}</strong>, 
                domiciliado(a) en <strong>${escapeHtml(d.trabajadorDireccion || '[Domicilio Particular]') }</strong>, 
                comuna de <strong>${escapeHtml(d.trabajadorComuna || res.ciudad)}</strong>, 
                correo electrónico <strong>${escapeHtml(d.trabajadorEmail || '[email@trabajador.cl]')}</strong>, 
                en adelante denominado "el Trabajador", se ha convenido el siguiente contrato individual de trabajo:
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                PRIMERO: DE LA NATURALEZA DE LOS SERVICIOS (CARGO Y FUNCIONES)
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 6pt;">
                De conformidad con lo dispuesto en el artículo 10 Nº 3 del Código del Trabajo, el Trabajador se compromete y obliga a prestar servicios personales bajo subordinación y dependencia en el cargo de 
                <strong>${escapeHtml(d.cargoNombre || '[Nombre del Cargo]')}</strong>, debiendo desempeñar con lealtad, esmero, eficiencia y diligencia las siguientes funciones específicas:
            </p>
            ${res.listaFuncionesDoc}
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-top: 4pt; margin-bottom: 8pt;">
                Asimismo, el Trabajador desempeñará todas aquellas labores análogas, conexas o complementarias que guarden estrecha relación con la naturaleza de su cargo y que le sean encomendadas por su jefatura directa para el normal desarrollo de las actividades de la empresa, acatando las instrucciones impartidas por sus superiores y cumpliendo el Reglamento Interno de Orden, Higiene y Seguridad del cual declara recibir copia en este acto.
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                SEGUNDO: DEL LUGAR DE PRESTACIÓN DE LOS SERVICIOS Y FACULTAD DE TRASLADO
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                El Trabajador desempeñará sus funciones en las dependencias o instalaciones de la empresa ubicadas en 
                <strong>${escapeHtml(d.lugarTrabajo || d.empresaDireccion || res.ciudad)}</strong>. 
                De conformidad con el artículo 12 del Código del Trabajo, el Empleador podrá alterar el sitio o recinto en que deban prestarse los servicios, a condición de que se trate de labores similares, que el nuevo sitio quede dentro de la misma localidad o ciudad y sin que ello importe menoscabo económico ni moral para el Trabajador.
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                TERCERO: DE LA JORNADA DE TRABAJO Y HORARIO LEGAL (LEY Nº 21.561 DE 40 HORAS)
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                ${res.textoJornada.replace(/\n/g, '<br>')}<br>
                El sistema de control y registro de asistencia se regirá estrictamente por lo dispuesto en el artículo 33 del Código del Trabajo.
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                CUARTO: DE LAS REMUNERACIONES Y FORMA DE PAGO
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 4pt;">
                El Empleador pagará al Trabajador las siguientes remuneraciones mensuales:
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 4pt; margin-left: 15pt;">
                a) <strong>Sueldo Base Mensual:</strong> La suma fija e imponible de <strong>${formatCLP(res.sueldoBase)} (${res.sueldoBasePalabras} moneda de curso legal)</strong> mensuales.
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 4pt; margin-left: 15pt;">
                b) <strong>Gratificación Legal:</strong> ${res.textoGratif}
            </p>
            ${res.textoComisiones ? `<div style="margin-left: 15pt; margin-bottom: 4pt; font-size: 11pt; font-family: 'Times New Roman', serif;">${res.textoComisiones}</div>` : ''}
            ${res.textoAsignaciones ? `<div style="margin-left: 15pt; margin-bottom: 4pt; font-size: 11pt; font-family: 'Times New Roman', serif;">${res.textoAsignaciones}</div>` : ''}
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-top: 6pt; margin-bottom: 8pt;">
                Las remuneraciones se liquidarán y pagarán por mensualidades vencidas el último día hábil de cada mes calendario, mediante transferencia bancaria a la cuenta del Trabajador o pago en dinero efectivo contra firma de la liquidación de sueldo respectiva, conforme al artículo 54 del Código del Trabajo.
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                QUINTO: DE LA DURACIÓN Y VIGENCIA DEL CONTRATO
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                ${res.clausulaDuracion}
            </p>

            <p style="font-weight: bold; font-size: 11pt; font-family: 'Times New Roman', serif; text-transform: uppercase; margin-top: 10pt; margin-bottom: 3pt;">
                SEXTO: DE LAS OBLIGACIONES, PREVISIÓN, HIGIENE Y SEGURIDAD LABORAL (ART. 184)
            </p>
            <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                De conformidad con el artículo 184 del Código del Trabajo y la Ley Nº 16.744 sobre Accidentes del Trabajo y Enfermedades Profesionales, el Empleador adoptará todas las medidas necesarias para proteger eficazmente la vida y salud del Trabajador. Asimismo, de las remuneraciones devengadas, el Empleador retendrá y enterará oportunamente en los organismos de seguridad social respectivos (Previred) las cotizaciones previsionales obligatorias de cargo del Trabajador para pensión (AFP), salud (Fonasa o Isapre), Seguro de Cesantía (AFC) e impuestos que graven la renta (Art. 58 del Código del Trabajo).
            </p>

            ${res.clausulaLeyKarin}
            ${res.clausulaConfidencialidad}
            ${res.clausulaHerramientas}
            ${res.clausulaBandasHorarias}
            ${res.clausulaMiDT}
            ${res.clausulaEjemplares}

            <!-- TABLA DE FIRMAS LIMPIA PARA WORD -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 40pt; border: none;">
                <tr>
                    <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 10pt;">
                        <div style="border-top: 1pt solid #000000; padding-top: 5pt; font-family: 'Times New Roman', serif;">
                            <strong style="text-transform: uppercase; font-size: 10pt;">${escapeHtml(d.empresaRazonSocial || 'EL EMPLEADOR')}</strong><br>
                            <span style="font-size: 9.5pt;">RUT Nº: ${escapeHtml(d.empresaRut || 'XX.XXX.XXX-X')}</span><br>
                            <span style="font-size: 9pt;">Rep. Legal: ${escapeHtml(d.empresaRepresentante || '')}</span><br>
                            <span style="font-size: 9pt; font-weight: bold; text-transform: uppercase;">Firma del Empleador</span>
                        </div>
                    </td>
                    <td style="width: 4%; border: none;"></td>
                    <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 10pt;">
                        <div style="border-top: 1pt solid #000000; padding-top: 5pt; font-family: 'Times New Roman', serif;">
                            <strong style="text-transform: uppercase; font-size: 10pt;">${escapeHtml(d.trabajadorNombre || 'EL TRABAJADOR')}</strong><br>
                            <span style="font-size: 9.5pt;">C.I. Nº: ${escapeHtml(d.trabajadorRut || 'XX.XXX.XXX-X')}</span><br>
                            <span style="font-size: 9pt; font-weight: bold; text-transform: uppercase;">Firma y Huella Trabajador(a)</span>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- SALTO DE SECCIÓN OFICIAL PARA WORD (ANEXO EN NUEVA HOJA) -->
            <br clear="all" style="page-break-before:always; mso-break-type:section-break">

            <div style="margin-top: 20pt;">
                <p style="text-align: center; font-size: 9pt; font-family: 'Times New Roman', serif; color: #555555; margin-bottom: 2pt;">
                    DOCUMENTO ANEXO OBLIGATORIO (DECRETO SUPREMO Nº 44 MINTRAB)
                </p>
                <h2 style="text-align: center; font-size: 13pt; font-family: 'Times New Roman', serif; font-weight: bold; text-transform: uppercase; margin-top: 6pt; margin-bottom: 2pt;">
                    CONSTANCIA DE ENTREGA Y RECEPCIÓN DE PROTOCOLO LEY KARIN
                </h2>
                <p style="text-align: center; font-size: 9.5pt; font-family: 'Times New Roman', serif; color: #444444; margin-bottom: 14pt;">
                    (En cumplimiento de la Ley Nº 21.643 y el Decreto Supremo Nº 44 del Ministerio del Trabajo y Previsión Social)
                </p>

                <p style="text-align: justify; line-height: 1.45; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                    En la ciudad de <strong>${escapeHtml(res.ciudad)}</strong>, a <strong>${escapeHtml(res.fecha)}</strong>, el(la) Trabajador(a) don(ña) 
                    <strong>${escapeHtml(d.trabajadorNombre || '[Nombre Trabajador]')}</strong>, cédula nacional de identidad Nº 
                    <strong>${escapeHtml(d.trabajadorRut || '[RUT]')}</strong>, deja constancia expresa y bajo su firma que, en este acto y de manera previa al inicio de sus funciones, ha recibido formalmente de parte de su empleador 
                    <strong>${escapeHtml(d.empresaRazonSocial || '[Razón Social Empleador]')}</strong>, RUT Nº <strong>${escapeHtml(d.empresaRut || '[RUT]')}</strong>, un ejemplar íntegro, impreso y en soporte electrónico de los siguientes instrumentos laborales:
                </p>

                <p style="margin-left: 20pt; line-height: 1.4; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 4pt;">
                    1. <strong>Reglamento Interno de Orden, Higiene y Seguridad</strong> de la empresa, debidamente actualizado con las directrices de la Ley Nº 21.643 (Ley Karin).
                </p>
                <p style="margin-left: 20pt; line-height: 1.4; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 4pt;">
                    2. <strong>Protocolo de Prevención de la Violencia y el Acoso en el Trabajo</strong>, elaborado de conformidad con los estándares del Decreto Supremo Nº 44 del Ministerio del Trabajo.
                </p>
                <p style="margin-left: 20pt; line-height: 1.4; font-size: 11pt; font-family: 'Times New Roman', serif; margin-bottom: 8pt;">
                    3. <strong>Procedimiento Formal y Canales de Denuncia, Investigación y Medidas de Resguardo</strong> vigentes para denuncias internas ante la empresa o ante la Inspección del Trabajo.
                </p>

                <p style="text-align: justify; line-height: 1.45; font-size: 10.5pt; font-family: 'Times New Roman', serif; margin-top: 8pt; margin-bottom: 8pt;">
                    El Trabajador declara haber sido debidamente informado de los canales de denuncia, de las medidas de resguardo y del derecho de acogerse a la atención psicológica temprana ante la respectiva mutualidad administradora del seguro de la Ley Nº 16.744.
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 40pt; border: none;">
                    <tr>
                        <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 10pt;">
                            <div style="border-top: 1pt solid #000000; padding-top: 5pt; font-family: 'Times New Roman', serif;">
                                <strong style="text-transform: uppercase; font-size: 10pt;">${escapeHtml(d.empresaRazonSocial || 'EL EMPLEADOR')}</strong><br>
                                <span style="font-size: 9.5pt;">RUT Nº: ${escapeHtml(d.empresaRut || 'XX.XXX.XXX-X')}</span><br>
                                <span style="font-size: 9pt; font-weight: bold; text-transform: uppercase;">Firma Entrega Empleador</span>
                            </div>
                        </td>
                        <td style="width: 4%; border: none;"></td>
                        <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0 10pt;">
                            <div style="border-top: 1pt solid #000000; padding-top: 5pt; font-family: 'Times New Roman', serif;">
                                <strong style="text-transform: uppercase; font-size: 10pt;">${escapeHtml(d.trabajadorNombre || 'EL TRABAJADOR')}</strong><br>
                                <span style="font-size: 9.5pt;">C.I. Nº: ${escapeHtml(d.trabajadorRut || 'XX.XXX.XXX-X')}</span><br>
                                <span style="font-size: 9pt; font-weight: bold; text-transform: uppercase;">Firma y Huella de Recepción</span>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        `;

        var htmlDocumento = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>Contrato_Trabajo_${escapeHtml(datos.trabajadorNombre || 'Trabajador')}_${res.folio}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 21.0cm 29.7cm; /* A4 */
                    margin: 2.5cm 2.5cm 2.5cm 2.5cm;
                    mso-header-margin: 35.4pt;
                    mso-footer-margin: 35.4pt;
                    mso-paper-source: 0;
                }
                div.Section1 {
                    page: Section1;
                }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 11pt;
                    line-height: 1.45;
                    color: #000000;
                    text-align: justify;
                }
                p {
                    margin-top: 0;
                    margin-bottom: 7pt;
                    text-align: justify;
                    line-height: 1.45;
                    font-family: 'Times New Roman', serif;
                    font-size: 11pt;
                }
                h1 {
                    font-size: 14pt;
                    font-weight: bold;
                    text-align: center;
                    text-transform: uppercase;
                    margin-bottom: 2pt;
                    font-family: 'Times New Roman', serif;
                }
                h2 {
                    font-size: 12pt;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 4pt;
                    font-family: 'Times New Roman', serif;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                td {
                    vertical-align: top;
                }
            </style>
        </head>
        <body>
            ${wordBodyHtml}
        </body>
        </html>
        `;

        var blob = new Blob(['\ufeff', htmlDocumento], {
            type: 'application/msword;charset=utf-8'
        });

        var nombreLimpio = (datos.trabajadorNombre || 'Trabajador').replace(/\s+/g, '_');
        var filename = `Contrato_Trabajo_${nombreLimpio}_${res.folio}.doc`;

        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // IMPRESIÓN / GUARDADO DIRECTO EN PDF (CON MARCA DE AGUA NOTORIA EN PREVIEW)
    function imprimirPDF(datos, esVistaPrevia) {
        var res = generarContratoCompleto(datos);
        var contenido = generarHTMLVisual(res, esVistaPrevia);

        var ventana = window.open('', '_blank', 'width=950,height=900');
        if (!ventana) {
            alert('Por favor autoriza las ventanas emergentes para visualizar y descargar tu contrato.');
            return;
        }

        ventana.document.open();
        ventana.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Contrato_Trabajo_${res.folio}</title>
                <link rel="stylesheet" href="/assets/css/style.css?v=2.6.2">
                <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;600;700&family=Geist:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Geist', system-ui, sans-serif;
                        background-color: #f1f5f9;
                        padding: 24px 16px;
                        color: #0f172a;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 18mm 18mm 20mm 18mm;
                    }
                    @media print {
                        body {
                            background: white !important;
                            padding: 0 !important;
                            color: #000000 !important;
                        }
                        .no-print { display: none !important; }
                        .contrato-a4-document {
                            box-shadow: none !important;
                            border: none !important;
                            padding: 0 !important;
                            width: 100% !important;
                            max-width: 100% !important;
                        }
                        .page-break-before {
                            page-break-before: always !important;
                        }
                        .tabla-firmas, .tabla-firmas-anexo {
                            page-break-inside: avoid !important;
                        }
                    }
                    .contrato-a4-document {
                        background: white;
                        max-width: 820px;
                        margin: 0 auto;
                        padding: 42px 48px;
                        border: 1px solid #cbd5e1;
                        border-radius: 12px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.06);
                        position: relative;
                        overflow: hidden;
                    }
                    .clausula-titulo {
                        font-weight: 800;
                        color: #0f172a;
                        margin-top: 14px;
                        margin-bottom: 4px;
                        letter-spacing: 0.2px;
                    }
                    .con-marca-agua {
                        position: relative;
                        background-image: repeating-linear-gradient(-35deg, rgba(225, 29, 72, 0.04), rgba(225, 29, 72, 0.04) 90px, transparent 90px, transparent 180px) !important;
                    }
                    /* MARCA DE AGUA NOTORIA PARA PDF PREVIEW (MULTI-ESTAMPA) */
                    .watermark-contrato-stamp {
                        position: absolute !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) rotate(-25deg) !important;
                        width: 88% !important;
                        max-width: 580px !important;
                        padding: 20px 28px !important;
                        border: 4px dashed rgba(225, 29, 72, 0.65) !important;
                        background-color: rgba(255, 255, 255, 0.90) !important;
                        border-radius: 16px !important;
                        text-align: center !important;
                        box-shadow: 0 12px 40px rgba(225, 29, 72, 0.22) !important;
                        pointer-events: none !important;
                        user-select: none !important;
                        z-index: 50 !important;
                    }
                    .watermark-stamp-top {
                        top: 240px !important;
                    }
                    .watermark-stamp-mid {
                        top: 55% !important;
                    }
                    .watermark-stamp-bot {
                        top: 86% !important;
                    }
                    .watermark-stamp-title {
                        font-size: 20px !important;
                        font-weight: 900 !important;
                        color: #e11d48 !important;
                        letter-spacing: 1.2px !important;
                        line-height: 1.2 !important;
                        text-transform: uppercase !important;
                    }
                    .watermark-stamp-sub {
                        font-size: 12px !important;
                        font-weight: 800 !important;
                        color: #9f1239 !important;
                        margin-top: 6px !important;
                        letter-spacing: 0.5px !important;
                        text-transform: uppercase !important;
                    }
                    .watermark-stamp-foot {
                        font-size: 10px !important;
                        font-weight: 700 !important;
                        color: #be123c !important;
                        margin-top: 5px !important;
                        text-transform: uppercase !important;
                    }
                </style>
            </head>
            <body>
                ${esVistaPrevia ? `
                <div class="no-print max-w-[820px] mx-auto mb-4 bg-rose-600 text-white p-3 rounded-xl shadow-md text-xs font-bold flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-icons text-base">lock</span>
                        <span>DOCUMENTO DE VISTA PREVIA • NO VÁLIDO PARA FIRMAR NI PRESENTAR ANTE LA DT</span>
                    </div>
                    <span class="bg-white/20 px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider">Borrador Protegido</span>
                </div>
                ` : ''}

                <div class="no-print max-w-[820px] mx-auto mb-4 flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span class="text-xs text-slate-700 font-semibold">Contrato de Trabajo: <strong>${escapeHtml(datos.trabajadorNombre || 'Trabajador')}</strong> (${escapeHtml(datos.cargoNombre || 'Cargo')})</span>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer !text-white" style="color:#fff!important;">
                            <span class="material-icons text-xs">print</span>
                            <span>Guardar como PDF / Imprimir</span>
                        </button>
                        <button onclick="window.close()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer">
                            Cerrar
                        </button>
                    </div>
                </div>

                ${contenido}

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            ${!esVistaPrevia ? 'window.print();' : ''}
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        ventana.document.close();
    }

    // Exportar al ámbito global
    window.ContratoTemplatesEngine = {
        SECTORES: SECTORES,
        JORNADAS: JORNADAS,
        generarContratoCompleto: generarContratoCompleto,
        generarHTMLVisual: generarHTMLVisual,
        descargarWordDoc: descargarWordDoc,
        imprimirPDF: imprimirPDF,
        FLOW_CHECKOUT_URL: FLOW_CHECKOUT_URL
    };
})();
