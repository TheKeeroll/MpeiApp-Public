const {execFileSync} = require('node:child_process');
const {appendFileSync, readFileSync} = require('node:fs');

const NO_JOBS = Object.freeze({mobile: false, android: false, proxy: false});
const ALL_JOBS = Object.freeze({mobile: true, android: true, proxy: true});
const SHA = /^[a-f0-9]{40}$/i;

const isDocumentation = path => path.startsWith('docs/') || path.toLowerCase().endsWith('.md');

function selectJobs(paths, tagged = false) {
  if (tagged) return {...ALL_JOBS};
  if (!paths.some(path => !isDocumentation(path))) return {...NO_JOBS};
  return {
    mobile: true,
    android: paths.some(path => path.startsWith('android/') || path === 'package.json'),
    proxy: paths.some(path => path.startsWith('vpn-subscription-proxy/')),
  };
}

function git(args, cwd) {
  return execFileSync('git', args, {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

function requireCommit(sha, cwd) {
  if (typeof sha !== 'string' || !SHA.test(sha)) throw new Error('The CI event has an invalid commit SHA.');
  try {
    git(['cat-file', '-e', `${sha}^{commit}`], cwd);
  } catch {
    // A force-push can remove the old commit from all fetched branch histories.
    git(['fetch', '--no-tags', 'origin', sha], cwd);
    git(['cat-file', '-e', `${sha}^{commit}`], cwd);
  }
}

function getChangedPaths(eventName, event, cwd) {
  let before;
  let after;
  if (eventName === 'pull_request') {
    before = event.pull_request?.base?.sha;
    after = event.pull_request?.head?.sha;
  } else if (eventName === 'push') {
    before = event.before;
    after = event.after;
  } else {
    throw new Error(`Unsupported CI event: ${eventName}`);
  }
  requireCommit(after, cwd);
  if (eventName === 'push' && before === '0'.repeat(40)) {
    // A newly created branch has no previous tree; inspect its initial snapshot.
    return git(['ls-tree', '-r', '--name-only', '-z', after], cwd).split('\0').filter(Boolean);
  }
  requireCommit(before, cwd);
  // PRs compare against their merge base; pushes compare the whole pushed range.
  const range = `${before}${eventName === 'pull_request' ? '...' : '..'}${after}`;
  // Treat renames as deletion + addition so both affected directories count.
  return git(['diff', '--no-renames', '--name-only', '-z', range, '--'], cwd).split('\0').filter(Boolean);
}

function detectChanges(eventName, event, cwd = process.cwd()) {
  if (eventName === 'push' && event.deleted) return {...NO_JOBS};
  if (eventName === 'push' && event.ref?.startsWith('refs/tags/')) return {...ALL_JOBS};
  return selectJobs(getChangedPaths(eventName, event, cwd));
}

if (require.main === module) {
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const result = detectChanges(process.env.GITHUB_EVENT_NAME, event);
    const output = Object.entries(result).map(([name, enabled]) => `${name}=${enabled}\n`).join('');
    appendFileSync(process.env.GITHUB_OUTPUT, output);
    console.log(`CI selection: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error('Could not determine changed paths; dependent jobs will not start.', error.message);
    process.exitCode = 1;
  }
}

module.exports = {selectJobs, getChangedPaths, detectChanges};
