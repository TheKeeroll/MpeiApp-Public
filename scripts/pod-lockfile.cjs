// Lossless Podfile.lock transport through downloadable Xcode Cloud logs.
// Archive contents changed by a post-hook are not a reliable custom artifact API.
const {createHash} = require('node:crypto');
const {readFileSync, writeFileSync, renameSync, existsSync, unlinkSync} = require('node:fs');
const {resolve, join} = require('node:path');
const {gzipSync, gunzipSync} = require('node:zlib');
const YAML = require('yaml');

const MARKER = 'MPEIAPP_PODLOCK';
const MAX_BYTES = 2 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function validate(bytes) {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Invalid Podfile.lock size.');
  const lock = YAML.parse(bytes.toString('utf8'));
  if (!Array.isArray(lock?.PODS) || !lock.PODS.length || !Array.isArray(lock.DEPENDENCIES) || !lock.DEPENDENCIES.length ||
      !lock['SPEC CHECKSUMS'] || !Object.keys(lock['SPEC CHECKSUMS']).length ||
      Object.values(lock['SPEC CHECKSUMS']).some(value => !/^[a-f0-9]{40}$/.test(value)) ||
      !/^[a-f0-9]{40}$/.test(lock['PODFILE CHECKSUM'] ?? '') ||
      !/^\d+\.\d+\.\d+$/.test(lock.COCOAPODS ?? '')) {
    throw new Error('The data is not a complete CocoaPods lockfile.');
  }
}

function encode(bytes, env = {}) {
  validate(bytes);
  const sha256 = digest(bytes);
  const metadata = {version: 1, bytes: bytes.length, sha256};
  if (/^\d+$/.test(env.CI_BUILD_NUMBER ?? '')) metadata.build = env.CI_BUILD_NUMBER;
  if (/^[a-z-]+$/.test(env.CI_XCODEBUILD_ACTION ?? '')) metadata.action = env.CI_XCODEBUILD_ACTION;
  const payload = gzipSync(bytes).toString('base64');
  const lines = [`[${MARKER}_BEGIN] ${JSON.stringify(metadata)}`];
  for (let index = 0; index * 96 < payload.length; index++) {
    lines.push(`[${MARKER}_DATA] ${index} ${payload.slice(index * 96, (index + 1) * 96)}`);
  }
  lines.push(`[${MARKER}_END] ${sha256}`);
  return lines.join('\n');
}

function decode(log) {
  let current;
  const results = new Map();
  for (const line of log.split(/\r?\n/)) {
    const match = line.match(/\[MPEIAPP_PODLOCK_(BEGIN|DATA|END)\] (.*)$/);
    if (!match) continue; // Xcode prepends timestamps and may interleave other output.
    if (match[1] === 'BEGIN') {
      if (current) throw new Error('Truncated or overlapping Podfile.lock record.');
      const metadata = JSON.parse(match[2]);
      if (metadata.version !== 1 || !Number.isInteger(metadata.bytes) || metadata.bytes <= 0 ||
          metadata.bytes > MAX_BYTES || !/^[a-f0-9]{64}$/.test(metadata.sha256 ?? '')) {
        throw new Error('Invalid Podfile.lock metadata.');
      }
      current = {metadata, chunks: []};
    } else if (match[1] === 'DATA') {
      const chunk = match[2].match(/^(\d+) ([A-Za-z0-9+/=]{1,96})$/);
      if (!current || !chunk || Number(chunk[1]) !== current.chunks.length || current.chunks.length > MAX_BYTES / 48) {
        throw new Error('Missing, reordered or invalid Podfile.lock chunk.');
      }
      current.chunks.push(chunk[2]);
    } else {
      if (!current || match[2] !== current.metadata.sha256) throw new Error('Invalid Podfile.lock end marker.');
      const payload = current.chunks.join('');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload) || payload.length % 4) throw new Error('Invalid lockfile encoding.');
      const bytes = gunzipSync(Buffer.from(payload, 'base64'), {maxOutputLength: MAX_BYTES});
      if (bytes.length !== current.metadata.bytes || digest(bytes) !== current.metadata.sha256) {
        throw new Error('Podfile.lock checksum or size mismatch.');
      }
      validate(bytes);
      results.set(current.metadata.sha256, bytes);
      current = undefined;
    }
  }
  if (current) throw new Error('Truncated Podfile.lock record.');
  if (!results.size) throw new Error('No complete Podfile.lock record in this log; versions alone cannot reconstruct it.');
  if (results.size !== 1) throw new Error('The log contains different lockfiles. Use the log of one Cloud action.');
  return [...results.values()][0];
}

function recover(logPath, destination) {
  // Decode and verify everything before touching an existing repository lockfile.
  const bytes = decode(readFileSync(logPath, 'utf8'));
  const temporary = `${destination}.recover-${process.pid}`;
  writeFileSync(temporary, bytes, {flag: 'wx'});
  try {
    renameSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return digest(bytes);
}

if (require.main === module) {
  try {
    if (process.argv[2] === 'print') {
      console.log(encode(readFileSync(join(__dirname, '../ios/Podfile.lock')), process.env));
    } else if (process.argv[2] === 'recover' && process.argv[3] && process.argv[4]) {
      console.log(`Recovered Podfile.lock; SHA-256 ${recover(resolve(process.argv[3]), resolve(process.argv[4]))}`);
    } else throw new Error('Usage: node scripts/pod-lockfile.cjs print | recover <ci_post_clone.log> <ios/Podfile.lock>');
  } catch (error) { console.error(`[Pods backup] ${error.message}`); process.exitCode = 1; }
}
module.exports = {encode, decode, recover};
