// Keep GitHub-readable Markdown/SVGs static, with values derived from the project.
const {readFileSync, writeFileSync, existsSync, mkdtempSync, unlinkSync, rmdirSync} = require('node:fs');
const {join, resolve} = require('node:path');
const {tmpdir} = require('node:os');
const {spawnSync} = require('node:child_process');

const ROOT = resolve(__dirname, '..');
const METRICS = 'docs/project-metrics.json';
const plural = (count, one, few, many) => count % 100 >= 11 && count % 100 <= 14
  ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many;
const escapeXML = text => String(text).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[character]));
function badge(label, value, color, foreground = '#FFFFFF') {
  const left = Math.ceil(label.length * 6.5 + 14);
  const right = Math.ceil(value.length * 6.5 + 14);
  const width = left + right;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" viewBox="0 0 ${width} 24" role="img" aria-labelledby="title">
  <title id="title">${escapeXML(label)}: ${escapeXML(value)}</title>
  <clipPath id="corners"><rect width="${width}" height="24" rx="4"/></clipPath>
  <g clip-path="url(#corners)">
    <path fill="#303746" d="M0 0h${left}v24H0z"/>
    <path fill="${color}" d="M${left} 0h${right}v24H${left}z"/>
    <path fill="#FFFFFF" fill-opacity=".08" d="M0 0h${width}v1H0z"/>
  </g>
  <g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="${left / 2}" y="16" fill="#FFFFFF">${escapeXML(label)}</text>
    <text x="${left + right / 2}" y="16" fill="${foreground}">${escapeXML(value)}</text>
  </g>
</svg>
`;
}
function metricsFromResults(results) {
  if (!results.success || results.wasInterrupted || results.numFailedTests || results.numFailedTestSuites
    || !Number.isInteger(results.numPassedTests) || results.numPassedTests < 1
    || !Number.isInteger(results.numPassedTestSuites) || results.numPassedTestSuites < 1) {
    throw new Error('Only a complete successful Jest run can update the README metrics.');
  }
  return {schemaVersion: 1, jest: {tests: results.numPassedTests, suites: results.numPassedTestSuites}};
}
function buildDocs(root, metrics) {
  if (metrics?.schemaVersion !== 1 || !Number.isInteger(metrics.jest?.tests) || metrics.jest.tests < 1
    || !Number.isInteger(metrics.jest?.suites) || metrics.jest.suites < 1) throw new Error('Invalid project test metrics.');
  const read = path => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
  const pkg = JSON.parse(read('package.json'));
  const deps = {...pkg.dependencies, ...pkg.devDependencies};
  const node = read('.nvmrc').trim().split('.')[0];
  const ios = read('ios/Podfile').match(/minimum_ios_version\s*=\s*'([^']+)'/)?.[1];
  const androidAPI = read('android/build.gradle').match(/minSdkVersion\s*=\s*(\d+)/)?.[1];
  if (!ios || !androidAPI || !/^\d+$/.test(node)) throw new Error('Platform minimums/Node version could not be read.');
  const android = ({24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16', 37: '17'})[androidAPI] ?? `API ${androidAPI}`;
  const chips = [
    ['react-native', 'React Native', deps['react-native'], '#61DAFB', '#11283F', `React Native ${deps['react-native']}`],
    ['react', 'React', deps.react, '#61DAFB', '#11283F', `React ${deps.react}`],
    ['typescript', 'TypeScript', deps.typescript, '#3178C6', '#FFFFFF', `TypeScript ${deps.typescript}`],
    ['node', 'Node.js', node, '#5FA04E', '#FFFFFF', `Node.js ${node}`],
    ['android', 'Android', `${android}+`, '#3DDC84', '#10251B', `Android ${android} и новее · Google Play`],
    ['ios', 'iOS', `${ios}+`, '#007AFF', '#FFFFFF', `iOS ${ios} и новее · App Store`],
    ['jest', 'Jest', `${metrics.jest.tests} tests`, '#C21325', '#FFFFFF', `${metrics.jest.tests} ${plural(metrics.jest.tests, 'тест', 'теста', 'тестов')} Jest`],
  ];
  const files = {[METRICS]: JSON.stringify(metrics, null, 2) + '\n'};
  let readme = read('README.md');
  for (const [name, label, value, color, foreground, alt] of chips) {
    if (typeof value !== 'string') throw new Error(`Missing dependency version for ${name}.`);
    files[`assets/images/README/badges/${name}.svg`] = badge(label, value, color, foreground);
    const pattern = new RegExp(`(<img src="\\./assets/images/README/badges/${name}\\.svg" alt=")[^"]*("[^>]*>)`);
    if (!pattern.test(readme)) throw new Error(`Missing README chip ${name}.`);
    readme = readme.replace(pattern, (_, before, after) => before + alt + after);
  }
  const replaceBlock = (name, content) => {
    const pattern = new RegExp(`(<!-- project:${name}:start -->)\\n[\\s\\S]*?\\n(<!-- project:${name}:end -->)`);
    if (!pattern.test(readme)) throw new Error(`Missing generated README block ${name}.`);
    readme = readme.replace(pattern, (_, start, end) => `${start}\n${content}\n${end}`);
  };
  replaceBlock('stack', `| Область | Технологии и назначение |
| --- | --- |
| **Клиент** | TypeScript ${deps.typescript}, React ${deps.react}, React Native ${deps['react-native']}; общий код Android и iOS. |
| **Интерфейс** | React Native Paper, React Navigation ${deps['@react-navigation/native'].split('.')[0]}, Reanimated ${deps['react-native-reanimated']}, Worklets ${deps['react-native-worklets']}, Gesture Handler, Safe Area Context, Lottie и Vector Icons. |
| **Состояние и хранение** | Redux Toolkit для учебных данных и статусов разделов; MMKV для локального кеша, настроек, последних и избранных расписаний. |
| **Разбор данных** | Отдельные HTML/JSON-парсеры; самостоятельный HTTPS-клиент расписаний с отменой и ограничением времени поиска. |
| **Нативные возможности** | Яндекс Карты через react-native-yamap, Vision Camera для QR, геолокация и смена иконок. |
| **Виджеты** | Android: Java, AppWidgetProvider и RemoteViews. iOS: Swift, WidgetKit, App Intents и общий App Group. |
| **Реклама** | Yandex Mobile Ads ${deps['yandex-mobile-ads']}; медиация BIGO Ads и VK Реклама; inline, sticky и rewarded. |
| **DragoNet proxy** | Node.js ${node}, TypeScript, Fastify, Zod, SQLite / better-sqlite3; HTTPS и systemd на VPS. |
| **Инструменты** | Yarn Classic и lockfiles, Metro, patch-package; Gradle для Android, CocoaPods / Xcode для iOS. |`);
  replaceBlock('tests', `Клиент: **${metrics.jest.tests} ${plural(metrics.jest.tests, 'тест', 'теста', 'тестов')} Jest в ${metrics.jest.suites} ${plural(metrics.jest.suites, 'наборе', 'наборах', 'наборах')}** — результат последнего полного успешного прогона.`);
  files['README.md'] = readme;
  return files;
}
function syncDocs(root, metrics, check = false) {
  const files = buildDocs(root, metrics);
  const changed = Object.entries(files).filter(([file, content]) => !existsSync(join(root, file))
    || readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n') !== content);
  if (check && changed.length) throw new Error(`Generated README metadata is stale: ${changed.map(([file]) => file).join(', ')}. Run yarn test:ci locally and commit the result.`);
  if (!check) for (const [file, content] of changed) writeFileSync(join(root, file), content);
  return changed.map(([file]) => file);
}
function runTests(args = []) {
  const directory = mkdtempSync(join(tmpdir(), 'mpei-jest-metrics-'));
  const resultPath = join(directory, 'results.json');
  try {
    const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--ci', '--runInBand', '--json', '--outputFile', resultPath, ...args], {cwd: ROOT, stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    // Filtered/name-selected runs must never replace the complete-project count.
    if (args.length) { console.log('Filtered Jest run: project metrics unchanged.'); return 0; }
    const metrics = metricsFromResults(JSON.parse(readFileSync(resultPath, 'utf8')));
    syncDocs(ROOT, metrics, process.env.CI === 'true');
    console.log(`README metadata ${process.env.CI === 'true' ? 'verified' : 'updated'}: ${metrics.jest.tests} tests / ${metrics.jest.suites} suites.`);
    return 0;
  } finally {
    if (existsSync(resultPath)) unlinkSync(resultPath);
    rmdirSync(directory); // Only our known file and now-empty temporary directory.
  }
}
if (require.main === module) {
  try {
    const mode = process.argv[2];
    if (mode === 'test') process.exitCode = runTests(process.argv.slice(3));
    else if (mode === 'sync' || mode === 'check') {
      const changed = syncDocs(ROOT, JSON.parse(readFileSync(join(ROOT, METRICS), 'utf8')), mode === 'check');
      console.log(mode === 'check' ? 'README metadata is current.' : `Updated ${changed.length} generated documentation files.`);
    } else throw new Error('Usage: node scripts/project-docs.cjs test [Jest arguments] | sync | check');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {metricsFromResults, buildDocs, syncDocs};
