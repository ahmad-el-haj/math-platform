import { cn } from '@/lib/cn'

/**
 * The mathematical motif used across the marketing pages: a coordinate grid
 * with a parabola, a sine curve and the vertex marked.
 *
 * The curves are drawn in with a stroke animation on first render. The
 * animation is disabled automatically when the visitor asked for reduced
 * motion (see the global rule in index.css).
 */
export function MathMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label="رسم بياني لمقطع زائد ومنحنى جيبي"
    >
      <defs>
        <linearGradient id="motif-curve" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.25" />
          <stop offset="45%" stopColor="var(--c-gold)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="motif-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--c-info)" stopOpacity="0.1" />
          <stop offset="50%" stopColor="var(--c-info)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--c-info)" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="motif-glow" cx="52%" cy="32%" r="46%">
          <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="300" fill="url(#motif-glow)" />

      {/* Grid */}
      <g stroke="var(--c-line)" strokeWidth="1">
        {Array.from({ length: 9 }, (_, index) => (
          <line key={`v${index}`} x1={20 + index * 45} y1="0" x2={20 + index * 45} y2="300" />
        ))}
        {Array.from({ length: 7 }, (_, index) => (
          <line key={`h${index}`} x1="0" y1={20 + index * 45} x2="400" y2={20 + index * 45} />
        ))}
      </g>

      {/* Axes */}
      <g stroke="var(--c-line-strong)" strokeWidth="1.4">
        <line x1="0" y1="220" x2="400" y2="220" />
        <line x1="60" y1="0" x2="60" y2="300" />
      </g>
      <g fill="var(--c-ink-3)" fontSize="10" fontFamily="inherit">
        <text x="384" y="236" textAnchor="end">
          x
        </text>
        <text x="52" y="14" textAnchor="end">
          y
        </text>
      </g>

      {/* Sine curve */}
      <path
        d="M20 214 C 60 214, 70 158, 110 158 S 160 214, 200 214 S 250 158, 290 158 S 340 214, 380 214"
        fill="none"
        stroke="url(#motif-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        className="[stroke-dasharray:520] [stroke-dashoffset:520] animate-[draw-line_1.6s_var(--ease-out-soft)_0.15s_forwards]"
        style={{ ['--draw-length' as string]: '520' }}
      />

      {/* Parabola */}
      <path
        d="M20 96 C 90 96, 130 36, 210 36 C 290 36, 330 96, 380 96"
        fill="none"
        stroke="url(#motif-curve)"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="[stroke-dasharray:640] [stroke-dashoffset:640] animate-[draw-line_1.9s_var(--ease-out-soft)_0.35s_forwards]"
        style={{ ['--draw-length' as string]: '640' }}
      />

      {/* Vertex */}
      <g className="animate-fade" style={{ animationDelay: '1.5s' }}>
        <line
          x1="210"
          y1="36"
          x2="210"
          y2="220"
          stroke="var(--c-gold)"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
        <circle cx="210" cy="36" r="4.5" fill="var(--c-gold)" />
        <circle cx="210" cy="36" r="9" fill="var(--c-gold)" fillOpacity="0.16" />
        <text x="218" y="30" fill="var(--c-gold)" fontSize="11" fontFamily="inherit">
          y = ax² + bx + c
        </text>
      </g>
    </svg>
  )
}
