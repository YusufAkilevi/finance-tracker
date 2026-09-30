import { percentage } from "../lib/format";
import type { InvestmentPortfolio } from "../types";

type AllocationItem = {
  portfolio: Pick<InvestmentPortfolio, "id" | "name">;
  value: number;
  color: string;
};

const WIDTH = 280;
const RADIUS = 67;
const STROKE = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const LABEL_GAP = 20;

export function InvestmentAllocationChart({ allocation }: { allocation: AllocationItem[] }) {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const slices = allocation.map((item) => {
    const ratio = total ? item.value / total : 0;
    const start = cursor;
    cursor += ratio;
    const angle = (start + ratio / 2) * 2 * Math.PI - Math.PI / 2;
    return {
      ...item,
      ratio,
      start,
      cosine: Math.cos(angle),
      sine: Math.sin(angle),
      labelY: 0,
    };
  });
  const left = slices.filter((slice) => slice.cosine < 0);
  const right = slices.filter((slice) => slice.cosine >= 0);
  const height = Math.max(220, Math.max(left.length, right.length) * LABEL_GAP + 24);
  const centerX = WIDTH / 2;
  const centerY = height / 2;

  // Keep adjacent slices' labels apart, with enough canvas for every label.
  [left, right].forEach((side) => {
    side.sort((a, b) => a.sine - b.sine);
    let previousY = -LABEL_GAP;
    side.forEach((slice) => {
      slice.labelY = Math.max(12, centerY + slice.sine * 96, previousY + LABEL_GAP);
      previousY = slice.labelY;
    });
    let nextY = height - 12 + LABEL_GAP;
    [...side].reverse().forEach((slice) => {
      slice.labelY = Math.min(slice.labelY, nextY - LABEL_GAP);
      nextY = slice.labelY;
    });
  });

  return (
    <svg
      className="investment-donut"
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={slices.map((slice) => `${slice.portfolio.name} yüzde ${Math.round(slice.ratio * 100)}`).join(", ")}
    >
      {slices.map((slice) => (
        <circle
          key={slice.portfolio.id}
          cx={centerX}
          cy={centerY}
          r={RADIUS}
          fill="none"
          stroke={slice.color}
          strokeWidth={STROKE}
          strokeDasharray={`${slice.ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={-slice.start * CIRCUMFERENCE}
          transform={`rotate(-90 ${centerX} ${centerY})`}
        >
          <title>{`${slice.portfolio.name}: ${percentage(slice.ratio)}`}</title>
        </circle>
      ))}
      <text className="investment-donut-count" x={centerX} y={centerY - 4} textAnchor="middle">
        {allocation.length}
      </text>
      <text className="investment-donut-caption" x={centerX} y={centerY + 16} textAnchor="middle">
        portföy
      </text>
      {slices.map((slice) => {
        const isRight = slice.cosine >= 0;
        const labelX = isRight ? 235 : 45;
        return (
          <g key={slice.portfolio.id} aria-hidden="true">
            <polyline
              className="investment-donut-leader"
              stroke={slice.color}
              points={`${centerX + slice.cosine * 85},${centerY + slice.sine * 85} ${centerX + slice.cosine * 92},${slice.labelY} ${labelX + (isRight ? -4 : 4)},${slice.labelY}`}
            />
            <text
              className="investment-donut-percentage"
              x={labelX}
              y={slice.labelY}
              textAnchor={isRight ? "start" : "end"}
              dominantBaseline="central"
            >
              {percentage(slice.ratio)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
