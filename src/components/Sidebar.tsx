import React from 'react';
import {
  Activity,
  Compass,
  Globe,
  GitBranch,
  Terminal,
  Settings,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { AppSettings, CoreStatus, NavTab } from '../types/clash';
import { OrangeLogo } from './OrangeLogo';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  coreStatus: CoreStatus;
  settings: AppSettings;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '总览', icon: Compass },
  { id: 'proxies', label: '代理节点', icon: Globe },
  { id: 'connections', label: '实时连接', icon: Activity },
  { id: 'rules', label: '分流规则', icon: GitBranch },
  { id: 'logs', label: '运行日志', icon: Terminal },
  { id: 'settings', label: '系统设置', icon: Settings }
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, coreStatus, settings }) => {
  return (
    <aside className="glass-sidebar w-[212px] shrink-0 flex flex-col justify-between p-3.5 ml-4 mb-4">
      <div>
        {/* 品牌头部 */}
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-5">
          <div className="shrink-0 drop-shadow-sm">
            <OrangeLogo size={34} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold tracking-tight text-stone-800 leading-tight">
              Orange Clash
            </div>
            <div className="text-[11px] font-medium text-stone-400 mt-0.5">macOS Edition</div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-orange-500/14 to-orange-400/8 text-orange-600 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.18)]'
                    : 'text-stone-600 hover:bg-stone-900/[0.04] hover:text-stone-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-500' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 底部内核状态卡 */}
      <div className="glass-subcard p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <span
            className={`w-2 h-2 rounded-full ${
              coreStatus.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-stone-300'
            }`}
          />
          <span className={coreStatus.running ? 'text-stone-800' : 'text-stone-500'}>
            {coreStatus.running ? '内核运行中' : '内核未运行'}
          </span>
        </div>

        <div className="text-[11px] text-stone-400 font-mono">
          {coreStatus.version} · 端口 {settings.mixedPort.toLocaleString()}
        </div>

        <div className="pt-0.5 flex flex-col gap-1">
          {settings.systemProxy && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>系统代理已接管</span>
            </div>
          )}
          {settings.tunEnabled && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600">
              <Cpu className="w-3.5 h-3.5" />
              <span>虚拟网卡 TUN 已启用</span>
            </div>
          )}
          {!settings.systemProxy && !settings.tunEnabled && (
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>流量未接管</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
