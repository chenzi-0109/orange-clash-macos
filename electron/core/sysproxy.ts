import { execFile } from 'child_process';
import { app } from 'electron';

function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * 枚举 macOS 所有启用的网络服务（如 Wi-Fi、Ethernet、USB LAN 等）
 */
async function getActiveNetworkServices(): Promise<string[]> {
  try {
    const output = await runCommand('/usr/sbin/networksetup', ['-listallnetworkservices']);
    const lines = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('An asterisk') && !l.startsWith('*'));
    return lines.length > 0 ? lines : ['Wi-Fi'];
  } catch {
    return ['Wi-Fi'];
  }
}

/**
 * 开启或关闭 macOS 系统代理（HTTP / HTTPS / SOCKS5 + 绕过域名）
 */
export async function setMacSystemProxy(
  enable: boolean,
  port: number,
  bypassDomains: string
): Promise<void> {
  const services = await getActiveNetworkServices();
  const bypassList = bypassDomains
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  await Promise.all(
    services.map(async (service) => {
      try {
        if (enable) {
          await runCommand('/usr/sbin/networksetup', ['-setwebproxy', service, '127.0.0.1', String(port)]);
          await runCommand('/usr/sbin/networksetup', ['-setsecurewebproxy', service, '127.0.0.1', String(port)]);
          await runCommand('/usr/sbin/networksetup', ['-setsocksfirewallproxy', service, '127.0.0.1', String(port)]);
          if (bypassList.length > 0) {
            await runCommand('/usr/sbin/networksetup', ['-setproxybypassdomains', service, ...bypassList]);
          }
        } else {
          await runCommand('/usr/sbin/networksetup', ['-setwebproxystate', service, 'off']);
          await runCommand('/usr/sbin/networksetup', ['-setsecurewebproxystate', service, 'off']);
          await runCommand('/usr/sbin/networksetup', ['-setsocksfirewallproxystate', service, 'off']);
        }
      } catch (err) {
        console.warn(`[SysProxy] Skip service "${service}":`, err);
      }
    })
  );
}

/**
 * 检查当前是否具有 root 管理员权限（macOS 创建 utun 虚拟网卡需要 root 权限）
 */
export async function isRunningAsAdmin(): Promise<boolean> {
  try {
    if (typeof process.getuid === 'function') {
      return process.getuid() === 0;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 通过 macOS 原生系统授权弹窗（密码 / Touch ID）以管理员权限重新启动应用
 */
export async function relaunchAsAdmin(): Promise<boolean> {
  try {
    const escapedPath = process.execPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `do shell script "\\"${escapedPath}\\" > /dev/null 2>&1 &" with administrator privileges with prompt "Orange Clash 需要管理员权限以启用虚拟网卡 (TUN) 模式"`;
    await runCommand('/usr/bin/osascript', ['-e', script]);
    app.quit();
    return true;
  } catch {
    return false;
  }
}
