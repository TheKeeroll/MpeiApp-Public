import path from 'node:path';
import {constants, existsSync, lstatSync, mkdirSync, openSync, closeSync, writeFileSync, fchmodSync, fsyncSync, chmodSync, copyFileSync, renameSync, unlinkSync} from 'node:fs';

export const DATABASE_FILES = Object.freeze(['demo-cooldowns.sqlite', 'demo-cooldowns.sqlite-wal', 'demo-cooldowns.sqlite-shm']);

export function serviceFlags(activeState, unitFileState) {
  return {active: ['active', 'activating', 'reloading'].includes(activeState),
    enabled: ['enabled', 'enabled-runtime'].includes(unitFileState), runtime: unitFileState === 'enabled-runtime'};
}

export function assertNoSymlinks(filename) {
  const absolute = path.resolve(filename);
  const root = path.parse(absolute).root;
  let part = root;
  for (const entry of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    part = path.join(part, entry);
    let entryInfo;
    try { entryInfo = lstatSync(part); }
    catch (error) { if (error.code !== 'ENOENT') throw error; continue; }
    if (entryInfo.isSymbolicLink()) throw new Error(`Symlink недопустим: ${part}`);
  }
}

export function makeParents(directory) {
  assertNoSymlinks(directory);
  if (existsSync(directory)) {
    if (!lstatSync(directory).isDirectory()) throw new Error(`Ожидался каталог: ${directory}`);
    return;
  }
  makeParents(path.dirname(directory));
  mkdirSync(directory, {mode: 0o755}); chmodSync(directory, 0o755);
}

export function atomicWrite(filename, content, mode) {
  assertNoSymlinks(filename); makeParents(path.dirname(filename));
  const temporary = `${filename}.installer-${process.pid}`;
  const descriptor = openSync(temporary, 'wx', mode);
  try {
    try { writeFileSync(descriptor, content); fchmodSync(descriptor, mode); fsyncSync(descriptor); }
    finally { closeSync(descriptor); }
    renameSync(temporary, filename);
  }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export function restoreFileSnapshots(snapshots, preserveNewFiles = new Set()) {
  for (const [filename, snapshot] of snapshots) {
    if (snapshot) atomicWrite(filename, snapshot.content, snapshot.mode);
    else if (existsSync(filename) && !preserveNewFiles.has(filename)) unlinkSync(filename);
  }
}

/** Both SQLite owners must be stopped. Never combine an old WAL with a new DB. */
export function copyClosedState(source, destination) {
  assertNoSymlinks(source); assertNoSymlinks(destination);
  makeParents(path.dirname(destination));
  if (!existsSync(destination)) { mkdirSync(destination, {mode: 0o700}); chmodSync(destination, 0o700); }
  if (!existsSync(path.join(source, DATABASE_FILES[0]))) return;
  for (const name of DATABASE_FILES) {
    const from = path.join(source, name), to = path.join(destination, name);
    assertNoSymlinks(from); assertNoSymlinks(to);
    if (existsSync(from)) {
      const temporary = `${to}.installer-${process.pid}`;
      let owned = true;
      try {
        copyFileSync(from, temporary, constants.COPYFILE_EXCL);
        chmodSync(temporary, 0o600); renameSync(temporary, to);
      } catch (error) {
        if (error.code === 'EEXIST') owned = false;
        throw error;
      } finally { if (owned && existsSync(temporary)) unlinkSync(temporary); }
    } else if (existsSync(to)) unlinkSync(to);
  }
}

export const DEFAULTS = Object.freeze({
  PROXY_LISTEN_HOST: '0.0.0.0', PROXY_LISTEN_PORT: '8443', PROXY_REQUEST_PATH: '/api/v1/subscription',
  PROXY_PUBLIC_HOST: '', VPN_PANEL_BASE_URL: '', VPN_PANEL_TOKEN: '', VPN_DEMO_INBOUNDS: '[12,13,15]',
  VPN_SUBSCRIPTION_PORT: '443', VPN_SUBSCRIPTION_PATH_PREFIX: '/sub', DEMO_COOLDOWN_HMAC_KEY: '',
  STATE_DIRECTORY: '/var/lib/dragonet-subscription-proxy', REQUEST_TIMEOUT_MS: '10000',
  REQUEST_RATE_LIMIT_MAX: '30', REQUEST_RATE_LIMIT_WINDOW_SECONDS: '60', VERIFY_CACHE_TTL_SECONDS: '30',
  MAX_REQUEST_BODY_BYTES: '1024', TRUSTED_REVERSE_PROXY_IPS: '', DEMO_VLESS_FLOW: 'xtls-rprx-vision',
});

/** Parse EnvironmentFile data, never source/eval it as a shell program. */
export function parseEnvironment(text) {
  const result = Object.create(null);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let line = 0; line < lines.length; line++) {
    const row = lines[line].trimStart();
    if (!row.trim() || /^[#;]/.test(row)) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/.exec(row);
    if (!match) throw new Error(`Некорректная строка EnvironmentFile: ${line + 1} (значение скрыто).`);
    const [, key, start] = match;
    let raw = start;
    let value = '';
    if (raw[0] === '"' || raw[0] === "'") {
      const quote = raw[0];
      let closed = false;
      for (let i = 1; ; i++) {
        if (i >= raw.length) {
          if (++line >= lines.length) break;
          raw += '\n' + lines[line];
        }
        const char = raw[i];
        if (char === quote) {
          if (raw.slice(i + 1).trim()) throw new Error(`Лишний текст после кавычек EnvironmentFile: ${line + 1}.`);
          closed = true;
          break;
        }
        if (quote === '"' && char === '\\') {
          if (i + 1 === raw.length && line + 1 < lines.length) raw += '\n' + lines[++line];
          const next = raw[i + 1];
          if (['"', '\\', '$', '`'].includes(next)) { value += next; i++; continue; }
          if (next === '\n') { i++; continue; }
        }
        value += char;
      }
      if (!closed) throw new Error(`Незакрытые кавычки EnvironmentFile: ${line + 1}.`);
    } else {
      while (/(?:^|[^\\])(?:\\\\)*\\$/.test(raw)) {
        if (++line >= lines.length) throw new Error('Незавершённая строка EnvironmentFile.');
        raw = raw.slice(0, -1) + lines[line];
      }
      value = raw.replace(/\\(.)/g, '$1').trim();
    }
    if (value.includes('\0')) throw new Error('NUL в EnvironmentFile недопустим.');
    result[key] = value;
  }
  return result;
}

export function serializeEnvironment(values) {
  return '# Managed by the DragoNet proxy installer. Root-only; never commit this file.\n'
    + Object.entries(values).map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || String(value).includes('\0')) throw new Error('Некорректное поле env.');
      const escaped = String(value).replace(/[\\"$`]/g, char => '\\' + char);
      return `${key}="${escaped}"\n`;
    }).join('');
}

export function validatePath(value, kind = 'каталог') {
  if (!/^\/[A-Za-z0-9._/-]+$/.test(value) || value.includes('//') || value.split('/').some(part => part === '.' || part === '..')
    || path.posix.normalize(value) !== value || value.endsWith('/')) {
    throw new Error(`${kind}: нужен абсолютный путь без пробелов, symlink и . / .. .`);
  }
  if (['/', '/etc', '/opt', '/srv', '/var', '/var/lib', '/var/backups', '/usr', '/usr/local', '/usr/local/lib', '/home', '/root', '/tmp', '/run', '/bin', '/sbin'].includes(value)
    || /^\/(?:dev|proc|sys|boot|run|tmp|root|bin|sbin)(?:\/|$)/.test(value)) {
    throw new Error(`${kind}: выбран системный или временный каталог.`);
  }
  return value;
}

export const containsPath = (parent, child) => child === parent || child.startsWith(parent + '/');

export function validateLayout({installDir, envFile, stateDir, backupRoot}) {
  for (const [label, value] of Object.entries({installDir, envFile, stateDir, backupRoot})) validatePath(value, label);
  for (const directory of [installDir, stateDir]) {
    if (/^\/etc(?:\/|$)/.test(directory) || /^\/usr\/(?:bin|sbin|share|include)(?:\/|$)/.test(directory)) throw new Error('Код/state не должны находиться в системных каталогах конфигурации или бинарных файлов.');
  }
  const entries = [installDir, envFile, stateDir, backupRoot];
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    if (containsPath(entries[i], entries[j]) || containsPath(entries[j], entries[i])) throw new Error('Код, env, state и backups должны находиться в отдельных каталогах.');
  }
}

// Paths are restricted to a single safe ASCII token. In particular,
// LoadCredential's source is not a shell string and must not be quoted.
const unitPath = value => value;

export function renderInstallationDropIn({installDir, envFile, stateDir, certificate}) {
  validatePath(installDir); validatePath(envFile); validatePath(stateDir);
  const root = certificate.source === 's-ui' ? '/root/cert' : certificate.source === 'letsencrypt' ? '/etc/letsencrypt/live' : undefined;
  if (!root || !/^[a-zA-Z0-9._-]+$/.test(certificate.name) || certificate.name === '.' || certificate.name === '..') throw new Error('Некорректный источник TLS.');
  const directory = `${root}/${certificate.name}`;
  return `[Service]\nWorkingDirectory=${unitPath(installDir)}\nEnvironmentFile=\nEnvironmentFile=${unitPath(envFile)}\n`
    + `LoadCredential=\nLoadCredential=fullchain.pem:${unitPath(directory + '/fullchain.pem')}\nLoadCredential=privkey.pem:${unitPath(directory + '/privkey.pem')}\n`
    + `ExecStart=\nExecStart=/usr/bin/node ${unitPath(installDir + '/dist/server.js')}\n`
    + `StateDirectory=\nReadWritePaths=\nReadWritePaths=${unitPath(stateDir)}\n`;
}

/** Build and tests precede downtime. Recovery never rolls back the live SQLite. */
export async function executeDeployment(operations) {
  await operations.prepare();
  let maintenance = false;
  try {
    maintenance = true;
    await operations.stop();
    await operations.backup();
    await operations.activate();
    await operations.start();
    await operations.verify();
  } catch (error) {
    if (maintenance) {
      try { await operations.rollback(); }
      catch { throw new Error(`${error.message} Автоматический откат не завершён; используйте резервную копию и journal.`); }
    }
    throw error;
  }
}

export function sanitizedChildEnvironment(env = process.env) {
  const result = {...env, NODE_ENV: 'development'};
  for (const key of Object.keys(result)) {
    if (key in DEFAULTS || key === 'CREDENTIALS_DIRECTORY' || key === 'NODE_OPTIONS' || key.startsWith('NPM_CONFIG_') || key.startsWith('npm_config_')) delete result[key];
  }
  return result;
}
