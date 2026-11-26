import React, { useMemo, useState } from 'react';
import { GitBranch, RefreshCw, Search } from 'lucide-react';
import { CoreStatus, RuleItem } from '../types/clash';

interface RulesPageProps {
  coreStatus: CoreStatus;
  rules: RuleItem[];
  onRefresh: () => Promise<void>;
}

export const RulesPage: React.FC<RulesPageProps> = ({ coreStatus, rules, onRefresh }) => {
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rules;
    return rules.filter(
      (r) =>
        r.type.toLowerCase().includes(kw) ||
        r.payload.toLowerCase().includes(kw) ||
        r.proxy.toLowerCase().includes(kw)
    );
  }, [rules, keyword]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800">分流规则</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">当前共加载 {rules.length} 条分流规则</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-pill px-3 py-1.5 rounded-full flex items-center gap-2 w-60">
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索规则类型 / 域名 / 策略..."
              className="bg-transparent text-[12.5px] text-stone-700 placeholder:text-stone-400 outline-none w-full"
            />
          </div>
          <button
            onClick={onRefresh}
            className="glass-pill p-2 rounded-full text-stone-500 hover:text-orange-600 transition-colors"
            title="刷新规则"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {!coreStatus.running || filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <GitBranch className="w-9 h-9 mx-auto text-stone-300" strokeWidth={1.5} />
            <div className="text-[13.5px]">{coreStatus.running ? '未匹配到规则' : '启动内核后查看分流规则'}</div>
          </div>
        ) : (
          <div className="divide-y divide-stone-200/50 max-h-[560px] overflow-y-auto">
            {filtered.slice(0, 300).map((r, idx) => (
              <div
                key={`${r.type}-${r.payload}-${idx}`}
                className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-orange-50/35 transition-colors text-[12.5px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-mono text-[11px] shrink-0">
                    {r.type}
                  </span>
                  <span className="text-stone-700 font-medium truncate">{r.payload || 'ALL'}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[11.5px] font-semibold shrink-0">
                  {r.proxy}
                </span>
              </div>
            ))}
            {filtered.length > 300 && (
              <div className="py-3 text-center text-[11.5px] text-stone-400">
                仅显示前 300 条，共 {filtered.length} 条，请通过搜索精准定位
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
