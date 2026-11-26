import { contextBridge, ipcRenderer } from 'electron';

export interface OrangeClashAPI {
  // 窗口控制
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;

  // 状态与设置
  getInitialState: () => Promise<{
    settings: any;
    coreStatus: any;
    profiles: any[];
    activeProfileId: string | null;
    isAdmin: boolean;
  }>;
  updateSettings: (partial: Record<string, unknown>) => Promise<any>;
  setMode: (mode: 'rule' | 'global' | 'direct') => Promise<any>;
  toggleSystemProxy: (enable: boolean) => Promise<{ systemProxy: boolean }>;
  toggleTun: (enable: boolean) => Promise<{ tunEnabled: boolean; requiresAdmin?: boolean }>;
  relaunchAsAdmin: () => Promise<boolean>;
  openDataDir: () => Promise<void>;

  // 内核控制
  coreStart: () => Promise<any>;
  coreStop: () => Promise<any>;
  coreRestart: () => Promise<any>;
  coreToggleMaster: (enable: boolean) => Promise<{
    coreStatus: any;
    systemProxy: boolean;
  }>;

  // 订阅管理（严格不返回/不显示订阅名称）
  importSubscriptionUrl: (url: string) => Promise<{ profiles: any[]; activeProfileId: string | null; nodeCount: number }>;
  importSubscriptionFile: () => Promise<{ canceled?: boolean; profiles?: any[]; activeProfileId?: string | null; nodeCount?: number }>;
  selectProfile: (id: string) => Promise<{ activeProfileId: string | null }>;
  refreshProfile: (id: string) => Promise<{ profiles: any[]; nodeCount: number }>;
  deleteProfile: (id: string) => Promise<{ profiles: any[]; activeProfileId: string | null }>;

  // 代理、规则、连接
  getProxies: () => Promise<any>;
  selectProxy: (group: string, proxy: string) => Promise<void>;
  testProxyDelay: (proxy: string) => Promise<number>;
  testGroupDelay: (group: string) => Promise<Record<string, number>>;
  getRules: () => Promise<any>;
  getConnections: () => Promise<any>;
  closeConnection: (id: string) => Promise<void>;
  closeAllConnections: () => Promise<void>;

  // 实时事件监听
  onCoreStatus: (cb: (status: any) => void) => () => void;
  onTraffic: (cb: (traffic: { up: number; down: number }) => void) => () => void;
  onConnections: (cb: (snapshot: any) => void) => () => void;
  onLog: (cb: (log: { type: string; payload: string; time: number }) => void) => () => void;
  onSettingsChanged: (cb: (settings: any) => void) => () => void;
}

const api: OrangeClashAPI = {
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  getInitialState: () => ipcRenderer.invoke('app:getInitialState'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  setMode: (mode) => ipcRenderer.invoke('settings:setMode', mode),
  toggleSystemProxy: (enable) => ipcRenderer.invoke('sysproxy:toggle', enable),
  toggleTun: (enable) => ipcRenderer.invoke('tun:toggle', enable),
  relaunchAsAdmin: () => ipcRenderer.invoke('app:relaunchAsAdmin'),
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),

  coreStart: () => ipcRenderer.invoke('core:start'),
  coreStop: () => ipcRenderer.invoke('core:stop'),
  coreRestart: () => ipcRenderer.invoke('core:restart'),
  coreToggleMaster: (enable) => ipcRenderer.invoke('core:toggleMaster', enable),

  importSubscriptionUrl: (url) => ipcRenderer.invoke('sub:importUrl', url),
  importSubscriptionFile: () => ipcRenderer.invoke('sub:importFile'),
  selectProfile: (id) => ipcRenderer.invoke('sub:select', id),
  refreshProfile: (id) => ipcRenderer.invoke('sub:refresh', id),
  deleteProfile: (id) => ipcRenderer.invoke('sub:delete', id),

  getProxies: () => ipcRenderer.invoke('clash:getProxies'),
  selectProxy: (group, proxy) => ipcRenderer.invoke('clash:selectProxy', group, proxy),
  testProxyDelay: (proxy) => ipcRenderer.invoke('clash:testProxyDelay', proxy),
  testGroupDelay: (group) => ipcRenderer.invoke('clash:testGroupDelay', group),
  getRules: () => ipcRenderer.invoke('clash:getRules'),
  getConnections: () => ipcRenderer.invoke('clash:getConnections'),
  closeConnection: (id) => ipcRenderer.invoke('clash:closeConnection', id),
  closeAllConnections: () => ipcRenderer.invoke('clash:closeAllConnections'),

  onCoreStatus: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('event:coreStatus', handler);
    return () => ipcRenderer.removeListener('event:coreStatus', handler);
  },
  onTraffic: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('event:traffic', handler);
    return () => ipcRenderer.removeListener('event:traffic', handler);
  },
  onConnections: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('event:connections', handler);
    return () => ipcRenderer.removeListener('event:connections', handler);
  },
  onLog: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('event:log', handler);
    return () => ipcRenderer.removeListener('event:log', handler);
  },
  onSettingsChanged: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('event:settingsChanged', handler);
    return () => ipcRenderer.removeListener('event:settingsChanged', handler);
  }
};

contextBridge.exposeInMainWorld('orangeClash', api);
