import {createPrivateKey, createPublicKey, type KeyObject, X509Certificate} from 'node:crypto';
import {constants} from 'node:fs';
import {access, readdir, readFile, realpath} from 'node:fs/promises';
import {resolve4 as resolveIpv4} from 'node:dns/promises';
import path from 'node:path';

const PUBLIC_IP_SOURCES = [
  'https://api.ipify.org',
  'https://ifconfig.me/ip',
  'https://icanhazip.com',
] as const;

const CERTIFICATE_PAIR_NAMES = [
  {certificate: 'fullchain.pem', privateKey: 'privkey.pem'},
  {certificate: 'cert.pem', privateKey: 'key.pem'},
] as const;

export type StartupTlsMaterial = Readonly<{
  certificatePem: string;
  privateKeyPem: string;
  hostname: string;
  publicIpv4: string;
}>;

export type StartupTlsIdentity = Omit<StartupTlsMaterial, 'publicIpv4'>;

type CertificatePair = Readonly<{
  certificatePath: string;
  privateKeyPath: string;
}>;

type LoadedCertificate = Readonly<{
  certificatePem: string;
  privateKeyPem: string;
  dnsNames: readonly string[];
  validTo: string;
  fingerprint: string;
}>;

type CertificateFileSystem = Readonly<{
  readdir: (directory: string) => Promise<readonly {name: string; isDirectory: () => boolean}[]>;
  realpath: (filename: string) => Promise<string>;
  access: (filename: string) => Promise<void>;
  readFile: (filename: string) => Promise<string>;
}>;

type DiscoveryDependencies = Readonly<{
  fetchText: (url: string) => Promise<string>;
  resolve4: (hostname: string) => Promise<readonly string[]>;
  files: CertificateFileSystem;
  preferredHostname?: string;
}>;

const normaliseIpv4 = (value: string): string | undefined => {
  const candidate = value.trim();
  const octets = candidate.split('.');
  if (octets.length !== 4 || octets.some(octet => !/^\d{1,3}$/u.test(octet))) {
    return undefined;
  }
  const parsed = octets.map(octet => Number.parseInt(octet, 10));
  if (parsed.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }
  return parsed.join('.');
};

export const isGlobalIpv4 = (value: string): boolean => {
  const normalised = normaliseIpv4(value);
  if (!normalised) {
    return false;
  }
  const [a, b, c] = normalised.split('.').map(Number);
  if (a === undefined || b === undefined || c === undefined) {
    return false;
  }
  if (a === 0 || a === 10 || a === 127 || a >= 224) {
    return false;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return false;
  }
  if (a === 169 && b === 254) {
    return false;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return false;
  }
  if (a === 192 && (b === 0 || b === 168)) {
    return false;
  }
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) {
    return false;
  }
  return !(a === 203 && b === 0 && c === 113);
};

export const selectQuorumIpv4 = (values: readonly string[]): string | undefined => {
  const votes = new Map<string, number>();
  for (const value of values) {
    const normalised = normaliseIpv4(value);
    if (!normalised || !isGlobalIpv4(normalised)) {
      continue;
    }
    votes.set(normalised, (votes.get(normalised) ?? 0) + 1);
  }
  return [...votes.entries()].find(([, count]) => count >= 2)?.[0];
};

const fetchPublicIpText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {Accept: 'text/plain'},
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error('Public IP source failed');
  }
  return response.text();
};

const defaultDependencies: DiscoveryDependencies = {
  fetchText: fetchPublicIpText,
  resolve4: resolveIpv4,
  files: {
    readdir: directory => readdir(directory, {withFileTypes: true}),
    realpath,
    access: filename => access(filename, constants.R_OK),
    readFile: filename => readFile(filename, 'utf8'),
  },
};

const isConcreteDnsName = (value: string): string | undefined => {
  const hostname = value.trim().toLowerCase().replace(/\.$/u, '');
  if (
    hostname.length < 3
    || hostname.length > 253
    || hostname.includes('*')
    || !hostname.includes('.')
    || !hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  ) {
    return undefined;
  }
  return hostname;
};

export const extractConcreteDnsNames = (certificate: X509Certificate): readonly string[] => {
  const fromSan = (certificate.subjectAltName ?? '')
    .split(/,\s*/u)
    .flatMap(entry => entry.startsWith('DNS:') ? [entry.slice(4)] : []);
  const fromCommonName = certificate.subject
    .split(/\n/u)
    .flatMap(entry => entry.startsWith('CN=') ? [entry.slice(3)] : []);
  return [...new Set(
    [...fromSan, ...fromCommonName]
      .map(isConcreteDnsName)
      .filter((hostname): hostname is string => hostname !== undefined),
  )];
};

const candidatePairsAt = (directory: string): CertificatePair[] => CERTIFICATE_PAIR_NAMES.map(names => ({
  certificatePath: path.join(directory, names.certificate),
  privateKeyPath: path.join(directory, names.privateKey),
}));

const readDirectoryEntries = async (directory: string, files: CertificateFileSystem) => {
  try {
    return await files.readdir(directory);
  } catch {
    return [];
  }
};

const oneLevelCandidatePairs = async (directory: string, files: CertificateFileSystem): Promise<CertificatePair[]> => {
  const pairs = candidatePairsAt(directory);
  const entries = await readDirectoryEntries(directory, files);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      pairs.push(...candidatePairsAt(path.join(directory, entry.name)));
    }
  }
  return pairs;
};

const letsEncryptCandidatePairs = async (files: CertificateFileSystem): Promise<CertificatePair[]> => {
  const root = '/etc/letsencrypt/live';
  const entries = await readDirectoryEntries(root, files);
  return entries
    .filter(entry => entry.isDirectory())
    .flatMap(entry => [{
      certificatePath: path.join(root, entry.name, 'fullchain.pem'),
      privateKeyPath: path.join(root, entry.name, 'privkey.pem'),
    }]);
};

/**
 * systemd LoadCredential reads the existing certificate files as root at
 * service start, then exposes a short-lived, read-only copy to the
 * unprivileged service. This is not a configurable certificate path.
 */
const systemdCredentialCandidatePairs = (): CertificatePair[] => {
  const credentialsDirectory = process.env.CREDENTIALS_DIRECTORY;
  if (!credentialsDirectory) {
    return [];
  }
  const credentialsRoot = '/run/credentials';
  const resolvedDirectory = path.resolve(credentialsDirectory);
  const relativeDirectory = path.relative(credentialsRoot, resolvedDirectory);
  if (
    !relativeDirectory
    || relativeDirectory.startsWith('..')
    || path.isAbsolute(relativeDirectory)
  ) {
    return [];
  }
  return [{
    certificatePath: path.join(resolvedDirectory, 'fullchain.pem'),
    privateKeyPath: path.join(resolvedDirectory, 'privkey.pem'),
  }];
};

const fallbackCandidatePairs = async (files: CertificateFileSystem): Promise<CertificatePair[]> => {
  const pairs = [
    ...(await oneLevelCandidatePairs('/etc/ssl', files)),
    ...(await oneLevelCandidatePairs('/etc/nginx/ssl', files)),
    ...(await oneLevelCandidatePairs('/root/cert', files)),
    ...candidatePairsAt('/root'),
    ...(await oneLevelCandidatePairs('/root/.acme.sh', files)),
  ];

  const optEntries = await readDirectoryEntries('/opt', files);
  for (const entry of optEntries) {
    if (entry.isDirectory()) {
      pairs.push(...(await oneLevelCandidatePairs(path.join('/opt', entry.name, 'ssl'), files)));
    }
  }
  return pairs;
};

export const publicKeyMatchesPrivateKey = (certificatePublicKey: KeyObject, privateKeyPem: string): boolean => {
  try {
    const certificatePublicKeyDer = certificatePublicKey.export({type: 'spki', format: 'der'});
    const privatePublicKey = createPublicKey(createPrivateKey(privateKeyPem)).export({type: 'spki', format: 'der'});
    return Buffer.from(certificatePublicKeyDer).equals(Buffer.from(privatePublicKey));
  } catch {
    return false;
  }
};

const keysMatch = (certificate: X509Certificate, privateKeyPem: string): boolean => (
  publicKeyMatchesPrivateKey(certificate.publicKey, privateKeyPem)
);

const loadCertificate = async (pair: CertificatePair, now: Date, files: CertificateFileSystem): Promise<LoadedCertificate | undefined> => {
  try {
    const [certificatePath, privateKeyPath] = await Promise.all([
      files.realpath(pair.certificatePath),
      files.realpath(pair.privateKeyPath),
    ]);
    await Promise.all([
      files.access(certificatePath),
      files.access(privateKeyPath),
    ]);
    const [certificatePem, privateKeyPem] = await Promise.all([
      files.readFile(certificatePath),
      files.readFile(privateKeyPath),
    ]);
    const certificate = new X509Certificate(certificatePem);
    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) || validFrom > now.getTime() || validTo <= now.getTime()) {
      return undefined;
    }
    if (!keysMatch(certificate, privateKeyPem)) {
      return undefined;
    }
    const dnsNames = extractConcreteDnsNames(certificate);
    return dnsNames.length > 0 ? {certificatePem, privateKeyPem, dnsNames, validTo: certificate.validTo, fingerprint: certificate.fingerprint256} : undefined;
  } catch {
    return undefined;
  }
};

const findMatchingMaterial = async (
  pairs: readonly CertificatePair[],
  publicIpv4: string,
  dependencies: DiscoveryDependencies,
  now: Date,
): Promise<StartupTlsIdentity | undefined> => {
  const tried = new Set<string>();
  for (const pair of pairs) {
    const pairKey = `${pair.certificatePath}\u0000${pair.privateKeyPath}`;
    if (tried.has(pairKey)) {
      continue;
    }
    tried.add(pairKey);

    const certificate = await loadCertificate(pair, now, dependencies.files);
    if (!certificate) {
      continue;
    }
    const hostname = await findDnsNameForPublicIpv4(
      dependencies.preferredHostname
        ? certificate.dnsNames.filter(name => name === dependencies.preferredHostname)
        : certificate.dnsNames,
      publicIpv4,
      dependencies.resolve4,
    );
    if (hostname) {
      return {
        certificatePem: certificate.certificatePem,
        privateKeyPem: certificate.privateKeyPem,
        hostname,
      };
    }
  }
  return undefined;
};

/** A certificate hostname must resolve to precisely the discovered public IP. */
export const findDnsNameForPublicIpv4 = async (
  dnsNames: readonly string[],
  publicIpv4: string,
  resolve4: (hostname: string) => Promise<readonly string[]>,
): Promise<string | undefined> => {
  for (const hostname of dnsNames) {
    try {
      const addresses = [...new Set(await resolve4(hostname))];
      if (addresses.length === 1 && addresses[0] === publicIpv4) {
        return hostname;
      }
    } catch {
      // A DNS failure is not diagnostic enough to expose outside the VPS.
    }
  }
  return undefined;
};

/** Runs discovery sources in their security order and stops at the first match. */
export const selectFirstStartupTlsMaterial = async (
  finders: readonly (() => Promise<StartupTlsIdentity | undefined>)[],
): Promise<StartupTlsIdentity | undefined> => {
  for (const findMaterial of finders) {
    const material = await findMaterial();
    if (material) {
      return material;
    }
  }
  return undefined;
};

const discoverPublicIpv4 = async (dependencies: DiscoveryDependencies): Promise<string> => {
  const responses = await Promise.allSettled(PUBLIC_IP_SOURCES.map(dependencies.fetchText));
  const publicIpv4 = selectQuorumIpv4(responses.flatMap(response => (
    response.status === 'fulfilled' ? [response.value] : []
  )));
  if (!publicIpv4) throw new Error('Public IPv4 quorum was not reached');
  return publicIpv4;
};

export type InstallerTlsCandidate = CertificatePair & Readonly<{
  source: 'letsencrypt' | 's-ui';
  name: string;
  hostnames: readonly string[];
  validTo: string;
  fingerprint: string;
}>;

/** Root-only installer discovery. Returns public metadata, never PEM/key contents. */
export const discoverInstallerCertificates = async (
  dependencies: Partial<DiscoveryDependencies> = {},
  now = new Date(),
): Promise<{publicIpv4: string; candidates: InstallerTlsCandidate[]; rejected: string[]}> => {
  const resolved: DiscoveryDependencies = {...defaultDependencies, ...dependencies};
  const publicIpv4 = await discoverPublicIpv4(resolved);
  const candidates: InstallerTlsCandidate[] = [];
  const rejected: string[] = [];
  for (const [source, root] of [['letsencrypt', '/etc/letsencrypt/live'], ['s-ui', '/root/cert']] as const) {
    for (const entry of await readDirectoryEntries(root, resolved.files)) {
      if (!entry.isDirectory() || !/^[a-zA-Z0-9._-]+$/u.test(entry.name)) continue;
      const pair = {
        certificatePath: path.join(root, entry.name, 'fullchain.pem'),
        privateKeyPath: path.join(root, entry.name, 'privkey.pem'),
      };
      const certificate = await loadCertificate(pair, now, resolved.files);
      if (!certificate) {
        rejected.push(`${source}/${entry.name}: invalid, expired, unreadable or mismatched certificate/key`);
        continue;
      }
      const hostnames: string[] = [];
      for (const name of certificate.dnsNames) {
        if (await findDnsNameForPublicIpv4([name], publicIpv4, resolved.resolve4)) hostnames.push(name);
      }
      if (!hostnames.length) {
        rejected.push(`${source}/${entry.name}: no concrete DNS name points exclusively to this VPS`);
        continue;
      }
      candidates.push({...pair, source, name: entry.name, hostnames, validTo: certificate.validTo, fingerprint: certificate.fingerprint});
    }
  }
  return {publicIpv4, candidates, rejected};
};

/**
 * Fails closed before Fastify opens a socket. There is intentionally no
 * configurable certificate path: discovery is bounded to known safe places.
 */
export const discoverStartupTls = async (
  dependencies: Partial<DiscoveryDependencies> = {},
  now = new Date(),
): Promise<StartupTlsMaterial> => {
  const resolvedDependencies: DiscoveryDependencies = {...defaultDependencies, ...dependencies};
  const publicIpv4 = await discoverPublicIpv4(resolvedDependencies);
  const credentials = systemdCredentialCandidatePairs();

  // An explicitly selected systemd pair must not be replaced by another
  // readable certificate, including during an incomplete renewal.
  const material = await selectFirstStartupTlsMaterial(credentials.length ? [
    async () => findMatchingMaterial(credentials, publicIpv4, resolvedDependencies, now),
  ] : [
    async () => findMatchingMaterial(
      await letsEncryptCandidatePairs(resolvedDependencies.files),
      publicIpv4,
      resolvedDependencies,
      now,
    ),
    async () => findMatchingMaterial(
      await fallbackCandidatePairs(resolvedDependencies.files),
      publicIpv4,
      resolvedDependencies,
      now,
    ),
  ]);
  if (!material) {
    throw new Error('No valid matching TLS certificate was found; check certificate expiry, key access, and DNS');
  }
  return {...material, publicIpv4};
};
