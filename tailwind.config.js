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
                primary: { DEFAULT: "#0ea5e9", dark: "#0284c7" },
                "background-dark": "#0f172a",
                "card-dark": "#1e293b",
                "input-dark": "#1e293b",
                brand: {
                    forest: '#064E3B',
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
