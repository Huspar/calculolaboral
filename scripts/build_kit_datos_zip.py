import os
import zipfile
import base64

files_dir = os.path.join(os.path.dirname(__file__), '..', 'api', 'assets', 'kit_datos_files')
out_zip = os.path.join(os.path.dirname(__file__), '..', 'Kit_Ley_21719_Proteccion_Datos_Pyme_2026.zip')
base64_out = os.path.join(os.path.dirname(__file__), '..', 'api', 'assets', 'kit-datos-base64.js')

files = [
    '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.pdf',
    '0_MANUAL_DE_USO_GUIA_RAPIDA_PYMES.docx',
    '1_Anexo_Laboral_Datos_Personales_Ley_21719.docx',
    '2_Politica_Privacidad_Web_y_Pyme_Ley_21719.docx',
    '3_Clausula_DPA_Proveedores_Encargados_Ley_21719.docx',
    '4_Registro_Actividades_Tratamiento_RAT_Ley_21719.xlsx',
    '5_Protocolo_Brechas_Seguridad_72h_Ley_21719.docx',
    '6_Formulario_Solicitud_Derechos_ARCOP.docx',
    '7_Guia_Autodiagnostico_DPO_Delegado_Proteccion_Datos_Pyme.docx'
]

with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        fp = os.path.join(files_dir, f)
        if os.path.exists(fp):
            zf.write(fp, arcname=f)
            print(f'Added: {f} ({os.path.getsize(fp)} bytes)')
        else:
            print(f'NOT FOUND: {f}')

with open(out_zip, 'rb') as f:
    b64_str = base64.b64encode(f.read()).decode('utf-8')

with open(base64_out, 'w', encoding='utf-8') as f:
    f.write(f'module.exports = "{b64_str}";\n')

print(f'Successfully built {out_zip} ({os.path.getsize(out_zip)} bytes)')
print(f'Successfully updated {base64_out} ({len(b64_str)} chars)')
