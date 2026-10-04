"""Contenido del Pack de Cartas de Despido por Causal.

Los textos de la ley citados vienen del Código del Trabajo (arts. 159, 160, 161, 162, 168, 174, 454).
Son modelos de referencia: no constituyen asesoría legal.
"""

PLAZO_3 = ('PLAZO: entrega la carta en mano o envíala por carta certificada al domicilio del contrato dentro de los '
          '3 DÍAS HÁBILES siguientes a la separación del trabajador, con copia a la Inspección del Trabajo en el mismo plazo.')

COTIZ = ('En cumplimiento del Artículo 162 del Código del Trabajo, se acompaña a esta comunicación el estado de pago de sus '
         'cotizaciones previsionales y de salud, con los comprobantes que acreditan que se encuentran pagadas hasta el último día del '
         'mes anterior al del término del contrato (AFP, Fonasa o Isapre, y Seguro de Cesantía).')

FINIQ_160 = ('Por tratarse de una causal imputable al trabajador, no corresponde el pago de indemnización por años de servicio ni de '
             'indemnización sustitutiva del aviso previo, sin perjuicio de lo que se haya pactado en su contrato individual o colectivo. '
             'Su finiquito, con las remuneraciones devengadas pendientes y la compensación del feriado legal y proporcional pendiente '
             '(Art. 73), estará disponible en [NOTARÍA / LUGAR DE FIRMA] dentro del plazo de 10 días hábiles contado desde la separación.')

FINIQ_159 = ('Por esta causal no corresponde el pago de indemnización por años de servicio ni de indemnización sustitutiva del aviso previo, '
             'sin perjuicio de lo que se haya pactado en su contrato individual o colectivo. Su finiquito, con las remuneraciones '
             'devengadas pendientes y la compensación del feriado legal y proporcional pendiente (Art. 73), estará disponible en '
             '[NOTARÍA / LUGAR DE FIRMA] dentro del plazo de 10 días hábiles contado desde la separación.')

INTRO_160 = ('Por medio de la presente, comunicamos formalmente a usted que con fecha [DÍA DE TÉRMINO] de [MES] de [AÑO] se ha resuelto '
             'poner término al contrato de trabajo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], R.U.T. [RUT EMPRESA], '
             'por la causal que se indica a continuación.')

HECHOS_INTRO = 'Los hechos concretos en que se funda esta decisión son los siguientes: '

PRUEBA = ('Estos hechos constan en [PRUEBAS: registro de asistencia, informe interno de fecha [FECHA], correos, cámaras de seguridad, '
          'declaraciones de testigos, actas u otros documentos], que quedan a disposición de la autoridad competente.')

DESCARGOS = ('Con fecha [FECHA] se le citó para que entregara sus descargos, y [ENTREGÓ SUS DESCARGOS, QUE NO DESVIRTUARON LOS HECHOS / NO '
             'COMPARECIÓ NI ENTREGÓ DESCARGOS DENTRO DEL PLAZO OTORGADO]. (Borra este párrafo si no hubo citación.)')


def carta(tipo, archivo, titulo, subtitulo, causal, hechos, box=None, finiquito=None, **kw):
    d = dict(tipo=tipo, archivo=archivo, titulo=titulo, subtitulo=subtitulo, causal=causal, hechos=hechos,
             intro=kw.pop('intro', INTRO_160), box=box or [])
    if finiquito:
        d['finiquito'] = finiquito
    d.update(kw)
    return d


T160 = 'CARTA DE TÉRMINO DE CONTRATO POR CAUSAL DISCIPLINARIA'

CARTAS = [
    carta('160', '03_Carta_Art160_N1a_Falta_de_Probidad.docx', T160,
          'Artículo 160 N° 1 letra a) del Código del Trabajo (Falta de probidad)',
          "La causal aplicada es la del Artículo 160 N° 1 letra a) del Código del Trabajo, esto es: 'Falta de probidad del trabajador en el desempeño de sus funciones'.",
          [HECHOS_INTRO + '[DESCRIBE QUÉ HIZO EL TRABAJADOR, CUÁNDO, DÓNDE Y CÓMO. EJEMPLO: el día 12 de junio de 2026 se detectó que usted registró 14 ventas con descuento a favor de un tercero sin autorización, apropiándose de la diferencia, por un total de $[MONTO]].',
           PRUEBA,
           DESCARGOS,
           'Esta conducta vulnera el deber de actuar con rectitud y honradez en el desempeño de las funciones, y afecta gravemente la confianza propia de la relación laboral.'],
          box=['Esta causal requiere un hecho grave y probado (apropiación, fraude, uso indebido de bienes o información, falsedad de documentos). Reúne la prueba antes de enviar la carta.',
               'Aunque la ley no exige citar a descargos, hacerlo (documento 18) fortalece tu posición.']),

    carta('160', '04_Carta_Art160_N1b_y_f_Acoso_Sexual_o_Laboral.docx', T160,
          'Artículo 160 N° 1 letras b) o f) (Acoso sexual / Acoso laboral, Ley N° 21.643 "Ley Karin")',
          "La causal aplicada es la del Artículo 160 N° 1 del Código del Trabajo, [letra b): 'Conductas de acoso sexual' / letra f): 'Conductas de acoso laboral'] (borra la que no aplique), conforme a las definiciones del Artículo 2° del mismo Código.",
          ['Con fecha [FECHA] se recibió una denuncia, que fue investigada conforme al procedimiento de la empresa y a la Ley N° 21.643. La investigación concluyó con el informe final de fecha [FECHA], que dio por acreditados los siguientes hechos: [DESCRIBE LOS HECHOS ACREDITADOS, CON FECHAS Y LUGARES. NO INCLUYAS DATOS INNECESARIOS DE LA PERSONA AFECTADA; USA SUS INICIALES O UNA IDENTIFICACIÓN RESERVADA].',
           'Durante la investigación usted fue notificado y tuvo la oportunidad de ser oído y de presentar pruebas, conforme a los principios de confidencialidad, imparcialidad y celeridad.',
           'Los hechos acreditados configuran la causal invocada, y la empresa ha resuelto aplicar la medida de término del contrato.'],
          box=['Usa esta carta solo después de terminar el procedimiento de investigación de la Ley Karin y de contar con el informe final. No despidas con la sola denuncia.',
               'El procedimiento (resguardo inmediato, decisión en 3 días hábiles de investigar o derivar, investigación de hasta 30 días hábiles, informe a la Dirección del Trabajo) debe estar cumplido y documentado. Ver la guía calculolaboral.cl/protocolo-ley-karin-empresas.',
               'Protege la reserva: no nombres a la persona afectada en la carta más de lo necesario.']),

    carta('160', '05_Carta_Art160_N1c_Vias_de_Hecho.docx', T160,
          'Artículo 160 N° 1 letra c) del Código del Trabajo (Vías de hecho)',
          "La causal aplicada es la del Artículo 160 N° 1 letra c) del Código del Trabajo, esto es: 'Vías de hecho ejercidas por el trabajador en contra del empleador o de cualquier trabajador de la empresa'.",
          [HECHOS_INTRO + '[DESCRIBE LA AGRESIÓN: FECHA, HORA, LUGAR, A QUIÉN, QUÉ ACTOS FÍSICOS Y CON QUÉ CONSECUENCIAS. EJEMPLO: el día 3 de julio de 2026, a las 15:20 horas, en la bodega, usted empujó y golpeó en el rostro a don/doña [NOMBRE], lo que le provocó [LESIONES]].',
           PRUEBA,
           DESCARGOS,
           'Los hechos descritos constituyen vías de hecho en el lugar de trabajo y justifican el término inmediato del contrato.'],
          box=['Reúne testigos, cámaras, partes de lesiones o constancias. Si hubo lesiones, evalúa denunciar a Carabineros o a la Fiscalía.',
               'La agresión puede configurar además acoso laboral o violencia en el trabajo (Ley N° 21.643). Revisa si debes aplicar el procedimiento de investigación y las medidas de resguardo a la persona afectada.']),

    carta('160', '06_Carta_Art160_N1d_Injurias.docx', T160,
          'Artículo 160 N° 1 letra d) del Código del Trabajo (Injurias al empleador)',
          "La causal aplicada es la del Artículo 160 N° 1 letra d) del Código del Trabajo, esto es: 'Injurias proferidas por el trabajador al empleador'.",
          [HECHOS_INTRO + '[TRANSCRIBE LAS EXPRESIONES USADAS, CON FECHA, HORA, LUGAR Y PERSONAS PRESENTES. EJEMPLO: el día 8 de agosto de 2026, en la oficina de gerencia y frente a [NÚMERO] trabajadores, usted se dirigió a [EL EMPLEADOR / QUIEN LO REPRESENTA] diciendo textualmente: "[EXPRESIÓN]"].',
           PRUEBA,
           DESCARGOS,
           'Estas expresiones atentan contra la honra del empleador y afectan gravemente el respeto que debe existir en la relación laboral.'],
          box=['La causal se refiere a las ofensas al empleador o a quien lo representa. Si fueron dirigidas a otros trabajadores, evalúa las letras c), e) o f) del mismo número.',
               'Un exabrupto aislado sin gravedad suele no bastar para esta causal. Transcribe las palabras exactas y acredita quién las escuchó.']),

    carta('160', '07_Carta_Art160_N1e_Conducta_Inmoral.docx', T160,
          'Artículo 160 N° 1 letra e) del Código del Trabajo (Conducta inmoral)',
          "La causal aplicada es la del Artículo 160 N° 1 letra e) del Código del Trabajo, esto es: 'Conducta inmoral del trabajador que afecte a la empresa donde se desempeña'.",
          [HECHOS_INTRO + '[DESCRIBE LA CONDUCTA, CON FECHA, LUGAR Y PERSONAS PRESENTES. EJEMPLO: el día 21 de julio de 2026, durante la jornada, usted se presentó en estado de ebriedad y mantuvo conductas impropias frente a clientes].',
           'Esta conducta afecta a la empresa porque [EXPLICA EL EFECTO CONCRETO EN LA EMPRESA: pérdida de clientes, daño a la imagen, alteración del ambiente de trabajo, riesgo para otras personas].',
           PRUEBA,
           DESCARGOS],
          box=['La conducta debe ser grave y afectar a la empresa; la vida privada sin relación con el trabajo no basta. Explica en la carta el efecto concreto en la empresa.',
               'Si la conducta es de naturaleza sexual hacia otra persona, usa el documento 04 y el procedimiento de la Ley Karin.']),

    carta('160', '08_Carta_Art160_N2_Negociaciones_Prohibidas.docx', T160,
          'Artículo 160 N° 2 del Código del Trabajo (Negociaciones prohibidas por escrito en el contrato)',
          "La causal aplicada es la del Artículo 160 N° 2 del Código del Trabajo, esto es: 'Negociaciones que ejecute el trabajador dentro del giro del negocio y que hubieren sido prohibidas por escrito en el respectivo contrato por el empleador'.",
          ['Su contrato de trabajo, en su cláusula [NÚMERO], le prohíbe expresamente [DESCRIBE LA PROHIBICIÓN: realizar por cuenta propia o de terceros negociaciones dentro del giro de la empresa].',
           HECHOS_INTRO + '[DESCRIBE LAS NEGOCIACIONES EJECUTADAS, CON FECHAS Y EVIDENCIA. EJEMPLO: entre marzo y junio de 2026 usted vendió por cuenta propia [PRODUCTOS / SERVICIOS] a clientes de la empresa mediante la empresa [NOMBRE]].',
           PRUEBA,
           DESCARGOS],
          box=['Solo procede si la prohibición está escrita en el contrato de trabajo. Adjunta copia de la cláusula.',
               'La negociación debe estar dentro del giro del negocio de tu empresa.']),

    carta('160', '09_Carta_Art160_N4_Abandono_del_Trabajo.docx', T160,
          'Artículo 160 N° 4 del Código del Trabajo (Abandono del trabajo)',
          "La causal aplicada es la del Artículo 160 N° 4 del Código del Trabajo (abandono del trabajo), en su [letra a): 'la salida intempestiva e injustificada del trabajador del sitio de la faena y durante las horas de trabajo, sin permiso del empleador o de quien lo represente' / letra b): 'la negativa del trabajador a trabajar sin causa justificada en las faenas convenidas en el contrato'] (borra la que no aplique).",
          [HECHOS_INTRO + '[LETRA a): el día [FECHA], a las [HORA], usted abandonó el [LUGAR DE TRABAJO] durante su jornada, sin dar aviso ni contar con permiso de [JEFATURA]. / LETRA b): el día [FECHA], [JEFATURA] le ordenó realizar [FAENA CONVENIDA EN SU CONTRATO] y usted se negó a hacerlo sin invocar causa justificada].',
           PRUEBA,
           DESCARGOS],
          box=['No es lo mismo que faltar al trabajo (documento 02): aquí el trabajador asiste y se va, o se niega a trabajar. Deja constancia el mismo día, con testigos y registro de asistencia.',
               'Si fue una negativa, acredita que la tarea estaba dentro de las funciones del contrato y quién dio la orden.']),

    carta('160', '10_Carta_Art160_N5_Imprudencias_Temerarias.docx', T160,
          'Artículo 160 N° 5 del Código del Trabajo (Actos, omisiones o imprudencias temerarias)',
          "La causal aplicada es la del Artículo 160 N° 5 del Código del Trabajo, esto es: 'Actos, omisiones o imprudencias temerarias que afecten a la seguridad o al funcionamiento del establecimiento, a la seguridad o a la actividad de los trabajadores, o a la salud de éstos'.",
          [HECHOS_INTRO + '[DESCRIBE EL ACTO U OMISIÓN, CON FECHA, LUGAR Y RIESGO GENERADO. EJEMPLO: el día [FECHA] usted operó la máquina [NOMBRE] sin el equipo de protección exigido y desactivó el resguardo de seguridad, poniendo en riesgo su integridad y la de sus compañeros].',
           'Usted conocía la obligación infringida, pues fue informado de ella mediante [REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD / CAPACITACIÓN DEL [FECHA] / OBLIGACIÓN DE INFORMAR LOS RIESGOS LABORALES], de lo cual consta registro firmado.',
           PRUEBA,
           DESCARGOS],
          box=['Acredita que el trabajador conocía la norma: reglamento interno, capacitación, entrega de elementos de protección y registros firmados.',
               'Reúne el informe del prevencionista de riesgos o del comité paritario si lo hay. Debe tratarse de una imprudencia grave (temeraria), no de un descuido menor.']),

    carta('160', '11_Carta_Art160_N6_Perjuicio_Material_Intencional.docx', T160,
          'Artículo 160 N° 6 del Código del Trabajo (Perjuicio material causado intencionalmente)',
          "La causal aplicada es la del Artículo 160 N° 6 del Código del Trabajo, esto es: 'El perjuicio material causado intencionalmente en las instalaciones, maquinarias, herramientas, útiles de trabajo, productos o mercaderías'.",
          [HECHOS_INTRO + '[DESCRIBE EL DAÑO, CON FECHA, LUGAR Y COSTO. EJEMPLO: el día [FECHA] usted [ACTO] el [BIEN], lo que dejó el equipo inutilizable y generó un perjuicio estimado en $[MONTO], según cotización/informe técnico de fecha [FECHA]].',
           'El daño fue causado de manera intencional, lo que se desprende de [EXPLICA POR QUÉ: reiteración, ausencia de explicación, registro de cámaras, declaraciones de testigos, informe técnico].',
           PRUEBA,
           DESCARGOS],
          box=['La ley exige que el daño sea intencional. Acredita la intención con cámaras, testigos o informe técnico; un accidente o descuido no basta.',
               'Guarda fotografías, el informe técnico y la cotización de reparación del daño.']),

    carta('160', '12_Carta_Art160_N7_Incumplimiento_Grave_del_Contrato.docx', T160,
          'Artículo 160 N° 7 del Código del Trabajo (Incumplimiento grave de las obligaciones del contrato)',
          "La causal aplicada es la del Artículo 160 N° 7 del Código del Trabajo, esto es: 'Incumplimiento grave de las obligaciones que impone el contrato'.",
          ['Su contrato de trabajo, en su cláusula [NÚMERO] (o el Reglamento Interno, artículo [NÚMERO]), le impone la obligación de [DESCRIBE LA OBLIGACIÓN].',
           HECHOS_INTRO + '[DESCRIBE EL INCUMPLIMIENTO, CON FECHAS. EJEMPLO: entre el [FECHA] y el [FECHA] usted no entregó los informes de ventas semanales exigidos, pese a las amonestaciones escritas del [FECHA] y [FECHA]].',
           'El incumplimiento es grave porque [EXPLICA LA GRAVEDAD: afecta el funcionamiento de la empresa, es reiterado a pesar de las amonestaciones, generó un perjuicio de $[MONTO]].',
           PRUEBA,
           DESCARGOS],
          box=['Es la causal que más se discute en tribunales. Debe tratarse de una obligación del contrato y de un incumplimiento grave, normalmente reiterado.',
               'Antes de despedir, deja constancia con amonestaciones escritas (documento 17). Cita la cláusula exacta del contrato o del reglamento interno.']),

    carta('159', '13_Carta_Art159_N4_Vencimiento_del_Plazo.docx',
          'CARTA DE TÉRMINO DE CONTRATO A PLAZO FIJO',
          'Artículo 159 N° 4 del Código del Trabajo (Vencimiento del plazo convenido)',
          "La causal aplicada es la del Artículo 159 N° 4 del Código del Trabajo, esto es: 'Vencimiento del plazo convenido en el contrato'.",
          ['Su contrato de trabajo a plazo fijo fue celebrado con fecha [FECHA] y establece como fecha de término el [FECHA DE TÉRMINO]. [Ha tenido [NÚMERO] renovaciones / No ha tenido renovaciones.]',
           'Llegada esa fecha, el plazo convenido vence y el contrato termina de pleno derecho, sin que la empresa tenga la intención de renovarlo ni de continuar la relación laboral.'],
          h2='II. ANTECEDENTES DEL CONTRATO:',
          intro=('Por medio de la presente, comunicamos a usted que el contrato de trabajo a plazo fijo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], '
                 'R.U.T. [RUT EMPRESA], termina el día [FECHA DE TÉRMINO] de [MES] de [AÑO], por la causal que se indica a continuación.'),
          pasos_propios=[COMUN_ITEM for COMUN_ITEM in [
              'Completa los campos entre corchetes [...] y borra las alternativas que no apliquen.',
              PLAZO_3,
              'Adjunta los comprobantes de pago de cotizaciones al día (AFP, salud y seguro de cesantía).']],
          box=['Si el trabajador sigue prestando servicios con tu conocimiento después de vencido el plazo, el contrato pasa a ser indefinido. La segunda renovación de un contrato a plazo fijo también lo transforma en indefinido, y la duración máxima es de un año (dos para gerentes o profesionales con título).',
               'Con fuero (maternal, sindical u otro) no puedes terminar el contrato sin autorización previa del juez (Art. 174).']),

    carta('159', '14_Carta_Art159_N5_Conclusion_del_Trabajo_o_Servicio.docx',
          'CARTA DE TÉRMINO DE CONTRATO POR OBRA O FAENA',
          'Artículo 159 N° 5 del Código del Trabajo (Conclusión del trabajo o servicio que dio origen al contrato)',
          "La causal aplicada es la del Artículo 159 N° 5 del Código del Trabajo, esto es: 'Conclusión del trabajo o servicio que dio origen al contrato'.",
          ['Su contrato de trabajo fue celebrado para la ejecución de [DESCRIBE LA OBRA, FAENA O SERVICIO ESPECÍFICO, SEGÚN LA CLÁUSULA [NÚMERO] DEL CONTRATO].',
           'Con fecha [FECHA] la obra o servicio [CONCLUYÓ / ENTREGÓ AL MANDANTE], según consta en [ACTA DE RECEPCIÓN / DOCUMENTO DE TÉRMINO], por lo que el trabajo que dio origen a su contrato ha terminado.'],
          h2='II. ANTECEDENTES:',
          intro=('Por medio de la presente, comunicamos a usted que el contrato de trabajo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], '
                 'R.U.T. [RUT EMPRESA], termina con fecha [FECHA DE TÉRMINO] de [MES] de [AÑO], por la causal que se indica a continuación.'),
          pasos_propios=[
              'Completa los campos entre corchetes [...] y borra las alternativas que no apliquen.',
              PLAZO_3,
              'Adjunta los comprobantes de pago de cotizaciones al día (AFP, salud y seguro de cesantía).'],
          box=['Solo procede si el contrato dice con claridad cuál es la obra, faena o servicio y este realmente terminó. Si el trabajador sigue haciendo tareas habituales de la empresa, se podría entender que el contrato es indefinido.',
               'Con fuero (maternal, sindical u otro) no puedes terminar el contrato sin autorización previa del juez (Art. 174).']),

    carta('159', '15_Carta_Art159_N6_Caso_Fortuito_o_Fuerza_Mayor.docx',
          'CARTA DE TÉRMINO DE CONTRATO POR CASO FORTUITO O FUERZA MAYOR',
          'Artículo 159 N° 6 del Código del Trabajo (Caso fortuito o fuerza mayor)',
          "La causal aplicada es la del Artículo 159 N° 6 del Código del Trabajo, esto es: 'Caso fortuito o fuerza mayor'.",
          ['Con fecha [FECHA] ocurrió [DESCRIBE EL HECHO IMPREVISIBLE E IRRESISTIBLE. EJEMPLO: un incendio que destruyó las instalaciones de la empresa / una inundación que inutilizó el local / una resolución de la autoridad que prohibió definitivamente la actividad].',
           'Este hecho no pudo ser previsto y no pudo ser resistido por la empresa, y tiene como consecuencia directa [EXPLICA POR QUÉ HACE IMPOSIBLE CONTINUAR EL CONTRATO: los puestos de trabajo no pueden mantenerse].',
           'Consta en [INFORME DE BOMBEROS / PERITAJE / RESOLUCIÓN / OTROS DOCUMENTOS], que quedan a disposición de la autoridad competente.'],
          h2='II. ANTECEDENTES:',
          intro=('Por medio de la presente, comunicamos a usted que el contrato de trabajo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], '
                 'R.U.T. [RUT EMPRESA], termina con fecha [FECHA DE TÉRMINO] de [MES] de [AÑO], por la causal que se indica a continuación.'),
          plazo=6,
          box=['Los tribunales interpretan esta causal en forma restrictiva: el hecho debe ser imprevisible e irresistible. Las dificultades económicas, la baja de ventas o el cierre por decisión de la empresa no suelen calificar.',
               'Si tu caso no es una catástrofe o un hecho externo grave, evalúa el documento 01 (necesidades de la empresa).']),

    dict(tipo='161d', archivo='16_Carta_Art161_Inc2_Desahucio_Escrito.docx',
         h2='II. FORMA DE TÉRMINO:',
         titulo='CARTA DE DESAHUCIO ESCRITO',
         subtitulo='Artículo 161 inciso segundo del Código del Trabajo (Desahucio del empleador)',
         intro=('Por medio de la presente, y en conformidad con el Artículo 161 inciso segundo del Código del Trabajo, comunicamos a usted el término '
                'del contrato de trabajo que lo vincula con nuestra empresa [RAZÓN SOCIAL EMPRESA], R.U.T. [RUT EMPRESA], mediante desahucio escrito del empleador.'),
         causal=("La causal aplicada es el desahucio escrito del empleador, que procede respecto de [gerentes / subgerentes / agentes / apoderados con facultades generales de administración / trabajadores de casa particular / cargos de exclusiva confianza del empleador] (borra lo que no aplique). Usted se desempeña como [CARGO]."),
         hechos=['Por tratarse de un cargo comprendido en la norma señalada, el empleador puede poner término al contrato por desahucio escrito, sin necesidad de expresar otra causa.',
                 '[OPCIÓN A: El contrato terminará el día [FECHA, AL MENOS 30 DÍAS DESPUÉS DE LA ENTREGA DE ESTA CARTA], respetándose el aviso previo de treinta días.]\n[OPCIÓN B: El contrato termina el día [FECHA]. En reemplazo del aviso previo, se le pagará al momento de la terminación una indemnización en dinero efectivo equivalente a la última remuneración mensual devengada.]'],
         finiquito=('Su finiquito, con las remuneraciones devengadas pendientes, la compensación del feriado legal y proporcional pendiente (Art. 73) y, si corresponde, la '
                    'indemnización sustitutiva del aviso previo y las indemnizaciones pactadas en su contrato o las que correspondan por ley, estará disponible en [NOTARÍA / LUGAR DE FIRMA] dentro del plazo de 10 días hábiles contado desde la separación.'),
         box=['Esta carta solo aplica a los cargos que indica el Art. 161 inciso segundo. Para el resto de los trabajadores, usa el documento 01.',
              'El desahucio requiere 30 días de aviso, o pagar una indemnización equivalente a la última remuneración mensual en dinero efectivo. Envía copia a la Inspección del Trabajo.',
              'Si el trabajador es de casa particular, revisa las reglas especiales de indemnización del Art. 163.',
              'No puedes usar esta causal si el trabajador está con licencia médica por enfermedad común, accidente del trabajo o enfermedad profesional (Art. 161).'],
         pasos_propios=[
             'Completa los campos entre corchetes [...] y borra las alternativas que no apliquen.',
             'PLAZO: entrega la carta en mano o envíala por carta certificada al domicilio del contrato dentro de los 3 DÍAS HÁBILES siguientes a la separación del trabajador, con copia a la Inspección del Trabajo, y con 30 días de anticipación si no pagas el mes de aviso.',
             'Adjunta los comprobantes de pago de cotizaciones al día (AFP, salud y seguro de cesantía).']),
]

# Documentos de apoyo ---------------------------------------------------------------------------------

LIN = '______________________________________________________________________'

DOCS_EXTRA = [
    dict(archivo='17_Carta_de_Amonestacion_Escrita.docx',
         titulo='CARTA DE AMONESTACIÓN ESCRITA',
         subtitulo='Constancia previa para respaldar una futura medida disciplinaria',
         box_titulo='INSTRUCCIÓN PARA EL EMPLEADOR:',
         box=['Úsala cuando haya una falta que aún no justifica el despido. Entrégala en mano y pide la firma del trabajador. Si se niega a firmar, déjalo anotado con dos testigos.',
              'Describe un hecho concreto por carta, con fecha y la norma infringida. Varias amonestaciones por hechos distintos y bien documentados sostienen mejor una causal como el Art. 160 N° 7.',
              'Si tu reglamento interno contempla amonestaciones, cita el artículo y respeta su procedimiento.'],
         body=[('date',), ('addr',), ('salut',),
               ('t', 'Por medio de la presente, la empresa [RAZÓN SOCIAL EMPRESA] deja constancia de que el día [FECHA], a las [HORA], usted [DESCRIBE EL HECHO CON PRECISIÓN: falta de puntualidad, incumplimiento de una tarea, trato inadecuado, etc.].'),
               ('h', 'I. NORMA INFRINGIDA:'),
               ('t', 'Esta conducta infringe [CLÁUSULA [NÚMERO] DEL CONTRATO DE TRABAJO / ARTÍCULO [NÚMERO] DEL REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD], que establece [TRANSCRIBE O RESUME LA OBLIGACIÓN].'),
               ('h', 'II. MEDIDA Y REQUERIMIENTO:'),
               ('t', 'Se le amonesta por escrito [SEGÚN EL REGLAMENTO INTERNO] y se le solicita [DESCRIBE LA CONDUCTA ESPERADA] a contar de esta fecha. Usted puede dejar constancia de sus observaciones al pie de este documento.'),
               ('t', 'Le recordamos que la reiteración de conductas como la descrita podría dar lugar a medidas disciplinarias adicionales y, si es grave, al término del contrato en conformidad con la ley.'),
               ('close',), ('sig', 'RECIBÍ CONFORME / OBSERVACIONES DEL TRABAJADOR\nNombre: [NOMBRE TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nFecha: ____ / ____ / ________\n(Si se niega a firmar: testigos 1 y 2)')]),

    dict(archivo='18_Citacion_y_Acta_de_Descargos.docx',
         titulo='CITACIÓN Y ACTA DE DESCARGOS',
         subtitulo='Para oír al trabajador antes de decidir una medida disciplinaria o el despido',
         box_titulo='INSTRUCCIÓN PARA EL EMPLEADOR:',
         box=['La ley no obliga a citar a descargos antes de despedir por causal disciplinaria, pero hacerlo muestra que oíste al trabajador y puede evitar errores.',
              'Entrega la citación con al menos [2] días hábiles de anticipación y guarda constancia de la entrega.',
              'Registra lo que diga el trabajador, aunque lo niegue todo. Si no asiste o se niega a firmar, anótalo con dos testigos.',
              'Si los hechos pueden ser acoso sexual, acoso laboral o violencia en el trabajo, aplica el procedimiento de la Ley Karin en lugar de este documento.'],
         body=[('h', 'PARTE A: CITACIÓN'),
               ('date',), ('addr',), ('salut',),
               ('t', 'Por medio de la presente, la empresa [RAZÓN SOCIAL EMPRESA] lo cita a una reunión el día [FECHA], a las [HORA], en [LUGAR], para que pueda dar su versión y presentar los antecedentes que estime pertinentes sobre los siguientes hechos: [DESCRIBE BREVEMENTE LOS HECHOS QUE SE LE ATRIBUYEN].'),
               ('t', 'Si lo desea, podrá asistir acompañado de un compañero de trabajo o de un representante sindical. Si no puede asistir en esa fecha, comuníquelo a [PERSONA / CORREO] para fijar otra oportunidad.'),
               ('close', 'Atentamente,'),
               ('sig', 'RECIBÍ LA CITACIÓN\nNombre: [NOMBRE TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nFecha: ____ / ____ / ________'),
               ('sp',),
               ('h', 'PARTE B: ACTA DE DESCARGOS'),
               ('l', 'Fecha y hora: ', '____ / ____ / ________   ____:____ hrs.     Lugar: ______________________________'),
               ('l', 'Asisten: ', 'Trabajador/a [NOMBRE, RUT]; por la empresa [NOMBRE, CARGO]; testigo/s [NOMBRE, CARGO].'),
               ('l', 'Hechos que se le atribuyen: ', LIN),
               ('t', LIN),
               ('l', 'Versión del trabajador: ', LIN),
               ('t', LIN),
               ('t', LIN),
               ('l', 'Antecedentes o pruebas que entrega: ', LIN),
               ('l', 'Observaciones de la empresa: ', LIN),
               ('t', 'El trabajador declara haber leído el acta y [ESTAR / NO ESTAR] de acuerdo con su contenido. Si se niega a firmar, se deja constancia con la firma de dos testigos.'),
               ('sp',),
               ('sig', 'FIRMA DEL TRABAJADOR\nNombre: [NOMBRE TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nTestigos (si se niega a firmar):\n1. ________________   2. ________________')]),

    dict(archivo='19_Comunicacion_a_la_Inspeccion_del_Trabajo.docx',
         titulo='COMUNICACIÓN A LA INSPECCIÓN DEL TRABAJO',
         subtitulo='Copia de la carta de término del contrato (Art. 162 del Código del Trabajo)',
         box_titulo='INSTRUCCIÓN PARA EL EMPLEADOR:',
         box=['El Art. 162 exige enviar copia de la carta a la Inspección del Trabajo dentro del mismo plazo de la carta (3 días hábiles; 6 si es el Art. 159 N° 6).',
              'La Dirección del Trabajo tiene un servicio electrónico para informar el término de contrato en su portal (Mi DT). Si lo usas, guarda el comprobante. Este documento sirve para presentarlo en la oficina.',
              'Adjunta copia de la carta enviada y el comprobante de Correos. Guarda el timbre de recepción.'],
         body=[('date',),
               ('t', 'Señor(a) Inspector(a) Comunal del Trabajo de [COMUNA]\nPresente.'),
               ('t', 'De mi consideración: en cumplimiento del Artículo 162 del Código del Trabajo, la empresa [RAZÓN SOCIAL EMPRESA], R.U.T. [RUT EMPRESA], domiciliada en [DIRECCIÓN], remite copia de la carta de término del contrato de trabajo del trabajador que se indica:'),
               ('l', 'Trabajador/a: ', '[NOMBRE COMPLETO], R.U.T. [RUT], cargo [CARGO].'),
               ('l', 'Fecha de separación: ', '[DÍA] de [MES] de [AÑO].'),
               ('l', 'Causal invocada: ', '[ARTÍCULO Y NÚMERO, EJ.: Art. 160 N° 3 del Código del Trabajo].'),
               ('l', 'Fecha de envío de la carta: ', '[FECHA]     N° de carta certificada: [NÚMERO DE SEGUIMIENTO]'),
               ('t', 'Se adjunta copia de la carta y del comprobante de envío.'),
               ('close', 'Saluda atentamente a usted,'),
               ('sig', 'TIMBRE DE RECEPCIÓN\nInspección del Trabajo\nFecha: ____ / ____ / ________')]),

    dict(archivo='20_Estado_de_Pago_de_Cotizaciones_Previsionales.docx',
         titulo='ESTADO DE PAGO DE COTIZACIONES PREVISIONALES',
         subtitulo='Anexo a la carta de término (Art. 162 del Código del Trabajo)',
         box_titulo='INSTRUCCIÓN PARA EL EMPLEADOR:',
         box=['Si al momento del despido no están pagadas las cotizaciones, el despido no produce el efecto de poner término al contrato y debes seguir pagando las remuneraciones hasta convalidarlo (Art. 162).',
              'Completa una línea por institución con los datos del comprobante de Previred y adjunta los comprobantes.',
              'Revisa que las cotizaciones estén efectivamente pagadas, no solo declaradas.'],
         body=[('date',),
               ('l', 'Trabajador/a: ', '[NOMBRE COMPLETO]   R.U.T.: [RUT]   Cargo: [CARGO]'),
               ('l', 'Empleador: ', '[RAZÓN SOCIAL EMPRESA]   R.U.T.: [RUT EMPRESA]'),
               ('l', 'Período informado: ', 'desde [MES Y AÑO DE INICIO] hasta [MES Y AÑO ANTERIOR AL TÉRMINO].'),
               ('h', 'Estado de pago por institución:'),
               ('l', 'AFP [NOMBRE]: ', 'pagada hasta [MES/AÑO]. Comprobante N° [NÚMERO] de fecha [FECHA].'),
               ('l', 'Salud [FONASA / ISAPRE NOMBRE]: ', 'pagada hasta [MES/AÑO]. Comprobante N° [NÚMERO] de fecha [FECHA].'),
               ('l', 'Seguro de Cesantía (AFC): ', 'pagado hasta [MES/AÑO]. Comprobante N° [NÚMERO] de fecha [FECHA].'),
               ('l', 'Seguro de accidentes del trabajo [MUTUAL / ISL]: ', 'pagado hasta [MES/AÑO]. Comprobante N° [NÚMERO] de fecha [FECHA].'),
               ('l', 'Otras (caja de compensación, APV u otras convenidas): ', '[DETALLE O "NO APLICA"].'),
               ('h', 'Declaración:'),
               ('t', 'El empleador declara que las cotizaciones previsionales y de salud del trabajador se encuentran pagadas hasta el último día del mes anterior al término del contrato, y acompaña los comprobantes que lo acreditan.'),
               ('close', 'Atentamente,'),
               ('sig', 'RECIBÍ CONFORME (TRABAJADOR)\nNombre: [NOMBRE TRABAJADOR]\nR.U.T.: [RUT TRABAJADOR]\nFecha: ____ / ____ / ________')]),

    dict(archivo='21_Checklist_de_Despido_Paso_a_Paso.docx',
         titulo='CHECKLIST DE DESPIDO PASO A PASO',
         subtitulo='Antes, durante y después de la carta (Código del Trabajo)',
         body=[('t', 'Este listado resume los pasos clave al terminar un contrato. Es una guía de referencia: cada caso puede tener particularidades.'),
               ('h', 'PASO 1: ¿PUEDO DESPEDIR A ESTA PERSONA?'),
               ('t', '• Fuero: maternal, sindical, de dirigentes u otros. Con fuero no puedes terminar el contrato sin autorización previa del juez (Art. 174).\n• Licencia médica: no puedes invocar necesidades de la empresa ni desahucio si está con licencia por enfermedad común, accidente del trabajo o enfermedad profesional (Art. 161).\n• Denuncias pendientes: si hay una denuncia de acoso, sigue el procedimiento de la Ley Karin antes de decidir.'),
               ('h', 'PASO 2: ELEGIR LA CAUSAL Y REUNIR LA PRUEBA'),
               ('t', '• Art. 159 (sin culpa del trabajador): vencimiento del plazo (N° 4), conclusión de la obra (N° 5), caso fortuito (N° 6).\n• Art. 160 (falta del trabajador): conductas indebidas graves (N° 1), negociaciones prohibidas (N° 2), inasistencias (N° 3), abandono (N° 4), imprudencias (N° 5), perjuicio intencional (N° 6), incumplimiento grave (N° 7).\n• Art. 161: necesidades de la empresa, o desahucio para los cargos que indica la ley.\n• Reúne la prueba antes de enviar la carta: registros, correos, cámaras, testigos, amonestaciones.'),
               ('h', 'PASO 3: PAGAR Y ACREDITAR LAS COTIZACIONES'),
               ('t', '• Las cotizaciones deben estar pagadas hasta el último día del mes anterior al despido. Si no, el despido no produce efecto y debes seguir pagando remuneraciones hasta convalidarlo (Art. 162).\n• Informa el estado de pago por escrito y adjunta los comprobantes (documento 20).'),
               ('h', 'PASO 4: REDACTAR LA CARTA'),
               ('t', '• Indica la causal legal y los hechos en que se funda, con fechas, horas, lugares y personas.\n• En juicio solo puedes defender los hechos que consten en la carta (Art. 454 N° 1).\n• Usa el modelo que corresponda a tu causal.'),
               ('h', 'PASO 5: ENTREGAR LA CARTA EN PLAZO'),
               ('t', '• Entrégala en mano o envíala por carta certificada al domicilio del contrato dentro de 3 días hábiles desde la separación (6 días hábiles si es el Art. 159 N° 6).\n• Art. 161: avisa con 30 días de anticipación, o paga la indemnización sustitutiva equivalente a la última remuneración mensual.\n• Guarda el comprobante de Correos o la firma de recepción del trabajador.'),
               ('h', 'PASO 6: AVISAR A LA INSPECCIÓN DEL TRABAJO'),
               ('t', '• Envía copia de la carta a la Inspección del Trabajo dentro del mismo plazo, por el servicio electrónico de la Dirección del Trabajo o con el documento 19.'),
               ('h', 'PASO 7: FINIQUITO'),
               ('t', '• Prepara el finiquito con remuneraciones pendientes, feriado proporcional y, si corresponde, indemnizaciones, y pónlo a disposición del trabajador dentro de 10 días hábiles.\n• Para que tenga poder liberatorio, debe firmarse ante un ministro de fe (notario, Inspección del Trabajo u otro que indica el Art. 177).'),
               ('h', 'DESPUÉS: SI EL TRABAJADOR RECLAMA'),
               ('t', '• El trabajador tiene 60 días hábiles para demandar por despido injustificado (Art. 168). Si el juez declara el despido injustificado, indebido o improcedente, las indemnizaciones se pagan con recargo de entre 30% y 80%, según la causal invocada.\n• Conserva toda la documentación de este pack mientras pueda haber un reclamo.')]),
]

GUIA = dict(
    archivo='00_LEEME_Guia_de_Uso_y_Plazos.docx',
    titulo='GUÍA DE USO DEL PACK DE CARTAS DE DESPIDO',
    subtitulo='Qué carta usar, plazos y errores frecuentes (Código del Trabajo)',
    box_titulo='AVISO:',
    box=['Son modelos de referencia basados en el Código del Trabajo; no constituyen asesoría legal. Si tu caso tiene particularidades (fuero, denuncias, montos altos), revísalo con un abogado antes de enviar la carta.'],
    body=[('h', '¿QUÉ CARTA USAR?'),
          ('t', '• Necesidades de la empresa (reorganización, baja de productividad): 01.\n• No llegó a trabajar (2 días seguidos, 2 lunes en el mes o 3 días en el mes): 02.\n• Falta de probidad (robo, fraude, falsedad): 03.\n• Acoso sexual o laboral comprobado: 04 (solo después de la investigación Ley Karin).\n• Agresión física: 05.  • Insultos al empleador: 06.  • Conducta inmoral que afecta a la empresa: 07.\n• Negociaciones prohibidas por contrato: 08.  • Abandono del trabajo: 09.\n• Imprudencias graves de seguridad: 10.  • Daño intencional: 11.  • Incumplimiento grave del contrato: 12.\n• Contrato a plazo fijo que vence: 13.  • Obra o faena terminada: 14.  • Caso fortuito o fuerza mayor: 15.\n• Gerentes, apoderados o trabajadores de casa particular (desahucio): 16.'),
          ('h', 'DOCUMENTOS DE APOYO'),
          ('t', '• 17 Carta de amonestación escrita.  • 18 Citación y acta de descargos.  • 19 Comunicación a la Inspección del Trabajo.  • 20 Estado de pago de cotizaciones.  • 21 Checklist paso a paso.'),
          ('h', 'PLAZOS CLAVE'),
          ('t', '• Carta: dentro de 3 días hábiles desde la separación (6 días hábiles en caso fortuito o fuerza mayor), en mano o por carta certificada al domicilio del contrato.\n• Copia a la Inspección del Trabajo: en el mismo plazo.\n• Art. 161: aviso con 30 días de anticipación o indemnización sustitutiva equivalente a la última remuneración mensual.\n• Finiquito: a disposición del trabajador dentro de 10 días hábiles.\n• El trabajador tiene 60 días hábiles para reclamar un despido (Art. 168).'),
          ('h', 'ERRORES FRECUENTES'),
          ('t', '• Hechos vagos en la carta. En juicio solo puedes defender los hechos escritos (Art. 454 N° 1).\n• Cotizaciones sin pagar al despedir: el despido no produce efecto (Art. 162).\n• Despedir a una persona con fuero sin autorización del juez (Art. 174).\n• Usar necesidades de la empresa con un trabajador con licencia médica (Art. 161).\n• Cambiar de causal después: la carta fija los hechos y la causal.\n• Despedir por acoso sin haber terminado la investigación Ley Karin.'),
          ('h', 'CÓMO COMPLETAR LOS MODELOS'),
          ('t', 'Completa los campos entre corchetes [...] y borra las alternativas que no apliquen. Mantén los datos de la persona afectada en reserva cuando haya denuncias. Imprime dos copias: una para el trabajador y otra con su firma de recepción para el empleador.')]
)
