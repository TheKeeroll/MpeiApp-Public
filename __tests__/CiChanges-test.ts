/// <reference types="node" />
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';

type Selection = {mobile: boolean; android: boolean; proxy: boolean};
const {selectJobs, getChangedPaths, detectChanges} = require('../.github/scripts/ci-changes.cjs') as {
  selectJobs: (paths: string[], tagged?: boolean) => Selection;
  getChangedPaths: (eventName: string, event: object, cwd: string) => string[];
  detectChanges: (eventName: string, event: object, cwd?: string) => Selection;
};
const none = {mobile: false, android: false, proxy: false};
const mobile = {...none, mobile: true};
const all = {mobile: true, android: true, proxy: true};

describe('CI job selection', () => {
  it.each([
    {name: 'no changed files', paths: [], expected: none},
    {name: 'root Markdown', paths: ['README.md', 'v2.6.0-technical-plan.md'], expected: none},
    {name: 'nested/uppercase Markdown', paths: ['src/README.MD', 'android/notes.Md'], expected: none},
    {name: 'arbitrary docs contents', paths: ['docs/diagram.png', 'docs/data.json', 'docs/nested/config.yml'], expected: none},
    {name: 'proxy documentation only', paths: ['vpn-subscription-proxy/README.md', 'docs/proxy.json'], expected: none},
    {name: 'Android documentation only', paths: ['android/README.md'], expected: none},
    {name: 'application code', paths: ['src/API/BARS.ts'], expected: mobile},
    {name: 'iOS code', paths: ['ios/Podfile'], expected: mobile},
    {name: 'lockfile only', paths: ['yarn.lock'], expected: mobile},
    {name: 'native patch only', paths: ['patches/yandex-mobile-ads+8.5.0.patch'], expected: mobile},
    {name: 'CI changes', paths: ['.github/workflows/ci.yml'], expected: mobile},
    {name: 'root package manifest', paths: ['package.json'], expected: {...mobile, android: true}},
    {name: 'Android configuration', paths: ['android/app/build.gradle'], expected: {...mobile, android: true}},
    {name: 'proxy code', paths: ['vpn-subscription-proxy/src/server.ts'], expected: {...mobile, proxy: true}},
    {name: 'proxy manifest', paths: ['vpn-subscription-proxy/package.json'], expected: {...mobile, proxy: true}},
    {name: 'mixed independent components', paths: ['android/gradlew', 'vpn-subscription-proxy/test/httpApi.test.ts'], expected: all},
    {name: 'documentation mixed with code', paths: ['docs/data.json', 'src/App.tsx'], expected: mobile},
    {name: 'directory lookalikes', paths: ['android-tools/check.js', 'vpn-subscription-proxy-old/server.ts'], expected: mobile},
    {name: 'a newline in a filename', paths: ['src/name\nandroid/build.gradle'], expected: mobile},
  ])('selects checks for $name', ({paths, expected}) => {
    expect(selectJobs(paths)).toEqual(expected);
  });

  it.each([{paths: []}, {paths: ['README.md']}, {paths: ['docs/image.png']}, {paths: ['src/App.tsx']}])('runs all checks for a published tag regardless of files: $paths', ({paths}) => {
    expect(selectJobs(paths, true)).toEqual(all);
  });

  it('recognizes a tag push before requesting a diff, including an annotated tag with an unknown object SHA', () => {
    expect(detectChanges('push', {ref: 'refs/tags/ios-dev-2.6.0-beta.1', after: 'unknown-tag-object'})).toEqual(all);
  });

  it.each(['refs/heads/dev', 'refs/tags/old-tag'])('does not build a deleted ref %s', ref => {
    expect(detectChanges('push', {ref, deleted: true})).toEqual(none);
  });
});

describe('CI Git event ranges', () => {
  let repo: string;
  let base: string;
  let docsHead: string;
  let appHead: string;
  let advancedBase: string;
  let renamedHead: string;
  let deletedHead: string;
  const git = (...args: string[]) => execFileSync('git', args, {cwd: repo, encoding: 'utf8'}).trim();
  const write = (name: string, content: string) => {
    const path = join(repo, name);
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, content);
  };
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=CI fixture', '-c', 'user.email=ci@example.invalid', '-c', 'commit.gpgSign=false',
      '-c', `core.hooksPath=${join(repo, 'no-hooks')}`, 'commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'mpei-ci-selection-'));
    git('init', '--quiet', '--initial-branch=dev');
    git('config', 'core.autocrlf', 'false');
    write('README.md', 'base');
    write('src/App.tsx', 'base');
    write('android/build.gradle', 'base');
    write('vpn-subscription-proxy/src/server.ts', 'base');
    write('package.json', '{}');
    base = commit();
    git('checkout', '--quiet', '-b', 'feature');
    write('README.md', 'documentation');
    docsHead = commit();
    write('src/App.tsx', 'application change');
    commit();
    write('README.md', 'last commit changes only documentation');
    appHead = commit();
    git('checkout', '--quiet', 'dev');
    write('android/build.gradle', 'base branch advanced independently');
    advancedBase = commit();
    git('checkout', '--quiet', '-b', 'rename', base);
    mkdirSync(join(repo, 'docs'), {recursive: true});
    renameSync(join(repo, 'android/build.gradle'), join(repo, 'docs/build.gradle'));
    renamedHead = commit();
    git('checkout', '--quiet', '-b', 'deletion', base);
    rmSync(join(repo, 'vpn-subscription-proxy/src/server.ts'));
    deletedHead = commit();
  });
  afterAll(() => {
    const target = resolve(repo);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('mpei-ci-selection-')) {
      throw new Error('Refusing to remove a fixture outside the expected temporary directory.');
    }
    rmSync(target, {recursive: true, force: true, maxRetries: 3});
  });

  it('checks the complete pushed range even when the last commit changes only Markdown', () => {
    const event = {before: docsHead, after: appHead, ref: 'refs/heads/dev'};
    expect(getChangedPaths('push', event, repo).sort()).toEqual(['README.md', 'src/App.tsx']);
    expect(detectChanges('push', event, repo)).toEqual(mobile);
  });

  it('uses the PR merge base, excluding unrelated Android changes in the target branch', () => {
    const event = {pull_request: {base: {sha: advancedBase}, head: {sha: docsHead}}};
    expect(getChangedPaths('pull_request', event, repo)).toEqual(['README.md']);
    expect(detectChanges('pull_request', event, repo)).toEqual(none);
  });

  it('counts both sides of a rename from Android into docs', () => {
    const event = {before: base, after: renamedHead};
    expect(getChangedPaths('push', event, repo).sort()).toEqual(['android/build.gradle', 'docs/build.gradle']);
    expect(detectChanges('push', event, repo)).toEqual({...mobile, android: true});
  });

  it('counts a deleted proxy source file', () => {
    expect(detectChanges('push', {before: base, after: deletedHead}, repo)).toEqual({...mobile, proxy: true});
  });

  it('inspects the initial snapshot of a new branch', () => {
    expect(detectChanges('push', {before: '0'.repeat(40), after: base}, repo)).toEqual(all);
  });

  it('writes only boolean GitHub outputs without relying on commit file lists from the event payload', () => {
    const eventPath = join(repo, 'event.json');
    const outputPath = join(repo, 'output.txt');
    writeFileSync(eventPath, JSON.stringify({before: docsHead, after: appHead, ref: 'refs/heads/dev', head_commit: {modified: ['README.md']}}));
    execFileSync(process.execPath, [resolve(__dirname, '../.github/scripts/ci-changes.cjs')], {
      cwd: repo, env: {...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath},
    });
    expect(readFileSync(outputPath, 'utf8')).toBe('mobile=true\nandroid=false\nproxy=false\n');
  });

  it('fails a malformed event instead of silently skipping checks or launching expensive jobs', () => {
    const eventPath = join(repo, 'bad-event.json');
    const outputPath = join(repo, 'bad-output.txt');
    writeFileSync(eventPath, JSON.stringify({before: base, after: '--invalid-sha'}));
    const result = spawnSync(process.execPath, [resolve(__dirname, '../.github/scripts/ci-changes.cjs')], {
      cwd: repo, encoding: 'utf8', env: {...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath},
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('invalid commit SHA');
  });
});
