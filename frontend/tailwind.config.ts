import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#030407",
        paper: "#FFFFFF",
        mist: "#F7F7F7",
        wash: "#FBFBFB",
        line: "#EAEAEA",
        "line-strong": "#DCDCDC",
        midnight: "#030407",
        ink: "#030407",
        "ink-soft": "#12151C",
        body: "#3A3A3A",
        secondary: "#575757",
        faint: "#6B6B6B",
        cobalt: "#1558C9",
        "cobalt-soft": "#EEF4FD",
        acid: "#D4FF24",
        "acid-strong": "#C3ED12",
        success: "#3F6B50",
        warning: "#8A6A2F",
        danger: "#8C3B32",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Iowan Old Style", "Palatino Linotype", "Georgia", "ui-serif", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: {
        page: "1240px",
        reading: "720px",
      },
      borderRadius: {
        card: "20px",
        field: "12px",
      },
      letterSpacing: {
        tightest: "-0.035em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s ease-out both",
        "fade-in": "fade-in 0.22s ease-out both",
        shimmer: "shimmer 1.6s infinite",
        "soft-pulse": "soft-pulse 1.8s ease-in-out infinite",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
