# Cálculo Laboral (Chile) 🇨🇱

Suite gratuita de herramientas y simuladores laborales para trabajadores y empleadores de Chile. Enfocada en la precisión legal, cálculos exactos según normativa vigente y una experiencia de usuario moderna y rápida.

## 🚀 Funcionalidades

- **Calculadora de Sueldo Líquido**: Obtén el detalle exacto de "haberes" y "descuentos" (AFP, Salud, Impuesto Único) a partir de un sueldo bruto o viceversa.
- **Calculadora de Finiquito**: Simulador completo de indemnizaciones por años de servicio, aviso previo y feriado proporcional.
- **Costo Empleador**: Herramienta para empresas que permite proyectar el costo total de contratar a un trabajador (incluyendo SIS, Mutual, SC).
- **Indicadores Económicos**: Actualización diaria de UF, UTM e IMM desde la API de mindicador.cl.

## 🛠️ Tecnologías

Este proyecto es **100% estático** y no requiere backend ni base de datos compleja.

- **Stack**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Tailwind CSS vía CDN).
- **Diseño**: "Glassmorphism" con modo oscuro nativo.
- **Performance**: Optimizado para carga instantánea y puntaje SEO alto (Lighthouse 95+).

## 📦 Ejecución Local

Para probar el proyecto en tu máquina:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/Huspar/calculolaboral.git
   ```

2. Abre el archivo `index.html` directamente en tu navegador.
   - O usa un servidor local simple:
     ```bash
     python3 -m http.server
     # o
     npx serve .
     ```

## 🌐 Despliegue en GitHub Pages

Este proyecto está listo para desplegarse en **GitHub Pages**.

1. Ve a `Settings` > `Pages` en tu repositorio.
2. Selecciona la rama `main` y la carpeta `/` (root).
3. Guarda. En segundos tu sitio estará online en `https://huspar.github.io/calculolaboral/` (o tu dominio personalizado).

## 📁 Estructura del Proyecto

```
/
├── index.html                  # Landing page
├── sueldo_liquido.html         # Calculadora de Sueldo
├── finiquito_calculator.html   # Calculadora de Finiquito
├── costo_empleador.html        # Calculadora Costo Empleador
├── assets/
│   ├── js/                     # Lógica (logic.js, indicators.js, etc.)
│   └── css/                    # Estilos adicionales
└── ...
```

---
© 2026 Cálculo Laboral. Código abierto bajo licencia MIT.
