import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        dusk: {
          bg: "#0a0a0a",
          panel: "#141418",
          accent: "#4cc9f0",
          muted: "#8a8a94",
        },
      },
    },
  },
  plugins: [],
};
export default config;
