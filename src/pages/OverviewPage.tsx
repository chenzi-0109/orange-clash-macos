import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Cpu,
  FileText,
  FolderOpen,
  Globe,
  Inbox,
  Layers,
  Link2,
  Plus,
  Power,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  WifiOff,
  Zap,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  AppSettings,
  ConnectionsSnapshot,
  CoreStatus,
  NavTab,
  ProxyMode,
  ProxyNode,
  PublicProfile,
  TrafficPoint
} from '../types/clash';
import { formatBytes, formatDuration, formatRelativeTime, getDelayColor } from '../utils/format';
import { TrafficChart } from '../components/TrafficChart';

interface OverviewPageProps {
  settings: AppSettings;
  coreStatus: CoreStatus;
  profiles: PublicProfile[];
  activeProfileId: string | null;
  proxies: Record<string, ProxyNode>;
  traffic: { up: number; down: number };
  trafficHistory: TrafficPoint[];
  connections: ConnectionsSnapshot;
  uptimeSeconds: number;
  isAdmin: boolean;
  onToggleMaster: () => Promise<void>;
  onChangeMode: (mode: ProxyMode) => Promise<void>;
  onToggleSystemProxy: (enable: boolean) => Promise<void>;
  onToggleTun: (enable: boolean) => Promise<void>;
  onRestartCore: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onImportFile: () => Promise<void>;
  onSelectProfile: (id: string) => Promise<void>;
  onRefreshProfile: (id: string) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onSelectProxy: (group: string, name: string) => Promise<void>;
  onTestGroupDelay: (group: string) => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

const MODE_OPTIONS: Array<{ value: ProxyMode; label: string }> = [
  { value: 'rule', label: '规则' },
  { value: 'global', label: '全局' },
  { value: 'direct', label: '直连' }
];

const MODE_LABELS: Record<ProxyMode, string> = {
  rule: '规则模式',
  global: '全局模式',
  direct: '直连模式'
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  settings,
  coreStatus,
  profiles,
  activeProfileId,
  proxies,
  traffic,
  trafficHistory,
  connections,
  uptimeSeconds,
  isAdmin,
  onToggleMaster,
  onChangeMode,
  onToggleSystemProxy,
  onToggleTun,
  onRestartCore,
  onRefreshAll,
  onImportUrl,
  onImportFile,
  onSelectProfile,
  onRefreshProfile,
  onDeleteProfile,
  onSelectProxy,
  onTestGroupDelay,
  onNavigate
}) => {
  const [subUrl, setSubUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [testingDelay, setTestingDelay] = useState(false);
  const [togglingPower, setTogglingPower] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // 提取所有策略分组（Selector / URLTest / Fallback / LoadBalance）
  const proxyGroups = useMemo(() => {
    const groupTypes = new Set(['Selector', 'URLTest', 'Fallback', 'LoadBalance']);
    const list = Object.values(proxies).filter(
      (p) => groupTypes.has(p.type) && Array.isArray(p.all) && p.all.length > 0 && p.name !== 'GLOBAL'
    );
    if (list.length === 0 && proxies.GLOBAL && Array.isArray(proxies.GLOBAL.all)) {
      return [proxies.GLOBAL];
    }
    return list;
  }, [proxies]);

  // 当前主选择组（优先第一个 Selector 组）
  const primaryGroup = useMemo(() => {
    if (settings.mode === 'global' && proxies.GLOBAL) {
      return proxies.GLOBAL;
    }
    return proxyGroups.find((g) => g.type === 'Selector') || proxyGroups[0] || null;
  }, [proxyGroups, proxies, settings.mode]);

  const currentNodeName = useMemo(() => {
    if (!coreStatus.running || !primaryGroup?.now) return null;
    return primaryGroup.now;
  }, [coreStatus.running, primaryGroup]);

  const quickNodes = useMemo(() => {
    if (!coreStatus.running || !primaryGroup?.all) return [];
    return primaryGroup.all.slice(0, 12).map((name) => {
      const node = proxies[name];
      const lastDelay = node?.history?.[node.history.length - 1]?.delay;
      return {
        name,
        type: node?.type || '',
        delay: lastDelay,
        active: primaryGroup.now === name
      };
    });
  }, [coreStatus.running, primaryGroup, proxies]);

  const handleImportSubmit = async () => {
    const trimmed = subUrl.trim();
    if (!trimmed || importing) return;
    setImporting(true);
    try {
      await onImportUrl(trimmed);
      setSubUrl('');
    } finally {
      setImporting(false);
    }
  };

  const handlePowerClick = async () => {
    if (togglingPower) return;
    setTogglingPower(true);
    try {
      await onToggleMaster();
    } finally {
      setTogglingPower(false);
    }
  };

  const handleQuickTest = async () => {
    if (!primaryGroup || testingDelay) return;
    setTestingDelay(true);
    try {
      await onTestGroupDelay(primaryGroup.name);
    } finally {
      setTestingDelay(false);
    }
  };

  const isConnected = coreStatus.running && (settings.systemProxy || settings.tunEnabled);

  return (
    <div className="space-y-4 pb-6">
      {/* 顶部标题栏与模式切换 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800 leading-tight">总览</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">连接状态、订阅与实时流量</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 规则 / 全局 / 直连 分段开关 */}
          <div className="glass-pill p-1 rounded-full flex items-center gap-0.5">
            {MODE_OPTIONS.map((opt) => {
              const active = settings.mode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onChangeMode(opt.value)}
                  className={`px-3.5 py-1 rounded-full text-[12.5px] font-medium transition-all ${
                    active
                      ? 'bg-orange-100/95 text-orange-600 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onRefreshAll}
            className="glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 hover:text-orange-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>刷新</span>
          </button>

          <div
            className={`glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-2 text-[12.5px] font-medium ${
              isConnected ? 'text-orange-600' : 'text-stone-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-stone-400'
              }`}
            />
            <span>{isConnected ? '代理中' : coreStatus.running ? '内核就绪' : '直连中'}</span>
          </div>
        </div>
      </div>

      {/* 第一行：三列核心功能模块（总开关 / 节点快切 / 匿名导入订阅） */}
      <div className="grid grid-cols-12 gap-4">
        {/* 1. 总开关模块 */}
        <div className="col-span-5 glass-card p-5 flex flex-col justify-between min-h-[218px]">
          <div className="flex items-center gap-5">
            {/* 大圆形液态玻璃电源按钮 */}
            <button
              onClick={handlePowerClick}
              disabled={togglingPower}
              className={`w-[106px] h-[106px] rounded-full shrink-0 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 ${
                isConnected ? 'power-orb-on text-white' : 'power-orb-off text-stone-700'
              }`}
            >
              <Power className={`w-7 h-7 ${togglingPower ? 'animate-pulse' : ''}`} strokeWidth={2} />
              <span className="text-[12px] font-semibold tracking-wide">
                {togglingPower ? '切换中...' : isConnected ? '已连接' : '已断开'}
              </span>
            </button>

            {/* 右侧状态说明与标签 */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start gap-1.5 text-[12px] text-stone-500 leading-snug">
                {isConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                ) : (
                  <WifiOff className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                )}
                <span>
                  {isConnected
                    ? settings.tunEnabled
                      ? '虚拟网卡与内核运行中，已接管流量'
                      : '系统代理已开启，正在智能分流'
                    : '当前为直连状态，未接管流量'}
                </span>
              </div>

              <div>
                <div className="text-[11px] text-stone-400">当前节点</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="text-[16px] font-bold text-stone-800 truncate">
                    {currentNodeName || '未选择节点'}
                  </span>
                </div>
              </div>

              {/* 彩色小胶囊标签 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-orange-100/90 text-orange-600">
                  {MODE_LABELS[settings.mode]}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-100/80 text-sky-600">
                  端口 {settings.mixedPort}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-violet-100/80 text-violet-600">
                  {formatDuration(uptimeSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* 底部快捷代理/虚拟网卡控制条 */}
          <div className="mt-4 pt-3 border-t border-stone-200/60 flex items-center gap-2.5">
            <div className="flex-1 glass-subcard px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
                <Globe className="w-3.5 h-3.5 text-orange-500" />
                <span>系统代理</span>
              </div>
              <button
                onClick={() => onToggleSystemProxy(!settings.systemProxy)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                  settings.systemProxy ? 'bg-orange-500' : 'bg-stone-300/80'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.systemProxy ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex-1 glass-subcard px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
                <Cpu className="w-3.5 h-3.5 text-orange-500" />
                <span>虚拟网卡</span>
              </div>
              <button
                onClick={() => onToggleTun(!settings.tunEnabled)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                  settings.tunEnabled ? 'bg-orange-500' : 'bg-stone-300/80'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.tunEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 2. 节点快切模块 */}
        <div className="col-span-4 glass-card p-5 flex flex-col justify-between min-h-[218px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span className="text-[14px] font-semibold text-stone-800">节点快切</span>
            </div>
            {primaryGroup && coreStatus.running && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium truncate max-w-[110px]">
                {primaryGroup.name}
              </span>
            )}
          </div>

          <div className="my-3 flex-1 overflow-y-auto max-h-[108px] pr-1">
            {quickNodes.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {quickNodes.map((n) => (
                  <button
                    key={n.name}
                    onClick={() => primaryGroup && onSelectProxy(primaryGroup.name, n.name)}
                    className={`px-2.5 py-1.5 rounded-xl text-left transition-all flex items-center justify-between gap-1 border ${
                      n.active
                        ? 'bg-orange-500/12 border-orange-400/50 text-orange-700 font-semibold'
                        : 'bg-white/65 border-stone-200/60 text-stone-600 hover:border-orange-300 hover:bg-orange-50/40'
                    }`}
                  >
                    <span className="text-[11.5px] truncate">{n.name}</span>
                    {n.delay && n.delay > 0 ? (
                      <span className={`text-[10px] font-mono shrink-0 ${getDelayColor(n.delay)}`}>
                        {n.delay}ms
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[84px] flex items-center justify-center gap-1.5 text-[12.5px] text-stone-400">
                <Activity className="w-4 h-4 text-stone-300" />
                <span>启动代理后可直接在这里切换节点</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigate('proxies')}
              className="glass-subcard py-2 px-3 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-stone-600 hover:text-orange-600 hover:bg-orange-50/60 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>全部节点</span>
            </button>
            <button
              onClick={handleQuickTest}
              disabled={!coreStatus.running || !primaryGroup || testingDelay}
              className="glass-subcard py-2 px-3 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-stone-600 hover:text-orange-600 hover:bg-orange-50/60 disabled:opacity-45 transition-colors"
            >
              <Zap className={`w-3.5 h-3.5 ${testingDelay ? 'animate-pulse text-orange-500' : ''}`} />
              <span>{testingDelay ? '测速中...' : '一键测速'}</span>
            </button>
          </div>
        </div>

        {/* 3. 导入订阅模块（严格隐藏订阅名称） */}
        <div className="col-span-3 glass-card p-5 flex flex-col justify-between min-h-[218px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-[14px] font-semibold text-stone-800">
                  订阅 {profiles.length} 个
                </span>
              </div>
              <span className="text-[10.5px] text-stone-400">名称已隐私隐藏</span>
            </div>

            {/* 导入输入栏 */}
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 bg-white/80 border border-stone-200/80 rounded-xl px-2.5 py-1.5 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
                <Link2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  value={subUrl}
                  onChange={(e) => setSubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImportSubmit()}
                  placeholder="订阅链接 https://..."
                  className="w-full bg-transparent text-[12px] text-stone-700 placeholder:text-stone-400 outline-none"
                />
              </div>
              <button
                onClick={handleImportSubmit}
                disabled={importing || !subUrl.trim()}
                title="导入订阅链接"
                className="w-8 h-8 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-stone-200 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
              >
                <Plus className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onImportFile}
                title="导入本地 YAML 配置"
                className="w-8 h-8 rounded-xl glass-subcard hover:bg-orange-50 text-stone-600 hover:text-orange-600 flex items-center justify-center shrink-0 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 订阅列表（绝不显示任何订阅名、URL 或文件名） */}
          <div className="mt-3 flex-1 overflow-y-auto max-h-[112px] space-y-1.5 pr-0.5">
            {profiles.length === 0 ? (
              <div className="h-[96px] flex flex-col items-center justify-center text-stone-400 gap-1.5">
                <Inbox className="w-6 h-6 text-stone-300" strokeWidth={1.6} />
                <span className="text-[12px]">粘贴订阅链接即可导入</span>
              </div>
            ) : (
              profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProfile(p.id)}
                    className={`px-2.5 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 border ${
                      isActive
                        ? 'bg-orange-50/90 border-orange-300/80'
                        : 'bg-white/60 border-stone-200/60 hover:bg-white/90'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-orange-500' : 'bg-stone-300'
                          }`}
                        />
                        <span className="text-[12px] font-semibold text-stone-700">
                          订阅 #{p.index}
                        </span>
                        <span className="text-[10.5px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-500">
                          {p.nodeCount} 节点
                        </span>
                      </div>
                      <div className="text-[10.5px] text-stone-400 mt-0.5 pl-3">
                        {formatRelativeTime(p.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {p.hasSourceUrl && (
                        <button
                          onClick={async () => {
                            setRefreshingId(p.id);
                            try {
                              await onRefreshProfile(p.id);
                            } finally {
                              setRefreshingId(null);
                            }
                          }}
                          title="更新订阅"
                          className="p-1 rounded-lg text-stone-400 hover:text-orange-600 hover:bg-orange-100/60 transition-colors"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${refreshingId === p.id ? 'animate-spin text-orange-500' : ''}`}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteProfile(p.id)}
                        title="删除订阅"
                        className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 第二行：实时流量统计 + 折线图 + 系统代理/虚拟网卡与内核状态 */}
      <div className="glass-card p-5 space-y-4">
        {/* 4 列核心流量指标 */}
        <div className="grid grid-cols-4 gap-3.5">
          <div className="glass-subcard p-3.5">
            <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <ArrowUp className="w-3.5 h-3.5 text-sky-500" />
              <span>上传速率</span>
            </div>
            <div className="text-[20px] font-bold text-stone-800 mt-1.5 font-mono tracking-tight">
              {formatBytes(traffic.up, true)}
            </div>
          </div>

          <div className="glass-subcard p-3.5">
            <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
              <span>下载速率</span>
            </div>
            <div className="text-[20px] font-bold text-stone-800 mt-1.5 font-mono tracking-tight">
              {formatBytes(traffic.down, true)}
            </div>
          </div>

          <div className="glass-subcard p-3.5">
            <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <Activity className="w-3.5 h-3.5 text-violet-500" />
              <span>累计流量</span>
            </div>
            <div className="text-[20px] font-bold text-stone-800 mt-1.5 font-mono tracking-tight">
              {formatBytes((connections.uploadTotal || 0) + (connections.downloadTotal || 0))}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5 font-mono">
              ↑ {formatBytes(connections.uploadTotal || 0)} · ↓ {formatBytes(connections.downloadTotal || 0)}
            </div>
          </div>

          <div className="glass-subcard p-3.5">
            <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <Link2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>活跃连接</span>
            </div>
            <div className="text-[20px] font-bold text-stone-800 mt-1.5 font-mono tracking-tight">
              {connections.connections?.length || 0}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5">运行 {formatDuration(uptimeSeconds)}</div>
          </div>
        </div>

        {/* 下半部分：左侧实时折线图 + 右侧系统代理 / TUN / 内核状态 */}
        <div className="grid grid-cols-12 gap-4 items-stretch">
          <div className="col-span-8 flex flex-col justify-between pr-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" />
                <span className="text-[13.5px] font-semibold text-stone-800">实时速率</span>
                <span className="text-[11.5px] text-stone-400">最近 60 秒</span>
              </div>
              <div className="flex items-center gap-4 text-[11.5px] font-mono">
                <span className="flex items-center gap-1.5 text-stone-500">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  下载 {formatBytes(traffic.down, true)}
                </span>
                <span className="flex items-center gap-1.5 text-stone-500">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  上传 {formatBytes(traffic.up, true)}
                </span>
              </div>
            </div>

            <TrafficChart points={trafficHistory} running={coreStatus.running} />
          </div>

          {/* 右侧：系统代理 + 虚拟网卡 TUN + 内核状态 */}
          <div className="col-span-4 space-y-2.5">
            <div className="glass-subcard px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
                  <Globe className="w-3.5 h-3.5 text-orange-500" />
                  <span>系统代理</span>
                  <span
                    className={`text-[10.5px] px-1.5 py-0.2 rounded-full ${
                      settings.systemProxy
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-stone-200/70 text-stone-500'
                    }`}
                  >
                    {settings.systemProxy ? '已接管' : '未接管'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5 font-mono">
                  HTTP / HTTPS / SOCKS5 · {settings.mixedPort.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => onToggleSystemProxy(!settings.systemProxy)}
                className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                  settings.systemProxy ? 'bg-orange-500' : 'bg-stone-300/80'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.systemProxy ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="glass-subcard px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
                  <Cpu className="w-3.5 h-3.5 text-orange-500" />
                  <span>虚拟网卡 (TUN)</span>
                  <span
                    className={`text-[10.5px] px-1.5 py-0.2 rounded-full ${
                      settings.tunEnabled
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-stone-200/70 text-stone-500'
                    }`}
                  >
                    {settings.tunEnabled ? '已启用' : '未启用'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {isAdmin ? `全局接管 · ${settings.tunStack} 堆栈` : '需要管理员权限以接管全局'}
                </div>
              </div>
              <button
                onClick={() => onToggleTun(!settings.tunEnabled)}
                className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                  settings.tunEnabled ? 'bg-orange-500' : 'bg-stone-300/80'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    settings.tunEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="glass-subcard px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    coreStatus.running ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'
                  }`}
                >
                  {coreStatus.running ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold text-stone-700">
                    {coreStatus.running ? '内核运行中' : '内核已停止'}
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono">
                    {coreStatus.version} · 控制端口 {settings.controllerPort}
                  </div>
                </div>
              </div>
              <button
                onClick={onRestartCore}
                title="重启内核"
                className="w-8 h-8 rounded-xl bg-white/80 hover:bg-orange-50 text-stone-500 hover:text-orange-600 flex items-center justify-center border border-stone-200/70 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 第三行：策略分组快捷栏 */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500" />
            <span className="text-[14px] font-semibold text-stone-800">策略分组</span>
          </div>
          <button
            onClick={() => onNavigate('proxies')}
            className="text-[12px] font-medium text-orange-600 hover:text-orange-700"
          >
            管理全部节点 →
          </button>
        </div>

        {proxyGroups.length === 0 ? (
          <div className="text-[12.5px] text-stone-400 py-2">
            {coreStatus.running
              ? '当前配置暂无自定义策略分组，可先导入订阅链接'
              : '启动内核后即可查看与切换策略分组'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {proxyGroups.slice(0, 6).map((group) => (
              <button
                key={group.name}
                onClick={() => onNavigate('proxies')}
                className="glass-subcard p-3 text-left hover:border-orange-300/80 hover:bg-orange-50/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-stone-800 truncate">{group.name}</span>
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-white/80 text-stone-500">
                    {group.type}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11.5px]">
                  <span className="text-orange-600 font-medium truncate max-w-[160px]">
                    {group.now || '未选择'}
                  </span>
                  <span className="text-stone-400">{group.all?.length || 0} 节点</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
