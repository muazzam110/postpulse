import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

// Tokens are HSL triplets in index.css; <alpha-value> keeps utilities like ring-ember/40 working.
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const tint = (name) => ({ DEFAULT: c(name), soft: c(`${name}-soft`) });

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: c("paper"),
        surface: { DEFAULT: c("surface"), 2: c("surface-2") },
        line: c("line"),
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3") },
        // ember: accents/indicators. strong: filled buttons (white text passes AA). hover: pressed state.
        ember: { DEFAULT: c("ember"), strong: c("ember-strong"), hover: c("ember-hover"), soft: c("ember-soft") },
        moss: tint("moss"),
        amber: tint("amber"),
        rose: tint("rose"),
        sky: tint("sky"),
        // shadcn/ui aliases so pasted shadcn components pick up our tokens
        background: c("paper"),
        foreground: c("ink"),
        border: c("line"),
        ring: c("ember"),
        primary: { DEFAULT: c("ember-strong"), foreground: "#fff" },
        muted: { DEFAULT: c("surface-2"), foreground: c("ink-3") },
        destructive: { DEFAULT: c("rose"), foreground: "#fff" },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"Geist Variable"', '"Inter Tight"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "monospace"],
      },
      borderRadius: { card: "14px", sheet: "18px" },
      boxShadow: {
        pop: "0 8px 24px -8px rgb(22 19 15 / .18), 0 2px 6px rgb(22 19 15 / .06)",
        lift: "0 1px 0 rgb(255 255 255 / .35) inset, 0 1px 2px rgb(22 19 15 / .12)",
      },
      transitionTimingFunction: { "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)" },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        caret: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
      },
      animation: {
        "fade-up": "fade-up .35s cubic-bezier(.16,1,.3,1) both",
        caret: "caret 1s steps(1) 2",
      },
    },
  },
  plugins: [animate, typography],
};
