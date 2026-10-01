/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: [
        "./*.html",
        "./js/**/*.js",
        "./build_redesign.py"
    ],
    theme: {
        extend: {
            colors: {
                primary: { DEFAULT: "#00382E", dark: "#002820" },
                canvas: "#F8FAF9",
                // Escala de marca derivada del verde bosque #00382E (800).
                forest: {
                    50: "#EEF6F3",
                    100: "#D6EBE4",
                    200: "#ADD6C9",
                    300: "#7DBBA9",
                    400: "#4C9A86",
                    500: "#267B67",
                    600: "#0F5E4F",
                    700: "#064A3E",
                    800: "#00382E",
                    900: "#002820",
                    950: "#001A15",
                },
                "background-dark": "#0f172a",
                "card-dark": "#1e293b",
                "input-dark": "#1e293b",
                brand: {
                    forest: '#00382E',
                    forestLight: '#0B644D',
                    emerald: '#059669',
                    mint: '#ECFDF5',
                    mustard: '#F59E0B',
                    mustardHover: '#D97706',
                    mustardLight: '#FEF3C7',
                },
            },
            fontFamily: {
                sans: ["Geist", "Inter", "system-ui", "sans-serif"],
                mono: ["Geist Mono", "ui-monospace", "monospace"],
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ],
}
