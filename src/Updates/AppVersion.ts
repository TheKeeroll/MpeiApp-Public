/** Compare numeric release components; channel/build labels do not affect it. */
export const normalizeAppVersion = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/^(?:версия|version)\s*:?\s*/iu, '');
  const match = /^v?(\d+(?:\.\d+){1,3})(?=$|[^\d.])/iu.exec(text);
  if (!match) return undefined;
  const components = match[1].split('.').map(Number);
  if (components.some(component => !Number.isSafeInteger(component))) return undefined;
  return components.join('.');
};

export const compareAppVersions = (left: string, right: string): number | undefined => {
  const a = normalizeAppVersion(left)?.split('.').map(Number);
  const b = normalizeAppVersion(right)?.split('.').map(Number);
  if (!a || !b) return undefined;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta > 0 ? 1 : -1;
  }
  return 0;
};
