import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type ProxyMode = 'rule' | 'global' | 'direct';
export type TunStack = 'mixed' | 'system' | 'gvisor';
export type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'silent';

export interface StoredProfile {
  id: string;
  sourceType: 'url' | 'file';
  sourceUrl?: string; // 仅用于后台更新订阅，绝不暴露给前端界面
  nodeCount: number;
  updatedAt: number;
  filePath: string;
}

export interface PublicProfile {
  id: string;
  index: number;
  sourceType: 'url' | 'file';
  hasSourceUrl: boolean;
  nodeCount: number;
  updatedAt: number;
}

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

export interface AppStoreData {
  settings: AppSettings;
  activeProfileId: string | null;
  profiles: StoredProfile[];
}

const DEFAULT_SETTINGS: AppSettings = {
  mixedPort: 17900,
  controllerPort: 9090,
  mode: 'rule',
  allowLan: false,
  systemProxy: false,
  tunEnabled: false,
  tunStack: 'mixed',
  logLevel: 'info',
  bypassDomains:
    '127.0.0.1,localhost,*.local,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,timestamp.apple.com,sequoia.apple.com',
  autoLaunch: false,
  testUrl: 'https://www.gstatic.com/generate_204'
};

export class AppStore {
  private dataDir: string;
  private profilesDir: string;
  private storeFile: string;
  private data: AppStoreData;

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'orange-clash-data');
    this.profilesDir = path.join(this.dataDir, 'profiles');
    this.storeFile = path.join(this.dataDir, 'store.json');
    fs.mkdirSync(this.profilesDir, { recursive: true });
    this.data = this.load();
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  public getProfilesDir(): string {
    return this.profilesDir;
  }

  private load(): AppStoreData {
    try {
      if (fs.existsSync(this.storeFile)) {
        const raw = fs.readFileSync(this.storeFile, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppStoreData>;
        return {
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          activeProfileId: parsed.activeProfileId ?? null,
          profiles: Array.isArray(parsed.profiles) ? parsed.profiles : []
        };
      }
    } catch (err) {
      console.error('[Store] Failed to load store:', err);
    }
    return {
      settings: { ...DEFAULT_SETTINGS },
      activeProfileId: null,
      profiles: []
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.storeFile, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] Failed to save store:', err);
    }
  }

  public getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.getSettings();
  }

  public getActiveProfileId(): string | null {
    return this.data.activeProfileId;
  }

  public setActiveProfileId(id: string | null): void {
    this.data.activeProfileId = id;
    this.save();
  }

  public getStoredProfiles(): StoredProfile[] {
    return this.data.profiles.filter((p) => fs.existsSync(p.filePath));
  }

  public getStoredProfile(id: string): StoredProfile | undefined {
    return this.getStoredProfiles().find((p) => p.id === id);
  }

  /**
   * 向前端返回完全匿名化的订阅列表，不包含任何订阅名称、文件名或 URL
   */
  public getPublicProfiles(): PublicProfile[] {
    return this.getStoredProfiles().map((p, idx) => ({
      id: p.id,
      index: idx + 1,
      sourceType: p.sourceType,
      hasSourceUrl: Boolean(p.sourceUrl),
      nodeCount: p.nodeCount,
      updatedAt: p.updatedAt
    }));
  }

  public addProfile(profile: StoredProfile): PublicProfile[] {
    this.data.profiles.push(profile);
    if (!this.data.activeProfileId) {
      this.data.activeProfileId = profile.id;
    }
    this.save();
    return this.getPublicProfiles();
  }

  public updateProfileMeta(id: string, nodeCount: number): PublicProfile[] {
    const target = this.data.profiles.find((p) => p.id === id);
    if (target) {
      target.nodeCount = nodeCount;
      target.updatedAt = Date.now();
      this.save();
    }
    return this.getPublicProfiles();
  }

  public deleteProfile(id: string): { profiles: PublicProfile[]; activeProfileId: string | null } {
    const target = this.data.profiles.find((p) => p.id === id);
    if (target && fs.existsSync(target.filePath)) {
      try {
        fs.unlinkSync(target.filePath);
      } catch {
        // ignore
      }
    }
    this.data.profiles = this.data.profiles.filter((p) => p.id !== id);
    if (this.data.activeProfileId === id) {
      this.data.activeProfileId = this.data.profiles[0]?.id ?? null;
    }
    this.save();
    return {
      profiles: this.getPublicProfiles(),
      activeProfileId: this.data.activeProfileId
    };
  }
}
