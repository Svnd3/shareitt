/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#1A7A3C",
        saddle: {
          50: "#FBF4EE",
          100: "#F3E2D3",
          200: "#E4C4A6",
          300: "#D3A379",
          400: "#BC824F",
          500: "#8B5E34",
          600: "#764C2A",
          700: "#5F3C22",
          800: "#4A2F1B",
          900: "#3A2515",
        },
      },
      boxShadow: {
        soft: "0 20px 50px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
