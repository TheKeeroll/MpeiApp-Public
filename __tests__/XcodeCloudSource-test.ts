/// <reference types="node" />
import {execFileSync, spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const scripts = resolve(__dirname, '../ios/ci_scripts');
const bash = process.platform === 'win32' ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/bin/bash.exe') : '/bin/bash';
const posix = (path: string) => path.replace(/\\/g, '/');
let workspace: string, seed: string, remote: string, base: string, outside: string;
let cloneIndex = 0;
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const commit = () => {
  git(seed, 'add', '-A');
  git(seed, '-c', 'user.name=Cloud fixture', '-c', 'user.email=ci@example.invalid', '-c', 'commit.gpgSign=false',
    '-c', `core.hooksPath=${join(workspace, 'no-hooks')}`, 'commit', '--quiet', '-m', 'fixture');
  return git(seed, 'rev-parse', 'HEAD');
};

beforeAll(() => {
  if (!existsSync(bash)) throw new Error('Git Bash or /bin/bash is required for Cloud shell checks.');
  workspace = mkdtempSync(join(tmpdir(), 'mpei-cloud-source-'));
  seed = join(workspace, 'seed'); remote = join(workspace, 'remote.git');
  git(workspace, 'init', '--quiet', '--bare', remote);
  git(workspace, 'init', '--quiet', '--initial-branch=dev', seed);
  git(seed, 'config', 'core.autocrlf', 'false');
  writeFileSync(join(seed, 'fixture.txt'), 'base');
  base = commit();
  git(seed, 'branch', 'v2');
  git(seed, '-c', 'user.name=Cloud fixture', '-c', 'user.email=ci@example.invalid', '-c', 'tag.gpgSign=false', 'tag', '-a', 'ios-dev-fixture-1', '-m', 'fixture', base);
  git(seed, '-c', 'tag.gpgSign=false', 'tag', 'release-1.0.0_tag_test_2', base);
  git(seed, '-c', 'user.name=Cloud fixture', '-c', 'user.email=ci@example.invalid', '-c', 'tag.gpgSign=false', 'tag', '-a', 'testflight-2.6.0-beta.1', '-m', 'fixture', base);
  writeFileSync(join(seed, 'fixture.txt'), 'advanced dev'); commit();
  git(seed, 'checkout', '--quiet', '-b', 'other', base);
  writeFileSync(join(seed, 'fixture.txt'), 'outside dev'); outside = commit();
  git(seed, '-c', 'tag.gpgSign=false', 'tag', 'ios-dev-outside', outside);
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '--quiet', 'origin', '--all');
  git(seed, 'push', '--quiet', 'origin', '--tags');
  git(workspace, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/dev');
});
afterAll(() => {
  if (!workspace) return;
  if (!basename(workspace).startsWith('mpei-cloud-source-') || dirname(workspace) !== resolve(tmpdir())) throw new Error('Unexpected fixture directory.');
  rmSync(workspace, {recursive: true, force: true});
});

const run = (changes: NodeJS.ProcessEnv, sha = base, configure?: (clone: string) => void) => {
  const clone = join(workspace, `checkout-${cloneIndex++}`);
  git(workspace, 'clone', '--quiet', '--depth=1', '--branch=dev', pathToFileURL(remote).href, clone);
  git(clone, 'fetch', '--quiet', '--depth=1', 'origin', sha);
  git(clone, 'fetch', '--quiet', '--depth=1', 'origin', '+refs/heads/*:refs/remotes/origin/*');
  git(clone, 'fetch', '--quiet', '--no-tags', 'origin', '+refs/tags/*:refs/tags/*');
  git(clone, 'checkout', '--quiet', '--detach', sha);
  configure?.(clone);
  const result = spawnSync(bash, ['--noprofile', '--norc', '-e', '-u', '-o', 'pipefail', posix(join(scripts, 'verify-source.sh'))], {
    cwd: clone, encoding: 'utf8',
    env: {...process.env, BASH_ENV: '', CI_XCODE_CLOUD: 'TRUE', CI_PRIMARY_REPOSITORY_PATH: posix(clone), CI_COMMIT: sha,
      CI_START_CONDITION: 'push', CI_TAG: '', CI_BRANCH: '', ...changes},
  });
  return {...result, clone};
};

test('all Cloud hooks and helpers parse as Bash scripts', () => {
  for (const name of readdirSync(scripts).filter(path => path.endsWith('.sh'))) {
    const result = spawnSync(bash, ['--noprofile', '--norc', '-n', posix(join(scripts, name))], {encoding: 'utf8'});
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  }
});

test.each(['release-1.0.0_tag_test_2', 'testflight-2.6.0-beta.1', 'ios-dev-fixture-1'])('recognizes tag %s without requiring CI_BRANCH or downloading history', tag => {
  const result = run({CI_TAG: tag}, base, clone => {
    // A dead remote must not affect source diagnostics or require a timeout.
    git(clone, 'remote', 'set-url', 'origin', join(workspace, 'unavailable.git'));
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(git(result.clone, 'rev-parse', '--is-shallow-repository')).toBe('true');
  expect(git(result.clone, 'rev-parse', `refs/tags/${tag}^{commit}`)).toBe(base);
  expect(result.stdout).toContain('controlled by the workflow');
});

test('a v2 tip push stays shallow without downloading full asset history', () => {
  const result = run({CI_BRANCH: 'v2'});
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(git(result.clone, 'rev-parse', '--is-shallow-repository')).toBe('true');
});

test('the initial manual dev build is allowed without a tag', () => {
  expect(run({CI_BRANCH: 'dev', CI_START_CONDITION: 'manual'}).status).toBe(0);
});

test('unconfirmed branch ancestry only warns', () => {
  const result = run({CI_TAG: 'ios-dev-outside', CI_BRANCH: 'dev'}, outside);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('warning:');
  expect(result.stderr).toContain('Branch ancestry is not confirmed');
});

test('a tag that points to another commit only warns', () => {
  const result = run({CI_TAG: 'ios-dev-outside'});
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('local tag points to a different commit');
});

test('a regular dev push is allowed', () => {
  const tip = git(seed, 'rev-parse', 'dev');
  const result = run({CI_BRANCH: 'dev'}, tip);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test.each([
  {CI_TAG: 'unrelated-tag'},
  {CI_TAG: 'release-'},
  {CI_TAG: 'testflight-'},
  {CI_TAG: 'invalid tag name'},
  {CI_BRANCH: 'v2', CI_START_CONDITION: 'pr_open'},
  {CI_BRANCH: 'another-branch'},
  {CI_BRANCH: 'invalid branch name'},
  {CI_COMMIT: ''},
  {CI_COMMIT: 'not-a-commit'},
  {CI_COMMIT: '0'.repeat(40)},
  {CI_XCODE_CLOUD: ''},
  {CI_START_CONDITION: ''},
  {CI_PRIMARY_REPOSITORY_PATH: ''},
  {},
])('diagnostic problem %j cannot block the build', event => {
  const result = run(event);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('warning:');
});

test('a tag missing from the shallow checkout only warns without fetching it', () => {
  const result = run({CI_TAG: 'release-1.0.0_tag_test_2'}, base, clone => {
    git(clone, 'tag', '-d', 'release-1.0.0_tag_test_2');
    git(clone, 'remote', 'set-url', 'origin', join(workspace, 'unavailable.git'));
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('Tag ref is not available locally');
  expect(git(result.clone, 'tag', '--list', 'release-1.0.0_tag_test_2')).toBe('');
});

test.each([
  {CI_PRIMARY_REPOSITORY_PATH: posix(tmpdir())},
  {CI_PRIMARY_REPOSITORY_PATH: posix(join(tmpdir(), 'missing-mpei-cloud-checkout'))},
  {PATH: '/missing-mpei-cloud-tools'},
])('missing checkout or Git only warns: %j', event => {
  const result = run(event);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('warning:');
});

test.each(['missing', 'failed'])('post-clone reaches toolchain setup when source diagnostics are %s', helper => {
  const fixture = join(workspace, `hook-${helper}`);
  mkdirSync(fixture);
  copyFileSync(join(scripts, 'ci_post_clone.sh'), join(fixture, 'ci_post_clone.sh'));
  writeFileSync(join(fixture, 'environment.sh'), 'set -euo pipefail\n');
  if (helper === 'failed') writeFileSync(join(fixture, 'verify-source.sh'), 'exit 23\n');
  // Stop at the next external command: reaching it proves the caller handles
  // even a missing/broken helper under its real set -euo pipefail settings.
  writeFileSync(join(fixture, 'xcodebuild'), '#!/bin/bash\nprintf "REACHED_TOOLCHAIN\\n"\nexit 42\n', {mode: 0o755});
  const result = spawnSync(bash, ['--noprofile', '--norc', posix(join(fixture, 'ci_post_clone.sh'))], {
    encoding: 'utf8', env: {...process.env, BASH_ENV: '', CI_PRIMARY_REPOSITORY_PATH: posix(workspace),
      PATH: `${posix(fixture)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`},
  });
  expect(result.stderr).toContain('Diagnostics could not finish; continuing the build');
  expect(result.stdout).toContain('REACHED_TOOLCHAIN');
  expect(result.status).toBe(42);
});
