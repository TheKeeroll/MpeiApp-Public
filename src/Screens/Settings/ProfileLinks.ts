import {URL} from 'react-native-url-polyfill';

export type ProfilePlatform = 'vk' | 'telegram' | 'instagram' | 'youtube' | 'tiktok' | 'link';
export interface ProfileLink {
  url: string;
  platform: ProfilePlatform;
  icon: string;
  label: string;
}

const platforms = [
  {platform: 'vk', icon: 'vk', label: 'VK', domains: ['vk.ru']},
  {platform: 'telegram', icon: 'telegram-plane', label: 'Telegram', domains: ['t.me', 'telegram.me', 'telegram.org']},
  {platform: 'instagram', icon: 'instagram', label: 'Instagram', domains: ['instagram.com']},
  {platform: 'youtube', icon: 'youtube', label: 'YouTube', domains: ['youtube.com', 'youtu.be']},
  {platform: 'tiktok', icon: 'tiktok', label: 'TikTok', domains: ['tiktok.com']},
] as const;

export function resolveProfileLink(value: string): ProfileLink {
  let url = value.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  else if (/^(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(url)) url = 'https://' + url;
  const fallback: ProfileLink = {url, platform: 'link', icon: 'link', label: 'Ссылка'};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    // Normalize a previously supplied VK address as well as updating stored links.
    if (/(^|\.)vk\.com$/.test(host)) parsed.hostname = host.replace(/vk\.com$/, 'vk.ru');
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const platform = platforms.find(item => item.domains.some(domain => hostname === domain || hostname.endsWith('.' + domain)));
    return platform ? {url: parsed.href, platform: platform.platform, icon: platform.icon, label: platform.label} : {...fallback, url: parsed.href};
  } catch {
    return fallback;
  }
}

export function profileLinks(value: string | readonly string[] | undefined): ProfileLink[] {
  const inputs = typeof value === 'string' ? [value] : value ?? [];
  const seen = new Set<string>();
  const result: ProfileLink[] = [];
  for (const input of inputs) {
    if (!input.trim()) continue;
    const link = resolveProfileLink(input);
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    result.push(link);
    if (result.length === 4) break;
  }
  return result;
}

export function avatarTitle(title: string): string {
  if (title.includes('\n')) return title;
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return title;
  return words.slice(0, -1).join(' ') + '\n' + words[words.length - 1];
}
