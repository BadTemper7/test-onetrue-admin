export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "yard-navy": "#0F1D73",
        "yard-green": "#087A55",
        "yard-blue": "#0F1D73",
        "yard-red": "#E30613",
        "yard-fog": "#F4F6F8",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
};
