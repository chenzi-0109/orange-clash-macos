import React, { useState } from 'react';
import { Cpu, FolderOpen, Globe, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { AppSettings, CoreStatus, LogLevel, TunStack } from '../types/clash';

interface SettingsPageProps {
  settings: AppSettings;
  coreStatus: CoreStatus;
  isAdmin: boolean;
  onSaveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onRestartCore: () => Promise<void>;
  onRelaunchAdmin: () => Promise<void>;
  onOpenDataDir: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  coreStatus,
  isAdmin,
  onSaveSettings,
  onRestartCore,
  onRelaunchAdmin,
  onOpenDataDir
}) => {
  const [mixedPort, setMixedPort] = useState(String(settings.mixedPort));
  const [controllerPort, setControllerPort] = useState(String(settings.controllerPort));
  const [bypassDomains, setBypassDomains] = useState(settings.bypassDomains);
  const [testUrl, setTestUrl] = useState(settings.testUrl);
  const [saving, setSaving] = useState(false);

  const handleSavePorts = async () => {
    setSaving(true);
    try {
      await onSaveSettings({
        mixedPort: Math.max(1024, Math.min(65535, Number(mixedPort) || 17900)),
        controllerPort: Math.max(1024, Math.min(65535, Number(controllerPort) || 9090)),
        bypassDomains: bypassDomains.trim(),
        testUrl: testUrl.trim() || 'https://www.gstatic.com/generate_204'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-stone-800">系统设置</h1>
          <p className="text-[12.5px] text-stone-400 mt-0.5">端口配置、虚拟网卡 TUN 与内核管理</p>
        </div>

        <button
          onClick={handleSavePorts}
          disabled={saving}
          className="px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 text-[12.5px] font-medium shadow-sm transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? '保存中...' : '保存配置'}</span>
        </button>
      </div>

      {/* 端口与网络设置 */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-stone-800">
          <Globe className="w-4 h-4 text-orange-500" />
          <span>代理与端口配置</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-subcard p-3.5">
            <label className="text-[12px] font-medium text-stone-600">混合代理端口 (HTTP / SOCKS5)</label>
            <input
              type="number"
              value={mixedPort}
              onChange={(e) => setMixedPort(e.target.value)}
              className="mt-1.5 w-full px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200 text-[13px] font-mono text-stone-800 outline-none focus:border-orange-400"
            />
          </div>

          <div className="glass-subcard p-3.5">
            <label className="text-[12px] font-medium text-stone-600">内核控制端口 (External Controller)</label>
            <input
              type="number"
              value={controllerPort}
              onChange={(e) => setControllerPort(e.target.value)}
              className="mt-1.5 w-full px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200 text-[13px] font-mono text-stone-800 outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-subcard p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-stone-700">允许局域网连接 (Allow LAN)</div>
              <div className="text-[11.5px] text-stone-400">允许同一局域网下的手机或其他设备共享代理</div>
            </div>
            <button
              onClick={() => onSaveSettings({ allowLan: !settings.allowLan })}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${
                settings.allowLan ? 'bg-orange-500' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  settings.allowLan ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="glass-subcard p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-stone-700">开机自动启动</div>
              <div className="text-[11.5px] text-stone-400">登录 macOS 后自动启动 Orange Clash</div>
            </div>
            <button
              onClick={() => onSaveSettings({ autoLaunch: !settings.autoLaunch })}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${
                settings.autoLaunch ? 'bg-orange-500' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  settings.autoLaunch ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="glass-subcard p-3.5">
          <label className="text-[12px] font-medium text-stone-600">测速接口 URL</label>
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            className="mt-1.5 w-full px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200 text-[12.5px] font-mono text-stone-700 outline-none focus:border-orange-400"
          />
        </div>

        <div className="glass-subcard p-3.5">
          <label className="text-[12px] font-medium text-stone-600">系统代理绕过地址 (逗号分隔)</label>
          <textarea
            rows={2}
            value={bypassDomains}
            onChange={(e) => setBypassDomains(e.target.value)}
            className="mt-1.5 w-full px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200 text-[12px] font-mono text-stone-700 outline-none focus:border-orange-400 resize-none"
          />
        </div>
      </div>

      {/* 虚拟网卡 TUN 与内核管理 */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-stone-800">
          <Cpu className="w-4 h-4 text-orange-500" />
          <span>虚拟网卡 (TUN) 与内置内核</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-subcard p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-stone-700">TUN 网络堆栈</div>
              <div className="text-[11.5px] text-stone-400">推荐 mixed（兼顾性能与兼容性）</div>
            </div>
            <select
              value={settings.tunStack}
              onChange={(e) => onSaveSettings({ tunStack: e.target.value as TunStack })}
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-[12.5px] text-stone-700 outline-none"
            >
              <option value="mixed">mixed</option>
              <option value="system">system</option>
              <option value="gvisor">gvisor</option>
            </select>
          </div>

          <div className="glass-subcard p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-stone-700">日志级别</div>
              <div className="text-[11.5px] text-stone-400">控制 Mihomo 内核输出详细程度</div>
            </div>
            <select
              value={settings.logLevel}
              onChange={(e) => onSaveSettings({ logLevel: e.target.value as LogLevel })}
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-[12.5px] text-stone-700 outline-none"
            >
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
              <option value="debug">debug</option>
            </select>
          </div>
        </div>

        <div className="glass-subcard p-4 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-stone-800">
              内置内核：Mihomo Meta {coreStatus.version}（macOS Apple Silicon / Intel 双架构）
            </div>
            <div className="text-[11.5px] text-stone-400 mt-0.5">
              当前权限：{isAdmin ? '管理员权限（可直接启用虚拟网卡 TUN）' : '标准用户权限（启用 TUN 需提权）'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin && (
              <button
                onClick={onRelaunchAdmin}
                className="px-3.5 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>以管理员重启</span>
              </button>
            )}
            <button
              onClick={onRestartCore}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-stone-700 hover:text-orange-600 border border-stone-200 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重启内核</span>
            </button>
            <button
              onClick={onOpenDataDir}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-stone-700 hover:text-orange-600 border border-stone-200 text-[12px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>数据目录</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
