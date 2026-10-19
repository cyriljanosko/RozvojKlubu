/** Decorative intro picture of the Hub: a pitch with the people of a club around it (placeholder for a photo). */
export function HubIllustration({ className = "" }: { className?: string }) {
  // people around the pitch: coach, players, parents, volunteers, fans
  const people = [
    { x: 70, y: 40, c: "fill-blue-600" },
    { x: 120, y: 30, c: "fill-amber-500" },
    { x: 330, y: 32, c: "fill-amber-500" },
    { x: 380, y: 44, c: "fill-zinc-500" },
    { x: 40, y: 150, c: "fill-zinc-500" },
    { x: 410, y: 160, c: "fill-blue-600" },
    { x: 150, y: 205, c: "fill-amber-500" },
    { x: 300, y: 208, c: "fill-zinc-500" },
  ];
  const players = [
    { x: 170, y: 95 },
    { x: 200, y: 140 },
    { x: 260, y: 100 },
    { x: 280, y: 150 },
  ];
  return (
    <svg
      viewBox="0 0 450 240"
      aria-hidden
      focusable="false"
      className={`h-auto w-full ${className}`}
    >
      <rect x="60" y="60" width="330" height="130" rx="6" className="fill-emerald-600/15" />
      <g className="fill-none stroke-emerald-700/60" strokeWidth="2">
        <rect x="60" y="60" width="330" height="130" rx="6" />
        <line x1="225" y1="60" x2="225" y2="190" />
        <circle cx="225" cy="125" r="24" />
        <rect x="60" y="95" width="34" height="60" />
        <rect x="356" y="95" width="34" height="60" />
      </g>
      {players.map((p) => (
        <g key={`${p.x}-${p.y}`} className="fill-blue-700">
          <circle cx={p.x} cy={p.y - 12} r="6" />
          <rect x={p.x - 6} y={p.y - 4} width="12" height="16" rx="5" />
        </g>
      ))}
      <circle cx="232" cy="128" r="5" className="fill-white stroke-zinc-700" strokeWidth="1.5" />
      {people.map((p) => (
        <g key={`${p.x}-${p.y}`} className={p.c}>
          <circle cx={p.x} cy={p.y - 13} r="7" />
          <rect x={p.x - 8} y={p.y - 4} width="16" height="20" rx="7" />
        </g>
      ))}
    </svg>
  );
}
