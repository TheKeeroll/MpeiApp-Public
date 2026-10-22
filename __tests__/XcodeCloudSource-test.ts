/// <reference types="node" />
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
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

const run = (changes: NodeJS.ProcessEnv, sha = base) => {
  const clone = join(workspace, `checkout-${cloneIndex++}`);
  git(workspace, 'clone', '--quiet', '--depth=1', '--branch=dev', pathToFileURL(remote).href, clone);
  git(clone, 'fetch', '--quiet', '--depth=1', 'origin', sha);
  git(clone, 'checkout', '--quiet', '--detach', 'FETCH_HEAD');
  const result = spawnSync(bash, ['--noprofile', '--norc', posix(join(scripts, 'verify-source.sh'))], {
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

test('an annotated dev tag is accepted from a shallow checkout after dev has advanced', () => {
  const result = run({CI_TAG: 'ios-dev-fixture-1'});
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(git(result.clone, 'rev-parse', '--is-shallow-repository')).toBe('false');
  expect(git(result.clone, 'rev-parse', 'refs/tags/ios-dev-fixture-1^{commit}')).toBe(base);
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

test('a tag outside dev is rejected', () => {
  const result = run({CI_TAG: 'ios-dev-outside'}, outside);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('not in the required remote branch history');
});

test('a tag that points to another commit is rejected', () => {
  const result = run({CI_TAG: 'ios-dev-outside'});
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('does not point to CI_COMMIT');
});

test.each([
  {CI_BRANCH: 'dev'},
  {CI_TAG: 'unrelated-tag'},
  {CI_BRANCH: 'v2', CI_START_CONDITION: 'pr_open'},
])('rejects an unsupported event %j', event => {
  expect(run(event).status).toBe(1);
});
