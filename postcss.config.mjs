/**
 * Tailwind v4 through PostCSS.
 *
 * create-next-app on this version wires Tailwind through a Turbopack CSS loader
 * instead; that loader hung the dev server in this environment (see DECISIONS.md
 * D-45), so the standard PostCSS pipeline is used instead. Output is identical.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
