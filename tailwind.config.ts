import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#0F3D2E",
        limewash: "#D7F279",
        ink: "#14211C",
        paper: "#F7F5EF"
      }
    }
  },
  plugins: []
};

export default config;
