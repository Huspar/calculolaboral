import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Blocks extraction
# We will find the sections by their HTML comments or section IDs

def get_block(start_marker, end_marker=None, next_section_marker=None):
    if next_section_marker:
        pattern = rf'({start_marker}.*?)(?={next_section_marker})'
    else:
        pattern = rf'({start_marker}.*?{end_marker})'
    
    match = re.search(pattern, html, flags=re.DOTALL)
    if match:
        return match.group(1)
    return ""

enhanced_cta = get_block(r'<!-- Enhanced Blog CTA Section -->', next_section_marker=r'<!-- Herramientas Principales -->')
herramientas = get_block(r'<!-- Herramientas Principales -->', next_section_marker=r'<!-- Por qué usar estas calculadoras -->')
por_que = get_block(r'<!-- Por qué usar estas calculadoras -->', next_section_marker=r'<!-- Featured Guide -->')
featured = get_block(r'<!-- Featured Guide -->', next_section_marker=r'<!-- Blog Section -->')
blog = get_block(r'<!-- Blog Section -->', next_section_marker=r'<!-- FAQ Section -->')

# Generate the new Centro de Conocimiento block
centro_conocimiento = enhanced_cta

# Add paragraph
centro_conocimiento = centro_conocimiento.replace(
    'creados por expertos.</p>',
    'creados por expertos.</p>\n                <p class="text-slate-400 max-w-2xl mx-auto mt-2">Aprende cómo calcular finiquito, indemnización y vacaciones proporcionales según el Código del Trabajo en Chile.</p>'
)

cards_html = """
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-10">
            <!-- Card 1 -->
            <a href="/como-calcular-finiquito-chile.html" class="glass-card rounded-2xl p-8 relative group overflow-hidden block">
                <div class="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <span class="material-icons text-slate-600 group-hover:text-blue-500 text-6xl transform rotate-12 group-hover:scale-110 transition-transform">article</span>
                </div>
                <div class="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500 transition-colors duration-300">
                    <span class="material-icons text-blue-400 group-hover:text-white text-2xl">menu_book</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">Cómo calcular finiquito en Chile (2026)</h3>
                <p class="text-slate-400 text-sm leading-relaxed mb-6">
                    Aprende paso a paso cómo calcular tu finiquito, con fórmulas y ejemplos reales.
                </p>
                <div class="flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-2 transition-transform">
                    Leer guía <span class="material-icons text-sm ml-1">arrow_forward</span>
                </div>
            </a>

            <!-- Card 2 -->
            <a href="/despido-necesidades-empresa-articulo-161.html" class="glass-card rounded-2xl p-8 relative group overflow-hidden block">
                <div class="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <span class="material-icons text-slate-600 group-hover:text-purple-500 text-6xl transform rotate-12 group-hover:scale-110 transition-transform">gavel</span>
                </div>
                <div class="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-colors duration-300">
                    <span class="material-icons text-purple-400 group-hover:text-white text-2xl">balance</span>
                </div>
                <h3 class="text-xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">Despido por necesidades de la empresa (Art. 161)</h3>
                <p class="text-slate-400 text-sm leading-relaxed mb-6">
                    Conoce qué significa esta causal, la indemnización correspondiente y tus derechos.
                </p>
                <div class="flex items-center text-purple-400 text-sm font-medium group-hover:translate-x-2 transition-transform">
                    Ver explicación <span class="material-icons text-sm ml-1">arrow_forward</span>
                </div>
            </a>
        </div>
"""

# Insert cards before the closing </section> of centro_conocimiento
centro_conocimiento = centro_conocimiento.replace('</section>', cards_html + '\n    </section>\n')

# Now let's build the new middle section
new_middle = centro_conocimiento + '\n    ' + herramientas + '\n    ' + por_que + '\n    '

# Remove the old featured and blog
old_middle_pattern = r'<!-- Enhanced Blog CTA Section -->.*?<!-- FAQ Section -->'

html = re.sub(old_middle_pattern, new_middle + '<!-- FAQ Section -->', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML reordered successfully")
