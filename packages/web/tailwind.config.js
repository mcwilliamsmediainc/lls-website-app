/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Spec brand palette (Table 5)
        navy: "#061e57",
        slate: "#3a4856",
        sky: "#b3cee1",
        sand: "#d8bfa7",
        rust: "#7c370c",
        offwhite: "#f5f0eb",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
