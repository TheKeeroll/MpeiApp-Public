/// <reference types="node" />
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import YAML from 'yaml';

const migration = require('../scripts/migrate-rn-pods.cjs');
const dependencies = {...migration.TARGET_PACKAGES};
const initial = {
  'React-Core': '0.87.1', ReactCodegen: '0.87.1', FBLazyVector: '0.87.1', fmt: '11.0.2',
  RNReanimated: '4.6.0', RNWorklets: '0.12.1', RNGestureHandler: '3.2.1',
  NitroMmkv: '4.3.2', YandexMobileAds: '8.5.0', ChartboostSDK: '9.13.0', YandexMapsMobile: '4.19.0-full',
};
const targets = {'React-Core': '0.88.1', ReactCodegen: '0.88.1', FBLazyVector: '0.88.1', RNReanimated: '4.7.1', RNWorklets: '0.13.1', RNGestureHandler: '3.4.0'};
const lock = (overrides: Record<string, string> = {}) => {
  const versions = {...initial, ...overrides} as Record<string, string>;
  const spec = (name: string) => `${name} (${versions[name]})`;
  return YAML.stringify({
    PODS: [
      {[spec('React-Core')]: ['React-Core/Default', 'FBLazyVector', 'fmt']},
      {[`React-Core/Default (${versions['React-Core']})`]: ['FBLazyVector']},
      {[spec('ReactCodegen')]: ['React-Core']},
      ...Object.keys(versions).filter(name => !['React-Core', 'ReactCodegen'].includes(name)).map(spec),
    ],
    'EXTERNAL SOURCES': {
      'React-Core': {':path': 'build/rncore-facades/React-Core'},
      FBLazyVector: {':path': 'build/rncore-facades/FBLazyVector'},
      fmt: {':path': 'build/rndeps-facades/fmt'},
      ReactCodegen: {':path': 'build/generated/ios'},
      NitroMmkv: {':path': '../node_modules/react-native-mmkv'},
    },
    COCOAPODS: '1.17.0',
  });
};
const source = lock();
const plan = () => migration.planMigration(source, dependencies, migration.lockHash(source));

test('migration unlocks RN facades, generated pods, subspec dependencies and animation/gesture pods only', () => {
  const result = plan();
  expect(result.pods).toEqual(['FBLazyVector', 'RNGestureHandler', 'RNReanimated', 'RNWorklets', 'React-Core', 'ReactCodegen', 'fmt']);
  expect(result.protectedVersions).toEqual(expect.arrayContaining([
    ['YandexMobileAds', '8.5.0'], ['ChartboostSDK', '9.13.0'], ['YandexMapsMobile', '4.19.0-full'], ['NitroMmkv', '4.3.2'],
  ]));
});

test('the source fingerprint is stable between Windows and macOS checkout line endings', () => {
  expect(migration.lockHash(source.replace(/\n/g, '\r\n'))).toBe(migration.lockHash(source));
  expect(migration.planMigration(source.replace(/\n/g, '\r\n'), dependencies, migration.lockHash(source))).toEqual(plan());
});

test('unknown source locks and unrelated upgrades fail before invoking the resolver', () => {
  expect(() => migration.planMigration(source, dependencies)).toThrow('Unrecognized source Podfile.lock');
  expect(() => migration.planMigration(source, {...dependencies, 'react-native': '0.89.0'}, migration.lockHash(source))).toThrow('only the pinned RN 0.88.1');
});

test('a committed resolved lockfile skips migration, including subsequent properly locked RN upgrades', () => {
  expect(migration.planMigration(lock(targets), dependencies)).toBeNull();
  expect(migration.planMigration(lock({...targets, 'React-Core': '0.89.0'}), {...dependencies, 'react-native': '0.89.0'})).toBeNull();
});

test('resolver output accepts the new RN set and its updated C++ dependency without changing unrelated SDKs', () => {
  expect(() => migration.verifyMigration(lock({...targets, fmt: '12.0.0'}), plan())).not.toThrow();
});

test.each(['YandexMobileAds', 'ChartboostSDK', 'YandexMapsMobile', 'NitroMmkv'])(
  'resolver output rejects an unrelated upgrade of %s', pod => {
    expect(() => migration.verifyMigration(lock({...targets, [pod]: '99.0.0'}), plan())).toThrow(pod);
  },
);

test.each(['React-Core', 'RNReanimated', 'RNWorklets', 'RNGestureHandler'])(
  'resolver output rejects an unresolved target %s', pod => {
    expect(() => migration.verifyMigration(lock({...targets, [pod]: initial[pod as keyof typeof initial]}), plan())).toThrow(pod);
  },
);

test('resolver output cannot change the locked CocoaPods toolchain', () => {
  expect(() => migration.verifyMigration(lock(targets).replace('1.17.0', '1.18.0'), plan())).toThrow('toolchain');
});

test('normal Cloud installs do not invoke pod update after the resolved lockfile has been committed', () => {
  const root = mkdtempSync(join(tmpdir(), 'mpei-rn-pods-'));
  try {
    mkdirSync(join(root, 'ios'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({dependencies}));
    writeFileSync(join(root, 'ios/Podfile.lock'), lock(targets));
    const run = jest.fn();
    migration.migrate(root, '2.4.10', run);
    expect(run).not.toHaveBeenCalled();
  } finally {
    if (!basename(root).startsWith('mpei-rn-pods-') || dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected fixture directory.');
    rmSync(root, {recursive: true, force: true});
  }
});
