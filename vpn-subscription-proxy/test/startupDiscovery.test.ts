import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import test from 'node:test';

import {
  findDnsNameForPublicIpv4,
  isGlobalIpv4,
  publicKeyMatchesPrivateKey,
  selectFirstStartupTlsMaterial,
  selectQuorumIpv4,
} from '../src/startupDiscovery.js';

test('public IPv4 discovery accepts a unanimous or two-source quorum only', () => {
  assert.equal(selectQuorumIpv4([
    '8.8.8.8',
    '8.8.8.8\n',
    '8.8.8.8',
  ]), '8.8.8.8');
  assert.equal(selectQuorumIpv4([
    '8.8.8.8',
    '1.1.1.1',
    '8.8.8.8',
  ]), '8.8.8.8');
  assert.equal(selectQuorumIpv4([
    '8.8.8.8',
    '1.1.1.1',
    '9.9.9.9',
  ]), undefined);
});

test('public IPv4 discovery rejects private, reserved, and malformed votes', () => {
  for (const value of ['10.0.0.1', '127.0.0.1', '192.168.1.1', '203.0.113.1', 'not-an-ip']) {
    assert.equal(isGlobalIpv4(value), false);
  }
  assert.equal(isGlobalIpv4('8.8.8.8'), true);
});

test('TLS selection prefers Let’s Encrypt and reaches fallback only after prior sources miss', async () => {
  const calls: string[] = [];
  const material = {
    certificatePem: 'certificate',
    privateKeyPem: 'private-key',
    hostname: 'le.example.com',
  };

  assert.deepEqual(await selectFirstStartupTlsMaterial([
    async () => {
      calls.push('lets-encrypt');
      return material;
    },
    async () => {
      calls.push('fallback');
      return undefined;
    },
  ]), material);
  assert.deepEqual(calls, ['lets-encrypt']);

  calls.length = 0;
  assert.deepEqual(await selectFirstStartupTlsMaterial([
    async () => {
      calls.push('lets-encrypt');
      return undefined;
    },
    async () => {
      calls.push('systemd-credential');
      return undefined;
    },
    async () => {
      calls.push('fallback');
      return material;
    },
  ]), material);
  assert.deepEqual(calls, ['lets-encrypt', 'systemd-credential', 'fallback']);
});

test('TLS discovery accepts only a DNS name with one exact public-IP answer', async () => {
  const resolved = await findDnsNameForPublicIpv4(
    ['multiple.example.com', 'wrong.example.com', 'matching.example.com'],
    '8.8.8.8',
    async hostname => {
      switch (hostname) {
        case 'multiple.example.com': return ['8.8.8.8', '1.1.1.1'];
        case 'wrong.example.com': return ['1.1.1.1'];
        default: return ['8.8.8.8'];
      }
    },
  );
  assert.equal(resolved, 'matching.example.com');
});

test('a certificate public key must match the supplied private key', () => {
  const matching = generateKeyPairSync('rsa', {modulusLength: 2048});
  const other = generateKeyPairSync('rsa', {modulusLength: 2048});
  const matchingPrivateKey = matching.privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
  const otherPrivateKey = other.privateKey.export({type: 'pkcs8', format: 'pem'}).toString();

  assert.equal(publicKeyMatchesPrivateKey(matching.publicKey, matchingPrivateKey), true);
  assert.equal(publicKeyMatchesPrivateKey(matching.publicKey, otherPrivateKey), false);
});
