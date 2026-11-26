import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import fs from 'fs';
import path from 'path';
import { MihomoManager } from './core/mihomo';
import { AppSettings, AppStore, ProxyMode } from './core/store';
import { createProfileFromFile, createProfileFromUrl, refreshProfile } from './core/subscriptions';
import { isRunningAsAdmin, relaunchAsAdmin, setMacSystemProxy } from './core/sysproxy';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let store: AppStore;
let mihomo: MihomoManager;
let cachedIsAdmin = false;

function getAssetIconPath(): string {
  if (app.isPackaged) {
    const p = path.join(process.resourcesPath, 'assets', 'icon.png');
    if (fs.existsSync(p)) return p;
  }
  return path.join(app.getAppPath(), 'resources', 'icon.png');
}

function broadcast(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/**
 * 配置 macOS 原生顶部应用菜单，确保 Cmd+C / Cmd+V / Cmd+A / Cmd+Q 快捷键正常工作
 */
function setupMacApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Orange Clash',
      submenu: [
        { role: 'about', label: '关于 Orange Clash' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 Orange Clash' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        {
          label: '退出 Orange Clash',
          accelerator: 'Command+Q',
          click: async () => {
            isQuitting = true;
            await cleanupBeforeQuit();
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '隐藏窗口' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTrayMenu(): void {
  if (!tray) return;
  const settings = store.getSettings();
  const status = mihomo.getStatus();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 Orange Clash',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: status.running && (settings.systemProxy || settings.tunEnabled) ? '断开代理' : '开启代理',
      click: async () => {
        const active = status.running && (settings.systemProxy || settings.tunEnabled);
        await handleMasterToggle(!active);
      }
    },
    {
      label: '系统代理',
      type: 'checkbox',
      checked: settings.systemProxy,
      click: async (item) => {
        await handleSystemProxyToggle(item.checked);
      }
    },
    {
      label: '代理模式',
      submenu: [
        {
          label: '规则模式',
          type: 'radio',
          checked: settings.mode === 'rule',
          click: () => handleModeChange('rule')
        },
        {
          label: '全局模式',
          type: 'radio',
          checked: settings.mode === 'global',
          click: () => handleModeChange('global')
        },
        {
          label: '直连模式',
          type: 'radio',
          checked: settings.mode === 'direct',
          click: () => handleModeChange('direct')
        }
      ]
    },
    { type: 'separator' },
    {
      label: '退出 Orange Clash',
      click: async () => {
        isQuitting = true;
        await cleanupBeforeQuit();
        app.quit();
      }
    }
  ]);

  tray.setToolTip(`Orange Clash · ${status.running ? '运行中' : '已断开'}`);
  tray.setContextMenu(contextMenu);
}

async function handleSystemProxyToggle(enable: boolean): Promise<{ systemProxy: boolean }> {
  const settings = store.getSettings();
  if (enable && !mihomo.getStatus().running) {
    await mihomo.start();
  }
  await setMacSystemProxy(enable, settings.mixedPort, settings.bypassDomains);
  const updated = store.updateSettings({ systemProxy: enable });
  broadcast('event:settingsChanged', updated);
  updateTrayMenu();
  return { systemProxy: updated.systemProxy };
}

async function handleModeChange(mode: ProxyMode): Promise<AppSettings> {
  const updated = store.updateSettings({ mode });
  if (mihomo.getStatus().running) {
    await mihomo.patchConfig({ mode });
  }
  broadcast('event:settingsChanged', updated);
  updateTrayMenu();
  return updated;
}

async function handleMasterToggle(enable: boolean): Promise<{ coreStatus: any; systemProxy: boolean }> {
  if (enable) {
    const status = await mihomo.start();
    const settings = store.getSettings();
    if (!settings.tunEnabled) {
      await setMacSystemProxy(true, settings.mixedPort, settings.bypassDomains);
      const updated = store.updateSettings({ systemProxy: true });
      broadcast('event:settingsChanged', updated);
    }
    updateTrayMenu();
    return { coreStatus: status, systemProxy: store.getSettings().systemProxy };
  } else {
    const settings = store.getSettings();
    if (settings.systemProxy) {
      await setMacSystemProxy(false, settings.mixedPort, settings.bypassDomains).catch(() => {});
      const updated = store.updateSettings({ systemProxy: false });
      broadcast('event:settingsChanged', updated);
    }
    const status = mihomo.stop();
    updateTrayMenu();
    return { coreStatus: status, systemProxy: false };
  }
}

async function cleanupBeforeQuit(): Promise<void> {
  try {
    const settings = store.getSettings();
    if (settings.systemProxy) {
      await setMacSystemProxy(false, settings.mixedPort, settings.bypassDomains);
      store.updateSettings({ systemProxy: false });
    }
  } catch {
    // ignore
  }
  try {
    mihomo.stop();
  } catch {
    // ignore
  }
}

function createWindow(): void {
  const iconPath = getAssetIconPath();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1020,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 15 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#FFFBF7',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const iconPath = getAssetIconPath();
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
    : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  updateTrayMenu();
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.hide());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle('app:getInitialState', async () => ({
    settings: store.getSettings(),
    coreStatus: mihomo.getStatus(),
    profiles: store.getPublicProfiles(),
    activeProfileId: store.getActiveProfileId(),
    isAdmin: cachedIsAdmin
  }));

  ipcMain.handle('app:relaunchAsAdmin', async () => relaunchAsAdmin());
  ipcMain.handle('app:openDataDir', async () => {
    await shell.openPath(store.getDataDir());
  });

  ipcMain.handle('settings:update', async (_e, partial: Partial<AppSettings>) => {
    const prev = store.getSettings();
    const updated = store.updateSettings(partial);

    if (typeof partial.autoLaunch === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: partial.autoLaunch });
    }

    const needReload =
      prev.mixedPort !== updated.mixedPort ||
      prev.controllerPort !== updated.controllerPort ||
      prev.allowLan !== updated.allowLan ||
      prev.logLevel !== updated.logLevel ||
      prev.tunStack !== updated.tunStack;

    if (needReload && mihomo.getStatus().running) {
      if (prev.controllerPort !== updated.controllerPort) {
        await mihomo.restart();
      } else {
        await mihomo.reloadConfig();
      }
    }

    if (updated.systemProxy && (prev.mixedPort !== updated.mixedPort || prev.bypassDomains !== updated.bypassDomains)) {
      await setMacSystemProxy(true, updated.mixedPort, updated.bypassDomains);
    }

    broadcast('event:settingsChanged', updated);
    updateTrayMenu();
    return updated;
  });

  ipcMain.handle('settings:setMode', async (_e, mode: ProxyMode) => handleModeChange(mode));
  ipcMain.handle('sysproxy:toggle', async (_e, enable: boolean) => handleSystemProxyToggle(enable));

  ipcMain.handle('tun:toggle', async (_e, enable: boolean) => {
    if (enable && !cachedIsAdmin) {
      return { tunEnabled: false, requiresAdmin: true };
    }
    const updated = store.updateSettings({ tunEnabled: enable });
    if (mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    } else if (enable) {
      await mihomo.start();
    }
    broadcast('event:settingsChanged', updated);
    updateTrayMenu();
    return { tunEnabled: updated.tunEnabled };
  });

  ipcMain.handle('core:start', async () => {
    const status = await mihomo.start();
    updateTrayMenu();
    return status;
  });
  ipcMain.handle('core:stop', async () => {
    const status = mihomo.stop();
    updateTrayMenu();
    return status;
  });
  ipcMain.handle('core:restart', async () => {
    const status = await mihomo.restart();
    updateTrayMenu();
    return status;
  });
  ipcMain.handle('core:toggleMaster', async (_e, enable: boolean) => handleMasterToggle(enable));

  // 订阅导入与管理（严格匿名，不返回任何订阅名）
  ipcMain.handle('sub:importUrl', async (_e, url: string) => {
    const profile = await createProfileFromUrl(url.trim(), store.getProfilesDir());
    const profiles = store.addProfile(profile);
    store.setActiveProfileId(profile.id);
    if (mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    } else {
      await mihomo.start();
    }
    return {
      profiles,
      activeProfileId: store.getActiveProfileId(),
      nodeCount: profile.nodeCount
    };
  });

  ipcMain.handle('sub:importFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 Clash 配置文件',
      filters: [
        { name: 'Clash 配置', extensions: ['yaml', 'yml', 'txt'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const profile = createProfileFromFile(result.filePaths[0], store.getProfilesDir());
    const profiles = store.addProfile(profile);
    store.setActiveProfileId(profile.id);
    if (mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    } else {
      await mihomo.start();
    }
    return {
      profiles,
      activeProfileId: store.getActiveProfileId(),
      nodeCount: profile.nodeCount
    };
  });

  ipcMain.handle('sub:select', async (_e, id: string) => {
    store.setActiveProfileId(id);
    if (mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    } else {
      await mihomo.start();
    }
    return { activeProfileId: store.getActiveProfileId() };
  });

  ipcMain.handle('sub:refresh', async (_e, id: string) => {
    const stored = store.getStoredProfile(id);
    if (!stored) throw new Error('订阅不存在');
    const nodeCount = await refreshProfile(stored);
    const profiles = store.updateProfileMeta(id, nodeCount);
    if (store.getActiveProfileId() === id && mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    }
    return { profiles, nodeCount };
  });

  ipcMain.handle('sub:delete', async (_e, id: string) => {
    const res = store.deleteProfile(id);
    if (mihomo.getStatus().running) {
      await mihomo.reloadConfig();
    }
    return res;
  });

  ipcMain.handle('clash:getProxies', async () => mihomo.getProxies());
  ipcMain.handle('clash:selectProxy', async (_e, group: string, proxy: string) =>
    mihomo.selectProxy(group, proxy)
  );
  ipcMain.handle('clash:testProxyDelay', async (_e, proxy: string) => mihomo.testProxyDelay(proxy));
  ipcMain.handle('clash:testGroupDelay', async (_e, group: string) => mihomo.testGroupDelay(group));
  ipcMain.handle('clash:getRules', async () => mihomo.getRules());
  ipcMain.handle('clash:getConnections', async () => mihomo.getConnections());
  ipcMain.handle('clash:closeConnection', async (_e, id: string) => mihomo.closeConnection(id));
  ipcMain.handle('clash:closeAllConnections', async () => mihomo.closeAllConnections());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(async () => {
    store = new AppStore();
    mihomo = new MihomoManager(store);
    cachedIsAdmin = await isRunningAsAdmin();

    if (store.getSettings().systemProxy) {
      store.updateSettings({ systemProxy: false });
      await setMacSystemProxy(false, store.getSettings().mixedPort, store.getSettings().bypassDomains).catch(() => {});
    }

    mihomo.on('status', (status) => {
      broadcast('event:coreStatus', status);
      updateTrayMenu();
    });
    mihomo.on('traffic', (data) => broadcast('event:traffic', data));
    mihomo.on('connections', (data) => broadcast('event:connections', data));
    mihomo.on('log', (data) => broadcast('event:log', data));

    setupMacApplicationMenu();
    registerIpcHandlers();
    createWindow();
    createTray();

    if (store.getActiveProfileId()) {
      mihomo.start().catch((err) => {
        console.error('[App] Auto start mihomo failed:', err);
      });
    }
  });

  app.on('before-quit', async () => {
    isQuitting = true;
    await cleanupBeforeQuit();
  });
}
