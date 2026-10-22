/// <reference types="node" />
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const cloud = require('../scripts/xcode-cloud.cjs');
const repository = resolve(__dirname, '..');
const version = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')).version;
const projectFile = 'ios/MpeiApp.xcodeproj/project.pbxproj';
let root: string;
const write = (name: string, content: string) => {
  const path = join(root, name);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, content);
};
const loadTS = (source: string) => {
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}, reportDiagnostics: true});
  expect(compiled.diagnostics).toEqual([]);
  const exports = {} as Record<string, any>;
  runInNewContext(compiled.outputText, {exports});
  return exports;
};
const variables = () => {
  const env: Record<string, string> = {
    MPEIAPP_YANDEX_MAPS_API_KEY: 'test-map-key',
    MPEIAPP_DRAGONET_PROXY_DOMAIN: 'proxy.example.org',
    MPEIAPP_DRAGONET_PROXY_PATH: '/private-endpoint',
    MPEIAPP_DRAGONET_TELEGRAM_URL: 'https://t.me/example_bot',
  };
  for (const placement of cloud.PLACEMENTS) env[cloud.AD_VARIABLE('ios', placement)] = `R-M-fixture-${placement}`;
  return env;
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mpei-xcode-cloud-'));
  for (const name of ['package.json', projectFile, 'android/app/build.gradle', 'Gemfile']) write(name, readFileSync(join(repository, name), 'utf8'));
  write('Gemfile.lock', 'GEM\n  specs:\n    cocoapods (1.17.0)\n    xcodeproj (1.28.1)\n\nBUNDLED WITH\n   2.4.10\n');
  write('ios/Podfile.lock', 'COCOAPODS: 1.17.0\n');
});
afterEach(() => {
  if (!basename(root).startsWith('mpei-xcode-cloud-') || dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected fixture directory.');
  rmSync(root, {recursive: true, force: true});
});

test('generated client exports match the public template, keep one maps key and optional Android IDs', () => {
  const env = {...variables(), MPEIAPP_YANDEX_MAPS_API_KEY: 'key"\\(mustRemainLiteral)'};
  const generated = cloud.renderClientConfiguration(cloud.readClientConfiguration(env));
  const parsed = loadTS(generated.typescript);
  const template = loadTS(readFileSync(join(repository, 'src/config/Secrets.example.ts'), 'utf8'));
  expect(Object.keys(parsed).sort()).toEqual(Object.keys(template).sort());
  for (const platform of ['ios', 'android']) expect(Object.keys(parsed.YANDEX_AD_UNIT_IDS[platform]).sort()).toEqual(Object.keys(template.YANDEX_AD_UNIT_IDS[platform]).sort());
  expect(parsed.YANDEX_MAPS_API_KEY).toBe(env.MPEIAPP_YANDEX_MAPS_API_KEY);
  expect(generated.swift).toContain('YMKMapKit.setApiKey("key\\"\\\\(mustRemainLiteral)")');
  expect(generated.swift).toContain('static let shared = YandexMapsInitializer()');
  expect(parsed.DRAGONET_PROXY_PORT).toBe(8443);
  expect(parsed.YANDEX_AD_UNIT_IDS.android.rewarded).toBe('');
  expect(parsed.YANDEX_AD_UNIT_IDS.ios.rewarded).toBe('R-M-fixture-rewarded');
});

test.each([
  ['MPEIAPP_YANDEX_MAPS_API_KEY', ''],
  ['MPEIAPP_DRAGONET_PROXY_DOMAIN', 'example.org:8443'],
  ['MPEIAPP_DRAGONET_PROXY_DOMAIN', 'https://example.org'],
  ['MPEIAPP_DRAGONET_PROXY_PATH', '/bad?token=secret-marker'],
  ['MPEIAPP_DRAGONET_PROXY_PORT', '65536'],
  ['MPEIAPP_DRAGONET_SUBSCRIPTION_PATH_PREFIX', '/bad//path'],
  ['MPEIAPP_DRAGONET_TELEGRAM_URL', 'http://t.me/example_bot'],
  ['MPEIAPP_YANDEX_AD_IOS_REWARDED', 'demo-rewarded-yandex'],
  ['MPEIAPP_YANDEX_AD_IOS_INLINE_BANNER_MARKS', ''],
])('rejects invalid %s and reports only the variable name', (name, value) => {
  const env = {...variables(), [name]: value};
  expect(() => cloud.readClientConfiguration(env)).toThrow(name);
  if (value) {
    try { cloud.readClientConfiguration(env); }
    catch (error) { expect((error as Error).message).not.toContain(value); }
  }
});

test('an optional Android ID is preserved when supplied', () => {
  const env = {...variables(), MPEIAPP_YANDEX_AD_ANDROID_REWARDED: 'R-M-android-fixture'};
  expect(cloud.readClientConfiguration(env).YANDEX_AD_UNIT_IDS.android.rewarded).toBe('R-M-android-fixture');
});

test('consecutive dev and v2 builds use the assigned Cloud number without changing the version', () => {
  const original = readFileSync(join(root, projectFile), 'utf8');
  const count = [...original.matchAll(/CURRENT_PROJECT_VERSION\s*=/g)].length;
  for (const [branch, number] of [['dev', '120'], ['v2', '121'], ['dev', '122']]) {
    expect(cloud.prepareBuild(root, {...variables(), CI_BRANCH: branch, CI_BUILD_NUMBER: number}, "/opt/a'b/node")).toEqual({version, build: number});
    const project = readFileSync(join(root, projectFile), 'utf8');
    expect([...project.matchAll(/CURRENT_PROJECT_VERSION\s*=\s*([^;]+);/g)].map(match => match[1])).toEqual(Array(count).fill(number));
    expect(cloud.releaseVersion(root)).toBe(version);
  }
  expect(readFileSync(join(root, 'ios/.xcode.env.local'), 'utf8')).toContain("export NODE_BINARY='/opt/a'\"'\"'b/node'");
  expect(loadTS(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).YANDEX_MAPS_API_KEY).toBe('test-map-key');
});

test.each([undefined, '', '0', '-1', '1.2', '42; false'])('rejects an invalid build number %s before touching configuration', value => {
  write('src/config/Secrets.ts', 'local configuration');
  expect(() => cloud.prepareBuild(root, {...variables(), CI_BUILD_NUMBER: value})).toThrow('CI_BUILD_NUMBER');
  expect(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).toBe('local configuration');
});

test('invalid secrets leave the existing configuration and build number untouched', () => {
  write('src/config/Secrets.ts', 'local configuration');
  const before = readFileSync(join(root, projectFile), 'utf8');
  expect(() => cloud.prepareBuild(root, {CI_BUILD_NUMBER: '99'})).toThrow('Missing/invalid Cloud variables');
  expect(readFileSync(join(root, projectFile), 'utf8')).toBe(before);
  expect(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).toBe('local configuration');
});

test('the CLI changes configuration only in the matching Cloud product checkout', () => {
  write('scripts/xcode-cloud.cjs', readFileSync(join(repository, 'scripts/xcode-cloud.cjs'), 'utf8'));
  write('src/config/Secrets.ts', 'local configuration');
  const result = spawnSync(process.execPath, [join(root, 'scripts/xcode-cloud.cjs'), 'prepare'], {
    env: {...process.env, ...variables(), CI_XCODE_CLOUD: '', CI_PRIMARY_REPOSITORY_PATH: root}, encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('only changes files in the primary Xcode Cloud checkout');
  expect(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).toBe('local configuration');
  expect(result.stdout + result.stderr).not.toContain('test-map-key');
  const env = {...process.env, ...variables(), CI_XCODE_CLOUD: 'TRUE', CI_PRIMARY_REPOSITORY_PATH: root, CI_BUILD_NUMBER: '123', CI_BUNDLE_ID: 'another.bundle'};
  const wrongProduct = spawnSync(process.execPath, [join(root, 'scripts/xcode-cloud.cjs'), 'prepare'], {env, encoding: 'utf8'});
  expect(wrongProduct.status).toBe(1);
  expect(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).toBe('local configuration');
  const prepared = spawnSync(process.execPath, [join(root, 'scripts/xcode-cloud.cjs'), 'prepare'], {
    env: {...env, CI_BUNDLE_ID: 'ru.noobdragons.mpeiapp'}, encoding: 'utf8',
  });
  expect(prepared.stderr).toBe('');
  expect(prepared.status).toBe(0);
  expect(prepared.stdout).toContain(`${version} (123)`);
  expect(prepared.stdout).not.toContain('test-map-key');
  expect(loadTS(readFileSync(join(root, 'src/config/Secrets.ts'), 'utf8')).YANDEX_MAPS_API_KEY).toBe('test-map-key');
});

test('lockfile preflight accepts the resolved tools and rejects stale CocoaPods/Pods resolution', () => {
  expect(cloud.validateToolchainLocks(root)).toBe('2.4.10');
  write('Gemfile.lock', '    cocoapods (1.15.2)\n    xcodeproj (1.25.1)\nBUNDLED WITH\n   2.4.10\n');
  expect(() => cloud.validateToolchainLocks(root)).toThrow('macOS resolver');
  write('Gemfile.lock', '    cocoapods (1.17.0)\n    xcodeproj (1.28.1)\nBUNDLED WITH\n   2.4.10\n');
  write('ios/Podfile.lock', 'COCOAPODS: 1.15.2\n');
  expect(() => cloud.validateToolchainLocks(root)).toThrow('bundle exec pod install');
});

test('release metadata rejects a preview version or a mismatched native target', () => {
  expect(cloud.releaseVersion(root)).toBe(version);
  write(projectFile, readFileSync(join(root, projectFile), 'utf8').replace(/(MARKETING_VERSION\s*=\s*)[^;]+;/, (_match, prefix) => `${prefix}0.0.0;`));
  expect(() => cloud.releaseVersion(root)).toThrow('Synchronize MARKETING_VERSION');
  write('package.json', '{"version":"2.6.0-preview"}');
  expect(() => cloud.releaseVersion(root)).toThrow('release version');
});

test('archive metadata verifies both targets, marketing/build numbers and the minimum iOS', () => {
  const app = {CFBundleIdentifier: 'ru.NoobDragons.MpeiApp', CFBundleShortVersionString: version, CFBundleVersion: '122', MinimumOSVersion: '15.6.0'};
  const widget = {...app, CFBundleIdentifier: 'ru.NoobDragons.MpeiApp.ScheduleWidget', MinimumOSVersion: '17.0'};
  expect(() => cloud.validateArchiveMetadata(app, widget, version, '122')).not.toThrow();
  expect(() => cloud.validateArchiveMetadata(app, {...widget, CFBundleVersion: '1'}, version, '122')).toThrow('widget version/build');
  expect(() => cloud.validateArchiveMetadata({...app, MinimumOSVersion: '16.0'}, widget, version, '122')).toThrow('MinimumOSVersion');
  expect(() => cloud.validateArchiveMetadata(app, {...widget, CFBundleIdentifier: 'another.bundle'}, version, '122')).toThrow('bundle identifier');
});
