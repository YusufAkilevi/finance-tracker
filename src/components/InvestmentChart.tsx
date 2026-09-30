import { shortMonth } from "../lib/date";
import { investmentMoney } from "../lib/format";
import type { InvestmentCurrency } from "../types";

type InvestmentChartProps = {
  currency: InvestmentCurrency;
  points: { month: string; value: number; invested: number }[];
};

const WIDTH = 680;
const HEIGHT = 230;
const LEFT = 54;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 38;

export function InvestmentChart({ currency, points }: InvestmentChartProps) {
  if (!points.length) {
    return (
      <div className="investment-chart-empty">
        Aylık kayıtlar eklendikçe değer ve ana para gelişimi burada görünecek.
      </div>
    );
  }

  const allValues = points.flatMap((point) => [point.value, point.invested]);
  const maximum = Math.max(1, ...allValues);
  // Net invested capital can go negative once withdrawals exceed contributions.
  const minimum = Math.min(0, ...allValues);
  const range = maximum - minimum;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (index: number) =>
    LEFT + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => TOP + plotHeight - ((value - minimum) / range) * plotHeight;
  const baselineY = y(0);
  const valuePath = linePath(points.map((point, index) => [x(index), y(point.value)]));
  const investedPath = linePath(points.map((point, index) => [x(index), y(point.invested)]));
  const areaPath = `${valuePath} L ${x(points.length - 1)} ${baselineY} L ${x(0)} ${baselineY} Z`;
  const tickValues = [maximum, minimum + range * 0.66, minimum + range * 0.33, minimum];

  return (
    <div className="investment-chart-wrap">
      <svg
        className="investment-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="investmentChartTitle investmentChartDescription"
      >
        <title id="investmentChartTitle">Yatırım varlığı gelişimi</title>
        <desc id="investmentChartDescription">
          {shortMonth(points[0].month)} ile {shortMonth(points.at(-1)!.month)} arasında portföy değeri ve net yatırılan ana para.
        </desc>
        {tickValues.map((tick, index) => {
          const tickY = TOP + (index / 3) * plotHeight;
          return (
            <g key={tick}>
              <line className="investment-chart-grid" x1={LEFT} y1={tickY} x2={WIDTH - RIGHT} y2={tickY} />
              <text className="investment-chart-axis" x={LEFT - 7} y={tickY + 4} textAnchor="end">
                {compactMoney(tick, currency)}
              </text>
            </g>
          );
        })}
        <path className="investment-chart-area" d={areaPath} />
        <path className="investment-chart-value" d={valuePath} />
        <path className="investment-chart-capital" d={investedPath} />
        {points.map((point, index) => (
          <circle key={point.month} className="investment-chart-point" cx={x(index)} cy={y(point.value)} r="3.5">
            <title>{`${shortMonth(point.month)}: ${investmentMoney(point.value, currency)}`}</title>
          </circle>
        ))}
        <text className="investment-chart-axis" x={x(0)} y={HEIGHT - 10} textAnchor={points.length === 1 ? "middle" : "start"}>
          {shortMonth(points[0].month)}
        </text>
        {points.length > 1 ? (
          <text className="investment-chart-axis" x={x(points.length - 1)} y={HEIGHT - 10} textAnchor="end">
            {shortMonth(points.at(-1)!.month)}
          </text>
        ) : null}
      </svg>
      <div className="investment-chart-legend" aria-hidden="true">
        <span><i className="investment-legend-value" />Portföy değeri</span>
        <span><i className="investment-legend-capital" />Net ana para</span>
      </div>
    </div>
  );
}

function linePath(points: number[][]) {
  return points.map(([pointX, pointY], index) => `${index ? "L" : "M"} ${pointX} ${pointY}`).join(" ");
}

function compactMoney(value: number, currency: InvestmentCurrency) {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency,
  }).format(value);
}
