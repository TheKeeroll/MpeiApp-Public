import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, renameSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {assertNoSymlinks, sanitizedChildEnvironment} from './setup-lib.mjs';

const SELF = fileURLToPath(import.meta.url);
const PROJECT = path.resolve(path.dirname(SELF), '..');
const C = {green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', reset: '\x1b[0m'};
const diagnostic = text => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');

/** Opening a database, not just importing JS, actually loads the native addon. */
export function probeSQLite(directory) {
  const require = createRequire(path.join(path.resolve(directory), 'package.json'));
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE native_probe (value INTEGER NOT NULL)');
    db.transaction(() => db.prepare('INSERT INTO native_probe VALUES (?)').run(42))();
    if (db.prepare('SELECT value FROM native_probe').get().value !== 42) throw new Error('SQLite read/write probe failed');
    return {ok: true, version: db.prepare('SELECT sqlite_version() AS version').get().version};
  } finally { db.close(); }
}

function probeProcess(directory, execute, env) {
  const result = execute(process.execPath, [SELF, '--probe'], {cwd: directory, env, encoding: 'utf8',
    timeout: 30000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe']});
  if (result.error || result.signal || result.status === null) {
    throw new Error(`Проверка SQLite не завершена: ${result.error?.code ?? result.signal ?? 'exec_error'}.`);
  }
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { throw new Error('Проверка SQLite вернула некорректную диагностику.'); }
  if (result.status === 0 && report?.ok === true && typeof report.version === 'string') return report;
  if (result.status !== 0 && report?.ok === false && typeof report.code === 'string' && typeof report.message === 'string') return report;
  throw new Error('Неожиданный результат проверки SQLite.');
}

/** Run only against the candidate release, before stopping the live service. */
export function ensureSQLite(directory, {execute = spawnSync, log = console.log, env = process.env, repair = true} = {}) {
  const root = path.resolve(directory);
  const packageDirectory = path.join(root, 'node_modules', 'better-sqlite3');
  assertNoSymlinks(packageDirectory);
  if (!existsSync(path.join(packageDirectory, 'package.json'))) throw new Error('better-sqlite3 не установлен; сначала выполните npm ci --include=dev.');
  const childEnv = sanitizedChildEnvironment(env);
  log(`${C.yellow}[SQLite] Проверка загрузки native-модуля, транзакции и чтения/записи в памяти...${C.reset}`);
  let report = probeProcess(root, execute, childEnv);
  if (!report.ok) {
    const reason = `${report.code}: ${diagnostic(report.message)}`;
    const nativeFailure = report.code === 'ERR_DLOPEN_FAILED'
      || (report.code === 'MODULE_NOT_FOUND' && /\.node|better_sqlite3/.test(report.message));
    if (!repair || !nativeFailure) throw new Error(`SQLite не прошла проверку: ${reason}`);
    log(`${C.yellow}[SQLite] Native-модуль несовместим или отсутствует: ${reason}${C.reset}`);
    const gyp = path.join(root, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
    assertNoSymlinks(gyp);
    if (!existsSync(gyp)) throw new Error('Для сборки SQLite нужен node-gyp из devDependencies; выполните npm ci --include=dev.');

    // better-sqlite3 13 prefers a shipped prebuild even when build/Release exists.
    // Keep the vendor files for diagnosis, but remove them from the loader's path.
    const prebuilds = path.join(packageDirectory, 'prebuilds');
    assertNoSymlinks(prebuilds);
    if (existsSync(prebuilds)) {
      const disabled = `${prebuilds}.disabled-${randomBytes(6).toString('hex')}`;
      renameSync(prebuilds, disabled);
      log(`${C.yellow}[SQLite] Готовые бинарники отключены в candidate release: ${disabled}${C.reset}`);
    }
    log(`${C.yellow}[SQLite] Сборка на этом VPS под его glibc: node-gyp rebuild, один процесс. Это может занять несколько минут.${C.reset}`);
    const args = [gyp, 'rebuild', '--release', '--force_build=1', '--jobs=1'];
    if (process.platform === 'linux') args.push('--python=/usr/bin/python3');
    const build = execute(process.execPath, args, {cwd: packageDirectory, env: childEnv, stdio: 'inherit', timeout: 1800000});
    if (build.status !== 0 || build.error || build.signal) {
      throw new Error(`Не удалось собрать SQLite (код ${build.status ?? build.error?.code ?? build.signal ?? 'exec_error'}). Проверьте вывод node-gyp выше; текущий proxy не остановлен.`);
    }
    report = probeProcess(root, execute, childEnv);
    if (!report.ok) throw new Error(`Собранная SQLite не загружается: ${report.code}: ${diagnostic(report.message)}`);
  }
  log(`${C.green}[OK] SQLite ${report.version}: native-модуль, транзакция и чтение/запись работают.${C.reset}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--probe') {
    try { console.log(JSON.stringify(probeSQLite(process.cwd()))); }
    catch (error) {
      console.log(JSON.stringify({ok: false, code: typeof error.code === 'string' ? error.code : 'SQLITE_ERROR', message: error.message}));
      process.exitCode = 1;
    }
  } else {
    try {
      if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Используйте без аргументов или --check.');
      ensureSQLite(PROJECT, {repair: args[0] !== '--check'});
    } catch (error) { console.error(`${C.red}[ОШИБКА] ${error.message}${C.reset}`); process.exitCode = 1; }
  }
}
