import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ink: { DEFAULT: "#0A1710", soft: "#12271B", line: "#25402F" },
        lime: { DEFAULT: "#D9FF63", deep: "#B6EE2F", soft: "#EEFFC0" },
        gold: { DEFAULT: "#FFD700", deep: "#B8860B", soft: "#FFF2B8" },
        goldenrod: "#DAA520",
        cream: { DEFAULT: "#F7F3E8", deep: "#EFE9D8" },
        clay: "#FF7A59",
        wa: {
          DEFAULT: "#25D366",
          bubble: "#DCF8C6",
          ink: "#075E54",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10, 23, 16, 0.04), 0 14px 34px -26px rgba(10, 23, 16, 0.35)",
        lift: "0 24px 60px -32px rgba(10, 23, 16, 0.4)",
        glow: "0 0 0 1px rgba(255, 215, 0, 0.3), 0 20px 60px -22px rgba(218, 165, 32, 0.45)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(1.5deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.8" },
          "70%, 100%": { transform: "scale(1.8)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "page-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        marquee: "marquee 34s linear infinite",
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        shimmer: "shimmer 2.6s linear infinite",
        "pulse-ring": "pulse-ring 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin-slow 24s linear infinite",
        "fade-in": "fade-in 0.5s ease-out both",
        "page-in": "page-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
