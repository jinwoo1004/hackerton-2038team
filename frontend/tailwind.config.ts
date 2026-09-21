import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        line: "#E2E8F0",

        ink: {
          DEFAULT: "#0F172A",
          900: "#0F172A",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
          400: "#94A3B8",
          300: "#CBD5E1",
          200: "#E2E8F0",
          100: "#F1F5F9",
        },

        primary: {
          DEFAULT: "#2563EB",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },

        toss: {
          ink: "#191F28",
          mid: "#4E5968",
          sub: "#8B95A1",
          line: "#E5E8EB",
          line2: "#F2F4F6",
          soft: "#F8FAFC",
          blue: "#3182F6",
          "blue-soft": "#E8F3FF",
          green: "#06A658",
          "green-soft": "#E6F7EF",
          amber: "#C8870E",
          "amber-soft": "#FFF6E0",
          red: "#E5484D",
          "red-soft": "#FFEBEC",
          purple: "#7B5BFF",
          "purple-soft": "#F0EBFF",
        },

        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(15, 23, 42, 0.04)",
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)",
        lift: "0 10px 30px -12px rgba(15, 23, 42, 0.18)",
        cta: "0 6px 16px rgba(37, 99, 235, 0.22)",
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        hand: ['"Nanum Pen Script"', "cursive"],
      },
      spacing: {
        sidebar: "260px",
        header: "56px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.98) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        sheetUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        cardPop: {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.9)", opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(22px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        stepInRight: {
          "0%": { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        stepInLeft: {
          "0%": { opacity: "0", transform: "translateX(-28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        highlight: {
          "0%": { "background-size": "0% 100%" },
          "100%": { "background-size": "100% 100%" },
        },
        breathe: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-6px) scale(1.03)" },
        },
        indeterminate: {
          "0%": { transform: "translateX(-110%)" },
          "100%": { transform: "translateX(260%)" },
        },      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "pop-in": "popIn 0.22s cubic-bezier(0.22,1,0.36,1)",
        "sheet-up": "sheetUp 0.28s cubic-bezier(0.22,1,0.36,1)",
        "slide-in-left": "slideInLeft 0.28s cubic-bezier(0.22,1,0.36,1)",
        "toast-in": "toastIn 0.24s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.6s infinite",
        "card-pop": "cardPop 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulseRing 2.4s cubic-bezier(0.22,1,0.36,1) infinite",
        "rise-in": "riseIn 0.9s cubic-bezier(0.22,1,0.36,1) both",
        "step-in-right": "stepInRight 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "step-in-left": "stepInLeft 0.45s cubic-bezier(0.22,1,0.36,1) both",
        breathe: "breathe 2.4s ease-in-out infinite",
        highlight: "highlight 0.8s cubic-bezier(0.65,0,0.35,1) both",
        indeterminate: "indeterminate 1.4s cubic-bezier(0.65,0,0.35,1) infinite",      },
    },
  },
  plugins: [],
};

export default config;
