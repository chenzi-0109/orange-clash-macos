import React, { useMemo, useState } from 'react';
import { Activity, Search, Trash2, X } from 'lucide-react';
import { ConnectionsSnapshot, CoreStatus } from '../types/clash';
import { formatBytes } from '../utils/format';

interface ConnectionsPageProps {
  coreStatus: CoreStatus;
  connections: ConnectionsSnapshot;
  onCloseConnection: (id: string) => Promise<void>;
  onCloseAll: () => Promise<void>;
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  coreStatus,
  connections,
  onCloseConnection,
  onCloseAll
}) => {
  const [keyword, setKeyword] = useState('');

  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const raw = connections.connections || [];
    if (!kw) return raw;
    return raw.filter((c) => {
      const host = (c.metadata?.host || c.metadata?.destinationIP || '').toLowerCase();
      const rule = `${c.rule} ${c.rulePayload}`.toLowerCase();
      const chain = (c.chains || []).join(' ').toLowerCase();
      const proc = (c.metadata?.process || '').toLowerCase();
      return host.includes(kw) || rule.includes(kw) || chain.includes(kw) || proc.includes(kw);
    });
  }, [connections.connections, keyword]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800">实时连接</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">
            活跃连接 {connections.connections?.length || 0} 条 · 累计 ↑ {formatBytes(connections.uploadTotal || 0)} · ↓{' '}
            {formatBytes(connections.downloadTotal || 0)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-pill px-3 py-1.5 rounded-full flex items-center gap-2 w-56">
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="筛选域名 / 进程 / 节点..."
              className="bg-transparent text-[12.5px] text-stone-700 placeholder:text-stone-400 outline-none w-full"
            />
          </div>

          <button
            onClick={onCloseAll}
            disabled={!coreStatus.running || (connections.connections?.length || 0) === 0}
            className="glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-45 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>断开全部</span>
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Activity className="w-9 h-9 mx-auto text-stone-300" strokeWidth={1.5} />
            <div className="text-[13.5px]">{coreStatus.running ? '当前暂无活跃连接' : '内核未运行'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200/70 text-[11.5px] font-semibold text-stone-400 bg-white/40">
                  <th className="py-3 px-4">目标地址 / 进程</th>
                  <th className="py-3 px-3">类型</th>
                  <th className="py-3 px-3">命中规则</th>
                  <th className="py-3 px-3">代理链路</th>
                  <th className="py-3 px-3 text-right">流量 (↑ / ↓)</th>
                  <th className="py-3 px-3 text-center w-12">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/50 text-[12.5px]">
                {list.slice(0, 150).map((c) => {
                  const target = `${c.metadata?.host || c.metadata?.destinationIP}:${c.metadata?.destinationPort}`;
                  return (
                    <tr key={c.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <div className="font-medium text-stone-800 truncate" title={target}>
                          {target}
                        </div>
                        {c.metadata?.process && (
                          <div className="text-[11px] text-stone-400 truncate">{c.metadata.process}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] uppercase font-mono">
                          {c.metadata?.network}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[160px] truncate text-stone-600">
                        {c.rule}
                        {c.rulePayload ? `(${c.rulePayload})` : ''}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate">
                        <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[11.5px] font-medium">
                          {(c.chains || []).slice().reverse().join(' → ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11.5px] text-stone-600 whitespace-nowrap">
                        {formatBytes(c.upload)} / {formatBytes(c.download)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onCloseConnection(c.id)}
                          title="断开连接"
                          className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
