export function formatBytes(bytes: number, perSecond = false): string {
  if (!bytes || bytes <= 0 || Number.isNaN(bytes)) {
    return perSecond ? '0 B/s' : '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  const str = val >= 100 || idx === 0 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2);
  return `${str} ${units[idx]}${perSecond ? '/s' : ''}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 秒';
  const s = Math.floor(seconds);
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return `${m} 分 ${remS} 秒`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h} 时 ${remM} 分`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return '刚刚更新';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export function getDelayColor(delay?: number): string {
  if (!delay || delay <= 0) return 'text-slate-400';
  if (delay < 150) return 'text-emerald-600';
  if (delay < 350) return 'text-amber-600';
  return 'text-rose-500';
}

export function getDelayBadgeBg(delay?: number): string {
  if (!delay || delay <= 0) return 'bg-slate-100 text-slate-400';
  if (delay < 150) return 'bg-emerald-50 text-emerald-600 border-emerald-200/70';
  if (delay < 350) return 'bg-amber-50 text-amber-600 border-amber-200/70';
  return 'bg-rose-50 text-rose-500 border-rose-200/70';
}
