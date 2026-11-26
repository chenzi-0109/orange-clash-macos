import React, { useMemo, useState } from 'react';
import { Pause, Play, Terminal, Trash2 } from 'lucide-react';
import { LogEntry } from '../types/clash';

interface LogsPageProps {
  logs: LogEntry[];
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
}

const LEVEL_BADGE: Record<string, string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  debug: 'bg-stone-200 text-stone-600'
};

export const LogsPage: React.FC<LogsPageProps> = ({ logs, paused, onTogglePause, onClear }) => {
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');

  const visibleLogs = useMemo(() => {
    if (levelFilter === 'all') return logs;
    return logs.filter((l) => l.type.toLowerCase() === levelFilter);
  }, [logs, levelFilter]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800">运行日志</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">内核实时输出流（最多保留 400 条）</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-pill p-1 rounded-full flex items-center gap-0.5">
            {(['all', 'info', 'warning', 'error'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setLevelFilter(lv)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium capitalize transition-colors ${
                  levelFilter === lv ? 'bg-orange-100 text-orange-600' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {lv === 'all' ? '全部' : lv.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={onTogglePause}
            className="glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 hover:text-orange-600"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{paused ? '继续' : '暂停'}</span>
          </button>

          <button
            onClick={onClear}
            className="glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 hover:text-rose-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空</span>
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        {visibleLogs.length === 0 ? (
          <div className="py-16 text-center text-stone-400 space-y-2">
            <Terminal className="w-9 h-9 mx-auto text-stone-300" strokeWidth={1.5} />
            <div className="text-[13px]">暂无日志输出</div>
          </div>
        ) : (
          <div className="h-[520px] overflow-y-auto space-y-1.5 font-mono text-[12px] pr-1">
            {visibleLogs.map((item) => {
              const d = new Date(item.time);
              const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
                2,
                '0'
              )}:${String(d.getSeconds()).padStart(2, '0')}`;
              const badge = LEVEL_BADGE[item.type.toLowerCase()] || 'bg-stone-100 text-stone-600';
              return (
                <div
                  key={item.id}
                  className="px-3 py-1.5 rounded-xl bg-white/55 border border-stone-200/40 flex items-start gap-2.5"
                >
                  <span className="text-stone-400 shrink-0">{ts}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10.5px] uppercase font-semibold shrink-0 ${badge}`}>
                    {item.type}
                  </span>
                  <span className="text-stone-700 break-all select-text">{item.payload}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
