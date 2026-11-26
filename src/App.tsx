import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  ConnectionsSnapshot,
  CoreStatus,
  LogEntry,
  NavTab,
  ProxyMode,
  ProxyNode,
  PublicProfile,
  RuleItem,
  TrafficPoint
} from './types/clash';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ToastContainer, ToastMessage } from './components/Toast';
import { OverviewPage } from './pages/OverviewPage';
import { ProxiesPage } from './pages/ProxiesPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { RulesPage } from './pages/RulesPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

const DEFAULT_SETTINGS: AppSettings = {
  mixedPort: 17900,
  controllerPort: 9090,
  mode: 'rule',
  allowLan: false,
  systemProxy: false,
  tunEnabled: false,
  tunStack: 'mixed',
  logLevel: 'info',
  bypassDomains: '',
  autoLaunch: false,
  testUrl: 'https://www.gstatic.com/generate_204'
};

const DEFAULT_CORE: CoreStatus = {
  running: false,
  version: 'v1.19.34',
  mixedPort: 17900,
  controllerPort: 9090,
  startedAt: null,
  lastError: null
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [coreStatus, setCoreStatus] = useState<CoreStatus>(DEFAULT_CORE);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [proxies, setProxies] = useState<Record<string, ProxyNode>>({});
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [traffic, setTraffic] = useState({ up: 0, down: 0 });
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>([]);
  const [connections, setConnections] = useState<ConnectionsSnapshot>({
    downloadTotal: 0,
    uploadTotal: 0,
    connections: []
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsPaused, setLogsPaused] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const logsPausedRef = useRef(logsPaused);
  logsPausedRef.current = logsPaused;
  const logIdRef = useRef(1);
  const toastIdRef = useRef(1);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const loadProxiesAndRules = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        window.orangeClash.getProxies(),
        window.orangeClash.getRules()
      ]);
      if (pRes?.proxies) setProxies(pRes.proxies);
      if (rRes?.rules) setRules(rRes.rules);
    } catch {
      // core may not be running
    }
  }, []);

  // 初始化状态与事件监听
  useEffect(() => {
    let mounted = true;
    window.orangeClash.getInitialState().then((state) => {
      if (!mounted) return;
      setSettings(state.settings);
      setCoreStatus(state.coreStatus);
      setProfiles(state.profiles);
      setActiveProfileId(state.activeProfileId);
      setIsAdmin(state.isAdmin);
      if (state.coreStatus.running) {
        loadProxiesAndRules();
      }
    });

    const offStatus = window.orangeClash.onCoreStatus((status) => {
      setCoreStatus(status);
      if (status.running) {
        loadProxiesAndRules();
      } else {
        setTraffic({ up: 0, down: 0 });
        setTrafficHistory([]);
        setConnections({ downloadTotal: 0, uploadTotal: 0, connections: [] });
      }
      if (status.lastError) {
        pushToast('error', status.lastError);
      }
    });

    const offTraffic = window.orangeClash.onTraffic((t) => {
      setTraffic(t);
      setTrafficHistory((prev) => [...prev.slice(-59), { time: Date.now(), up: t.up, down: t.down }]);
    });

    const offConn = window.orangeClash.onConnections((snap) => {
      setConnections(snap);
    });

    const offLog = window.orangeClash.onLog((entry) => {
      if (logsPausedRef.current) return;
      setLogs((prev) => [
        { id: logIdRef.current++, type: entry.type || 'info', payload: entry.payload, time: entry.time },
        ...prev.slice(0, 399)
      ]);
    });

    const offSettings = window.orangeClash.onSettingsChanged((next) => {
      setSettings(next);
    });

    return () => {
      mounted = false;
      offStatus();
      offTraffic();
      offConn();
      offLog();
      offSettings();
    };
  }, [loadProxiesAndRules, pushToast]);

  // 运行时长计时器
  useEffect(() => {
    if (!coreStatus.running || !coreStatus.startedAt) {
      setUptimeSeconds(0);
      return;
    }
    const tick = () => {
      setUptimeSeconds(Math.max(0, Math.floor((Date.now() - coreStatus.startedAt!) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [coreStatus.running, coreStatus.startedAt]);

  const handleToggleMaster = async () => {
    try {
      const isProxyActive = coreStatus.running && (settings.systemProxy || settings.tunEnabled);
      const target = !isProxyActive;
      const res = await window.orangeClash.coreToggleMaster(target);
      setCoreStatus(res.coreStatus);
      if (target) {
        await loadProxiesAndRules();
        pushToast('success', 'Orange Clash 已连接并接管流量');
      } else {
        pushToast('info', '已断开代理并恢复直连');
      }
    } catch (err: any) {
      pushToast('error', err?.message || '切换代理失败');
    }
  };

  const handleChangeMode = async (mode: ProxyMode) => {
    try {
      const updated = await window.orangeClash.setMode(mode);
      setSettings(updated);
      pushToast('info', `已切换至${mode === 'rule' ? '规则' : mode === 'global' ? '全局' : '直连'}模式`);
    } catch (err: any) {
      pushToast('error', err?.message || '切换模式失败');
    }
  };

  const handleToggleSystemProxy = async (enable: boolean) => {
    try {
      await window.orangeClash.toggleSystemProxy(enable);
      if (enable) await loadProxiesAndRules();
      pushToast('success', enable ? '系统代理已开启' : '系统代理已关闭');
    } catch (err: any) {
      pushToast('error', err?.message || '切换系统代理失败');
    }
  };

  const handleToggleTun = async (enable: boolean) => {
    try {
      const res = await window.orangeClash.toggleTun(enable);
      if (res.requiresAdmin) {
        setShowAdminModal(true);
        return;
      }
      if (enable) await loadProxiesAndRules();
      pushToast('success', enable ? '虚拟网卡 (TUN) 已启用' : '虚拟网卡 (TUN) 已关闭');
    } catch (err: any) {
      pushToast('error', err?.message || '切换虚拟网卡失败');
    }
  };

  const handleRestartCore = async () => {
    try {
      const status = await window.orangeClash.coreRestart();
      setCoreStatus(status);
      await loadProxiesAndRules();
      pushToast('success', '内核已重启');
    } catch (err: any) {
      pushToast('error', err?.message || '内核重启失败');
    }
  };

  const handleImportUrl = async (url: string) => {
    try {
      const res = await window.orangeClash.importSubscriptionUrl(url);
      setProfiles(res.profiles);
      setActiveProfileId(res.activeProfileId);
      await loadProxiesAndRules();
      pushToast('success', `订阅导入成功（共 ${res.nodeCount} 个节点），内核已就绪`);
    } catch (err: any) {
      pushToast('error', err?.message || '导入订阅失败');
    }
  };

  const handleImportFile = async () => {
    try {
      const res = await window.orangeClash.importSubscriptionFile();
      if (res.canceled) return;
      if (res.profiles) setProfiles(res.profiles);
      if (res.activeProfileId !== undefined) setActiveProfileId(res.activeProfileId);
      await loadProxiesAndRules();
      pushToast('success', `本地配置导入成功（共 ${res.nodeCount || 0} 个节点），内核已就绪`);
    } catch (err: any) {
      pushToast('error', err?.message || '导入本地文件失败');
    }
  };

  const handleSelectProfile = async (id: string) => {
    try {
      const res = await window.orangeClash.selectProfile(id);
      setActiveProfileId(res.activeProfileId);
      if (coreStatus.running) await loadProxiesAndRules();
      pushToast('success', '已切换当前订阅配置');
    } catch (err: any) {
      pushToast('error', err?.message || '切换订阅失败');
    }
  };

  const handleRefreshProfile = async (id: string) => {
    try {
      const res = await window.orangeClash.refreshProfile(id);
      setProfiles(res.profiles);
      if (coreStatus.running) await loadProxiesAndRules();
      pushToast('success', `订阅已更新（共 ${res.nodeCount} 个节点）`);
    } catch (err: any) {
      pushToast('error', err?.message || '更新订阅失败');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      const res = await window.orangeClash.deleteProfile(id);
      setProfiles(res.profiles);
      setActiveProfileId(res.activeProfileId);
      if (coreStatus.running) await loadProxiesAndRules();
      pushToast('info', '已删除该订阅');
    } catch (err: any) {
      pushToast('error', err?.message || '删除订阅失败');
    }
  };

  const handleSelectProxy = async (group: string, proxy: string) => {
    try {
      await window.orangeClash.selectProxy(group, proxy);
      await loadProxiesAndRules();
      pushToast('success', `已切换至 ${proxy}`);
    } catch (err: any) {
      pushToast('error', err?.message || '切换节点失败');
    }
  };

  const handleTestProxyDelay = async (proxy: string) => {
    await window.orangeClash.testProxyDelay(proxy);
    await loadProxiesAndRules();
  };

  const handleTestGroupDelay = async (group: string) => {
    await window.orangeClash.testGroupDelay(group);
    await loadProxiesAndRules();
    pushToast('success', `「${group}」测速完成`);
  };

  return (
    <div className="liquid-canvas h-screen w-screen flex flex-col overflow-hidden text-stone-800">
      <TitleBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          coreStatus={coreStatus}
          settings={settings}
        />

        <main className="flex-1 overflow-y-auto px-6 pb-4">
          {activeTab === 'overview' && (
            <OverviewPage
              settings={settings}
              coreStatus={coreStatus}
              profiles={profiles}
              activeProfileId={activeProfileId}
              proxies={proxies}
              traffic={traffic}
              trafficHistory={trafficHistory}
              connections={connections}
              uptimeSeconds={uptimeSeconds}
              isAdmin={isAdmin}
              onToggleMaster={handleToggleMaster}
              onChangeMode={handleChangeMode}
              onToggleSystemProxy={handleToggleSystemProxy}
              onToggleTun={handleToggleTun}
              onRestartCore={handleRestartCore}
              onRefreshAll={loadProxiesAndRules}
              onImportUrl={handleImportUrl}
              onImportFile={handleImportFile}
              onSelectProfile={handleSelectProfile}
              onRefreshProfile={handleRefreshProfile}
              onDeleteProfile={handleDeleteProfile}
              onSelectProxy={handleSelectProxy}
              onTestGroupDelay={handleTestGroupDelay}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'proxies' && (
            <ProxiesPage
              coreStatus={coreStatus}
              proxies={proxies}
              onSelectProxy={handleSelectProxy}
              onTestProxyDelay={handleTestProxyDelay}
              onTestGroupDelay={handleTestGroupDelay}
              onRefresh={loadProxiesAndRules}
            />
          )}

          {activeTab === 'connections' && (
            <ConnectionsPage
              coreStatus={coreStatus}
              connections={connections}
              onCloseConnection={(id) => window.orangeClash.closeConnection(id)}
              onCloseAll={() => window.orangeClash.closeAllConnections()}
            />
          )}

          {activeTab === 'rules' && (
            <RulesPage coreStatus={coreStatus} rules={rules} onRefresh={loadProxiesAndRules} />
          )}

          {activeTab === 'logs' && (
            <LogsPage
              logs={logs}
              paused={logsPaused}
              onTogglePause={() => setLogsPaused((v) => !v)}
              onClear={() => setLogs([])}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              coreStatus={coreStatus}
              isAdmin={isAdmin}
              onSaveSettings={async (partial) => {
                const updated = await window.orangeClash.updateSettings(partial);
                setSettings(updated);
                pushToast('success', '设置已保存并生效');
              }}
              onRestartCore={handleRestartCore}
              onRelaunchAdmin={async () => {
                await window.orangeClash.relaunchAsAdmin();
              }}
              onOpenDataDir={() => window.orangeClash.openDataDir()}
            />
          )}
        </main>
      </div>

      {/* 管理员权限提权引导弹窗（用于 TUN 虚拟网卡） */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4">
            <div className="text-[16px] font-bold text-stone-800">启用虚拟网卡 (TUN) 需要管理员权限</div>
            <p className="text-[13px] text-stone-500 leading-relaxed">
              macOS 创建 utun 虚拟网卡并接管全局底层流量需要管理员权限（将弹出系统密码 / Touch ID 认证框）。是否立即以管理员身份重启 Orange Clash？
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowAdminModal(false)}
                className="px-4 py-1.5 rounded-xl glass-subcard text-[13px] text-stone-600 hover:text-stone-800"
              >
                暂不开启
              </button>
              <button
                onClick={async () => {
                  setShowAdminModal(false);
                  await window.orangeClash.relaunchAsAdmin();
                }}
                className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium shadow-sm"
              >
                以管理员重启
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
};

export default App;
