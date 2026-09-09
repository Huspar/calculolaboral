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
