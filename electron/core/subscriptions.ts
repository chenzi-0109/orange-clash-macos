import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { anonymizeClashConfig } from './anonymize';
import { StoredProfile } from './store';

interface ClashConfig {
  proxies?: Array<Record<string, unknown>>;
  'proxy-groups'?: Array<Record<string, unknown>>;
  'proxy-providers'?: Record<string, unknown>;
  rules?: string[];
  [key: string]: unknown;
}

function tryDecodeBase64(input: string): string | null {
  const cleaned = input.trim().replace(/\s+/g, '');
  if (!cleaned || cleaned.length < 8) return null;
  try {
    const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
    if (/(ss|ssr|vmess|vless|trojan|hysteria2|hy2):\/\//i.test(decoded)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function parseSingleUri(uri: string, idx: number): Record<string, unknown> | null {
  const line = uri.trim();
  if (!line) return null;

  try {
    if (line.startsWith('vmess://')) {
      const jsonStr = Buffer.from(line.slice(8), 'base64').toString('utf-8');
      const v = JSON.parse(jsonStr) as Record<string, unknown>;
      const name = String(v.ps || `Node-${idx + 1}`);
      const proxy: Record<string, unknown> = {
        name,
        type: 'vmess',
        server: String(v.add || ''),
        port: Number(v.port || 443),
        uuid: String(v.id || ''),
        alterId: Number(v.aid || 0),
        cipher: String(v.scy || 'auto'),
        tls: v.tls === 'tls' || v.tls === true,
        'skip-cert-verify': true
      };
      if (v.net === 'ws') {
        proxy.network = 'ws';
        proxy['ws-opts'] = {
          path: String(v.path || '/'),
          headers: v.host ? { Host: String(v.host) } : {}
        };
      }
      if (v.sni) proxy.servername = String(v.sni);
      return proxy.server ? proxy : null;
    }

    if (line.startsWith('ss://')) {
      const u = new URL(line);
      const name = decodeURIComponent(u.hash.replace(/^#/, '') || `SS-${idx + 1}`);
      let method = '';
      let password = '';
      if (u.username && u.password) {
        method = decodeURIComponent(u.username);
        password = decodeURIComponent(u.password);
      } else {
        const decoded = Buffer.from(decodeURIComponent(u.username), 'base64').toString('utf-8');
        const sep = decoded.indexOf(':');
        if (sep > 0) {
          method = decoded.slice(0, sep);
          password = decoded.slice(sep + 1);
        }
      }
      if (!u.hostname || !method) return null;
      return {
        name,
        type: 'ss',
        server: u.hostname,
        port: Number(u.port || 443),
        cipher: method,
        password
      };
    }

    if (line.startsWith('trojan://')) {
      const u = new URL(line);
      const name = decodeURIComponent(u.hash.replace(/^#/, '') || `Trojan-${idx + 1}`);
      const sni = u.searchParams.get('sni') || u.searchParams.get('peer') || u.hostname;
      const proxy: Record<string, unknown> = {
        name,
        type: 'trojan',
        server: u.hostname,
        port: Number(u.port || 443),
        password: decodeURIComponent(u.username),
        sni,
        'skip-cert-verify': true
      };
      if (u.searchParams.get('type') === 'ws') {
        proxy.network = 'ws';
        proxy['ws-opts'] = {
          path: u.searchParams.get('path') || '/',
          headers: u.searchParams.get('host') ? { Host: u.searchParams.get('host') } : {}
        };
      }
      return proxy;
    }

    if (line.startsWith('vless://')) {
      const u = new URL(line);
      const name = decodeURIComponent(u.hash.replace(/^#/, '') || `VLESS-${idx + 1}`);
      const security = u.searchParams.get('security') || '';
      const proxy: Record<string, unknown> = {
        name,
        type: 'vless',
        server: u.hostname,
        port: Number(u.port || 443),
        uuid: decodeURIComponent(u.username),
        tls: security === 'tls' || security === 'reality',
        'skip-cert-verify': true,
        servername: u.searchParams.get('sni') || u.hostname
      };
      const flow = u.searchParams.get('flow');
      if (flow) proxy.flow = flow;
      const fp = u.searchParams.get('fp');
      if (fp) proxy['client-fingerprint'] = fp;
      if (security === 'reality') {
        proxy['reality-opts'] = {
          'public-key': u.searchParams.get('pbk') || '',
          'short-id': u.searchParams.get('sid') || ''
        };
      }
      if (u.searchParams.get('type') === 'ws') {
        proxy.network = 'ws';
        proxy['ws-opts'] = {
          path: u.searchParams.get('path') || '/',
          headers: u.searchParams.get('host') ? { Host: u.searchParams.get('host') } : {}
        };
      }
      return proxy;
    }

    if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) {
      const normalized = line.replace(/^hy2:\/\//, 'hysteria2://');
      const u = new URL(normalized);
      const name = decodeURIComponent(u.hash.replace(/^#/, '') || `HY2-${idx + 1}`);
      return {
        name,
        type: 'hysteria2',
        server: u.hostname,
        port: Number(u.port || 443),
        password: decodeURIComponent(u.username),
        sni: u.searchParams.get('sni') || u.hostname,
        'skip-cert-verify': true
      };
    }
  } catch {
    return null;
  }
  return null;
}

function buildClashConfigFromProxies(proxies: Array<Record<string, unknown>>): ClashConfig {
  // 去重节点名
  const used = new Set<string>();
  const uniqueProxies = proxies.map((p, idx) => {
    let base = String(p.name || `Node-${idx + 1}`).trim();
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base} (${suffix++})`;
    }
    used.add(candidate);
    return { ...p, name: candidate };
  });

  const names = uniqueProxies.map((p) => String(p.name));

  return {
    proxies: uniqueProxies,
    'proxy-groups': [
      {
        name: '节点选择',
        type: 'select',
        proxies: ['自动选择', 'DIRECT', ...names]
      },
      {
        name: '自动选择',
        type: 'url-test',
        proxies: names,
        url: 'https://www.gstatic.com/generate_204',
        interval: 300
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
      'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
      'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'DOMAIN-SUFFIX,cn,DIRECT',
      'GEOIP,CN,DIRECT',
      'MATCH,节点选择'
    ]
  };
}

export function parseSubscriptionContent(rawText: string): { yamlContent: string; nodeCount: number } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('订阅内容为空');
  }

  // 1. 尝试直接解析为 YAML
  let parsed: unknown = null;
  try {
    parsed = yaml.load(trimmed);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as ClashConfig;
    const hasProxies = Array.isArray(obj.proxies) && obj.proxies.length > 0;
    const hasProviders = obj['proxy-providers'] && Object.keys(obj['proxy-providers']).length > 0;
    const hasGroups = Array.isArray(obj['proxy-groups']) && obj['proxy-groups'].length > 0;

    if (hasProxies || hasProviders || hasGroups) {
      const cleanedObj = anonymizeClashConfig(obj as Record<string, unknown>);
      const nodeCount = Array.isArray(obj.proxies) ? obj.proxies.length : 0;
      return {
        yamlContent: yaml.dump(cleanedObj, { lineWidth: -1, noRefs: true }),
        nodeCount
      };
    }
  }

  // 2. 尝试解析 Base64 或明文 URI 列表
  const decoded = tryDecodeBase64(trimmed) ?? trimmed;
  const lines = decoded.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const proxies: Array<Record<string, unknown>> = [];
  lines.forEach((line, idx) => {
    const p = parseSingleUri(line, idx);
    if (p) proxies.push(p);
  });

  if (proxies.length === 0) {
    throw new Error('无法解析订阅内容：请确认链接为 Clash YAML 或标准节点订阅格式');
  }

  const config = buildClashConfigFromProxies(proxies);
  return {
    yamlContent: yaml.dump(config, { lineWidth: -1, noRefs: true }),
    nodeCount: proxies.length
  };
}

export async function fetchSubscriptionFromUrl(url: string): Promise<{ yamlContent: string; nodeCount: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'clash-verge/v2.0.0 mihomo/1.19'
      }
    });
    if (!res.ok) {
      throw new Error(`拉取订阅失败 (HTTP ${res.status})`);
    }
    const text = await res.text();
    return parseSubscriptionContent(text);
  } finally {
    clearTimeout(timeout);
  }
}

export async function createProfileFromUrl(
  url: string,
  profilesDir: string
): Promise<StoredProfile> {
  const { yamlContent, nodeCount } = await fetchSubscriptionFromUrl(url);
  const id = crypto.randomUUID();
  const filePath = path.join(profilesDir, `${id}.yaml`);
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
  return {
    id,
    sourceType: 'url',
    sourceUrl: url,
    nodeCount,
    updatedAt: Date.now(),
    filePath
  };
}

export function createProfileFromFile(
  localFilePath: string,
  profilesDir: string
): StoredProfile {
  const raw = fs.readFileSync(localFilePath, 'utf-8');
  const { yamlContent, nodeCount } = parseSubscriptionContent(raw);
  const id = crypto.randomUUID();
  const filePath = path.join(profilesDir, `${id}.yaml`);
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
  return {
    id,
    sourceType: 'file',
    nodeCount,
    updatedAt: Date.now(),
    filePath
  };
}

export async function refreshProfile(profile: StoredProfile): Promise<number> {
  if (!profile.sourceUrl) {
    throw new Error('本地导入的订阅不支持远程更新');
  }
  const { yamlContent, nodeCount } = await fetchSubscriptionFromUrl(profile.sourceUrl);
  fs.writeFileSync(profile.filePath, yamlContent, 'utf-8');
  return nodeCount;
}
