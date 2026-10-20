import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, chmodSync, renameSync, unlinkSync, readdirSync, cpSync} from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Writable} from 'node:stream';
import {loadConfig} from '../src/config.ts';
import {discoverInstallerCertificates} from '../src/startupDiscovery.ts';
import {DEFAULTS, DATABASE_FILES, parseEnvironment, serializeEnvironment, validatePath, validateLayout, containsPath, renderInstallationDropIn, executeDeployment, sanitizedChildEnvironment, assertNoSymlinks, makeParents, atomicWrite, restoreFileSnapshots, copyClosedState, serviceFlags} from './setup-lib.mjs';

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METADATA = '/etc/dragonet-subscription-proxy-installation.json';
const BACKUPS = '/var/backups/dragonet-subscription-proxy';
const USER = 'dragonet-proxy';
const PREFIX = '/etc/systemd/system';
const TEMPLATES = ['dragonet-subscription-proxy@.service', 'dragonet-subscription-proxy-certificate-reload@.service', 'dragonet-subscription-proxy-certificate-reload@.path'];
const C = {green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', reset: '\x1b[0m'};
const separator = '*'.repeat(64);
const stage = (number, text) => console.log(`\n${separator}\n[${number}/8] ${text}`);
const ok = text => console.log(`${C.green}[OK] ${text}${C.reset}`);
const warn = text => console.log(`${C.yellow}${text}${C.reset}`);
const info = text => console.log(`${C.yellow}[ДЕЙСТВИЕ] ${text}${C.reset}`);
let cancelled = false;
let recovering = false;
const checkCancellation = () => { if (cancelled && !recovering) throw new Error('Установка прервана пользователем.'); };

function run(command, args = [], {cwd, capture = false, allowFailure = false, timeout = 120000} = {}) {
  checkCancellation();
  const result = spawnSync(command, args, {
    cwd, timeout, encoding: 'utf8', env: {...sanitizedChildEnvironment(), SYSTEMD_COLORS: '0', SYSTEMD_PAGER: ''},
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', maxBuffer: 16 * 1024 * 1024,
  });
  if ((result.status !== 0 || result.error) && !allowFailure) {
    const operation = command === 'systemctl' ? `${command} ${args[0] ?? ''}`.trim() : command;
    throw new Error(`Команда ${operation} не завершена успешно (код ${result.status ?? 'timeout/exec'}).`);
  }
  return {success: result.status === 0 && !result.error, output: (result.stdout ?? '').trim(),
    status: result.status, errorOutput: (result.stderr ?? '').trim(), executionError: result.error ? (result.error.code ?? 'exec_error') : undefined};
}

export function ask(label, {current = '', example = '', secret = false, optional = false} = {}, {input = process.stdin, output = process.stdout} = {}) {
  const hint = secret ? (current ? 'скрытый ввод; Enter — сохранить текущее значение' : `скрытый ввод${example ? `; пример: ${example}` : ''}`)
    : (current ? `Enter — ${current}` : example || (optional ? 'пусто; "-" — очистить' : 'обязательно'));
  const prompt = `${C.yellow}[ВВОД] ${label} [${hint}]: ${C.reset}`;
  return new Promise((resolve, reject) => {
    let muted = false;
    const terminalOutput = secret ? new Writable({write(chunk, encoding, callback) {
      // Forward the initial prompt synchronously; suppress only subsequent input echo.
      if (!muted) output.write(chunk, encoding);
      callback();
    }}) : output;
    if (secret) Object.defineProperty(terminalOutput, 'columns', {get: () => output.columns});
    const rl = createInterface({input, output: terminalOutput, terminal: true});
    let done = false;
    rl.once('SIGINT', () => rl.close());
    rl.once('close', () => {
      if (!done) {
        done = true; muted = false; output.write('\n');
        reject(new Error('Установка прервана пользователем.'));
      }
    });
    // readline must own the prompt, otherwise its first ANSI refresh erases it.
    rl.question(prompt, answer => {
      done = true; muted = false; rl.close();
      if (secret) output.write('\n');
      if (/[\u0000-\u001f\u007f]/u.test(answer)) { reject(new Error('Управляющие символы во вводе недопустимы.')); return; }
      resolve(answer === '-' && optional ? '' : answer || current);
    });
    muted = secret;
  });
}

async function required(label, options) {
  for (;;) {
    const value = await ask(label, options);
    if (value) return value;
    warn('Введите значение; пример в скобках не является действующей конфигурацией.');
  }
}

async function pick(label, choices, preferred = 0) {
  for (;;) {
    const value = await ask(label, {current: String(preferred + 1)});
    const index = Number(value) - 1;
    if (Number.isInteger(index) && index >= 0 && index < choices.length) return choices[index];
    warn(`Введите номер от 1 до ${choices.length}.`);
  }
}

function readEnvironment(filename) {
  assertNoSymlinks(filename);
  return existsSync(filename) ? parseEnvironment(readFileSync(filename, 'utf8')) : {};
}

function validateProject(directory) {
  if (!existsSync(directory)) return;
  assertNoSymlinks(directory);
  const message = `Каталог ${directory} не является установленным vpn-subscription-proxy; он не будет заменён.`;
  let project;
  try {
    project = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  } catch { throw new Error(message); }
  if (project?.name !== 'vpn-subscription-proxy') throw new Error(message);
}

function validateState(directory) {
  assertNoSymlinks(directory);
  if (!existsSync(directory)) return;
  if (!lstatSync(directory).isDirectory() || readdirSync(directory).some(name => !DATABASE_FILES.includes(name))) {
    throw new Error(`State ${directory} содержит посторонние файлы; автоматическое изменение прав запрещено.`);
  }
  for (const name of DATABASE_FILES) {
    const filename = path.join(directory, name);
    assertNoSymlinks(filename);
    if (existsSync(filename) && !lstatSync(filename).isFile()) throw new Error(`Ожидался обычный файл SQLite: ${filename}`);
  }
}

const validService = value => /^dragonet-subscription-proxy@[a-zA-Z0-9._-]+\.service$/.test(value);
const watcherFor = service => service.replace('dragonet-subscription-proxy@', 'dragonet-subscription-proxy-certificate-reload@').replace(/\.service$/, '.path');
const reloaderFor = service => watcherFor(service).replace(/\.path$/, '.service');

function stateOf(unit, execute = run) {
  return serviceFlags(
    execute('systemctl', ['show', '--property=ActiveState', '--value', unit], {capture: true, allowFailure: true}).output,
    execute('systemctl', ['is-enabled', unit], {capture: true, allowFailure: true}).output,
  );
}

export function previousService(metadata, execute = run, progress = () => {}) {
  if (metadata.service && !validService(metadata.service)) throw new Error('Некорректный service в файле установки.');
  progress('systemctl list-unit-files: поиск установленных proxy instances...');
  const files = execute('systemctl', ['list-unit-files', '--type=service', '--no-legend', '--no-pager', 'dragonet-subscription-proxy@*.service'], {capture: true, allowFailure: true});
  // systemd 247 returns ENOENT (exit 1) for an empty list, without diagnostics.
  // Other failures, including D-Bus/permissions/exec errors, must still stop setup.
  const emptyList = files.status === 1 && !files.output && !files.errorOutput && !files.executionError;
  if (!files.success && !emptyList) {
    const diagnostic = files.errorOutput ? ` ${files.errorOutput.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')}` : '';
    throw new Error(`Команда systemctl list-unit-files не завершена успешно (код ${files.status ?? 'timeout/exec'}).${diagnostic}`);
  }
  progress('systemctl list-units: поиск загруженных proxy instances...');
  const loaded = execute('systemctl', ['list-units', '--all', '--plain', '--type=service', '--no-legend', '--no-pager', 'dragonet-subscription-proxy@*.service'], {capture: true}).output;
  const choices = [...new Set((files.output + '\n' + loaded).split('\n').map(line => line.trim().split(/\s+/)[0]).filter(validService))];
  const enabled = choices.filter(unit => {
    progress(`Проверка состояния ${unit}...`);
    const s = stateOf(unit, execute); return s.active || s.enabled;
  });
  if (enabled.length < 2) return enabled[0] ?? metadata.service;
  throw new Error('Найдено несколько активных/включённых proxy instances. Автоустановка рассчитана на один proxy; сначала выберите единственную рабочую установку вручную.');
}

async function configuration(metadata) {
  const oldEnvFile = metadata.envFile ?? '/etc/dragonet-subscription-proxy.env';
  validatePath(oldEnvFile, 'EnvironmentFile');
  const envFile = validatePath(await required('EnvironmentFile', {current: oldEnvFile}), 'EnvironmentFile');
  info('Чтение существующего env; значения Token и HMAC не выводятся.');
  if (envFile !== oldEnvFile && existsSync(envFile) && Object.keys(readEnvironment(oldEnvFile)).length) throw new Error('Новый env-путь уже занят; существующий файл не будет затёрт.');
  const oldEnvironment = readEnvironment(oldEnvFile);
  const existing = Object.keys(oldEnvironment).length ? oldEnvironment : readEnvironment(envFile);
  ok(Object.keys(existing).length ? 'Существующие настройки загружены; Enter сохраняет текущее значение.' : 'Env не найден: выполняется первичная настройка.');
  const env = {...DEFAULTS, ...existing};
  const installDir = validatePath(await required('Каталог кода', {current: metadata.installDir ?? '/opt/vpn-subscription-proxy'}));
  env.STATE_DIRECTORY = validatePath(await required('Каталог SQLite state', {current: env.STATE_DIRECTORY}));
  info('Проверка путей кода/env/state и наличия прежней SQLite...');
  const oldStateDir = existing.STATE_DIRECTORY ?? env.STATE_DIRECTORY;
  validatePath(oldStateDir, 'Прежний state');
  validateLayout({installDir, envFile, stateDir: env.STATE_DIRECTORY, backupRoot: BACKUPS});
  validateState(oldStateDir); validateState(env.STATE_DIRECTORY);
  if (oldStateDir !== env.STATE_DIRECTORY && existsSync(path.join(env.STATE_DIRECTORY, DATABASE_FILES[0]))) throw new Error('Новый state уже содержит БД; автоматическое объединение запрещено.');
  const oldInstallDir = metadata.installDir ?? installDir;
  validatePath(oldInstallDir); validateProject(oldInstallDir);
  validateLayout({installDir: oldInstallDir, envFile: oldEnvFile, stateDir: oldStateDir, backupRoot: BACKUPS});
  for (const code of [installDir, oldInstallDir]) for (const protectedPath of [envFile, oldEnvFile, env.STATE_DIRECTORY, oldStateDir, BACKUPS]) {
    if (containsPath(code, protectedPath) || containsPath(protectedPath, code)) throw new Error('Прежние и новые пути кода/env/state/backups пересекаются.');
  }
  if (installDir !== oldInstallDir && existsSync(installDir)) throw new Error('Новый каталог кода уже занят.');
  if (containsPath(installDir, SOURCE) && SOURCE !== installDir) throw new Error('Распакуйте исходники вне каталога заменяемого релиза.');
  if (existsSync(path.join(oldStateDir, DATABASE_FILES[0])) && !existing.DEMO_COOLDOWN_HMAC_KEY) throw new Error('Найдена SQLite без HMAC-ключа. Восстановите прежний env до установки.');
  if (!env.DEMO_COOLDOWN_HMAC_KEY) env.DEMO_COOLDOWN_HMAC_KEY = randomBytes(32).toString('hex');
  ok(existing.DEMO_COOLDOWN_HMAC_KEY ? 'Текущий HMAC-ключ сохранён (не отображается).' : 'Сгенерирован новый HMAC-ключ (не отображается).');

  const fields = [
    ['PROXY_LISTEN_HOST', 'Адрес listener'], ['PROXY_LISTEN_PORT', 'Публичный порт proxy'], ['PROXY_REQUEST_PATH', 'Путь запросов MpeiApp'],
    ['VPN_PANEL_BASE_URL', 'HTTPS URL S-UI с закрытым путём', 'https://panel.example.com:2053/panel-secret', true],
    ['VPN_PANEL_TOKEN', 'Token S-UI (скрытый ввод)', 'вставьте Token', true], ['VPN_DEMO_INBOUNDS', 'Demo inbound ID в JSON'],
    ['VPN_SUBSCRIPTION_PORT', 'Порт подписки S-UI'], ['VPN_SUBSCRIPTION_PATH_PREFIX', 'Префикс пути подписки'],
  ];
  for (const [key, label, example = '', secret = false] of fields) env[key] = await required(label, {current: env[key], example, secret});
  if ((await ask('Изменить дополнительные лимиты/настройки? y/N', {current: 'N'})).toLowerCase() === 'y') {
    for (const key of ['REQUEST_TIMEOUT_MS', 'REQUEST_RATE_LIMIT_MAX', 'REQUEST_RATE_LIMIT_WINDOW_SECONDS', 'VERIFY_CACHE_TTL_SECONDS', 'MAX_REQUEST_BODY_BYTES', 'TRUSTED_REVERSE_PROXY_IPS', 'DEMO_VLESS_FLOW']) {
      env[key] = await ask(key, {current: env[key], optional: key === 'TRUSTED_REVERSE_PROXY_IPS'});
    }
  }
  if (!['0.0.0.0', '::', '127.0.0.1', '::1'].includes(env.PROXY_LISTEN_HOST)) throw new Error('Для loopback healthz выберите listener 0.0.0.0 или :: (обычно 0.0.0.0).');
  if (['127.0.0.1', '::1'].includes(env.PROXY_LISTEN_HOST)) warn('Выбран loopback listener: приложение извне не подключится без отдельного TCP-проброса.');
  for (const key of ['PROXY_LISTEN_PORT', 'VPN_SUBSCRIPTION_PORT', 'REQUEST_TIMEOUT_MS', 'REQUEST_RATE_LIMIT_MAX', 'REQUEST_RATE_LIMIT_WINDOW_SECONDS', 'VERIFY_CACHE_TTL_SECONDS', 'MAX_REQUEST_BODY_BYTES']) {
    if (!/^\d+$/.test(env[key])) throw new Error(`В ${key} допустимо только целое число.`);
  }
  env.PROXY_REQUEST_PATH = loadConfig(env).requestPath;
  for (const [key, value] of Object.entries(existing)) {
    if (value !== env[key] && ['PROXY_LISTEN_PORT', 'PROXY_REQUEST_PATH'].includes(key)) warn(`${key} изменён: уже выпущенная MpeiApp 2.5.0 должна использовать прежний endpoint.`);
  }
  return {installDir, oldInstallDir, envFile, oldEnvFile, oldStateDir, env};
}

async function chooseCertificate(preferred) {
  const result = await discoverInstallerCertificates();
  console.log(`Публичный IPv4: ${result.publicIpv4}`);
  for (const reason of result.rejected) warn(`Пропущено: ${reason}`);
  const trusted = [];
  for (const candidate of result.candidates) {
    const hostnames = candidate.hostnames.filter(hostname => run('openssl', ['verify', '-purpose', 'sslserver', '-verify_hostname', hostname, '-untrusted', candidate.certificatePath, candidate.certificatePath], {capture: true, allowFailure: true, timeout: 10000}).success);
    if (hostnames.length) trusted.push({...candidate, hostnames});
    else warn(`Пропущено ${candidate.source}/${candidate.name}: цепочка не доверена ОС или имя не подходит сертификату.`);
  }
  result.candidates = trusted;
  if (!result.candidates.length) throw new Error('Нет подходящей TLS-пары. Выпустите/продлите сертификат в S-UI или Certbot и проверьте единственную A-запись домена.');
  result.candidates.forEach((candidate, index) => console.log(`${index + 1}. ${candidate.source}: ${candidate.name}; DNS: ${candidate.hostnames.join(', ')}; до ${candidate.validTo}; SHA-256 ${candidate.fingerprint.slice(0, 23)}…`));
  const previous = Math.max(0, result.candidates.findIndex(item => item.source === preferred.certificate?.source && item.name === preferred.certificate?.name));
  const certificate = result.candidates.length === 1 ? result.candidates[0] : await pick('Какую TLS-пару использовать?', result.candidates, previous);
  let hostname = certificate.hostnames[0];
  if (certificate.hostnames.length > 1) {
    certificate.hostnames.forEach((name, index) => console.log(`${index + 1}. ${name}`));
    hostname = await pick('DNS-имя proxy для MpeiApp', certificate.hostnames, Math.max(0, certificate.hostnames.indexOf(preferred.hostname)));
  }
  if (preferred.hostname && preferred.hostname !== hostname) warn('DNS-имя изменилось. Для MpeiApp 2.5.0 нужно сохранить её прежний публичный endpoint.');
  ok(`Выбрано ${certificate.source}/${certificate.name}, ${hostname}.`);
  return {certificate, hostname};
}

function createUser() {
  const account = run('getent', ['passwd', USER], {capture: true, allowFailure: true});
  if (account.success) {
    const parts = account.output.split(':');
    if (parts[2] === '0' || !/(?:nologin|false)$/.test(parts[6] ?? '')) throw new Error('dragonet-proxy уже существует как интерактивный/root пользователь; остановка для проверки.');
  } else run('useradd', ['--system', '--user-group', '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', USER]);
  const group = run('getent', ['group', USER], {capture: true, allowFailure: true});
  if (!group.success) run('groupadd', ['--system', USER]);
  else if (group.output.split(':')[2] === '0') throw new Error('Группа dragonet-proxy не должна иметь GID 0.');
}

function copySources(destination) {
  for (const entry of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'src', 'test', 'deploy', 'README.md', 'UPDATING.md', '.env.example', 'S_UI_API_V2_1_6_5_CONTRACT.md']) {
    const source = path.join(SOURCE, entry);
    if (existsSync(source)) cpSync(source, path.join(destination, entry), {recursive: true, filter: filename => {
      if (lstatSync(filename).isSymbolicLink()) throw new Error('Symlink в архиве исходников не поддерживается.');
      return true;
    }});
  }
}

async function checkPanel(staging, env) {
  const {VpnPanelClient} = await import(pathToFileURL(path.join(staging, 'dist/vpnPanelClient.js')).href);
  const config = loadConfig(env);
  const panel = new VpnPanelClient(config.panelBaseUrl, config.panelToken, config.requestTimeoutMs);
  let response;
  try { response = await panel.getClients(); }
  catch (error) {
    const details = error.details ?? {};
    throw new Error(`Проверка S-UI: ${details.category ?? 'transport_error'}${details.httpStatus ? `, HTTP ${details.httpStatus}` : ''}${details.code ? `, ${details.code}` : ''}. Проверьте URL/Token и TLS панели; они не выводятся. Работающий proxy не остановлен.`);
  }
  if (response.success !== true) throw new Error('S-UI не принял Token/запрос списка клиентов. Текущая установка не остановлена.');
  ok('Панель S-UI доступна, Token принят (read-only проверка, без создания demo).');
}

function health(hostname, env) {
  const port = Number(env.PROXY_LISTEN_PORT);
  const address = env.PROXY_LISTEN_HOST.includes(':') ? '[::1]' : '127.0.0.1';
  const request = endpoint => run('curl', ['--fail', '--silent', '--show-error', '--noproxy', '*', '--connect-timeout', '2', '--max-time', '5', '--resolve', `${hostname}:${port}:${address}`, `https://${hostname}:${port}/${endpoint}`], {capture: true, allowFailure: true, timeout: 7000});
  return {request};
}

function statePermissions(directory) {
  makeParents(path.dirname(directory));
  run('install', ['-d', '-o', USER, '-g', USER, '-m', '0700', '--', directory]);
  for (const name of DATABASE_FILES) {
    const filename = path.join(directory, name);
    if (existsSync(filename)) { run('chown', [`${USER}:${USER}`, '--', filename]); chmodSync(filename, 0o600); }
  }
}

export async function install() {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || !process.stdin.isTTY) throw new Error('Запускайте deploy/install.sh от root в интерактивной Linux SSH-сессии.');
  stage(2, 'Пути, env и сервисный пользователь');
  info(`Чтение метаданных установки: ${METADATA}`);
  let metadata = {};
  assertNoSymlinks(METADATA);
  if (existsSync(METADATA)) {
    const message = 'Файл метаданных установки повреждён; восстановите его из backup.';
    try {
      metadata = JSON.parse(readFileSync(METADATA, 'utf8'));
    }
    catch { throw new Error(message); }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(message);
  }
  ok(existsSync(METADATA) ? 'Метаданные прежней установки прочитаны.' : 'Метаданных прежней установки нет.');
  const oldService = previousService(metadata, run, info);
  ok(oldService ? `Найден прежний proxy: ${oldService}` : 'Прежний proxy instance не найден; это допустимо для новой установки.');
  if (oldService && (!existsSync(METADATA) || metadata.service !== oldService)) {
    info('Чтение путей из прежнего systemd unit...');
    const directory = run('systemctl', ['show', '--property=WorkingDirectory', '--value', oldService], {capture: true}).output;
    try { metadata.installDir = validatePath(directory); } catch { /* ask for a path if the old unit omitted it */ }
    const environment = run('systemctl', ['show', '--property=EnvironmentFiles', '--value', oldService], {capture: true}).output;
    const match = /^(\/[A-Za-z0-9._/-]+) \(ignore_errors=(?:yes|no)\)$/.exec(environment);
    if (match) metadata.envFile = match[1];
  }
  info('Настройка env и путей. Жёлтая строка [ВВОД] означает ожидание ответа; Enter сохраняет текущее значение. Обязательные поля нужно заполнить.');
  const plan = await configuration(metadata);
  ok('Параметры env и пути проверены.');
  info(`Проверка/создание служебного пользователя и группы ${USER}...`);
  createUser();
  ok('Пути проверены; сервисный пользователь готов.');
  stage(3, 'Поиск и выбор TLS-пары');
  const selected = await chooseCertificate({...metadata, hostname: plan.env.PROXY_PUBLIC_HOST || metadata.hostname});
  Object.assign(plan, selected);
  plan.env.PROXY_PUBLIC_HOST = selected.hostname;
  loadConfig(plan.env);
  const service = `dragonet-subscription-proxy@${plan.certificate.name}.service`;
  const watcher = watcherFor(service);
  const reloader = reloaderFor(service);
  const managed = [...new Set([oldService, oldService && watcherFor(oldService), oldService && reloaderFor(oldService), service, watcher, reloader].filter(Boolean))];
  const before = new Map();
  const id = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
  const staging = `${plan.installDir}.release-${id}`;
  const previous = `${plan.oldInstallDir}.previous-${id}`;
  const failed = `${plan.installDir}.failed-${id}`;
  const backup = `${BACKUPS}/${id}`;
  const snapshots = new Map();
  const initialEnv = !existsSync(plan.oldEnvFile) && !existsSync(plan.envFile);
  checkCancellation();
  if (initialEnv && !oldService) {
    atomicWrite(plan.envFile, serializeEnvironment(plan.env), 0o600);
    ok('Новая конфигурация сохранена root-only; при ошибке подготовки её можно использовать повторно.');
  }
  let swapped = false;
  let movedPrevious = false;
  let migration = false;
  const saveFile = filename => {
    if (snapshots.has(filename)) return;
    assertNoSymlinks(filename);
    snapshots.set(filename, existsSync(filename) ? {content: readFileSync(filename), mode: lstatSync(filename).mode & 0o777} : undefined);
  };
  const write = (filename, value, mode = 0o644) => { saveFile(filename); atomicWrite(filename, value, mode); };
  const stopManaged = () => {
    for (const unit of managed.filter(name => name !== service && name !== oldService)) run('systemctl', ['stop', unit], {capture: true, allowFailure: true});
    for (const unit of [...new Set([service, oldService].filter(Boolean))]) {
      const loaded = run('systemctl', ['show', '--property=LoadState', '--value', unit], {capture: true, allowFailure: true});
      if (loaded.output !== 'not-found' && loaded.success) run('systemctl', ['stop', unit]);
    }
  };
  await executeDeployment({
    prepare: async () => {
      stage(4, 'Подготовка релиза без остановки текущего proxy');
      console.log(`Staging: ${staging}`);
      makeParents(path.dirname(staging));
      mkdirSync(staging, {mode: 0o700}); copySources(staging);
      info('Установка npm-зависимостей candidate release...');
      run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], {cwd: staging, timeout: 1800000});
      run('npm', ['run', 'prepare:sqlite'], {cwd: staging, timeout: 1920000});
      info('Typecheck, тесты и сборка proxy...');
      run('npm', ['run', 'typecheck'], {cwd: staging, timeout: 600000});
      run('npm', ['test'], {cwd: staging, timeout: 600000});
      run('npm', ['run', 'build'], {cwd: staging, timeout: 600000});
      await checkPanel(staging, plan.env);
      run('npm', ['prune', '--omit=dev', '--no-audit', '--no-fund'], {cwd: staging, timeout: 600000});
      run('npm', ['run', 'check:sqlite'], {cwd: staging, timeout: 60000});
      run('chown', ['-R', 'root:root', '--', staging]); run('chmod', ['-R', 'a+rX', '--', staging]);
      for (const unit of managed) before.set(unit, stateOf(unit));
      ok('Зависимости, typecheck, тесты, сборка и доступ к S-UI проверены.');
    },
    stop: async () => { stage(5, 'Остановка и резервная копия'); stopManaged(); },
    backup: async () => {
      makeParents(BACKUPS); mkdirSync(backup, {mode: 0o700}); chmodSync(backup, 0o700);
      if (existsSync(plan.oldStateDir)) cpSync(plan.oldStateDir, path.join(backup, 'state'), {recursive: true});
      for (const filename of [...TEMPLATES.map(name => `${PREFIX}/${name}`), plan.envFile, plan.oldEnvFile, METADATA,
        `${PREFIX}/${service}.d/20-s-ui-tls.conf`, `${PREFIX}/${service}.d/30-installation.conf`]) saveFile(filename);
      let index = 0;
      const manifest = [];
      for (const [filename, snapshot] of snapshots) {
        if (snapshot) writeFileSync(path.join(backup, `file-${index}`), snapshot.content, {mode: 0o600});
        manifest.push({filename, backup: snapshot ? `file-${index}` : null, mode: snapshot?.mode}); index++;
      }
      writeFileSync(path.join(backup, 'files.json'), JSON.stringify(manifest, null, 2), {mode: 0o600});
      writeFileSync(path.join(backup, 'services.json'), JSON.stringify(Object.fromEntries(before), null, 2), {mode: 0o600});
      writeFileSync(path.join(backup, 'candidate.env'), serializeEnvironment(plan.env), {mode: 0o600});
      writeFileSync(path.join(backup, 'deployment.json'), JSON.stringify({installDir: plan.installDir, oldInstallDir: plan.oldInstallDir, envFile: plan.envFile, oldEnvFile: plan.oldEnvFile, stateDir: plan.env.STATE_DIRECTORY, oldStateDir: plan.oldStateDir, service, oldService, staging, previous, failed}, null, 2), {mode: 0o600});
      ok(`Резервная копия env/state/systemd: ${backup}`);
    },
    activate: async () => {
      stage(6, 'Установка кода, env и прав');
      if (existsSync(plan.oldInstallDir)) { renameSync(plan.oldInstallDir, previous); movedPrevious = true; }
      renameSync(staging, plan.installDir); swapped = true;
      atomicWrite(plan.envFile, serializeEnvironment(plan.env), 0o600);
      if (plan.oldStateDir !== plan.env.STATE_DIRECTORY && existsSync(plan.oldStateDir)) {
        copyClosedState(plan.oldStateDir, plan.env.STATE_DIRECTORY);
      }
      migration = plan.oldStateDir !== plan.env.STATE_DIRECTORY;
      statePermissions(plan.env.STATE_DIRECTORY);
      run('runuser', ['-u', USER, '--', 'test', '-r', path.join(plan.installDir, 'dist/server.js')]);
      run('runuser', ['-u', USER, '--', 'test', '-w', plan.env.STATE_DIRECTORY]);
      for (const template of TEMPLATES) write(`${PREFIX}/${template}`, readFileSync(path.join(plan.installDir, 'deploy', template), 'utf8').replace(/\r\n/g, '\n'));
      const legacy = `${PREFIX}/${service}.d/20-s-ui-tls.conf`;
      if (existsSync(legacy)) unlinkSync(legacy);
      write(`${PREFIX}/${service}.d/30-installation.conf`, renderInstallationDropIn({...plan, stateDir: plan.env.STATE_DIRECTORY}));
      write(METADATA, JSON.stringify({installDir: plan.installDir, envFile: plan.envFile, stateDir: plan.env.STATE_DIRECTORY, certificate: {source: plan.certificate.source, name: plan.certificate.name}, hostname: plan.hostname, service, backup, previousDirectory: movedPrevious ? previous : null}, null, 2) + '\n', 0o600);
      ok('Код — root-owned; env 0600; state 0700 для dragonet-proxy.');
    },
    start: async () => {
      stage(7, 'Обновление systemd и запуск service/watcher');
      run('systemctl', ['daemon-reload']);
      run('systemd-analyze', ['verify', service, watcher, reloader]);
      if (oldService && oldService !== service) {
        run('systemctl', ['disable', oldService, watcherFor(oldService)], {capture: true});
        run('systemctl', ['disable', '--runtime', oldService, watcherFor(oldService)], {capture: true, allowFailure: true});
      }
      run('systemctl', ['reset-failed', service, watcher, reloader], {capture: true, allowFailure: true});
      run('systemctl', ['enable', service, watcher]);
      run('systemctl', ['restart', service]); run('systemctl', ['restart', watcher]);
      ok('Service и watcher включены и перезапущены.');
    },
    verify: async () => {
      stage(8, 'HTTPS, статистика и итоговый статус');
      const {request} = health(plan.hostname, plan.env);
      const deadline = Date.now() + 90000;
      let healthy = false;
      do {
        const result = request('healthz');
        if (result.success) {
          try { healthy = JSON.parse(result.output).status === 'ok'; } catch { /* retry until deadline */ }
        }
        if (!healthy) await new Promise(resolve => setTimeout(resolve, 2000));
      } while (!healthy && Date.now() < deadline);
      if (!healthy) throw new Error('HTTPS /healthz не прошёл за 90 секунд. Проверьте DNS, сертификат и journal.');
      const stats = request('stats');
      if (!stats.success || !Number.isFinite(JSON.parse(stats.output).successfulVerifyRequests)) throw new Error('Не удалось проверить /stats.');
      run('systemctl', ['is-active', '--quiet', service]); run('systemctl', ['is-active', '--quiet', watcher]);
      run('systemctl', ['is-enabled', '--quiet', service]); run('systemctl', ['is-enabled', '--quiet', watcher]);
      ok('HTTPS/SNI/цепочка доверия, /healthz, /stats, service и watcher исправны.');
      const ufw = run('sh', ['-c', 'command -v ufw >/dev/null && LC_ALL=C ufw status | head -n 1'], {capture: true, allowFailure: true});
      if (ufw.output.includes('Status: active')) {
        if (run('ufw', ['allow', `${plan.env.PROXY_LISTEN_PORT}/tcp`], {capture: true, allowFailure: true}).success) ok('Активный UFW: TCP-порт proxy разрешён.');
        else warn('Не удалось добавить UFW-правило; откройте TCP-порт вручную.');
      }
      warn(`Проверьте firewall провайдера и локальный nftables/firewalld, если он используется: TCP ${plan.env.PROXY_LISTEN_PORT}. Сертификат продлевает S-UI/acme.sh либо Certbot; watcher только перечитывает файлы.`);
      console.log(`\n${separator}`);
      ok(`Proxy готов: https://${plan.hostname}:${plan.env.PROXY_LISTEN_PORT}${plan.env.PROXY_REQUEST_PATH}`);
      console.log(`Service: ${service}\nWatcher: ${watcher}\nEnv: ${plan.envFile}\nState: ${plan.env.STATE_DIRECTORY}\nBackup: ${backup}`);
      console.log(`Журнал: journalctl -u '${service}' -f -o cat`);
    },
    rollback: async () => {
      recovering = true;
      warn('Ошибка установки: возвращаю прежний код, env и systemd. Актуальная SQLite не откатывается.');
      stopManaged();
      for (const unit of managed) {
        run('systemctl', ['disable', unit], {capture: true, allowFailure: true});
        run('systemctl', ['disable', '--runtime', unit], {capture: true, allowFailure: true});
      }
      if (swapped && existsSync(plan.installDir)) renameSync(plan.installDir, failed);
      if (movedPrevious) renameSync(previous, plan.oldInstallDir);
      restoreFileSnapshots(snapshots, initialEnv ? new Set([plan.envFile]) : new Set());
      if (migration && existsSync(path.join(plan.env.STATE_DIRECTORY, DATABASE_FILES[0]))) {
        // A newly chosen state can have live writes after startup: retain these
        // when returning the old env to its original state path.
        copyClosedState(plan.env.STATE_DIRECTORY, plan.oldStateDir);
        statePermissions(plan.oldStateDir);
      }
      run('systemctl', ['daemon-reload']);
      for (const [unit, previousState] of before) {
        if (previousState.enabled) run('systemctl', ['enable', ...(previousState.runtime ? ['--runtime'] : []), unit]);
        if (previousState.active) run('systemctl', ['start', unit]);
      }
      if (initialEnv) warn(`Первичная установка не завершена. Env сохранён для повтора: ${plan.envFile}; backup: ${backup}.`);
      else ok(`Прежние код/env/units восстановлены, состояние запуска восстановлено командами systemd; backup: ${backup}. Проверьте journal.`);
      if (swapped) warn(`Ошибочный релиз сохранён: ${failed}`);
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const onSignal = () => { cancelled = true; warn('Получен сигнал отмены; текущая операция завершится, затем выполнится восстановление.'); };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, onSignal);
  install().catch(error => {
    console.error(`\n${C.red}[ОШИБКА] ${error.message}${C.reset}`);
    process.exitCode = 1;
  }).finally(() => { for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, onSignal); });
}
