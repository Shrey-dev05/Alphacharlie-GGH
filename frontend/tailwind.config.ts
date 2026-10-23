import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F1E36", // authority navy
          light: "#1A2E4E",
          dark: "#08101E",
        },
        paper: "#F8FAFC", // clean official portal background
        parchment: "#F1F5F9",
        slate: {
          DEFAULT: "#475569",
          light: "#64748B",
          dark: "#334155",
        },
        hairline: "#E2E8F0",
        compliant: {
          DEFAULT: "#15803D", // official green
          bg: "#ECFDF5",
          border: "#A7F3D0",
        },
        violation: {
          DEFAULT: "#B91C1C", // official violation red
          bg: "#FEF2F2",
          border: "#FECACA",
        },
        alert: {
          DEFAULT: "#D97706", // cautionary amber
          bg: "#FFFBEB",
          border: "#FDE68A",
        },
        gov: {
          navy: {
            DEFAULT: "#0F2B48",
            dark: "#0A1B2F",
            light: "#183D63",
          },
          saffron: {
            DEFAULT: "#FF9933",
            dark: "#E65100",
            light: "#FFF3E0",
          },
          green: {
            DEFAULT: "#138808",
            dark: "#0D6105",
            light: "#E8F5E9",
          },
          blue: {
            DEFAULT: "#000080",
            dark: "#000055",
            light: "#E3F2FD",
          },
          gold: {
            DEFAULT: "#D4AF37",
            dark: "#AA8C2C",
            light: "#FFF9E6",
          },
          ivory: "#FAFAF9",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        heading: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        gov: "0 1px 3px 0 rgba(15, 30, 54, 0.06), 0 1px 2px -1px rgba(15, 30, 54, 0.04)",
        "gov-md": "0 4px 6px -1px rgba(15, 30, 54, 0.08), 0 2px 4px -2px rgba(15, 30, 54, 0.05)",
        "gov-lg": "0 10px 15px -3px rgba(15, 30, 54, 0.10), 0 4px 6px -4px rgba(15, 30, 54, 0.05)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-right": "slideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-subtle": "pulseSubtle 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
