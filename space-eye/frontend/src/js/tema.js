// frontend/src/js/tema.js
// El tema visual de SPACE EYES, en UN solo lugar para todo el sistema.
//
// Sale del Brand Book V2 de AS Network: SPACE EYES vive dentro de SPACE OS
// («Space» = lo que toca al espacio fisico), asi que lleva sus reglas:
//   - un color de producto, el azul electrico #0A66FF ("nunca navy");
//   - tinta calida #1C1612 para el texto y grises calidos para lo secundario;
//   - fondos blanco o crema, bordes #EAE4D8;
//   - verde #1DA850 SOLO para "verificado / en linea", ambar para activo/en vivo;
//   - flat absoluto: cero sombras, cero gradientes, bordes de 1px;
//   - General Sans para la interfaz, Cabinet Grotesk para titulos y JetBrains
//     Mono para cifras, IDs, IPs y versiones.
//
// Se carga justo despues del script de Tailwind: al redefinir su paleta aqui,
// todas las paginas (que ya usan neutral-*, blue-*, green-*...) quedan con los
// colores de la marca sin tocar cada clase.
(function () {
  // Tipografias de la marca.
  const fuentes = [
    'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=cabinet-grotesk@700,800&display=swap',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
  ];
  for (const href of fuentes) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  if (!window.tailwind) return;
  window.tailwind.config = {
    theme: {
      extend: {
        colors: {
          // Grises calidos. 500 es un punto mas oscuro que el #9A8D7C del
          // manual para que el texto secundario pequeño sea legible (4.5:1).
          neutral: {
            50: '#FBF9F4', 100: '#F4EDDE', 200: '#EAE4D8', 300: '#D9D0C1', 400: '#B3A794',
            500: '#7F7262', 600: '#665B4E', 700: '#4D443A', 800: '#332C25', 900: '#1C1612',
          },
          blue: {
            50: '#EBF2FF', 100: '#D6E5FF', 200: '#ADCBFF', 300: '#7AABFF', 400: '#3D85FF',
            500: '#1F74FF', 600: '#0A66FF', 700: '#0852CC', 800: '#063E99', 900: '#042A66',
          },
          green: {
            50: '#E8F7EE', 100: '#CDEFD9', 200: '#9BDFB4', 500: '#23B85A', 600: '#1DA850',
            700: '#178A42', 800: '#116832',
          },
          amber: { 50: '#FEF5E6', 100: '#FDE9C4', 500: '#F59E0B', 600: '#D98A06', 700: '#B06F04', 800: '#7A4D03' },
          tinta: '#1C1612',
          crema: '#F4EDDE',
          fuego: '#EB4B0A',
        },
        fontFamily: {
          sans: ['"General Sans"', 'system-ui', 'sans-serif'],
          display: ['"Cabinet Grotesk"', '"General Sans"', 'system-ui', 'sans-serif'],
          mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        },
        // Flat absoluto: ninguna sombra en todo el sistema.
        boxShadow: { sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none' },
      },
    },
  };
})();
