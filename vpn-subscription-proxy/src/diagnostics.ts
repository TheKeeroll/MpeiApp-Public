export type FailureDetails = Readonly<Record<string, unknown>>;
export type AuditSink = (entry: Readonly<Record<string, unknown>>) => void;

/** One JSON line per event; systemd captures stdout in journalctl. */
export const journalAudit: AuditSink = entry => {
  process.stdout.write(`${JSON.stringify({time: new Date().toISOString(), ...entry})}\n`);
};

/** Never serialize arbitrary Error objects/messages, URLs or request bodies. */
export const errorDetails = (error: unknown): FailureDetails => {
  if (error instanceof PanelTransportError) return error.details;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^SQLITE_[A-Z_]+$/u.test(code)
    ? {category: 'storage_error', code}
    : {category: 'unexpected_error'};
};

export class PanelTransportError extends Error {
  public constructor(public readonly details: FailureDetails = {category: 'panel_network_error'}) {
    super('Panel request failed');
  }
}

export const networkErrorCode = (error: unknown, depth = 0): string | undefined => {
  if (depth >= 4 || typeof error !== 'object' || error === null) return undefined;
  const code = 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/u.test(code)) return code;
  return 'cause' in error ? networkErrorCode(error.cause, depth + 1) : undefined;
};

export const safePanelMessage = (value: unknown, secrets: readonly string[]): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  if (value.length > 16_384) return '[oversized panel message omitted]';
  let message = value;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    if (!secret) continue;
    const pattern = secret.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    message = message.replace(new RegExp(pattern, 'giu'), '[redacted]');
  }
  return message.replace(/https?:\/\/[^\s"'<>]+/giu, '[redacted-url]')
    .replace(/[\u0000-\u001F\u007F-\u009F]/gu, ' ').slice(0, 512);
};
