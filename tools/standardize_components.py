import os
import re
import glob

CANONICAL_TICKER_AND_HEADER = """
    <!-- 1. TOP TICKER: Live Official Economic Indicators (Pine Forest Deep) -->
    <div style="background-color: var(--teal-forest-deep);" class="text-white text-xs py-2 border-b border-white/10 no-print">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-[#FFB703]"></span>
                <span class="font-medium text-slate-200">Ley 40 Horas (42h en 2026) · Fórmulas oficiales Dirección del Trabajo</span>
            </div>
            <div class="flex items-center gap-4 font-mono-num text-[11.5px] text-slate-300">
                <span>UF: <strong class="uf-value text-white font-bold">$41.032,64</strong></span>
                <span class="text-white/20">|</span>
                <span>UTM: <strong class="utm-value text-white font-bold">$71.721</strong></span>
                <span class="text-white/20">|</span>
                <span>IMM: <strong class="text-white font-bold">$553.553</strong></span>
            </div>
        </div>
    </div>

    <!-- 2. MAIN HEADER (TealHQ Navbar: Pure White, Rotating Dropdowns & Clean CTA Pills) -->
    <header class="sticky top-0 w-full z-50 bg-white border-b border-slate-200/90 no-print shadow-xs">
        <div class="max-w-[1240px] mx-auto px-4 sm:px-6">
            <div class="flex justify-between items-center h-20">
                
                <!-- Brand Logo: Dark green box + Gold balance icon + Wordmark -->
                <a href="./" class="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
                    <div style="background-color: var(--teal-forest);" class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs">
                        <svg class="w-5 h-5 text-[#FFB703]" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M30 84h40M38 79h24"></path>
                            <path d="M50 22v57"></path>
                            <path d="M50 14l-2 4h4l-2-4v8"></path>
                            <path d="M18 36c10-9 22-12 32-12s22 3 32 12"></path>
                            <path d="M18 36l-8 18h16Z"></path>
                            <path d="M10 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                            <path d="M82 36l-8 18h16Z"></path>
                            <path d="M74 54c0 3 3.5 5 8 5s8-2 8-5"></path>
                        </svg>
                    </div>
                    <span style="color: var(--teal-forest);" class="font-extrabold text-2xl tracking-tight">
                        cálculolaboral<span class="text-[#FFB703]">.</span>
                    </span>
                </a>

                <!-- Desktop Center Navigation -->
                <nav class="hidden lg:flex items-center gap-1 text-[14.5px] font-semibold text-slate-700">
                    <a href="finiquito_calculator" class="px-3.5 py-2 hover:text-[#00382E] transition-colors">
                        Simulador Finiquito
                    </a>

                    <!-- Dropdown: Herramientas ⌵ -->
                    <div class="nav-dropdown-group relative">
                        <button type="button" class="flex items-center gap-1 px-3.5 py-2 hover:text-[#00382E] transition-colors cursor-pointer">
                            <span>Herramientas</span>
                            <svg class="nav-chevron w-4 h-4 text-slate-400 transition-transform duration-200" viewBox="0 0 20 20" fill="none">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        
                        <div class="nav-dropdown-menu absolute left-0 top-full bg-white rounded-2xl border border-slate-100 shadow-2xl p-4 z-50" style="width: 580px;">
                            <div class="grid grid-cols-2 gap-2">
                                <a href="finiquito_calculator" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-slate-100 text-[#00382E] flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">calculate</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Finiquito Legal Completo</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Años de servicio, aviso y feriado.</div>
                                    </div>
                                </a>

                                <a href="sueldo_liquido" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-slate-100 text-[#00382E] flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">payments</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Sueldo Líquido</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Descuentos AFP, Fonasa/Isapre y SII.</div>
                                    </div>
                                </a>

                                <a href="simulador-despido-injustificado-chile" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">gavel</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Despido Injustificado</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Recargo 30% y recuperación de AFC.</div>
                                    </div>
                                </a>

                                <a href="calculadora-horas-extras" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">schedule</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Horas Extras 42h</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Factor legal al 50% Ley 40 Horas.</div>
                                    </div>
                                </a>

                                <a href="calculadora-vacaciones-proporcionales" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">beach_access</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Vacaciones Proporcionales</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Días hábiles y proyección corrida.</div>
                                    </div>
                                </a>

                                <a href="simulador-seguro-cesantia-afc" class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                        <span class="material-icons text-lg">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs text-slate-900">Seguro Cesantía AFC</div>
                                        <div class="text-[11px] text-slate-500 mt-0.5">Giros de cuenta individual y fondo.</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Dropdown: Guías ⌵ -->
                    <div class="nav-dropdown-group relative">
                        <button type="button" class="flex items-center gap-1 px-3.5 py-2 hover:text-[#00382E] transition-colors cursor-pointer">
                            <span>Guías</span>
                            <svg class="nav-chevron w-4 h-4 text-slate-400 transition-transform duration-200" viewBox="0 0 20 20" fill="none">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        
                        <div class="nav-dropdown-menu absolute left-0 top-full bg-white rounded-2xl border border-slate-100 shadow-2xl p-4 z-50" style="width: 320px;">
                            <div class="space-y-1">
                                <a href="reclamar-despido-injustificado-chile" class="block p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors">
                                    Cómo Reclamar Despido Injustificado
                                </a>
                                <a href="carta-de-renuncia-chile" class="block p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors">
                                    Generador de Carta de Renuncia
                                </a>
                                <a href="despido-necesidades-empresa-articulo-161" class="block p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors">
                                    Art. 161 Necesidades de la Empresa
                                </a>
                                <a href="checklist-fiscalizacion-dt-pymes-chile" class="block p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors">
                                    Checklist Fiscalización DT Pymes
                                </a>
                                <a href="ley-40-horas-chile-2026" class="block p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors">
                                    Ley 40 Horas (42 Horas en 2026)
                                </a>
                                <div class="pt-2 border-t border-slate-100 mt-2">
                                    <a href="blog" class="block px-2.5 py-1 text-xs font-bold text-[#00382E] hover:underline">
                                        Ver todas las guías en el Blog →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <a href="para-empleadores" class="px-3.5 py-2 hover:text-[#00382E] transition-colors">
                        Para Empleadores
                    </a>
                </nav>

                <!-- Header Right CTAs (TealHQ Pill Style) -->
                <div class="flex items-center gap-2">
                    <a href="para-empleadores" class="hidden md:inline-flex btn-yellow-pill !py-2.5 !px-5 !text-xs !shadow-xs">
                        Portal Empleadores
                    </a>
                    <a href="contacto" class="hidden lg:inline-flex btn-outline-pill !py-2 !px-4 !text-xs">
                        Contacto
                    </a>
                    
                    <!-- Mobile Hamburger -->
                    <button type="button" onclick="document.getElementById('mobile-drawer').classList.toggle('hidden')" class="lg:hidden p-2 text-slate-700 hover:text-slate-900 rounded-xl cursor-pointer" aria-label="Abrir menú">
                        <span class="material-icons text-2xl">menu</span>
                    </button>
                </div>

            </div>
        </div>

        <!-- Mobile Drawer -->
        <div id="mobile-drawer" class="hidden lg:hidden border-t border-slate-100 bg-white px-5 py-4 space-y-3">
            <a href="finiquito_calculator" class="block text-sm font-bold text-[#00382E]">Simulador Finiquito</a>
            <a href="sueldo_liquido" class="block text-sm font-semibold text-slate-700">Sueldo Líquido</a>
            <a href="simulador-despido-injustificado-chile" class="block text-sm font-semibold text-slate-700">Despido Injustificado</a>
            <a href="calculadora-horas-extras" class="block text-sm font-semibold text-slate-700">Horas Extras 42h</a>
            <a href="para-empleadores" class="block text-sm font-semibold text-slate-700">Portal Empleadores</a>
            <a href="blog" class="block text-sm font-semibold text-slate-700">Blog de Guías Laborales</a>
            <div class="pt-2">
                <a href="para-empleadores" class="btn-yellow-pill w-full !text-xs text-center justify-center">Portal Empleadores</a>
            </div>
        </div>
    </header>
"""

CANONICAL_FOOTER = """    <!-- EXACT TEALHQ ASYMMETRIC CURVED DARK FOOTER (#00382E) -->
    <footer class="no-print mt-16">
        <div class="teal-footer-curve">
            <div class="footer-inner-container max-w-[1240px] mx-auto px-6 py-16 sm:py-20">
                
                <!-- Main Grid 4 Columns -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10 text-left">
                    
                    <!-- Col 1: Brand & Description -->
                    <div class="lg:col-span-2 space-y-4">
                        <div class="flex items-center gap-2.5">
                            <div style="background-color: #FFB703;" class="w-9 h-9 rounded-xl bg-[#FFB703] flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-sm">
                                <span class="material-icons text-lg" style="color: #00382E;">balance</span>
                            </div>
                            <span class="font-extrabold text-2xl tracking-tight text-white leading-none whitespace-nowrap">
                                cálculolaboral<span class="text-[#FFB703]">.</span>
                            </span>
                        </div>
                        <p class="text-xs text-white/70 leading-relaxed max-w-sm">
                            Plataforma legal independiente de cálculo laboral en Chile. Desarrollada para transparentar liquidaciones, proteger los derechos del trabajador y blindar a las pymes.
                        </p>
                        <div class="pt-1 text-[11px] font-mono-num text-white/40">
                            Versión 2.5 · Actualizada Marzo 2026
                        </div>
                    </div>

                    <!-- Col 2: Calculadoras -->
                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-white/60 uppercase tracking-wider">Calculadoras</h4>
                        <ul class="space-y-2 text-xs">
                            <li><a href="finiquito_calculator" class="text-white hover:text-[#FFB703] font-bold transition-colors">Finiquito Legal</a></li>
                            <li><a href="simulador-despido-injustificado-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Despido Injustificado</a></li>
                            <li><a href="sueldo_liquido" class="text-white/80 hover:text-[#FFB703] transition-colors">Sueldo Líquido</a></li>
                            <li><a href="calculadora-horas-extras" class="text-white/80 hover:text-[#FFB703] transition-colors">Horas Extras 42h</a></li>
                            <li><a href="calculadora-vacaciones-proporcionales" class="text-white/80 hover:text-[#FFB703] transition-colors">Vacaciones Proporcionales</a></li>
                            <li><a href="calculadora-sueldo-part-time" class="text-white/80 hover:text-[#FFB703] transition-colors">Sueldo Part-Time</a></li>
                        </ul>
                    </div>

                    <!-- Col 3: Guías Legales -->
                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-white/60 uppercase tracking-wider">Guías Legales</h4>
                        <ul class="space-y-2 text-xs">
                            <li><a href="reclamar-despido-injustificado-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Cómo Reclamar Despido</a></li>
                            <li><a href="carta-de-renuncia-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Carta de Renuncia</a></li>
                            <li><a href="despido-necesidades-empresa-articulo-161" class="text-white/80 hover:text-[#FFB703] transition-colors">Art. 161 Necesidades</a></li>
                            <li><a href="checklist-fiscalizacion-dt-pymes-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Checklist Fiscalización DT</a></li>
                            <li><a href="ley-40-horas-chile-2026" class="text-white/80 hover:text-[#FFB703] transition-colors">Ley 40 Horas (42h)</a></li>
                            <li><a href="blog" class="text-[#FFB703] hover:underline font-semibold block pt-1">Ver todas las guías →</a></li>
                        </ul>
                    </div>

                    <!-- Col 4: Empresas -->
                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-white/60 uppercase tracking-wider">Empresas</h4>
                        <ul class="space-y-2 text-xs">
                            <li><a href="para-empleadores" class="text-white/80 hover:text-[#FFB703] transition-colors">Portal Empleadores (Pymes)</a></li>
                            <li><a href="kit-cumplimiento-ley-datos-personales-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Kit Ley 21.719 Datos ($29.990)</a></li>
                            <li><a href="kit-cumplimiento-laboral-pymes" class="text-white/80 hover:text-[#FFB703] transition-colors">Kit Blindaje Laboral ($19.990)</a></li>
                            <li><a href="generador-finiquito-chile" class="text-white/80 hover:text-[#FFB703] transition-colors">Generador Finiquito ($12.990)</a></li>
                            <li><a href="sobre-nosotros" class="text-white/80 hover:text-[#FFB703] transition-colors">Sobre Nosotros</a></li>
                            <li><a href="contacto" class="text-white/80 hover:text-[#FFB703] transition-colors">Contacto Directo</a></li>
                        </ul>
                    </div>

                </div>

                <!-- Bottom Bar -->
                <div class="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50 text-center md:text-left">
                    <div>
                        &copy; 2026 Cálculo Laboral Chile. Fórmulas conformes al Código del Trabajo y dictámenes de la Dirección del Trabajo.
                    </div>
                    <div class="flex items-center gap-4">
                        <a href="terminos" class="hover:text-white transition-colors">Términos</a>
                        <span>·</span>
                        <a href="privacidad" class="hover:text-white transition-colors">Privacidad</a>
                        <span>·</span>
                        <a href="disclaimer" class="hover:text-white transition-colors">Disclaimer</a>
                        <span>·</span>
                        <span class="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <span class="material-icons text-xs" aria-hidden="true">verified</span>
                            Fórmulas Conforme a DT
                        </span>
                    </div>
                </div>

            </div>
        </div>
    </footer>"""

CANONICAL_FOOTER_CSS = r"""
        /* TealHQ Elevated Curved Dark Footer (#00382E & 96px curve) */
        .teal-footer-curve {
            background-color: #00382E;
            color: #FFFFFF;
            border-top-left-radius: 40px;
            border-top-right-radius: 40px;
            position: relative;
            overflow: hidden;
        }
        .teal-footer-curve .footer-inner-container {
            max-width: 1240px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
        }
        @media (min-width: 1024px) {
            .teal-footer-curve {
                border-top-left-radius: 96px;
                border-top-right-radius: 0px;
            }
            .teal-footer-curve .footer-inner-container {
                padding-left: 8rem !important; /* 128px > 96px curve */
                padding-right: 3rem !important;
            }
        }
        @media (min-width: 1440px) {
            .teal-footer-curve .footer-inner-container {
                padding-left: 4rem !important;
                padding-right: 4rem !important;
            }
        }
"""

CANONICAL_HEAD_CSS = r"""
        /* TealHQ Required Signature System Tokens & Components */
        :root {
            --teal-forest: #00382E;
            --teal-forest-hover: #002820;
            --teal-forest-deep: #00261F;
            --teal-yellow: #FFB703;
            --teal-yellow-hover: #FFAA00;
            --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-yellow-pill {
            background-color: var(--teal-yellow);
            color: #111827 !important;
            font-weight: 700;
            border-radius: 9999px;
            padding: 12px 26px;
            font-size: 14.5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s var(--ease-spring);
            text-decoration: none;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(255, 183, 3, 0.35);
        }
        .btn-yellow-pill:hover {
            background-color: #FFAA00;
            transform: translateY(-1.5px);
            box-shadow: 0 8px 20px rgba(255, 183, 3, 0.45);
        }
        .btn-yellow-pill:active {
            transform: translateY(1px) scale(0.98);
        }

        .btn-dark-pill {
            background-color: var(--teal-forest);
            color: #FFFFFF !important;
            font-weight: 700;
            border-radius: 9999px;
            padding: 12px 26px;
            font-size: 14.5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s var(--ease-spring);
            text-decoration: none;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 56, 46, 0.25);
        }
        .btn-dark-pill:hover {
            background-color: var(--teal-forest-hover);
            transform: translateY(-1.5px);
            box-shadow: 0 8px 20px rgba(0, 56, 46, 0.35);
            color: #FFFFFF !important;
        }
        .btn-dark-pill:active {
            transform: translateY(1px) scale(0.98);
        }

        .btn-outline-pill {
            background-color: #FFFFFF;
            color: #374151 !important;
            font-weight: 600;
            border-radius: 9999px;
            padding: 11px 22px;
            font-size: 14px;
            border: 1.5px solid #D1D5DB;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s var(--ease-spring);
            text-decoration: none;
            cursor: pointer;
        }
        .btn-outline-pill:hover {
            border-color: #9CA3AF;
            background-color: #F9FAFB;
            color: #111827 !important;
            transform: translateY(-1px);
        }

        .btn-yellow-pill.hidden,
        .btn-dark-pill.hidden,
        .btn-outline-pill.hidden {
            display: none !important;
        }
        @media (min-width: 768px) {
            .btn-yellow-pill.md\:inline-flex,
            .btn-dark-pill.md\:inline-flex,
            .btn-outline-pill.md\:inline-flex {
                display: inline-flex !important;
            }
        }
        @media (min-width: 1024px) {
            .btn-yellow-pill.lg\:inline-flex,
            .btn-dark-pill.lg\:inline-flex,
            .btn-outline-pill.lg\:inline-flex {
                display: inline-flex !important;
            }
        }

        .nav-dropdown-menu {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(8px);
            transition: opacity 0.2s var(--ease-spring), transform 0.2s var(--ease-spring), visibility 0.2s;
        }
        .nav-dropdown-group:hover .nav-dropdown-menu {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(0);
        }
        .nav-dropdown-group:hover .nav-chevron {
            transform: rotate(180deg);
        }
""" + CANONICAL_FOOTER_CSS

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove any blanket `.hidden { display: none !important; }`
    content = re.sub(r'/\*\s*Hidden utility guarantee\s*\*/\s*\.hidden\s*\{\s*display:\s*none\s*!important;\s*\}', '', content)
    content = re.sub(r'^\s*\.hidden\s*\{\s*display:\s*none\s*!important;\s*\}', '', content, flags=re.MULTILINE)

    # 2. Update CSS in <head>
    head_end = content.find('</head>')
    if head_end != -1:
        head = content[:head_end]
        rest = content[head_end:]

        # Ensure base tokens and components exist
        if 'btn-yellow-pill' not in head:
            last_style_idx = head.rfind('</style>')
            if last_style_idx != -1:
                head = head[:last_style_idx] + CANONICAL_HEAD_CSS + '\n    ' + head[last_style_idx:]
            else:
                head = head + f'<style>{CANONICAL_HEAD_CSS}</style>\n'

        # Update or inject canonical footer CSS, removing any duplicate or old rules
        footer_css_pattern = r'(\s*/\*\s*TealHQ[^*]*\*/)?\s*\.teal-footer-curve\s*\{[^}]*\}(?:\s*@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*'
        matches = list(re.finditer(footer_css_pattern, head))
        if matches:
            for m in reversed(matches[:-1]):
                head = head[:m.start()] + head[m.end():]
            last_m = list(re.finditer(footer_css_pattern, head))[-1]
            head = head[:last_m.start()] + '\n' + CANONICAL_FOOTER_CSS.strip() + '\n' + head[last_m.end():]
        else:
            last_style_idx = head.rfind('</style>')
            if last_style_idx != -1:
                head = head[:last_style_idx] + '\n' + CANONICAL_FOOTER_CSS.strip() + '\n' + head[last_style_idx:]
            else:
                head = head + f'<style>{CANONICAL_FOOTER_CSS.strip()}</style>\n'

        content = head + rest

    # 3. Standardize Header: from after <body...> to </header>
    body_m = re.search(r'(<body[^>]*>)', content)
    header_m = re.search(r'(</header>)', content)
    if body_m and header_m and body_m.end() < header_m.end():
        content = content[:body_m.end()] + '\n' + CANONICAL_TICKER_AND_HEADER.strip() + '\n' + content[header_m.end():]

    # 4. Standardize Footer: replace <footer...>...</footer>
    footer_m = re.search(r'(<footer\b[^>]*>[\s\S]*?</footer>)', content)
    if footer_m:
        content = content[:footer_m.start()] + CANONICAL_FOOTER.strip() + content[footer_m.end():]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed: {filepath}')

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] != '--all':
        process_file(sys.argv[1])
    else:
        files = [f for f in sorted(glob.glob('*.html')) if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html', '_template.html']]
        print(f'Processing {len(files)} core HTML files...')
        for f in files:
            process_file(f)
