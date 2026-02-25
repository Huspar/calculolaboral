/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./*.{html,js}"],
    theme: {
        extend: {
            colors: {
                primary: { DEFAULT: "#3b82f6", dark: "#2563eb" },
                "background-dark": "#0f172a",
                "card-dark": "#1e293b",
                "input-dark": "#1e293b",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ],
}
