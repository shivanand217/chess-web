// Tiny inline-SVG sparkline for rating history. One data point per finished game plus a trailing
// "now" point; no axes, just the line, dots at head/tail, and the current value tucked at the
// right edge. Dependency-free so the frontend bundle doesn't bloat for one chart.
"use client";

interface Point {
  at: string;
  rating: number;
}

interface Props {
  points: Point[];
  width?: number;
  height?: number;
}

export function RatingSparkline({ points, width = 520, height = 120 }: Props) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/40 text-xs text-neutral-500"
        style={{ width, height }}
      >
        Not enough games yet to chart.
      </div>
    );
  }

  const padX = 8;
  const padY = 10;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const ratings = points.map((p) => p.rating);
  let min = Math.min(...ratings);
  let max = Math.max(...ratings);
  // Flat series would collapse to a horizontal line at y=0 — pad the range so the midline sits
  // visibly inside the chart.
  if (max === min) {
    min -= 50;
    max += 50;
  }
  const span = max - min;

  const toXy = (p: Point, i: number): [number, number] => {
    const x = padX + (i / (points.length - 1)) * w;
    const y = padY + (1 - (p.rating - min) / span) * h;
    return [x, y];
  };

  const coords = points.map(toXy);
  const path = coords
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = last.rating - first.rating;
  const trend = delta === 0 ? "neutral" : delta > 0 ? "up" : "down";
  const stroke =
    trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#a3a3a3";
  const [, lastY] = coords[coords.length - 1]!;
  const [, firstY] = coords[0]!;

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="rounded-md border border-neutral-800 bg-neutral-900/40"
      >
        {/* Baseline grid line at the starting rating — a visual zero. */}
        <line
          x1={padX}
          x2={width - padX}
          y1={firstY}
          y2={firstY}
          stroke="#262626"
          strokeDasharray="3 3"
        />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        {/* Head + tail dots so the start and current value read clearly. */}
        <circle cx={coords[0]![0]} cy={firstY} r={2.5} fill="#737373" />
        <circle
          cx={coords[coords.length - 1]![0]}
          cy={lastY}
          r={3.5}
          fill={stroke}
        />
      </svg>
      <div className="pointer-events-none absolute right-2 top-1 text-xs text-neutral-300">
        <span className="font-mono">{last.rating}</span>
        {delta !== 0 ? (
          <span
            className={`ml-1 font-mono ${trend === "up" ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
