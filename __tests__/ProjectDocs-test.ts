/// <reference types="node" />
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, basename, resolve} from 'node:path';
const {buildDocs, syncDocs, metricsFromResults} = require('../scripts/project-docs.cjs');

test('failed/interrupted runs cannot publish a green full-project count', () => {
  const valid = {success: true, numPassedTests: 20, numPassedTestSuites: 3, numFailedTests: 0, numFailedTestSuites: 0};
  expect(metricsFromResults(valid).jest).toEqual({tests: 20, suites: 3});
  for (const bad of [{...valid, success: false}, {...valid, wasInterrupted: true}, {...valid, numFailedTests: 1}, {...valid, numPassedTests: 0}]) {
    expect(() => metricsFromResults(bad)).toThrow();
  }
});
test('project versions and actual run counts drive README/SVGs; check mode detects drift without changing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'mpei-docs-'));
  try {
    for (const dir of ['ios', 'android', 'docs', 'assets/images/README/badges']) mkdirSync(join(root, dir), {recursive: true});
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(root, 'README.md'), readFileSync(join(__dirname, '../README.md')));
    writeFileSync(join(root, '.nvmrc'), '24.13.0');
    writeFileSync(join(root, 'ios/Podfile'), "minimum_ios_version = '15.6'");
    writeFileSync(join(root, 'android/build.gradle'), 'minSdkVersion = 24');
    const metrics = {schemaVersion: 1, jest: {tests: 101, suites: 10}};
    syncDocs(root, metrics);
    expect(() => syncDocs(root, metrics, true)).not.toThrow();
    pkg.dependencies['react-native'] = '0.99.9';
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
    const previous = readFileSync(join(root, 'README.md'), 'utf8');
    expect(() => syncDocs(root, metrics, true)).toThrow('stale');
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe(previous);
    const files = buildDocs(root, {schemaVersion: 1, jest: {tests: 123, suites: 11}});
    expect(files['README.md']).toContain('React Native 0.99.9');
    expect(files['README.md']).toContain('123 теста Jest');
    expect(files['assets/images/README/badges/react-native.svg']).toContain('0.99.9');
  } finally {
    if (!basename(root).startsWith('mpei-docs-') || dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected fixture directory.');
    rmSync(root, {recursive: true, force: true});
  }
});
