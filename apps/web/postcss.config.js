// PostCSS para la app web. Tailwind sólo emite utilidades donde se usan las
// directivas @tailwind (app/demo/demo.css). La globals.css de producción no
// tiene directivas Tailwind, así que pasa intacta; autoprefixer es inocuo.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
