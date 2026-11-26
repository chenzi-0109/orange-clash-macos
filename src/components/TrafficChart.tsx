import React, { useMemo } from 'react';
import { TrafficPoint } from '../types/clash';

interface TrafficChartProps {
  points: TrafficPoint[];
  running: boolean;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({ points, running }) => {
  const { downPath, downArea, upPath, upArea, hasTraffic } = useMemo(() => {
    const width = 560;
    const height = 110;
    const padY = 8;

    const data = points.slice(-60);
    const maxVal = Math.max(
      1024,
      ...data.map((p) => Math.max(p.down || 0, p.up || 0))
    );
    const hasAny = data.some((p) => p.down > 0 || p.up > 0);

    const buildPaths = (getter: (p: TrafficPoint) => number) => {
      if (data.length < 2) return { line: '', area: '' };
      const stepX = width / Math.max(1, data.length - 1);
      const coords = data.map((p, idx) => {
        const x = idx * stepX;
        const ratio = Math.min(1, getter(p) / maxVal);
        const y = height - padY - ratio * (height - padY * 2);
        return { x, y };
      });

      const line = coords
        .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(' ');
      const area = `${line} L ${width} ${height} L 0 ${height} Z`;
      return { line, area };
    };

    const down = buildPaths((p) => p.down);
    const up = buildPaths((p) => p.up);

    return {
      downPath: down.line,
      downArea: down.area,
      upPath: up.line,
      upArea: up.area,
      hasTraffic: hasAny
    };
  }, [points]);

  if (!running || (!hasTraffic && points.length < 2)) {
    return (
      <div className="h-[116px] flex items-center text-[13px] text-stone-400 pl-1">
        暂无流量 · 开启代理后开始记录
      </div>
    );
  }

  return (
    <div className="h-[116px] w-full relative pt-2">
      <svg viewBox="0 0 560 110" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* 背景虚线网格 */}
        <line x1="0" y1="28" x2="560" y2="28" stroke="rgba(28,25,23,0.05)" strokeDasharray="4 4" />
        <line x1="0" y1="68" x2="560" y2="68" stroke="rgba(28,25,23,0.05)" strokeDasharray="4 4" />

        {upArea && <path d={upArea} fill="url(#upGrad)" />}
        {downArea && <path d={downArea} fill="url(#downGrad)" />}
        {upPath && <path d={upPath} fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinejoin="round" />}
        {downPath && <path d={downPath} fill="none" stroke="#F97316" strokeWidth="2.1" strokeLinejoin="round" />}
      </svg>
    </div>
  );
};
