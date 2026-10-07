// Tailwind v4 ships its own PostCSS plugin — no autoprefixer needed, no `tailwind.config.ts` either;
// the design tokens live in `src/app/globals.css` via `@theme`.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
