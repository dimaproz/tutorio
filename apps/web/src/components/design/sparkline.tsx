/**
 * Inline SVG sparkline. Deliberately not recharts: one series answering one
 * question ("чи росте навантаження?") does not justify a charting runtime.
 */
export function Sparkline({
  values,
  label,
  width = 168,
  height = 40,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path d={area} fill="var(--marker)" opacity="0.09" />
      <path
        d={line}
        fill="none"
        stroke="var(--marker)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="var(--marker)" />
    </svg>
  );
}
