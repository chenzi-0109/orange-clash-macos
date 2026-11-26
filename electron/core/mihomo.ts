import { ChildProcess, spawn } from 'child_process';
import { app } from 'electron';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import WebSocket from 'ws';
import { anonymizeClashConfig } from './anonymize';
import { AppSettings, AppStore } from './store';

export interface CoreStatus {
  running: boolean;
  version: string;
  mixedPort: number;
  controllerPort: number;
  startedAt: number | null;
  lastError: string | null;
}

export class MihomoManager extends EventEmitter {
  private proc: ChildProcess | null = null;
  private store: AppStore;
  private workDir: string;
  private runtimeConfigPath: string;
  private version = 'v1.19.34';
  private startedAt: number | null = null;
  private lastError: string | null = null;
  private trafficWs: WebSocket | null = null;
  private logsWs: WebSocket | null = null;
  private connectionsWs: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(store: AppStore) {
    super();
    this.store = store;
    this.workDir = path.join(store.getDataDir(), 'mihomo');
    this.runtimeConfigPath = path.join(this.workDir, 'runtime-config.yaml');
    fs.mkdirSync(this.workDir, { recursive: true });
  }

  public getBinaryDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin');
    }
    return path.join(app.getAppPath(), 'resources', 'bin');
  }

  /**
   * 根据当前 Mac 芯片架构（Apple Silicon arm64 / Intel x64）自动选择内置 Mihomo 内核
   */
  public getBinaryPath(): string {
    const binName = process.arch === 'arm64' ? 'mihomo-arm64' : 'mihomo-x64';
    return path.join(this.getBinaryDir(), binName);
  }

  private ensureGeoDatabases(): void {
    const binDir = this.getBinaryDir();
    for (const fileName of ['geoip.metadb', 'GeoSite.dat']) {
      const src = path.join(binDir, fileName);
      const dst = path.join(this.workDir, fileName);
      try {
        if (fs.existsSync(src)) {
          const needCopy = !fs.existsSync(dst) || fs.statSync(dst).size < 1024;
          if (needCopy) {
            fs.copyFileSync(src, dst);
          }
        }
      } catch (err) {
        console.error(`[Mihomo] Failed to copy ${fileName}:`, err);
      }
    }
  }

  public getStatus(): CoreStatus {
    const settings = this.store.getSettings();
    return {
      running: Boolean(this.proc && !this.proc.killed),
      version: this.version,
      mixedPort: settings.mixedPort,
      controllerPort: settings.controllerPort,
      startedAt: this.startedAt,
      lastError: this.lastError
    };
  }

  private getApiBase(): string {
    const { controllerPort } = this.store.getSettings();
    return `http://127.0.0.1:${controllerPort}`;
  }

  private buildRuntimeConfig(): string {
    const settings: AppSettings = this.store.getSettings();
    const activeId = this.store.getActiveProfileId();
    const activeProfile = activeId ? this.store.getStoredProfile(activeId) : undefined;

    let baseConfig: Record<string, unknown> = {
      proxies: [],
      'proxy-groups': [
        {
          name: '节点选择',
          type: 'select',
          proxies: ['DIRECT']
        }
      ],
      rules: ['MATCH,DIRECT']
    };

    if (activeProfile && fs.existsSync(activeProfile.filePath)) {
      try {
        const raw = fs.readFileSync(activeProfile.filePath, 'utf-8');
        const parsed = yaml.load(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          baseConfig = parsed as Record<string, unknown>;
        }
      } catch (err) {
        console.error('[Mihomo] Failed to parse active profile:', err);
      }
    }

    // 匿名化清理可能包含机场/订阅品牌的策略组名，并清理冲突字段
    const anonymized = anonymizeClashConfig(baseConfig);
    const sanitized: Record<string, unknown> = { ...anonymized };
    delete sanitized.port;
    delete sanitized['socks-port'];
    delete sanitized['redir-port'];
    delete sanitized['tproxy-port'];
    delete sanitized['external-ui'];

    const merged: Record<string, unknown> = {
      ...sanitized,
      'mixed-port': settings.mixedPort,
      'allow-lan': settings.allowLan,
      mode: settings.mode,
      'log-level': settings.logLevel,
      'external-controller': `127.0.0.1:${settings.controllerPort}`,
      secret: '',
      'find-process-mode': 'strict',
      'unified-delay': true,
      'tcp-concurrent': true,
      'geodata-mode': false
    };

    if (settings.tunEnabled) {
      merged.tun = {
        enable: true,
        stack: settings.tunStack || 'mixed',
        'auto-route': true,
        'auto-detect-interface': true,
        'dns-hijack': ['any:53']
      };
      if (!merged.dns) {
        merged.dns = {
          enable: true,
          'enhanced-mode': 'fake-ip',
          'fake-ip-range': '198.18.0.1/16',
          nameserver: ['223.5.5.5', '119.29.29.29', 'https://doh.pub/dns-query'],
          fallback: ['https://dns.google/dns-query', 'https://cloudflare-dns.com/dns-query']
        };
      }
    } else {
      merged.tun = { enable: false };
    }

    const dumped = yaml.dump(merged, { lineWidth: -1, noRefs: true });
    fs.writeFileSync(this.runtimeConfigPath, dumped, 'utf-8');
    return this.runtimeConfigPath;
  }

  public async start(): Promise<CoreStatus> {
    if (this.proc && !this.proc.killed) {
      return this.getStatus();
    }

    const binPath = this.getBinaryPath();
    if (!fs.existsSync(binPath)) {
      this.lastError = `未找到内置内核文件: ${binPath}`;
      this.emit('status', this.getStatus());
      throw new Error(this.lastError);
    }

    // 确保 macOS 内核二进制具备可执行权限
    try {
      fs.chmodSync(binPath, 0o755);
    } catch {
      // ignore if read-only bundle already executable
    }

    this.lastError = null;
    this.ensureGeoDatabases();
    const cfgPath = this.buildRuntimeConfig();

    const child = spawn(binPath, ['-d', this.workDir, '-f', cfgPath], {
      cwd: this.workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.proc = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        this.emit('log', { type: 'info', payload: text, time: Date.now() });
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8').trim();
      if (text) {
        this.emit('log', { type: 'error', payload: text, time: Date.now() });
      }
    });

    child.on('exit', (code) => {
      if (this.proc === child) {
        this.proc = null;
        this.startedAt = null;
        this.closeWebSockets();
        if (code && code !== 0) {
          this.lastError = `内核异常退出 (代码 ${code})`;
        }
        this.emit('status', this.getStatus());
      }
    });

    child.on('error', (err) => {
      this.lastError = err.message;
      this.proc = null;
      this.startedAt = null;
      this.emit('status', this.getStatus());
    });

    const ready = await this.waitForApiReady(25000);
    if (!ready) {
      this.stop();
      this.lastError = '内核启动超时，请检查端口占用或配置格式';
      this.emit('status', this.getStatus());
      throw new Error(this.lastError);
    }

    this.startedAt = Date.now();
    this.connectWebSockets();
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  public stop(): CoreStatus {
    this.closeWebSockets();
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      this.startedAt = null;
      try {
        p.kill('SIGTERM');
      } catch {
        try {
          p.kill();
        } catch {
          // ignore
        }
      }
    }
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  public async restart(): Promise<CoreStatus> {
    this.stop();
    await new Promise((r) => setTimeout(r, 350));
    return this.start();
  }

  public async reloadConfig(): Promise<void> {
    if (!this.proc || this.proc.killed) {
      this.buildRuntimeConfig();
      return;
    }
    const cfgPath = this.buildRuntimeConfig();
    await this.apiRequest('/configs?force=true', 'PUT', { path: cfgPath });
  }

  private async waitForApiReady(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!this.proc || this.proc.killed) return false;
      try {
        const res = await fetch(`${this.getApiBase()}/version`);
        if (res.ok) {
          const data = (await res.json()) as { version?: string };
          if (data.version) {
            this.version = data.version.startsWith('v') ? data.version : `v${data.version}`;
          }
          return true;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  private closeWebSockets(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    [this.trafficWs, this.logsWs, this.connectionsWs].forEach((ws) => {
      if (ws) {
        try {
          ws.removeAllListeners();
          ws.close();
        } catch {
          // ignore
        }
      }
    });
    this.trafficWs = null;
    this.logsWs = null;
    this.connectionsWs = null;
  }

  private connectWebSockets(): void {
    this.closeWebSockets();
    if (!this.proc || this.proc.killed) return;

    const { controllerPort, logLevel } = this.store.getSettings();
    const wsBase = `ws://127.0.0.1:${controllerPort}`;

    try {
      this.trafficWs = new WebSocket(`${wsBase}/traffic`);
      this.trafficWs.on('message', (data) => {
        try {
          this.emit('traffic', JSON.parse(data.toString()));
        } catch {
          // ignore
        }
      });
      this.trafficWs.on('error', () => {});

      this.connectionsWs = new WebSocket(`${wsBase}/connections`);
      this.connectionsWs.on('message', (data) => {
        try {
          this.emit('connections', JSON.parse(data.toString()));
        } catch {
          // ignore
        }
      });
      this.connectionsWs.on('error', () => {});

      this.logsWs = new WebSocket(`${wsBase}/logs?level=${logLevel || 'info'}`);
      this.logsWs.on('message', (data) => {
        try {
          this.emit('log', { ...JSON.parse(data.toString()), time: Date.now() });
        } catch {
          // ignore
        }
      });
      this.logsWs.on('error', () => {});
    } catch (err) {
      console.error('[Mihomo] WS connect error:', err);
    }
  }

  public async apiRequest<T = unknown>(
    endpoint: string,
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<T> {
    if (!this.proc || this.proc.killed) {
      throw new Error('内核未运行');
    }
    const url = `${this.getApiBase()}${endpoint}`;
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`内核接口错误 (${res.status}): ${txt}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  public async getProxies(): Promise<Record<string, unknown>> {
    return this.apiRequest('/proxies');
  }

  public async selectProxy(groupName: string, proxyName: string): Promise<void> {
    await this.apiRequest(`/proxies/${encodeURIComponent(groupName)}`, 'PUT', { name: proxyName });
  }

  public async testProxyDelay(proxyName: string, url?: string, timeout = 5000): Promise<number> {
    const testUrl = url || this.store.getSettings().testUrl;
    try {
      const res = await this.apiRequest<{ delay?: number }>(
        `/proxies/${encodeURIComponent(proxyName)}/delay?timeout=${timeout}&url=${encodeURIComponent(testUrl)}`
      );
      return res?.delay ?? -1;
    } catch {
      return -1;
    }
  }

  public async testGroupDelay(groupName: string, url?: string, timeout = 5000): Promise<Record<string, number>> {
    const testUrl = url || this.store.getSettings().testUrl;
    try {
      return await this.apiRequest<Record<string, number>>(
        `/group/${encodeURIComponent(groupName)}/delay?timeout=${timeout}&url=${encodeURIComponent(testUrl)}`
      );
    } catch {
      return {};
    }
  }

  public async getRules(): Promise<{ rules: Array<{ type: string; payload: string; proxy: string }> }> {
    return this.apiRequest('/rules');
  }

  public async getConnections(): Promise<Record<string, unknown>> {
    return this.apiRequest('/connections');
  }

  public async closeConnection(id: string): Promise<void> {
    await this.apiRequest(`/connections/${encodeURIComponent(id)}`, 'DELETE');
  }

  public async closeAllConnections(): Promise<void> {
    await this.apiRequest('/connections', 'DELETE');
  }

  public async patchConfig(patch: Record<string, unknown>): Promise<void> {
    if (!this.proc || this.proc.killed) return;
    await this.apiRequest('/configs', 'PATCH', patch);
  }
}
