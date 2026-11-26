# Orange Clash · macOS Edition

白底 + 暖橙色 + 液态玻璃（Liquid Glass）风格的 macOS 桌面代理客户端，直接内置 **Mihomo Meta v1.19.34**（Apple Silicon `arm64` + Intel `x64` 双架构）内核与 Geo 数据库，开箱即用。

## 核心特性
- **原生 macOS 体验**：无边框 `hiddenInset` 红黄绿交通灯、`vibrancy` 液态毛玻璃、原生顶部应用菜单（完美支持 `Cmd+C`/`Cmd+V`/`Cmd+Q`）、菜单栏托盘与 Dock 恢复。
- **macOS 原生系统代理**：通过 `networksetup` 自动接管所有活跃网络服务（Wi-Fi / 有线网卡）的 HTTP / HTTPS / SOCKS5 代理与绕过域名。
- **虚拟网卡 (TUN) 模式**：支持 `utun` 虚拟网卡，非管理员权限点击时自动弹出 macOS 原生密码 / Touch ID 授权框一键提权重启。
- **订阅名称 100% 匿名隐藏**：导入订阅链接或本地 YAML 时完全隐藏订阅名，并自动将机场自定义的主策略组名清洗为通用名称（如 `节点选择` / `自动选择` / `故障转移`）。

## 如何在 Mac 上打包 `.dmg` 安装包

### 方式一：在任意 Mac 上本地一键打包
将整个 `orange-clash-macos` 目录拷贝到 Mac，终端执行：
```bash
chmod +x build-mac.sh
./build-mac.sh
```
打包完成后即可在 `release/` 目录获取：
- `Orange-Clash-1.0.0-macOS-arm64.dmg`（M1 / M2 / M3 / M4 芯片）
- `Orange-Clash-1.0.0-macOS-x64.dmg`（Intel 芯片）

> 首次打开未签名应用若提示“已损坏”或“无法验证开发者”，在终端执行一次：
> ```bash
> xattr -cr "/Applications/Orange Clash.app"
> ```

### 方式二：无 Mac 时用 GitHub Actions 免费云端打包
将本项目推送到 GitHub 仓库后，在仓库的 **Actions → Build Orange Clash macOS → Run workflow** 点击运行，约 3 分钟即可直接下载现成的双架构 `.dmg` 安装包。
