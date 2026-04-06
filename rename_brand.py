import os
import re

directory = r"c:\Users\Jhon\Desktop\Arreglarpagina"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace specific brand spans (supports multi-line formatting from Prettier/formatters)
    # Target: Calculadoras<span class="text-blue-400">Chile</span>
    content = re.sub(
        r'Calculadoras\s*(<span[^>]*>)Chile</span>',
        r'Cálculo\1Laboral</span>',
        content,
        flags=re.IGNORECASE
    )
    
    # Target: Calculadora<span class="text-blue-400">Chile</span>
    content = re.sub(
        r'Calculadora\s*(<span[^>]*>)Chile</span>',
        r'Cálculo\1Laboral</span>',
        content,
        flags=re.IGNORECASE
    )

    # Replace footer copyright domain
    content = content.replace('CalculadorasChile.cl', 'calculolaboral.cl')
    content = content.replace('Calculadoraschile.cl', 'calculolaboral.cl')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {os.path.basename(filepath)}")

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        process_file(os.path.join(directory, filename))

print("Brand rename complete.")
