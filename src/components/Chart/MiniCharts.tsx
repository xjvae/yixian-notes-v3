// ========== 共享 SVG 迷你图表组件（无外部依赖） ==========
// 供 DashboardPage / WorkspaceDashboard 等复用，避免多份拷贝。
// 各页通过 width/height 传入自己的尺寸以保持原样。

interface MiniChartBase {
  data: number[];
  color: string;
}

export function MiniBarChart({ data, color, width = 200, height = 70 }: MiniChartBase & { width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const w = width;
  const h = height;
  const barW = 18;
  const gap = 6;
  const startX = (w - data.length * (barW + gap) + gap) / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 8);
        const x = startX + i * (barW + gap);
        const y = h - bh - 4;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={3}
            fill={color}
            opacity={0.7 + (i / data.length) * 0.3}
          />
        );
      })}
    </svg>
  );
}

export function MiniLineChart({ data, color, width = 220, height = 70 }: MiniChartBase & { width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = width;
  const h = height;
  const pad = 4;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const areaPoints = `${pad},${h} ${points} ${w - pad},${h}`;
  const gradId = `dashLine-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
    </svg>
  );
}

export function MiniDonutChart({
  segments,
  size = 80,
}: {
  segments: { value: number; color: string; label?: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={8}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

export function StudyHeatmap({ data, color, width = 280, height = 64 }: MiniChartBase & { width?: number; height?: number }) {
  const w = width;
  const h = height;
  const cellW = 7;
  const cellH = 7;
  const gap = 2;
  const cols = 15;
  const max = Math.max(...data, 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {data.map((v, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (cellW + gap);
        const y = row * (cellH + gap);
        const intensity = v / max;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={cellW}
            height={cellH}
            rx={1.5}
            fill={color}
            opacity={0.1 + intensity * 0.9}
          />
        );
      })}
    </svg>
  );
}