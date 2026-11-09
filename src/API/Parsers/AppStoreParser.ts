import parse from 'node-html-parser';
import {normalizeAppVersion} from '../../Updates/AppVersion';

export type AppStorePlatform = 'android' | 'ios';
export type AppStoreRelease = {version: string; releaseNotes: string};

export const releaseNotesText = (html: string): string => parse(html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n• ')
  .replace(/<\/(?:p|div|ul|ol|h[1-6])\s*>/gi, '\n'))
  .text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
  .split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/** Only standalone release headings delimit history, never mentions inside a bullet. */
const releaseHeading = (line: string): {version: string; rest: string} | undefined => {
  const match = /^(?:#{1,6}\s*)?(?:(?:версия|version|релиз|release)\s*:?\s*)?v?(\d+(?:\.\d+){1,3})(?:-[\w.-]+)?(?:\s*[:：–—-]\s*(.*)|\s*)$/iu.exec(line);
  const version = normalizeAppVersion(match?.[1]);
  return version ? {version, rest: match?.[2]?.trim() ?? ''} : undefined;
};

export const currentReleaseNotes = (raw: string, version: string): string => {
  const lines = releaseNotesText(raw).split('\n');
  const current = normalizeAppVersion(version);
  const matchingHeader = lines.findIndex(line => releaseHeading(line)?.version === current);
  const start = matchingHeader < 0 ? 0 : matchingHeader;
  const result: string[] = [];
  for (let index = start; index < lines.length; index++) {
    const heading = releaseHeading(lines[index]);
    if (heading) {
      if (heading.version !== current) break;
      if (heading.rest) result.push(heading.rest);
    } else {
      result.push(lines[index]);
    }
  }
  return result.join('\n').trim();
};

const release = (versionValue: unknown, notesValue: unknown): AppStoreRelease | undefined => {
  const version = normalizeAppVersion(versionValue);
  if (!version || typeof notesValue !== 'string') return undefined;
  return {version, releaseNotes: currentReleaseNotes(notesValue, version)};
};

/** Extract JSON from a JS callback without executing any store-provided code. */
const callbackData = (script: string): unknown => {
  const marker = /\bdata\s*:\s*(?=[\[{])/.exec(script);
  if (!marker) return undefined;
  const start = marker.index + marker[0].length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < script.length; index++) {
    const char = script[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '[' || char === '{') depth++;
    else if (char === ']' || char === '}') {
      if (--depth === 0) {
        try { return JSON.parse(script.slice(start, index + 1)); }
        catch { return undefined; }
      }
    }
  }
  return undefined;
};

// Store data is external and versioned independently of the application.
type StoreValue = any;

export const parseAppStorePage = (html: string, platform: AppStorePlatform): AppStoreRelease | undefined => {
  try {
    const root = parse(html);
    if (platform === 'android') {
      for (const script of root.querySelectorAll('script')) {
        const source = script.innerHTML;
        if (!source.includes('AF_initDataCallback(')) continue;
        const data = callbackData(source) as StoreValue;
        const details = data?.[1]?.[2];
        if (!Array.isArray(details) || details[0]?.[0] !== 'MpeiApp') continue;
        // Current Play payload groups numbered fields in a direct child object.
        const fields = details.find(value => value && !Array.isArray(value)
          && typeof value === 'object' && value['141'] && value['145']);
        const parsed = release(fields?.['141']?.[0]?.[0]?.[0], fields?.['145']?.[1]?.[1])
          // Previous Play payload stores these fields directly in the array.
          ?? release(details[140]?.[0]?.[0]?.[0], details[144]?.[1]?.[1]);
        if (parsed) return parsed;
      }
      const version = root.querySelector('[itemprop="softwareVersion"]')?.text;
      const notes = root.querySelector('[itemprop="releaseNotes"]')?.innerHTML;
      return release(version, notes);
    }

    const serialized = root.querySelector('script#serialized-server-data')?.innerHTML;
    if (serialized) {
      try {
        const data = JSON.parse(serialized) as StoreValue;
        for (const entry of data.data ?? []) {
          if (String(entry.intent?.id) !== '1618910681') continue;
          const latest = entry.data?.shelfMapping?.mostRecentVersion?.items?.[0];
          const parsed = release(latest?.primarySubtitle, latest?.text);
          if (parsed) return parsed;
        }
      } catch { /* Try the visible, scoped section below. */ }
    }
    const section = root.querySelector('.whats-new, #whatsNew');
    const version = section?.querySelector('.whats-new__latest__version, .metadata span')?.text;
    const notes = section?.querySelector('.whats-new__content .we-truncate__content, .whats-new__content')?.innerHTML;
    return release(version, notes);
  } catch {
    return undefined;
  }
};
