import { TIER_COLORS, matchTier } from "@/lib/format";

// Anillo de coincidencia: color según el nivel de afinidad (verde ≥85, ámbar ≥65, gris resto).
export default function MatchBadge({ pct, size = 54 }: { pct: number; size?: number }) {
  const tier = matchTier(pct);
  const colors = TIER_COLORS[tier];
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: colors.bg }}
      data-testid="match-badge"
      role="img"
      aria-label={`Coincidencia con tu perfil: ${pct} por ciento, ${colors.label}`}
      title={`${pct}% — ${colors.label}`}
    >
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.fg} strokeOpacity={0.15} strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.fg}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>
      <span className="relative font-mono text-sm font-semibold" style={{ color: colors.fg }}>
        {pct}%
      </span>
    </div>
  );
}
