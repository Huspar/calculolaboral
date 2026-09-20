/**
 * Generador de Informe Ejecutivo de Contratación & Comparador de 3 Columnas (Chile 2026)
 * Desarrollado para Cálculo Laboral Chile (calculolaboral.cl)
 * Producto Digital: $4.990 CLP (Flow.cl)
 */

(function () {
    'use strict';

    var FLOW_TOKEN = 'a2ebbd799fc71fb07a2caf43814319d6b44715fa';
    var FLOW_CHECKOUT_URL = 'https://www.flow.cl/btn.php?token=' + FLOW_TOKEN;

    // Utilidades de formato
    function formatCLP(amount) {
        if (isNaN(amount)) return '$0';
        return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function getFolio() {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var rand = Math.floor(1000 + Math.random() * 9000);
        return 'CL-INF-' + y + m + d + '-' + rand;
    }

    function getFechaFormateada() {
        var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        var d = new Date();
        return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
    }

    // Calcula los 3 escenarios en paralelo a partir de los datos ingresados
    function calcularTresModalidades(monto, modo, opciones) {
        var calc = window.CostoEmpresaCalculator;
        if (!calc) return null;

        // Opciones comunes
        var tasaMutual = opciones.tasaMutual || 0.0093;
        var asignaciones = opciones.asignaciones || 0;
        var tieneGratif = opciones.gratificacion !== false;

        // 1. Escenario INDEFINIDO
        var optsIndef = {
            tipoContrato: 'indefinido',
            tasaMutual: tasaMutual,
            gratificacion: tieneGratif,
            gratificacionAdicional: opciones.gratificacionAdicional || false,
            asignaciones: asignaciones,
            incluirProvisiones: true
        };
        var resIndef = (modo === 'liquido') 
            ? calc.calcularDesdeLiquido(monto, optsIndef) 
            : calc.calcularDesdeBase(monto, optsIndef);

        // 2. Escenario PLAZO FIJO (AFC 3.0% empleador, $0 en provisión de años de servicio IAS)
        var optsPlazo = {
            tipoContrato: 'plazo',
            tasaMutual: tasaMutual,
            gratificacion: tieneGratif,
            gratificacionAdicional: opciones.gratificacionAdicional || false,
            asignaciones: asignaciones,
            incluirProvisiones: true // Provisión vacaciones sí corre, IAS es $0 en la calculadora
        };
        var resPlazo = (modo === 'liquido') 
            ? calc.calcularDesdeLiquido(monto, optsPlazo) 
            : calc.calcularDesdeBase(monto, optsPlazo);

        // 3. Escenario HONORARIOS (Prestación de Servicios)
        // El monto acordado es el líquido en bolsillo o bruto
        // Tasa retención SII vigente en 2026: 14.5%
        var retencionTasa = 0.145;
        var honorarioLiquido = resIndef.sueldoLiquido;
        var honorarioBruto = Math.round(honorarioLiquido / (1 - retencionTasa));
        var retencionPesos = honorarioBruto - honorarioLiquido;

        var resHonorarios = {
            montoBruto: honorarioBruto,
            retencionSII: retencionPesos,
            montoLiquido: honorarioLiquido,
            costoEmpresaMensual: honorarioBruto, // La empresa solo desembolsa el bruto (líquido + retención F29)
            costoEmpresaAnual: honorarioBruto * 12,
            leyesPatronales: 0,
            provisiones: 0,
            factorMultiplicador: (honorarioBruto / honorarioLiquido)
        };

        return {
            indefinido: resIndef,
            plazo: resPlazo,
            honorarios: resHonorarios,
            modo: modo,
            montoIngresado: monto,
            cargo: opciones.cargo || 'Cargo / Puesto Presupuestado',
            folio: getFolio(),
            fecha: getFechaFormateada()
        };
    }

    // Estilos CSS incrustados para renderizado nítido y A4 print
    function getEstilosInforme() {
        return `
        <style>
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm;
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff !important;
                    font-family: 'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .no-print {
                    display: none !important;
                }
                .informe-a4-page {
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                }
            }

            .informe-a4-page {
                background: #ffffff;
                max-width: 820px;
                margin: 0 auto;
                padding: 28px 32px;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
                font-family: 'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                color: #0f172a;
            }

            .con-marca-agua {
                position: relative;
                overflow: hidden;
            }

            .watermark-badge {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-25deg);
                font-size: 26px;
                font-weight: 900;
                color: rgba(225, 29, 72, 0.14);
                border: 4px dashed rgba(225, 29, 72, 0.25);
                padding: 14px 32px;
                border-radius: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                pointer-events: none;
                user-select: none;
                z-index: 40;
                white-space: nowrap;
            }

            .logo-box {
                width: 34px;
                height: 34px;
                border-radius: 8px;
                background-color: #0284c7 !important;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
            }

            .badge-dt-conforme {
                display: inline-block;
                background-color: #ecfdf5;
                color: #065f46;
                border: 1px solid #a7f3d0;
                font-size: 10px;
                font-weight: 800;
                padding: 3px 10px;
                border-radius: 9999px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .tabla-comparativa {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                font-size: 11px;
                border: 1px solid #cbd5e1;
                border-radius: 10px;
                overflow: hidden;
            }

            .tabla-comparativa th {
                background-color: #f8fafc;
                padding: 9px 12px;
                text-align: left;
                font-weight: 800;
                color: #0f172a;
                border-bottom: 2px solid #cbd5e1;
                border-right: 1px solid #e2e8f0;
                font-size: 10.5px;
            }

            .tabla-comparativa th:last-child {
                border-right: none;
            }

            .tabla-comparativa th.col-indef {
                background-color: #e0f2fe;
                color: #0369a1;
                border-bottom: 2px solid #0284c7;
            }

            .tabla-comparativa td {
                padding: 7px 12px;
                border-bottom: 1px solid #e2e8f0;
                border-right: 1px solid #f1f5f9;
                vertical-align: middle;
            }

            .tabla-comparativa td:last-child {
                border-right: none;
            }

            .tabla-comparativa tr:last-child td {
                border-bottom: none;
            }

            .tabla-comparativa tr.fila-destacada td {
                background-color: #f0fdf4;
                border-top: 2px solid #0284c7;
                border-bottom: 2px solid #0284c7;
            }

            .tabla-comparativa tr.fila-destacada td:nth-child(2) {
                background-color: #e0f2fe !important;
            }

            .tag-riesgo {
                display: inline-block;
                padding: 2.5px 8px;
                border-radius: 6px;
                font-size: 9.5px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .tag-bajo {
                background-color: #dcfce7;
                color: #15803d;
                border: 1px solid #bbf7d0;
            }

            .tag-medio {
                background-color: #fef3c7;
                color: #b45309;
                border: 1px solid #fde68a;
            }

            .tag-alto {
                background-color: #ffe4e6;
                color: #be123c;
                border: 1px solid #fecdd3;
            }

            .box-alerta-riesgo {
                background-color: #fff1f2;
                border: 1px solid #fecdd3;
                border-left: 5px solid #e11d48;
                padding: 12px 14px;
                border-radius: 10px;
            }

            .badge-alerta {
                background-color: #e11d48;
                color: #ffffff;
                font-size: 9.5px;
                font-weight: 900;
                padding: 2.5px 7px;
                border-radius: 5px;
                letter-spacing: 0.5px;
                display: inline-block;
            }
        </style>
        `;
    }

    // Plantilla HTML del Informe Ejecutivo A4
    function generarHTMLInforme(data, esVistaPrevia) {
        var ind = data.indefinido;
        var plz = data.plazo;
        var hon = data.honorarios;

        var marcaAguaClase = esVistaPrevia ? 'con-marca-agua' : '';
        var estilos = getEstilosInforme();

        return estilos + `
        <div class="informe-a4-page ${marcaAguaClase}">
            ${esVistaPrevia ? '<div class="watermark-badge">VISTA PREVIA DE EJEMPLO • CÁLCULO LABORAL</div>' : ''}
            
            <!-- ENCABEZADO OFICIAL -->
            <div class="informe-header">
                <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                    <div class="flex items-center gap-2.5">
                        <div class="logo-box">
                            <svg class="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M30 84h40M38 79h24"></path>
                                <path d="M50 22v57"></path>
                                <path d="M50 14l-2 4h4l-2-4v8"></path>
                                <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                                <path d="M18 36l-8 18h16Z"></path>
                                <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                                <path d="M82 36l-8 18h16Z"></path>
                                <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                                <path d="M41 43.5a10 10 0 1 0 0 20h6"></path>
                                <path d="M58 43.5v20h10"></path>
                            </svg>
                        </div>
                        <div>
                            <span class="font-extrabold text-lg tracking-tight text-slate-900 block leading-tight">Cálculo<span class="text-sky-600">Laboral</span></span>
                            <span class="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Plataforma de Inteligencia Laboral para Pymes</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="badge-dt-conforme">DT Chile Conforme 2026</span>
                        <div class="text-[10.5px] text-slate-600 font-mono mt-0.5">Folio: <strong class="text-slate-900">${data.folio}</strong></div>
                        <div class="text-[10px] text-slate-400 font-mono">Emisión: ${data.fecha}</div>
                    </div>
                </div>

                <div class="text-center my-3.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 bg-sky-100/70 px-3 py-1 rounded-full border border-sky-200">
                        Documento Oficial de Decisión Estratégica & Presupuesto
                    </span>
                    <h1 class="text-2xl font-black text-slate-900 tracking-tight mt-2">
                        Informe Ejecutivo de Presupuesto Laboral & Matriz 3 Vías
                    </h1>
                    <p class="text-xs text-slate-600 max-w-xl mx-auto mt-1 leading-relaxed">
                        Evaluación integral de costos reales, aportes patronales obligatorios, pasivos laborales ocultos y contingencias inspectivas DT para: <strong class="text-slate-900">${data.cargo}</strong>.
                    </p>
                </div>
            </div>

            <!-- FICHA RESUMEN DE NEGOCIACIÓN -->
            <div class="grid grid-cols-4 gap-3 my-4 p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs">
                <div>
                    <span class="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Sueldo Acordado Líquido</span>
                    <span class="font-mono font-extrabold text-slate-900 text-sm block mt-0.5">${formatCLP(ind.sueldoLiquido)}</span>
                </div>
                <div>
                    <span class="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Sueldo Base Mensual</span>
                    <span class="font-mono font-bold text-slate-800 text-sm block mt-0.5">${formatCLP(ind.sueldoBase)}</span>
                </div>
                <div>
                    <span class="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Colación + Movilización</span>
                    <span class="font-mono font-semibold text-slate-700 text-sm block mt-0.5">${formatCLP(ind.asignacionesNoImponibles)}</span>
                </div>
                <div>
                    <span class="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Tasa Mutual Estimada</span>
                    <span class="font-mono font-semibold text-slate-700 text-sm block mt-0.5">${(ind.costoMutual / (ind.totalImponible || 1) * 100).toFixed(2)}%</span>
                </div>
            </div>

            <!-- EL COMPARADOR ESTRATÉGICO DE 3 COLUMNAS -->
            <div class="my-4">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                        Comparativa Estratégica de Contratación (3 Vías Posibles)
                    </h2>
                    <span class="text-[10px] text-slate-500 font-medium">Análisis financiero y legal certificado</span>
                </div>

                <table class="tabla-comparativa">
                    <thead>
                        <tr>
                            <th class="w-1/4">Criterio de Decisión</th>
                            <th class="w-1/4 col-indef">1. Contrato Indefinido (Estándar)</th>
                            <th class="w-1/4 col-plazo">2. Contrato a Plazo Fijo</th>
                            <th class="w-1/4 col-hon">3. Boleta de Honorarios</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="font-semibold text-slate-700">Líquido que recibe el colaborador</td>
                            <td class="font-mono font-bold text-slate-900 bg-sky-50/50">${formatCLP(ind.sueldoLiquido)}</td>
                            <td class="font-mono font-bold text-slate-900">${formatCLP(plz.sueldoLiquido)}</td>
                            <td class="font-mono font-bold text-slate-900">${formatCLP(hon.montoLiquido)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Total Imponible Bruto / Facturado</td>
                            <td class="font-mono text-slate-800 bg-sky-50/50">${formatCLP(ind.totalImponible)}</td>
                            <td class="font-mono text-slate-800">${formatCLP(plz.totalImponible)}</td>
                            <td class="font-mono text-slate-800">${formatCLP(hon.montoBruto)} <span class="text-[9.5px] text-slate-500">(Ret. 14,5%)</span></td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Aportes Patronales (SIS, AFC, Mutual)</td>
                            <td class="font-mono font-semibold text-emerald-700 bg-sky-50/50">+${formatCLP(ind.totalAportesPatronales)}</td>
                            <td class="font-mono font-semibold text-emerald-700">+${formatCLP(plz.totalAportesPatronales)} <span class="text-[9px] text-slate-400 block">(AFC 3,0%)</span></td>
                            <td class="font-mono text-slate-400">$0 aparente</td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Reserva Pasivos (Vacaciones + Finiquito)</td>
                            <td class="font-mono font-semibold text-amber-700 bg-sky-50/50">+${formatCLP(ind.totalProvisiones)} <span class="text-[9px] text-amber-600 block">(Vac. + IAS 8,33%)</span></td>
                            <td class="font-mono font-semibold text-amber-700">+${formatCLP(plz.totalProvisiones)} <span class="text-[9px] text-slate-400 block">(Solo Vacaciones)</span></td>
                            <td class="font-mono text-slate-400">$0 aparente</td>
                        </tr>
                        <tr class="fila-destacada">
                            <td class="font-black text-slate-900 text-xs">COSTO REAL MENSUAL EMPRESA</td>
                            <td class="font-mono font-black text-sky-800 text-base">${formatCLP(ind.costoEmpresaTotal)}</td>
                            <td class="font-mono font-black text-slate-900 text-sm">${formatCLP(plz.costoEmpresaTotal)}</td>
                            <td class="font-mono font-bold text-slate-600 text-sm">${formatCLP(hon.costoEmpresaMensual)}*</td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Presupuesto Anual Consolidado (12m)</td>
                            <td class="font-mono font-bold text-slate-900 bg-sky-50/50">${formatCLP(ind.costoEmpresaAnual)}</td>
                            <td class="font-mono font-bold text-slate-900">${formatCLP(plz.costoEmpresaAnual)}</td>
                            <td class="font-mono text-slate-700">${formatCLP(hon.costoEmpresaAnual)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Factor Multiplicador sobre Líquido</td>
                            <td class="font-mono font-bold text-sky-700 bg-sky-50/50">${ind.factorMultiplicador.toFixed(2)}x</td>
                            <td class="font-mono font-bold text-slate-700">${plz.factorMultiplicador.toFixed(2)}x</td>
                            <td class="font-mono text-slate-600">${hon.factorMultiplicador.toFixed(2)}x</td>
                        </tr>
                        <tr>
                            <td class="font-semibold text-slate-700">Semáforo de Riesgo Inspectivo DT</td>
                            <td class="bg-sky-50/50"><span class="tag-riesgo tag-bajo">BAJO (Blindado)</span></td>
                            <td><span class="tag-riesgo tag-medio">MEDIO (Máx 2 renovaciones)</span></td>
                            <td><span class="tag-riesgo tag-alto">CRÍTICO (Riesgo Demanda)</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- MATRIZ DE RIESGO: BOLETA DE HONORARIOS VS REALIDAD DT -->
            <div class="box-alerta-riesgo my-4">
                <div class="flex items-start gap-3">
                    <span class="badge-alerta shrink-0">ALERTA LEGAL DT</span>
                    <div>
                        <h3 class="text-xs font-black text-rose-950">
                            Peligro de Contingencia Oculta por Prestación a Honorarios (Art. 7 y 8 Código del Trabajo)
                        </h3>
                        <p class="text-[11px] text-rose-900 leading-relaxed mt-1">
                            Si contratas a honorarios pero la persona <strong>cumple horario, tiene jefatura directa, correo corporativo o exclusividad</strong>, la Dirección del Trabajo y los Tribunales calificarán la relación como un <strong>contrato de trabajo encubierto</strong>.
                        </p>
                        <div class="grid grid-cols-3 gap-2.5 mt-2.5 pt-2.5 border-t border-rose-200/90 text-[10px] text-rose-950 leading-snug">
                            <div><strong>1. Pago Retroactivo:</strong> Todas las imposiciones adeudadas (AFP, Salud, AFC, Mutual) con reajustes e intereses acumulados.</div>
                            <div><strong>2. Ley Bustos (Art. 162):</strong> La empresa debe pagar el sueldo íntegro de cada mes transcurrido durante el juicio laboral.</div>
                            <div><strong>3. Multas DT:</strong> De 10 a 60 UTM ($696.000 a $4.176.000) por trabajador no escriturado según tamaño de empresa.</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DESGLOSE CONTABLE ITEMIZADO (PARA CONTADOR Y SOCIOS) -->
            <div class="my-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
                    Desglose Contable Itemizado (Contrato Indefinido - Moneda CLP)
                </h3>
                <div class="grid grid-cols-2 gap-3 text-[11px]">
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <span class="font-bold text-slate-900 block text-[10px] uppercase tracking-wider mb-1">Aportes Patronales Obligatorios (Costo Directo)</span>
                        <div class="flex justify-between text-slate-700"><span>Seguro Invalidez y Sobrevivencia (SIS 1,49%):</span><span class="font-mono font-semibold text-slate-900">${formatCLP(ind.costoSis)}</span></div>
                        <div class="flex justify-between text-slate-700"><span>Seguro Cesantía AFC Empleador (2,40%):</span><span class="font-mono font-semibold text-slate-900">${formatCLP(ind.costoAfcEmp)}</span></div>
                        <div class="flex justify-between text-slate-700"><span>Mutualidad y Ley SANNA (Ley 16.744):</span><span class="font-mono font-semibold text-slate-900">${formatCLP(ind.costoMutual)}</span></div>
                        <div class="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-emerald-800"><span>Total Leyes Sociales Empresa:</span><span class="font-mono text-emerald-700">${formatCLP(ind.totalAportesPatronales)}</span></div>
                    </div>
                    <div class="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1.5">
                        <span class="font-bold text-amber-900 block text-[10px] uppercase tracking-wider mb-1">Reserva Mensual de Pasivos Laborales (Provisiones)</span>
                        <div class="flex justify-between text-slate-700"><span>Provisión Vacaciones Legales (4,17% mensual):</span><span class="font-mono font-semibold text-slate-900">${formatCLP(ind.provVacaciones)}</span></div>
                        <div class="flex justify-between text-slate-700"><span>Provisión Indemnización Años Servicio (8,33%):</span><span class="font-mono font-semibold text-slate-900">${formatCLP(ind.provIas)}</span></div>
                        <div class="flex justify-between pt-1.5 border-t border-amber-200 font-bold text-amber-950"><span>Total Reserva Mensual de Caja:</span><span class="font-mono text-amber-900">${formatCLP(ind.totalProvisiones)}</span></div>
                    </div>
                </div>
            </div>

            <!-- HOJA DE RUTA Y SIGUIENTE PASO -->
            <div class="p-3.5 bg-sky-50 border border-sky-200 rounded-xl my-4 text-xs">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-extrabold text-sky-950 block text-xs">Siguiente Paso Obligatorio: Escrituración Formal del Contrato</span>
                        <p class="text-[11px] text-sky-900 mt-0.5 max-w-lg">
                            El Código del Trabajo otorga un plazo improrrogable de <strong>15 días</strong> desde la incorporación para firmar el contrato (o 5 días si dura menos de 30 días) y debe registrarse obligatoriamente en el portal Mi DT.
                        </p>
                    </div>
                    <div class="text-right shrink-0 pl-3">
                        <span class="text-[10px] text-slate-500 block">Herramienta legal recomendada:</span>
                        <span class="text-xs font-bold text-sky-700">Pack Contrato Pyme Word ($12.990)</span>
                    </div>
                </div>
            </div>

            <!-- PIE DE PÁGINA Y DISCLAIMER -->
            <div class="informe-footer mt-5 pt-3 border-t border-slate-200 text-[9.5px] text-slate-500 leading-relaxed">
                <div class="flex justify-between items-center mb-1 font-medium text-slate-600">
                    <span>Cálculo Laboral Chile • calculolaboral.cl • Inteligencia Laboral para Empleadores y Pymes</span>
                    <span>Página 1 de 1 • Documento Confidencial</span>
                </div>
                <p>
                    <strong>Aviso Legal y Certificación Referencial:</strong> Informe pro-forma emitido conforme al Código del Trabajo de Chile, Ley 19.728 (AFC), Ley 16.744 (Accidentes y Enfermedades Profesionales), Ley 21.561 (40 Horas / 42h en 2026) y normativas de la Superintendencia de Seguridad Social (SUSESO) y Previred vigentes al año 2026. Esta estimación es de carácter referencial y presupuestario. Se recomienda validar la tasa de riesgo específica con su respectivo organismo administrador mutual (ACHS, Mutual CChC, IST o ISL).
                </p>
            </div>
        </div>
        `;
    }

    // Dispara la impresión / guardado en PDF nativo de alta resolución
    function imprimirInforme(data, esVistaPrevia) {
        var contenidoHTML = generarHTMLInforme(data, esVistaPrevia);
        var estilos = getEstilosInforme();

        var ventanaImpresion = window.open('', '_blank', 'width=900,height=800');
        if (!ventanaImpresion) {
            alert('Por favor, permite abrir ventanas emergentes para visualizar y descargar tu Informe Ejecutivo en PDF.');
            return;
        }

        ventanaImpresion.document.open();
        ventanaImpresion.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Informe_Ejecutivo_Contratacion_${data.folio}</title>
                <link rel="stylesheet" href="/assets/css/style.css?v=2.6.2">
                ${estilos}
            </head>
            <body class="bg-slate-100 py-6">
                <div class="no-print text-center mb-4 max-w-[800px] mx-auto flex items-center justify-between px-4">
                    <span class="text-xs text-slate-600 font-medium">Informe generado con éxito para <strong>${data.cargo}</strong></span>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer">
                            Guardar como PDF / Imprimir
                        </button>
                        <button onclick="window.close()" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer">
                            Cerrar
                        </button>
                    </div>
                </div>
                ${contenidoHTML}
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
        ventanaImpresion.document.close();
    }

    // Inicialización y eventos DOM
    document.addEventListener('DOMContentLoaded', function () {
        var inputMonto = document.getElementById('input-monto-sueldo');
        var inputModo = document.getElementById('select-modo-calculo');
        var selectRiesgoMutual = document.getElementById('select-riesgo-mutual');
        var checkGratificacion = document.getElementById('check-gratificacion');
        var checkGratifAdicional = document.getElementById('check-gratif-adicional');
        var inputAsignaciones = document.getElementById('input-asignaciones');
        var inputCargo = document.getElementById('input-cargo-presupuestado');

        var btnComprarInforme = document.getElementById('btn-comprar-informe-pdf');
        var btnPreviewInforme = document.getElementById('btn-preview-informe-pdf');

        // Función para recopilar los datos actuales
        function getDatosActuales() {
            var calc = window.CostoEmpresaCalculator;
            var monto = calc ? calc.parseCLP(inputMonto.value) : 850000;
            var modo = inputModo ? inputModo.value : 'base';
            var tasaMutual = selectRiesgoMutual ? parseFloat(selectRiesgoMutual.value) : 0.0093;
            var asignaciones = (inputAsignaciones && calc) ? calc.parseCLP(inputAsignaciones.value) : 60000;
            var gratificacion = checkGratificacion ? checkGratificacion.checked : true;
            var gratificacionAdicional = checkGratifAdicional ? checkGratifAdicional.checked : false;
            var cargo = (inputCargo && inputCargo.value.trim()) ? inputCargo.value.trim() : 'Cargo / Puesto Presupuestado';

            return {
                monto: monto,
                modo: modo,
                opciones: {
                    tasaMutual: tasaMutual,
                    asignaciones: asignaciones,
                    gratificacion: gratificacion,
                    gratificacionAdicional: gratificacionAdicional,
                    cargo: cargo
                }
            };
        }

        // 1. Botón COMPRAR INFORME ($4.990 Flow)
        if (btnComprarInforme) {
            btnComprarInforme.addEventListener('click', function (e) {
                var currentData = getDatosActuales();
                // Guardar datos en localStorage para restaurar tras el retorno de Flow
                try {
                    localStorage.setItem('simulacion_costo_empresa', JSON.stringify(currentData));
                } catch (err) {
                    console.error(err);
                }
                // Redirigir a Flow
                window.location.href = FLOW_CHECKOUT_URL;
            });
        }

        // 2. Botón VISTA PREVIA GRATIS (Con Marca de Agua)
        if (btnPreviewInforme) {
            btnPreviewInforme.addEventListener('click', function (e) {
                e.preventDefault();
                var state = getDatosActuales();
                var matriz = calcularTresModalidades(state.monto, state.modo, state.opciones);
                if (matriz) {
                    imprimirInforme(matriz, true); // true = vista previa con marca de agua
                }
            });
        }

        // Botón Crear Contrato a la Medida ($12.990)
        var linkContrato = document.getElementById('link-ir-generador-contrato');
        if (linkContrato) {
            linkContrato.addEventListener('click', function (e) {
                var state = getDatosActuales();
                try {
                    localStorage.setItem('simulacion_costo_empresa', JSON.stringify(state));
                } catch (err) {}
                var cargoParam = (state.opciones.cargo && state.opciones.cargo !== 'Cargo / Puesto Presupuestado') 
                    ? encodeURIComponent(state.opciones.cargo) 
                    : '';
                var baseParam = state.monto || '850000';
                linkContrato.href = 'generador-contrato-trabajo-chile?cargo=' + cargoParam + '&base=' + baseParam;
            });
        }

        // 3. DETECCIÓN DE RETORNO DE PAGO EXITOSO (URL query ?pago=exito)
        var urlParams = new URLSearchParams(window.location.search);
        var statusPago = urlParams.get('pago') || urlParams.get('status');

        if (statusPago === 'exito' || statusPago === 'pago_exitoso') {
            // Recuperar datos de simulación
            var stored = null;
            try {
                stored = JSON.parse(localStorage.getItem('simulacion_costo_empresa'));
            } catch (err) {
                console.error(err);
            }

            var simData = stored || getDatosActuales();
            var matrizExito = calcularTresModalidades(simData.monto, simData.modo, simData.opciones);

            // Mostrar modal de felicitación y descarga automática
            mostrarModalExito(matrizExito);
        }

        function mostrarModalExito(matriz) {
            var modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs no-print';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center animate-bounce-in">
                    <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/20">
                        <span class="material-icons text-3xl">verified</span>
                    </div>
                    <span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full uppercase tracking-wider">
                        Pago Confirmado ($4.990 CLP)
                    </span>
                    <h2 class="text-lg font-black text-slate-900 mt-2">¡Tu Informe Ejecutivo está listo!</h2>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                        Hemos procesado tu pago por Flow.cl exitosamente. Tu informe con la <strong>Comparativa de 3 Columnas y Matriz de Riesgo DT</strong> ya se encuentra preparado.
                    </p>
                    <div class="my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-left space-y-1 font-mono">
                        <div class="flex justify-between text-slate-500"><span>Folio Oficial:</span><span class="font-bold text-slate-800">${matriz.folio}</span></div>
                        <div class="flex justify-between text-slate-500"><span>Puesto:</span><span class="font-bold text-slate-800">${matriz.cargo}</span></div>
                        <div class="flex justify-between text-slate-500"><span>Costo Indefinido:</span><span class="font-bold text-sky-700">${formatCLP(matriz.indefinido.costoEmpresaTotal)}</span></div>
                    </div>
                    <div class="space-y-2">
                        <button id="btn-descargar-ahora" class="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 font-bold text-xs text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                            <span class="material-icons text-sm">download</span>
                            <span>Abrir / Descargar Informe PDF Limpio</span>
                        </button>
                        <button id="btn-cerrar-modal" class="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer">
                            Continuar en la calculadora
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-descargar-ahora').addEventListener('click', function () {
                imprimirInforme(matriz, false); // false = limpio, sin marca de agua
            });

            document.getElementById('btn-cerrar-modal').addEventListener('click', function () {
                modal.remove();
            });
        }
    });

    // Exportar al objeto global
    window.CostoEmpresaPDF = {
        calcularTresModalidades: calcularTresModalidades,
        generarHTMLInforme: generarHTMLInforme,
        imprimirInforme: imprimirInforme,
        FLOW_CHECKOUT_URL: FLOW_CHECKOUT_URL
    };
})();
