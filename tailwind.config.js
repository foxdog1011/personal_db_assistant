module.exports = {
  darkMode: 'class', // ✅ 用 class 來切換 dark 模式
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in forwards',
      },
    },
  },
  plugins: [],
};
