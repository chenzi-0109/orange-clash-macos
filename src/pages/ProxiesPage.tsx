import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Globe, RefreshCw, Search, Zap, Check } from 'lucide-react';
import { CoreStatus, ProxyNode } from '../types/clash';
import { getDelayBadgeBg } from '../utils/format';

interface ProxiesPageProps {
  coreStatus: CoreStatus;
  proxies: Record<string, ProxyNode>;
  onSelectProxy: (group: string, proxy: string) => Promise<void>;
  onTestProxyDelay: (proxy: string) => Promise<void>;
  onTestGroupDelay: (group: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const ProxiesPage: React.FC<ProxiesPageProps> = ({
  coreStatus,
  proxies,
  onSelectProxy,
  onTestProxyDelay,
  onTestGroupDelay,
  onRefresh
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [sortByDelay, setSortByDelay] = useState(false);
  const [testingGroup, setTestingGroup] = useState(false);
  const [testingNode, setTestingNode] = useState<string | null>(null);

  const groups = useMemo(() => {
    const groupTypes = new Set(['Selector', 'URLTest', 'Fallback', 'LoadBalance']);
    const list = Object.values(proxies).filter(
      (p) => groupTypes.has(p.type) && Array.isArray(p.all) && p.all.length > 0 && p.name !== 'GLOBAL'
    );
    if (proxies.GLOBAL && Array.isArray(proxies.GLOBAL.all)) {
      list.push(proxies.GLOBAL);
    }
    return list;
  }, [proxies]);

  const activeGroup = useMemo(() => {
    if (!groups.length) return null;
    return groups.find((g) => g.name === selectedGroup) || groups[0];
  }, [groups, selectedGroup]);

  const nodes = useMemo(() => {
    if (!activeGroup?.all) return [];
    const kw = keyword.trim().toLowerCase();
    let items = activeGroup.all
      .filter((name) => !kw || name.toLowerCase().includes(kw))
      .map((name) => {
        const info = proxies[name];
        const delay = info?.history?.[info.history.length - 1]?.delay ?? 0;
        return {
          name,
          type: info?.type || 'Direct',
          udp: info?.udp,
          delay,
          selected: activeGroup.now === name
        };
      });

    if (sortByDelay) {
      items = [...items].sort((a, b) => {
        const da = a.delay > 0 ? a.delay : 999999;
        const db = b.delay > 0 ? b.delay : 999999;
        return da - db;
      });
    }
    return items;
  }, [activeGroup, keyword, proxies, sortByDelay]);

  const handleGroupTest = async () => {
    if (!activeGroup || testingGroup) return;
    setTestingGroup(true);
    try {
      await onTestGroupDelay(activeGroup.name);
    } finally {
      setTestingGroup(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800">代理节点</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">切换策略组节点与实时延迟测试</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-pill px-3 py-1.5 rounded-full flex items-center gap-2 w-52">
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索节点名称..."
              className="bg-transparent text-[12.5px] text-stone-700 placeholder:text-stone-400 outline-none w-full"
            />
          </div>

          <button
            onClick={() => setSortByDelay((v) => !v)}
            className={`glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium transition-colors ${
              sortByDelay ? 'text-orange-600 bg-orange-50/90' : 'text-stone-600 hover:text-orange-600'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>按延迟</span>
          </button>

          <button
            onClick={handleGroupTest}
            disabled={!coreStatus.running || !activeGroup || testingGroup}
            className="px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-45 text-white flex items-center gap-1.5 text-[12.5px] font-medium shadow-sm transition-colors"
          >
            <Zap className={`w-3.5 h-3.5 ${testingGroup ? 'animate-pulse' : ''}`} />
            <span>{testingGroup ? '测速中...' : '全组测速'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="glass-pill p-2 rounded-full text-stone-500 hover:text-orange-600 transition-colors"
            title="刷新节点"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!coreStatus.running ? (
        <div className="glass-card p-12 text-center text-stone-400 space-y-2">
          <Globe className="w-10 h-10 mx-auto text-stone-300" strokeWidth={1.5} />
          <div className="text-[14px] font-medium text-stone-600">内核尚未启动</div>
          <div className="text-[12.5px]">请先在「总览」页开启总开关，启动内核后即可选择与测速节点</div>
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-12 text-center text-stone-400 space-y-2">
          <Globe className="w-10 h-10 mx-auto text-stone-300" strokeWidth={1.5} />
          <div className="text-[14px] font-medium text-stone-600">暂无可用节点</div>
          <div className="text-[12.5px]">请在「总览」页右侧导入订阅链接或本地 YAML 配置</div>
        </div>
      ) : (
        <>
          {/* 策略分组横向标签 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {groups.map((g) => {
              const active = activeGroup?.name === g.name;
              return (
                <button
                  key={g.name}
                  onClick={() => setSelectedGroup(g.name)}
                  className={`px-4 py-2 rounded-2xl text-[13px] font-medium shrink-0 transition-all flex items-center gap-2 border ${
                    active
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'glass-pill text-stone-600 hover:text-orange-600'
                  }`}
                >
                  <span>{g.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {g.all?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 节点网格 */}
          <div className="grid grid-cols-3 gap-3">
            {nodes.map((node) => (
              <div
                key={node.name}
                onClick={() => activeGroup && onSelectProxy(activeGroup.name, node.name)}
                className={`glass-card p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 ${
                  node.selected
                    ? 'ring-2 ring-orange-400/80 bg-gradient-to-br from-orange-50/90 to-white/85'
                    : 'hover:ring-1 hover:ring-orange-300/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {node.selected && (
                        <span className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-stone-800 truncate">{node.name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-stone-100/90 text-stone-500 uppercase">
                      {node.type}
                    </span>
                    {node.udp && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600">
                        UDP
                      </span>
                    )}
                  </div>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setTestingNode(node.name);
                      try {
                        await onTestProxyDelay(node.name);
                      } finally {
                        setTestingNode(null);
                      }
                    }}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full border transition-colors ${getDelayBadgeBg(
                      node.delay
                    )}`}
                  >
                    {testingNode === node.name
                      ? '测速...'
                      : node.delay > 0
                        ? `${node.delay} ms`
                        : '测速'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
