import assert from 'node:assert/strict';
import {generateKeyPairSync, X509Certificate} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test, {type TestContext} from 'node:test';

import {discoverInstallerCertificates, discoverStartupTls} from '../src/startupDiscovery.js';

const certificatePem = readFileSync(new URL('./fixtures/tls/fullchain.pem', import.meta.url), 'utf8');
const privateKeyPem = readFileSync(new URL('./fixtures/tls/privkey.pem', import.meta.url), 'utf8');
const certificate = new X509Certificate(certificatePem);
const validTime = new Date(Date.parse(certificate.validFrom) + 86400000);
const suiDirectory = '/root/cert/proxy.example.com';

const createFilesystem = (t: TestContext) => {
  const previousCredentialsDirectory = process.env.CREDENTIALS_DIRECTORY;
  delete process.env.CREDENTIALS_DIRECTORY;
  t.after(() => {
    if (previousCredentialsDirectory === undefined) delete process.env.CREDENTIALS_DIRECTORY;
    else process.env.CREDENTIALS_DIRECTORY = previousCredentialsDirectory;
  });

  const contents = new Map<string, string>();
  const directories = new Map<string, string[]>();
  const aliases = new Map<string, string>();
  const denied = new Set<string>();
  const listed: string[] = [];
  const reads: string[] = [];
  const normalise = (filename: string) => path.normalize(filename);
  const put = (filename: string, value: string) => contents.set(normalise(filename), value);
  const list = (directory: string, names: string[]) => directories.set(normalise(directory), names);
  const addPair = (directory: string) => {
    put(path.join(directory, 'fullchain.pem'), certificatePem);
    put(path.join(directory, 'privkey.pem'), privateKeyPem);
    const parent = path.dirname(directory);
    list(parent, [...new Set([...(directories.get(normalise(parent)) ?? []), path.basename(directory)])]);
  };
  const requireFile = (filename: string) => {
    if (!contents.has(normalise(filename)) || denied.has(normalise(filename))) throw new Error('File unavailable');
  };
  const files = {
    readdir: async (directory: string) => {
      listed.push(normalise(directory));
      if (denied.has(normalise(directory))) throw new Error('Directory unavailable');
      return (directories.get(normalise(directory)) ?? []).map(name => ({name, isDirectory: () => true}));
    },
    realpath: async (filename: string) => {
      const target = aliases.get(normalise(filename)) ?? normalise(filename);
      requireFile(target);
      return target;
    },
    access: async (filename: string) => { requireFile(filename); },
    readFile: async (filename: string) => {
      requireFile(filename);
      reads.push(normalise(filename));
      return contents.get(normalise(filename))!;
    },
  };
  const dependencies = {files, fetchText: async () => '8.8.8.8', resolve4: async (_hostname: string) => ['8.8.8.8']};
  const discover = (now = validTime, resolve4 = dependencies.resolve4) => discoverStartupTls({...dependencies, resolve4}, now);
  return {put, list, addPair, contents, aliases, denied, normalise, reads, listed, discover, dependencies};
};

test('startup discovers and validates the pair installed by s-ui.sh under /root/cert/<domain>', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  const tls = await fs.discover();
  assert.deepEqual(tls, {certificatePem, privateKeyPem, hostname: 'proxy.example.com', publicIpv4: '8.8.8.8'});
  assert.ok(fs.reads.includes(fs.normalise(path.join(suiDirectory, 'privkey.pem'))));
});

test('an existing valid Let’s Encrypt pair still takes priority over /root/cert', async t => {
  const fs = createFilesystem(t);
  fs.addPair('/etc/letsencrypt/live/proxy.example.com');
  fs.addPair(suiDirectory);
  assert.equal((await fs.discover()).hostname, 'proxy.example.com');
  assert.ok(!fs.listed.includes(fs.normalise('/root/cert')));
});

test('an unprivileged service uses the S-UI snapshot passed through systemd credentials without reading /root', async t => {
  const fs = createFilesystem(t);
  const credentialsDirectory = path.resolve('/run/credentials/dragonet-subscription-proxy@proxy.example.com.service');
  process.env.CREDENTIALS_DIRECTORY = credentialsDirectory;
  fs.denied.add(fs.normalise('/root/cert'));
  fs.addPair(credentialsDirectory);
  assert.equal((await fs.discover()).hostname, 'proxy.example.com');
  assert.ok(fs.reads.includes(path.join(credentialsDirectory, 'privkey.pem')));
  assert.ok(!fs.listed.includes(fs.normalise('/root/cert')));
});

test('S-UI discovery resolves file symlinks before checking the certificate and key', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  fs.put('/root/cert/archive/cert.pem', certificatePem);
  fs.put('/root/cert/archive/key.pem', privateKeyPem);
  fs.aliases.set(fs.normalise(path.join(suiDirectory, 'fullchain.pem')), fs.normalise('/root/cert/archive/cert.pem'));
  fs.aliases.set(fs.normalise(path.join(suiDirectory, 'privkey.pem')), fs.normalise('/root/cert/archive/key.pem'));
  assert.equal((await fs.discover()).hostname, 'proxy.example.com');
  assert.ok(fs.reads.includes(fs.normalise('/root/cert/archive/key.pem')));
});

for (const failure of ['missing key', 'invalid certificate', 'mismatched key', 'expired certificate', 'unreadable key', 'wrong DNS'] as const) {
  test(`S-UI discovery fails closed for ${failure}`, async t => {
    const fs = createFilesystem(t);
    fs.addPair(suiDirectory);
    let now = validTime;
    let resolve4 = async (_hostname: string) => ['8.8.8.8'];
    const keyPath = fs.normalise(path.join(suiDirectory, 'privkey.pem'));
    switch (failure) {
      case 'missing key': fs.contents.delete(keyPath); break;
      case 'invalid certificate': fs.put(path.join(suiDirectory, 'fullchain.pem'), 'not a PEM certificate'); break;
      case 'mismatched key': {
        const other = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
        fs.put(keyPath, other.privateKey.export({type: 'pkcs8', format: 'pem'}).toString());
        break;
      }
      case 'expired certificate': now = new Date(Date.parse(certificate.validTo) + 1); break;
      case 'unreadable key': fs.denied.add(keyPath); break;
      case 'wrong DNS': resolve4 = async () => ['1.1.1.1']; break;
    }
    await assert.rejects(fs.discover(now, resolve4), /No valid matching TLS certificate/);
  });
}

test('S-UI discovery stays bounded to the certificate root and one directory level', async t => {
  const fs = createFilesystem(t);
  fs.list('/root/cert', ['proxy.example.com']);
  fs.addPair(path.join(suiDirectory, 'deeper'));
  await assert.rejects(fs.discover(), /No valid matching TLS certificate/);
  assert.ok(!fs.listed.includes(fs.normalise(suiDirectory)));
});

test('certificate and key from different S-UI directories are never combined', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  fs.contents.delete(fs.normalise(path.join(suiDirectory, 'privkey.pem')));
  fs.list('/root/cert', ['proxy.example.com', 'other.example.com']);
  fs.put('/root/cert/other.example.com/privkey.pem', privateKeyPem);
  await assert.rejects(fs.discover(), /No valid matching TLS certificate/);
});

test('a restart revalidates renewed material instead of reusing an earlier TLS pair', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  assert.equal((await fs.discover()).hostname, 'proxy.example.com');
  fs.put(path.join(suiDirectory, 'privkey.pem'), 'an incomplete renewal');
  await assert.rejects(fs.discover(), /No valid matching TLS certificate/);
});

test('installer finds valid S-UI and Certbot choices and exposes only public metadata', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory); fs.addPair('/etc/letsencrypt/live/proxy.example.com-0001');
  const result = await discoverInstallerCertificates(fs.dependencies, validTime);
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map(item => item.source), ['letsencrypt', 's-ui']);
  assert.ok(result.candidates.every(item => item.hostnames[0] === 'proxy.example.com' && item.validTo && item.fingerprint));
  assert.ok(!JSON.stringify(result).includes('BEGIN'));
});

test('installer reports unusable pairs instead of offering them as a TLS choice', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory); fs.addPair('/root/cert/broken.example.com');
  fs.contents.delete(fs.normalise('/root/cert/broken.example.com/privkey.pem'));
  const result = await discoverInstallerCertificates(fs.dependencies, validTime);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0]!.includes('broken.example.com'));
  assert.ok(!result.rejected[0]!.includes(privateKeyPem));
});

test('the selected systemd credential pair takes precedence over another readable Let’s Encrypt pair', async t => {
  const fs = createFilesystem(t);
  fs.addPair('/etc/letsencrypt/live/proxy.example.com');
  const credentialsDirectory = path.resolve('/run/credentials/dragonet-subscription-proxy@chosen.service');
  process.env.CREDENTIALS_DIRECTORY = credentialsDirectory;
  fs.addPair(credentialsDirectory);
  assert.equal((await fs.discover()).hostname, 'proxy.example.com');
  assert.ok(!fs.listed.includes(fs.normalise('/etc/letsencrypt/live')));
});

test('invalid selected credentials never silently fall back to a different valid certificate', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  process.env.CREDENTIALS_DIRECTORY = path.resolve('/run/credentials/dragonet-subscription-proxy@chosen.service');
  await assert.rejects(fs.discover(), /No valid matching TLS certificate/);
  assert.ok(!fs.listed.includes(fs.normalise('/root/cert')));
});

test('installer and runtime support choosing a specific matching hostname from a multi-SAN certificate', async t => {
  const fs = createFilesystem(t);
  fs.addPair(suiDirectory);
  const multiPem = readFileSync(new URL('./fixtures/tls/multi-fullchain.pem', import.meta.url), 'utf8');
  fs.put(path.join(suiDirectory, 'fullchain.pem'), multiPem);
  const result = await discoverInstallerCertificates(fs.dependencies, validTime);
  assert.deepEqual(result.candidates[0]!.hostnames, ['proxy.example.com', 'alternate.example.com']);
  const selected = await discoverStartupTls({...fs.dependencies, preferredHostname: 'alternate.example.com'}, validTime);
  assert.equal(selected.hostname, 'alternate.example.com');
  await assert.rejects(discoverStartupTls({...fs.dependencies, preferredHostname: 'other.example.com'}, validTime), /No valid matching TLS certificate/);
});
