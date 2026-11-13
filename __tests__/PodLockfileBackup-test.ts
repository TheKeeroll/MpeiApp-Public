/// <reference types="node" />
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';

const {encode, decode, recover} = require('../scripts/pod-lockfile.cjs');
const lock = Buffer.from('# Проверка сохранения UTF-8\nPODS:\n  - Example (1.0.0)\nDEPENDENCIES:\n  - Example\nSPEC CHECKSUMS:\n  Example: "0123456789012345678901234567890123456789"\nPODFILE CHECKSUM: "0123456789012345678901234567890123456789"\nCOCOAPODS: 1.17.0\n');
const cloudLog = (text: string) => text.split('\n').map(line => `2026-11-13T16:00:00Z\t${line}`).join('\r\n');

test.each([lock, Buffer.from(lock.toString().replace(/\n/g, '\r\n'))])('log transport preserves exact bytes with timestamps and LF/CRLF (%#)', bytes => {
  expect(decode(cloudLog(encode(bytes, {CI_BUILD_NUMBER: '17', CI_XCODEBUILD_ACTION: 'archive'})))).toEqual(bytes);
});

test('encoding includes only lockfile data and explicit non-secret build metadata', () => {
  const result = encode(lock, {CI_BUILD_NUMBER: '17', CI_XCODEBUILD_ACTION: 'archive', SECRET_TOKEN: 'must-not-appear'});
  expect(result).toContain('"build":"17"');
  expect(result).not.toContain('must-not-appear');
  expect(result).not.toContain('SECRET_TOKEN');
});

test('versions-only historical logs cannot be mistaken for a lockfile', () => {
  expect(() => decode('Installing React-Core (0.88.1)\nPod installation complete!')).toThrow('No complete Podfile.lock');
  expect(() => encode(Buffer.from('PODS: []\nCOCOAPODS: 1.17.0\n'))).toThrow('complete CocoaPods');
});

test('truncation, missing/reordered chunks and checksum mismatches fail closed', () => {
  const record = encode(lock);
  expect(() => decode(record.split('\n').slice(0, -1).join('\n'))).toThrow('Truncated');
  expect(() => decode(record.replace('_DATA] 0 ', '_DATA] 1 '))).toThrow('chunk');
  expect(() => decode(record.replace(/"sha256":"[a-f0-9]{64}"/, '"sha256":"' + '0'.repeat(64) + '"'))).toThrow('end marker');
  expect(() => decode(record.replace('"bytes":' + lock.length, '"bytes":' + (lock.length + 1)))).toThrow('mismatch');
});

test('identical repeated records are accepted, distinct resolutions require a single action log', () => {
  const record = encode(lock);
  expect(decode(record + '\n' + record)).toEqual(lock);
  const other = encode(Buffer.from(lock.toString().replace('1.0.0', '1.0.1')));
  expect(() => decode(record + '\n' + other)).toThrow('different lockfiles');
});

test('recovery never modifies the repository lockfile before validating a complete record', () => {
  const root = mkdtempSync(join(tmpdir(), 'mpei-podlock-'));
  try {
    const log = join(root, 'ci_post_clone.log');
    const output = join(root, 'Podfile.lock');
    writeFileSync(log, 'Installing Example (1.0.0)');
    writeFileSync(output, 'existing-lock');
    expect(() => recover(log, output)).toThrow('No complete');
    expect(readFileSync(output, 'utf8')).toBe('existing-lock');
    writeFileSync(log, cloudLog(encode(lock)));
    expect(recover(log, output)).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(output)).toEqual(lock);
  } finally {
    if (!basename(root).startsWith('mpei-podlock-') || dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected fixture directory.');
    rmSync(root, {recursive: true, force: true});
  }
});
