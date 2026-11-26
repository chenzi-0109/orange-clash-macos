export type ProxyMode = 'rule' | 'global' | 'direct';
export type TunStack = 'mixed' | 'system' | 'gvisor';
export type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'silent';
export type NavTab = 'overview' | 'proxies' | 'connections' | 'rules' | 'logs' | 'settings';

export interface AppSettings {
  mixedPort: number;
  controllerPort: number;
  mode: ProxyMode;
  allowLan: boolean;
  systemProxy: boolean;
  tunEnabled: boolean;
  tunStack: TunStack;
  logLevel: LogLevel;
  bypassDomains: string;
  autoLaunch: boolean;
  testUrl: string;
}

export interface CoreStatus {
  running: boolean;
  version: string;
  mixedPort: number;
  controllerPort: number;
  startedAt: number | null;
  lastError: string | null;
}

export interface PublicProfile {
  id: string;
  index: number;
  sourceType: 'url' | 'file';
  hasSourceUrl: boolean;
  nodeCount: number;
  updatedAt: number;
}

export interface ProxyNode {
  name: string;
  type: string;
  now?: string;
  all?: string[];
  udp?: boolean;
  history?: Array<{ time: string; delay: number }>;
}

export interface TrafficPoint {
  time: number;
  up: number;
  down: number;
}

export interface ConnectionItem {
  id: string;
  metadata: {
    network: string;
    type: string;
    sourceIP: string;
    destinationIP: string;
    sourcePort: string;
    destinationPort: string;
    host: string;
    processPath?: string;
    process?: string;
  };
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
}

export interface ConnectionsSnapshot {
  downloadTotal: number;
  uploadTotal: number;
  connections: ConnectionItem[];
}

export interface RuleItem {
  type: string;
  payload: string;
  proxy: string;
}

export interface LogEntry {
  id: number;
  type: string;
  payload: string;
  time: number;
}

declare global {
  interface Window {
    orangeClash: {
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;

      getInitialState: () => Promise<{
        settings: AppSettings;
        coreStatus: CoreStatus;
        profiles: PublicProfile[];
        activeProfileId: string | null;
        isAdmin: boolean;
      }>;
      updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
      setMode: (mode: ProxyMode) => Promise<AppSettings>;
      toggleSystemProxy: (enable: boolean) => Promise<{ systemProxy: boolean }>;
      toggleTun: (enable: boolean) => Promise<{ tunEnabled: boolean; requiresAdmin?: boolean }>;
      relaunchAsAdmin: () => Promise<boolean>;
      openDataDir: () => Promise<void>;

      coreStart: () => Promise<CoreStatus>;
      coreStop: () => Promise<CoreStatus>;
      coreRestart: () => Promise<CoreStatus>;
      coreToggleMaster: (enable: boolean) => Promise<{ coreStatus: CoreStatus; systemProxy: boolean }>;

      importSubscriptionUrl: (
        url: string
      ) => Promise<{ profiles: PublicProfile[]; activeProfileId: string | null; nodeCount: number }>;
      importSubscriptionFile: () => Promise<{
        canceled?: boolean;
        profiles?: PublicProfile[];
        activeProfileId?: string | null;
        nodeCount?: number;
      }>;
      selectProfile: (id: string) => Promise<{ activeProfileId: string | null }>;
      refreshProfile: (id: string) => Promise<{ profiles: PublicProfile[]; nodeCount: number }>;
      deleteProfile: (id: string) => Promise<{ profiles: PublicProfile[]; activeProfileId: string | null }>;

      getProxies: () => Promise<{ proxies: Record<string, ProxyNode> }>;
      selectProxy: (group: string, proxy: string) => Promise<void>;
      testProxyDelay: (proxy: string) => Promise<number>;
      testGroupDelay: (group: string) => Promise<Record<string, number>>;
      getRules: () => Promise<{ rules: RuleItem[] }>;
      getConnections: () => Promise<ConnectionsSnapshot>;
      closeConnection: (id: string) => Promise<void>;
      closeAllConnections: () => Promise<void>;

      onCoreStatus: (cb: (status: CoreStatus) => void) => () => void;
      onTraffic: (cb: (traffic: { up: number; down: number }) => void) => () => void;
      onConnections: (cb: (snapshot: ConnectionsSnapshot) => void) => () => void;
      onLog: (cb: (log: { type: string; payload: string; time: number }) => void) => () => void;
      onSettingsChanged: (cb: (settings: AppSettings) => void) => () => void;
    };
  }
}
