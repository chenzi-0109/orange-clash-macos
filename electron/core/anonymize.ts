/**
 * 通用订阅与策略组匿名化清洗模块
 * 目标：彻底去除机场/订阅方在 proxy-groups 名称及 rules 引用中嵌入的订阅品牌名，
 * 统一替换为干净、通用的策略分组名（如「节点选择」「自动选择」「故障转移」），
 * 同时保持所有分流规则和分组引用 100% 完整可用。
 */

const GENERIC_GROUP_PATTERNS: RegExp[] = [
  /^(节点选择|手动选择|手动切换|代理选择|选择节点|默认代理|全球代理|海外代理|外网代理)$/i,
  /^(自动选择|自动测速|延迟最低|最快节点|智能选择|自动优选)$/i,
  /^(故障转移|故障切换|自动回退|备用节点)$/i,
  /^(负载均衡|轮询负载)$/i,
  /^(漏网之鱼|兜底分流|最终规则|其他流量|其它流量|Final|Match|Others)$/i,
  /^(国内直连|全球直连|直连流量|中国直连|Direct|Domestic)$/i,
  /^(广告拦截|全球拦截|应用净化|隐私防护|广告过滤|Reject|AdBlock)$/i,
  /(苹果|Apple|iCloud|App\s*Store)/i,
  /(微软|Microsoft|Bing|OneDrive|Office)/i,
  /(谷歌|Google|FCM|YouTube|油管)/i,
  /(奈飞|Netflix|迪士尼|Disney|HBO|Hulu|Bahamut|巴哈姆特|哔哩哔哩|Bilibili|Spotify|TikTok|抖音|流媒体|海外媒体|国际媒体|港台番剧|Media|Streaming)/i,
  /(电报|Telegram|推特|Twitter|X\.com|Discord|WhatsApp|Facebook|Instagram|社交)/i,
  /(OpenAI|ChatGPT|Claude|Gemini|Copilot|AI\s*服务|人工智能)/i,
  /(游戏|Steam|Epic|PlayStation|Xbox|Nintendo|Game)/i,
  /(PayPal|金融|银行|GitHub|开发)/i,
  /(香港|台湾|日本|新加坡|狮城|美国|韩国|英国|德国|法国|加拿大|澳大利亚|欧洲|港澳台|HK|TW|JP|SG|US|KR|UK)/i,
  /^(Proxy|Proxies|Select|Auto|UrlTest|Fallback|LoadBalance|Global)$/i
];

function isGenericGroupName(name: string): boolean {
  // 去掉开头常见的 Emoji 与装饰符号再判断
  const cleaned = name
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f\s\-_|【】[\]()（）]+/gu, '')
    .trim();
  if (!cleaned) return false;
  return GENERIC_GROUP_PATTERNS.some((re) => re.test(cleaned));
}

function getDefaultNameByType(type: string, isFirstSelect: boolean): string {
  const t = (type || '').toLowerCase();
  if (t === 'url-test') return '自动选择';
  if (t === 'fallback') return '故障转移';
  if (t === 'load-balance') return '负载均衡';
  if (isFirstSelect) return '节点选择';
  return '策略分组';
}

export function anonymizeClashConfig(config: Record<string, unknown>): Record<string, unknown> {
  const groups = config['proxy-groups'];
  if (!Array.isArray(groups) || groups.length === 0) {
    return config;
  }

  const renameMap = new Map<string, string>();
  const usedNames = new Set<string>();

  // 先登记所有本身就是通用名称的分组，避免重命名撞车
  for (const g of groups) {
    if (g && typeof g === 'object' && typeof (g as any).name === 'string') {
      const n = String((g as any).name).trim();
      if (isGenericGroupName(n)) {
        usedNames.add(n);
      }
    }
  }

  let firstSelectHandled = false;

  const allocUniqueName = (base: string): string => {
    if (!usedNames.has(base)) {
      usedNames.add(base);
      return base;
    }
    let idx = 2;
    while (usedNames.has(`${base} ${idx}`)) {
      idx++;
    }
    const candidate = `${base} ${idx}`;
    usedNames.add(candidate);
    return candidate;
  };

  for (const g of groups) {
    if (!g || typeof g !== 'object') continue;
    const grp = g as Record<string, unknown>;
    const oldName = typeof grp.name === 'string' ? grp.name.trim() : '';
    const type = typeof grp.type === 'string' ? grp.type : 'select';
    if (!oldName) continue;

    const isSelect = type.toLowerCase() === 'select';
    const isFirstSelect = isSelect && !firstSelectHandled;
    if (isSelect) firstSelectHandled = true;

    if (!isGenericGroupName(oldName)) {
      const base = getDefaultNameByType(type, isFirstSelect);
      const newName = allocUniqueName(base);
      renameMap.set(oldName, newName);
    }
  }

  if (renameMap.size === 0) {
    return config;
  }

  // 1. 替换 proxy-groups 的 name 与内部 proxies 引用
  const newGroups = groups.map((g) => {
    if (!g || typeof g !== 'object') return g;
    const grp = { ...(g as Record<string, unknown>) };
    if (typeof grp.name === 'string' && renameMap.has(grp.name.trim())) {
      grp.name = renameMap.get(grp.name.trim());
    }
    if (Array.isArray(grp.proxies)) {
      grp.proxies = grp.proxies.map((item) => {
        if (typeof item === 'string' && renameMap.has(item.trim())) {
          return renameMap.get(item.trim());
        }
        return item;
      });
    }
    return grp;
  });

  // 2. 替换 rules 中引用到旧分组名的目标策略
  const replaceRuleTarget = (ruleLine: unknown): unknown => {
    if (typeof ruleLine !== 'string') return ruleLine;
    const parts = ruleLine.split(',');
    if (parts.length < 2) return ruleLine;
    // Clash 规则格式：TYPE,PAYLOAD,TARGET[,no-resolve] 或 MATCH,TARGET
    let changed = false;
    const nextParts = parts.map((seg, idx) => {
      if (idx === 0) return seg;
      const trimmed = seg.trim();
      if (renameMap.has(trimmed)) {
        changed = true;
        return renameMap.get(trimmed)!;
      }
      return seg;
    });
    return changed ? nextParts.join(',') : ruleLine;
  };

  const nextConfig: Record<string, unknown> = {
    ...config,
    'proxy-groups': newGroups
  };

  // 收集被识别为非通用订阅/机场品牌的旧名称，用于清理残留的机场推广规则或节点名中的品牌词
  const brandTerms = Array.from(renameMap.keys()).filter((k) => k.length >= 2);

  if (Array.isArray(config.rules)) {
    nextConfig.rules = config.rules
      .filter((line) => {
        if (typeof line !== 'string') return true;
        const parts = line.split(',');
        const payload = parts[1] || '';
        return !brandTerms.some((term) => payload.includes(term));
      })
      .map(replaceRuleTarget);
  }

  // 如果节点名称中包含机场品牌词，也同步匿名替换（同时更新策略组引用）
  if (Array.isArray(config.proxies) && brandTerms.length > 0) {
    const proxyRename = new Map<string, string>();
    const newProxies = config.proxies.map((p) => {
      if (!p || typeof p !== 'object') return p;
      const node = { ...(p as Record<string, unknown>) };
      if (typeof node.name === 'string') {
        let nextName = node.name;
        for (const term of brandTerms) {
          if (nextName.includes(term)) {
            nextName = nextName.split(term).join('').replace(/^[\s\-_|]+|[\s\-_|]+$/g, '').trim();
          }
        }
        if (nextName !== node.name) {
          const finalName = nextName || '节点';
          proxyRename.set(node.name, finalName);
          node.name = finalName;
        }
      }
      return node;
    });

    if (proxyRename.size > 0) {
      nextConfig.proxies = newProxies;
      nextConfig['proxy-groups'] = (nextConfig['proxy-groups'] as Array<Record<string, unknown>>).map((grp) => {
        if (!grp || !Array.isArray(grp.proxies)) return grp;
        return {
          ...grp,
          proxies: grp.proxies.map((item) =>
            typeof item === 'string' && proxyRename.has(item) ? proxyRename.get(item) : item
          )
        };
      });
    }
  }

  if (config['sub-rules'] && typeof config['sub-rules'] === 'object') {
    const subRules = { ...(config['sub-rules'] as Record<string, unknown>) };
    for (const key of Object.keys(subRules)) {
      if (Array.isArray(subRules[key])) {
        subRules[key] = (subRules[key] as unknown[]).map(replaceRuleTarget);
      }
    }
    nextConfig['sub-rules'] = subRules;
  }

  return nextConfig;
}
