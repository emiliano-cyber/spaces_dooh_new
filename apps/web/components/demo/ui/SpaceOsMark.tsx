// Logotipo (burst) de SPACE OS — fiel al brand book de AS Network:
// 12 rayos azules alternando largo/corto sobre un cuadrado de tinta centrado.
// Usa las variables de tema (--accent, --ink) para heredar la paleta.
export function SpaceOsMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const long = i % 2 === 0
        return (
          <line
            key={i}
            x1="24"
            y1={long ? 4 : 8}
            x2="24"
            y2="12"
            stroke="var(--accent)"
            strokeWidth={long ? 2.8 : 2.2}
            strokeLinecap="round"
            transform={`rotate(${i * 30} 24 24)`}
          />
        )
      })}
      <rect x="18.5" y="18.5" width="11" height="11" rx="1" fill="var(--ink)" />
    </svg>
  )
}
