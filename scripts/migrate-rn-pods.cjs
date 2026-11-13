// Transitional Cloud resolver for the RN 0.88.1 / Ads 8.6.0 migration. Once the generated
// Podfile.lock is committed, this becomes a no-op before pod install --deployment.
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {join, resolve} = require('node:path');
const YAML = require('yaml');

const SOURCE_LOCK_HASH = '0f77cb94925d605e939aa0d24a1c5efd2c15624b03fb7060a4f4285c7a67aba1';
const TARGET_PACKAGES = {
  'react-native': '0.88.1',
  'react-native-reanimated': '4.7.1',
  'react-native-worklets': '0.13.1',
  'react-native-gesture-handler': '3.4.0',
  'yandex-mobile-ads': '8.6.0',
};
const POD_PACKAGES = {
  'React-Core': 'react-native',
  RNReanimated: 'react-native-reanimated',
  RNWorklets: 'react-native-worklets',
  RNGestureHandler: 'react-native-gesture-handler',
  YandexMobileAds: 'yandex-mobile-ads',
  'yandex-mobile-ads': 'yandex-mobile-ads',
};
const ADAPTER_VERSIONS = {BigoADSYandexMobileAdsAdapters: '5.0.6.6', MyTargetYandexMobileAdsAdapters: '5.45.0.0'};
const REMOVED_PODS = ['ChartboostSDK', 'ChartboostYandexMobileAdsAdapters'];
const rootName = spec => spec.split(/[\s(/]/)[0];
const lockHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function parseLock(text) {
  const lock = YAML.parse(text);
  if (!Array.isArray(lock?.PODS)) throw new Error('Invalid CocoaPods lockfile: PODS is missing.');
  const versions = new Map();
  const graph = new Map();
  for (const entry of lock.PODS) {
    const [spec, dependencies] = typeof entry === 'string' ? [entry, []] : Object.entries(entry)[0];
    const match = spec.match(/^(\S+) \(([^)]+)\)$/);
    if (!match || !Array.isArray(dependencies)) throw new Error('Invalid CocoaPods spec in lockfile.');
    const name = rootName(match[1]);
    if (versions.has(name) && versions.get(name) !== match[2]) throw new Error(`Conflicting locked versions of ${name}.`);
    versions.set(name, match[2]);
    const children = graph.get(name) ?? new Set();
    for (const dependency of dependencies) children.add(rootName(dependency));
    graph.set(name, children);
  }
  return {lock, versions, graph};
}

function expectedVersions(dependencies) {
  return [...Object.entries(POD_PACKAGES).map(([pod, name]) => [pod, dependencies[name]]), ...Object.entries(ADAPTER_VERSIONS)];
}

function planMigration(text, dependencies, sourceHash = SOURCE_LOCK_HASH) {
  const {lock, versions, graph} = parseLock(text);
  const expected = expectedVersions(dependencies);
  if (expected.every(([pod, version]) => version && versions.get(pod) === version) && REMOVED_PODS.every(name => !versions.has(name))) return null;
  if (Object.entries(TARGET_PACKAGES).some(([name, version]) => dependencies[name] !== version)) {
    throw new Error('This Cloud migration supports only the pinned RN 0.88.1 / Ads 8.6.0 dependency set. Resolve Pods on macOS.');
  }
  if (lockHash(text) !== sourceHash) {
    throw new Error('Unrecognized source Podfile.lock; the one-time RN / Ads migration will not change it. Resolve Pods on macOS.');
  }

  const affected = new Set([...Object.keys(POD_PACKAGES), ...Object.keys(ADAPTER_VERSIONS), ...REMOVED_PODS]);
  for (const [name, source] of Object.entries(lock['EXTERNAL SOURCES'] ?? {})) {
    if (Object.values(source).some(value => /node_modules\/react-native\/|build\/(?:rncore|rndeps)-facades\//.test(String(value))) ||
        ['ReactCodegen', 'ReactAppDependencyProvider'].includes(name)) affected.add(name);
  }
  // Unlock the RN dependency closure too (including subspecs and shared C++ pods),
  // Ads adapters and their dependency closure are updated too; unrelated modules
  // and maps stay locked. Removed SDKs are allowed to disappear, never to remain.
  for (const name of affected) for (const child of graph.get(name) ?? []) affected.add(child);
  return {
    pods: [...affected].filter(name => versions.has(name) && !REMOVED_PODS.includes(name)).sort(),
    expected,
    protectedVersions: [...versions].filter(([name]) => !affected.has(name)),
    cocoapods: lock.COCOAPODS,
  };
}

function verifyMigration(text, plan) {
  const {lock, versions} = parseLock(text);
  for (const [name, version] of [...plan.expected, ...plan.protectedVersions]) {
    if (versions.get(name) !== version) throw new Error(`Pod migration changed or failed to resolve ${name}; expected ${version}.`);
  }
  if (lock.COCOAPODS !== plan.cocoapods) throw new Error('The Pod migration changed the CocoaPods toolchain.');
  if (REMOVED_PODS.some(name => versions.has(name))) throw new Error('The Pod migration retained Chartboost.');
}

function migrate(root, bundler, run = execFileSync) {
  if (!/^\d+\.\d+\.\d+$/.test(bundler ?? '')) throw new Error('Pass the Bundler version from Gemfile.lock.');
  const dependencies = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies;
  const path = join(root, 'ios/Podfile.lock');
  const plan = planMigration(readFileSync(path, 'utf8'), dependencies);
  if (!plan) {
    console.log('[Pods] React Native and Ads versions match the committed lockfile; using deployment install.');
    return;
  }
  for (const [name, version] of Object.entries(TARGET_PACKAGES)) {
    if (JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version !== version) {
      throw new Error(`Install frozen Yarn dependencies before resolving ${name}.`);
    }
  }
  console.log(`[Pods] One-time RN 0.88.1 / Ads 8.6.0 migration: updating ${plan.pods.length} related pods.`);
  run('bundle', [`_${bundler}_`, 'exec', 'pod', 'update', ...plan.pods, '--no-repo-update'], {cwd: join(root, 'ios'), stdio: 'inherit'});
  verifyMigration(readFileSync(path, 'utf8'), plan);
  console.log('[Pods] Native migration resolved; unrelated SDK versions preserved. Recover and commit Podfile.lock from the log backup.');
}

if (require.main === module) {
  try { migrate(resolve(__dirname, '..'), process.argv[2]); }
  catch (error) { console.error(`[Pods] ${error.message}`); process.exitCode = 1; }
}
module.exports = {SOURCE_LOCK_HASH, TARGET_PACKAGES, lockHash, planMigration, verifyMigration, migrate};
