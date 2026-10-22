'use strict';

// Only Node built-ins: preflight runs before Yarn installs dependencies.
const {execFileSync} = require('node:child_process');
const {chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync} = require('node:fs');
const {dirname, join, resolve} = require('node:path');

const PROJECT = 'ios/MpeiApp.xcodeproj/project.pbxproj';
const PLACEMENTS = Object.freeze([
  'inlineBannerMarks', 'inlineBannerDrawer', 'inlineBannerScheduleToday', 'inlineBannerGuestScheduleEmpty',
  'stickyBannerLoading', 'stickyBannerSkippedClasses', 'stickyBannerDetailedMarks', 'stickyBannerRecordBook',
  'stickyBannerStipends', 'rewarded',
]);
const AD_VARIABLE = (platform, placement) => `MPEIAPP_YANDEX_AD_${platform.toUpperCase()}_${placement.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;

function configurationVariables() {
  return [
    {name: 'MPEIAPP_YANDEX_MAPS_API_KEY', required: true},
    {name: 'MPEIAPP_DRAGONET_PROXY_DOMAIN', required: true},
    {name: 'MPEIAPP_DRAGONET_PROXY_PATH', required: true},
    {name: 'MPEIAPP_DRAGONET_TELEGRAM_URL', required: true},
    {name: 'MPEIAPP_DRAGONET_PROXY_PORT', required: false, default: 8443},
    {name: 'MPEIAPP_DRAGONET_SUBSCRIPTION_PORT', required: false, default: 443},
    {name: 'MPEIAPP_DRAGONET_SUBSCRIPTION_PATH_PREFIX', required: false, default: '/sub'},
    ...['ios', 'android'].flatMap(platform => PLACEMENTS.map(placement => ({
      name: AD_VARIABLE(platform, placement), required: platform === 'ios',
    }))),
  ];
}

function readClientConfiguration(env) {
  const problems = [];
  const string = (name, required = true, fallback = '') => {
    const value = (env[name] ?? fallback).trim();
    if ((required && !value) || /[\u0000-\u001f\u007f-\u009f]/.test(value)) problems.push(name);
    return value;
  };
  const port = (name, fallback) => {
    const raw = string(name, false, String(fallback));
    const value = Number(raw);
    if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > 65535) problems.push(name);
    return value;
  };
  const path = (name, fallback) => {
    const value = string(name, true, fallback);
    if (value.length < 2 || !value.startsWith('/') || /\/\/|[?#\s]/.test(value)) problems.push(name);
    return value;
  };
  const config = {
    YANDEX_MAPS_API_KEY: string('MPEIAPP_YANDEX_MAPS_API_KEY'),
    DRAGONET_PROXY_DOMAIN: string('MPEIAPP_DRAGONET_PROXY_DOMAIN'),
    DRAGONET_PROXY_PORT: port('MPEIAPP_DRAGONET_PROXY_PORT', 8443),
    DRAGONET_PROXY_PATH: path('MPEIAPP_DRAGONET_PROXY_PATH', ''),
    DRAGONET_SUBSCRIPTION_PORT: port('MPEIAPP_DRAGONET_SUBSCRIPTION_PORT', 443),
    DRAGONET_SUBSCRIPTION_PATH_PREFIX: path('MPEIAPP_DRAGONET_SUBSCRIPTION_PATH_PREFIX', '/sub'),
    DRAGONET_TELEGRAM_URL: string('MPEIAPP_DRAGONET_TELEGRAM_URL'),
    YANDEX_AD_UNIT_IDS: {android: {}, ios: {}},
  };
  try {
    const domain = new URL(`https://${config.DRAGONET_PROXY_DOMAIN}`);
    if (domain.hostname !== config.DRAGONET_PROXY_DOMAIN || domain.host !== config.DRAGONET_PROXY_DOMAIN || domain.port || domain.pathname !== '/' || domain.username || domain.password || domain.search || domain.hash) throw new Error();
  } catch { problems.push('MPEIAPP_DRAGONET_PROXY_DOMAIN'); }
  try {
    const telegram = new URL(config.DRAGONET_TELEGRAM_URL);
    if (telegram.protocol !== 'https:' || telegram.username || telegram.password || telegram.pathname === '/') throw new Error();
  } catch { problems.push('MPEIAPP_DRAGONET_TELEGRAM_URL'); }
  for (const platform of ['ios', 'android']) {
    for (const placement of PLACEMENTS) {
      const name = AD_VARIABLE(platform, placement);
      const value = string(name, platform === 'ios');
      if (value.startsWith('demo-')) problems.push(name);
      config.YANDEX_AD_UNIT_IDS[platform][placement] = value;
    }
  }
  // Report names only. Never include a supplied value, URL, or parser exception.
  if (problems.length) throw new Error(`Missing/invalid Cloud variables: ${[...new Set(problems)].join(', ')}`);
  return config;
}

function swiftString(value) {
  return '"' + [...value].map(char => {
    if (char === '\\') return '\\\\';
    if (char === '"') return '\\"';
    const code = char.codePointAt(0);
    return code < 32 || code === 127 ? `\\u{${code.toString(16)}}` : char;
  }).join('') + '"';
}

function renderClientConfiguration(config) {
  return {
    typescript: '// Generated from Xcode Cloud variables. Do not commit.\n' + Object.entries(config)
      .map(([name, value]) => `export const ${name} = ${JSON.stringify(value, null, 2)}${typeof value === 'object' ? ' as const' : ''};\n`).join(''),
    swift: `// Generated from Xcode Cloud variables. Do not commit.
import YandexMapsMobile

final class YandexMapsInitializer {
  static let shared = YandexMapsInitializer()
  private var initialized = false
  private init() {}

  func initialize() {
    guard !initialized else { return }
    YMKMapKit.setLocale("ru_RU")
    YMKMapKit.setApiKey(${swiftString(config.YANDEX_MAPS_API_KEY)})
    initialized = true
  }
}
`,
  };
}

function writePrivateFile(path, content) {
  mkdirSync(dirname(path), {recursive: true});
  const temporary = `${path}.ci-${process.pid}`;
  try {
    writeFileSync(temporary, content, {mode: 0o600});
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  } finally { rmSync(temporary, {force: true}); }
}

function releaseVersion(root) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('package.json must contain a release version, for example 2.6.0.');
  const project = readFileSync(join(root, PROJECT), 'utf8');
  const versions = [...project.matchAll(/\bMARKETING_VERSION\s*=\s*"?([^;"\r\n]+)"?;/g)].map(match => match[1]);
  const counters = [...project.matchAll(/\bCURRENT_PROJECT_VERSION\s*=/g)];
  if (versions.length < 4 || versions.length !== counters.length || versions.some(value => value !== version)) {
    throw new Error('Synchronize MARKETING_VERSION and CURRENT_PROJECT_VERSION for all app/widget/test configurations.');
  }
  const android = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
  if (!android.includes(`versionName "${version}"`)) throw new Error('Android versionName does not match package.json.');
  return version;
}

function validateToolchainLocks(root) {
  const gemfile = readFileSync(join(root, 'Gemfile'), 'utf8');
  const lock = readFileSync(join(root, 'Gemfile.lock'), 'utf8');
  for (const name of ['cocoapods', 'xcodeproj']) {
    const required = gemfile.match(new RegExp(`^gem '${name}', '([0-9.]+)'$`, 'm'))?.[1];
    const locked = lock.match(new RegExp(`^    ${name} \\(([^)]+)\\)`, 'm'))?.[1];
    if (!required || locked !== required) {
      throw new Error('Gemfile.lock needs the macOS resolver: run bundle update cocoapods xcodeproj, then pod install through Bundler; commit both lockfiles before Cloud.');
    }
  }
  const pods = readFileSync(join(root, 'ios/Podfile.lock'), 'utf8');
  const cocoapods = lock.match(/^    cocoapods \(([^)]+)\)/m)?.[1];
  if (pods.match(/^COCOAPODS: (.+)$/m)?.[1]?.trim() !== cocoapods) {
    throw new Error('ios/Podfile.lock needs bundle exec pod install on macOS before Cloud.');
  }
  const bundler = lock.match(/BUNDLED WITH\s+([0-9.]+)/)?.[1];
  if (!bundler) throw new Error('Gemfile.lock must declare BUNDLED WITH.');
  return bundler;
}

function cloudBuildNumber(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error('CI_BUILD_NUMBER must be a positive integer assigned by Xcode Cloud.');
  return value;
}

function synchronizeBuildNumber(root, value) {
  const number = cloudBuildNumber(value);
  const path = join(root, PROJECT);
  const original = readFileSync(path, 'utf8');
  let count = 0;
  const updated = original.replace(/(\bCURRENT_PROJECT_VERSION\s*=\s*)[^;\r\n]+;/g, (_match, prefix) => {
    count++;
    return `${prefix}${number};`;
  });
  if (count < 4) throw new Error('App and widget must both declare CURRENT_PROJECT_VERSION in Debug/Release.');
  writeFileSync(path, updated);
  return number;
}

function prepareBuild(root, env, node = process.execPath) {
  const version = releaseVersion(root);
  const build = cloudBuildNumber(env.CI_BUILD_NUMBER);
  const config = renderClientConfiguration(readClientConfiguration(env));
  // All validation happens before changing any files.
  synchronizeBuildNumber(root, build);
  writePrivateFile(join(root, 'src/config/Secrets.ts'), config.typescript);
  writePrivateFile(join(root, 'ios/MpeiApp/YandexMapsInitializer.swift'), config.swift);
  const quotedNode = "'" + node.replace(/'/g, "'\"'\"'") + "'";
  writePrivateFile(join(root, 'ios/.xcode.env.local'), `export NODE_BINARY=${quotedNode}\nexport RCT_NO_LAUNCH_PACKAGER=1\n`);
  return {version, build};
}

function validateArchiveMetadata(app, widget, version, number) {
  const build = cloudBuildNumber(number);
  const normalizeOS = value => {
    if (typeof value !== 'string' || !/^\d+(\.\d+){0,2}$/.test(value)) return '';
    const parts = value.split('.').map(Number);
    while (parts.length > 1 && parts[parts.length - 1] === 0) parts.pop();
    return parts.join('.');
  };
  for (const [label, info, minimum, bundle] of [
    ['app', app, '15.6', 'ru.NoobDragons.MpeiApp'],
    ['widget', widget, '17.0', 'ru.NoobDragons.MpeiApp.ScheduleWidget'],
  ]) {
    if (info.CFBundleIdentifier !== bundle) throw new Error(`The archived ${label} bundle identifier is incorrect.`);
    if (info.CFBundleShortVersionString !== version || info.CFBundleVersion !== build) {
      throw new Error(`The archived ${label} version/build differs from package.json or CI_BUILD_NUMBER.`);
    }
    if (normalizeOS(info.MinimumOSVersion) !== normalizeOS(minimum)) throw new Error(`The archived ${label} MinimumOSVersion must be ${minimum}.`);
  }
}

function verifyArchive(root, env) {
  if (!env.CI_ARCHIVE_PATH) throw new Error('CI_ARCHIVE_PATH is missing after the successful archive action.');
  const applications = join(env.CI_ARCHIVE_PATH, 'Products/Applications');
  const apps = readdirSync(applications).filter(name => name.endsWith('.app'));
  if (apps.length !== 1) throw new Error('Expected one iOS application in CI_ARCHIVE_PATH.');
  const app = join(applications, apps[0]);
  const readPlist = path => JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  validateArchiveMetadata(readPlist(join(app, 'Info.plist')), readPlist(join(app, 'PlugIns/ScheduleWidgetExtension.appex/Info.plist')), releaseVersion(root), env.CI_BUILD_NUMBER);
}

function cloudRoot(env) {
  const root = resolve(__dirname, '..');
  if (!/^true$/i.test(env.CI_XCODE_CLOUD ?? '') || !env.CI_PRIMARY_REPOSITORY_PATH || realpathSync(env.CI_PRIMARY_REPOSITORY_PATH) !== realpathSync(root)) {
    throw new Error('This command only changes files in the primary Xcode Cloud checkout.');
  }
  if (env.CI_BUNDLE_ID?.toLowerCase() !== 'ru.noobdragons.mpeiapp') throw new Error('Select the existing MpeiApp product in the recipient account.');
  return root;
}

if (require.main === module) {
  try {
    const command = process.argv[2];
    if (command === 'variables') console.log(JSON.stringify(configurationVariables(), null, 2));
    else if (command === 'preflight') {
      const root = resolve(__dirname, '..');
      const version = releaseVersion(root);
      const bundler = validateToolchainLocks(root);
      if (/^true$/i.test(process.env.CI_XCODE_CLOUD ?? '')) {
        cloudRoot(process.env);
        cloudBuildNumber(process.env.CI_BUILD_NUMBER);
        readClientConfiguration(process.env);
      }
      console.log(`Release ${version}; CocoaPods lockfiles ready; Bundler ${bundler}.`);
    } else if (command === 'prepare') {
      const result = prepareBuild(cloudRoot(process.env), process.env);
      console.log(`Prepared MpeiApp ${result.version} (${result.build}); app and widget share the Cloud build number.`);
    } else if (command === 'verify-archive') {
      verifyArchive(cloudRoot(process.env), process.env);
      console.log('Archive versions, shared build number and minimum iOS verified.');
    } else throw new Error('Usage: node scripts/xcode-cloud.cjs variables|preflight|prepare|verify-archive');
  } catch (error) {
    console.error(`[Xcode Cloud] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {PLACEMENTS, AD_VARIABLE, configurationVariables, readClientConfiguration, renderClientConfiguration,
  releaseVersion, validateToolchainLocks, cloudBuildNumber, synchronizeBuildNumber, prepareBuild, validateArchiveMetadata};
