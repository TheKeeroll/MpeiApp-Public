import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import test, {afterEach} from 'node:test';

const setupUrl = new URL('../deploy/setup.mjs', import.meta.url);
const {ask} = await import(setupUrl.href);
const originalTerm = process.env.TERM;
afterEach(() => {
  if (originalTerm === undefined) delete process.env.TERM;
  else process.env.TERM = originalTerm;
});

function terminal(t: import('node:test').TestContext, columns = 80, term = 'xterm') {
  process.env.TERM = term;
  const input = new PassThrough();
  const output = new PassThrough();
  const rawModes: boolean[] = [];
  Object.defineProperty(input, 'isTTY', {value: true});
  Object.defineProperty(input, 'setRawMode', {value: (enabled: boolean) => {rawModes.push(enabled);}});
  Object.defineProperty(output, 'columns', {value: columns});
  let transcript = '';
  output.setEncoding('utf8');
  output.on('data', chunk => {transcript += chunk;});
  t.after(() => {
    input.destroy(); output.destroy();
  });
  return {input, output, rawModes, read: () => transcript};
}

function assertPromptVisible(transcript: string, label: string) {
  const promptPosition = transcript.lastIndexOf('[ВВОД]');
  assert.ok(promptPosition >= 0, 'The question must be printed before input');
  // readline emits cursor-to-start + erase-screen-down on a normal SSH terminal.
  // A question printed before this sequence disappears, even if it exists in raw logs.
  assert.ok(promptPosition > transcript.lastIndexOf('\x1b[0J'), 'The question must survive readline clearing the terminal line');
  assert.ok(transcript.slice(promptPosition).includes(label));
  assert.ok(transcript.includes('\x1b[33m'), 'Use an explicit visible color');
}

for (const term of ['xterm', 'dumb']) {
  test(`installer question is visible before Enter and preserves its default with TERM=${term}`, async t => {
    const tty = terminal(t, 80, term);
    const answer = ask('EnvironmentFile', {current: '/etc/proxy.env'}, tty);
    const beforeInput = tty.read();
    tty.input.write('\r');
    assert.equal(await answer, '/etc/proxy.env');
    assertPromptVisible(beforeInput, 'EnvironmentFile');
    assert.ok(beforeInput.includes('/etc/proxy.env'));
    if (term === 'xterm') assert.ok(beforeInput.includes('\x1b[0J'), 'Exercise ANSI redraw rather than the dumb-terminal path');
    assert.deepEqual(tty.rawModes, [true, false]);
  });
}

test('long Cyrillic questions remain visible on a narrow terminal before the first keypress', async t => {
  const tty = terminal(t, 32);
  const label = 'Каталог SQLite state';
  const current = '/var/lib/dragonet-subscription-proxy';
  const answer = ask(label, {current}, tty);
  const beforeInput = tty.read();
  tty.input.write('\r');
  assert.equal(await answer, current);
  assertPromptVisible(beforeInput, label);
  assert.ok(beforeInput.includes(current));
});

test('editing and cursor redraw keep the question and accept the edited value', async t => {
  const tty = terminal(t);
  const answer = ask('Каталог кода', {current: '/opt/default'}, tty);
  tty.input.write('/opt/testx\x7f');
  const whileEditing = tty.read();
  tty.input.write('\r');
  assert.equal(await answer, '/opt/test');
  assertPromptVisible(whileEditing, 'Каталог кода');
});

test('secret questions are visible but existing values, typed values and redraws are never echoed', async t => {
  const tty = terminal(t, 40);
  const answer = ask('Token S-UI', {current: 'existing-private-token', secret: true}, tty);
  const beforeInput = tty.read();
  tty.input.write('new-private-token\x7fX');
  const whileEditing = tty.read();
  tty.input.write('\r');
  assert.equal(await answer, 'new-private-tokeX');
  assertPromptVisible(beforeInput, 'Token S-UI');
  assert.ok(beforeInput.includes('скрытый ввод'));
  assert.ok(!beforeInput.includes('existing-private-token'));
  assert.equal(whileEditing, beforeInput, 'No secret characters or editing sequences may reach the output');
  assert.equal(tty.read(), beforeInput + '\n');
  assert.deepEqual(tty.rawModes, [true, false]);
});

test('a new secret shows only a public example and Enter can retain an existing secret', async t => {
  for (const current of ['', 'https://panel.example.com/private-path']) {
    const tty = terminal(t);
    const answer = ask('HTTPS URL S-UI', {current, example: 'https://panel.example.com/example', secret: true}, tty);
    const beforeInput = tty.read();
    tty.input.write('\r');
    assert.equal(await answer, current);
    assertPromptVisible(beforeInput, 'HTTPS URL S-UI');
    if (!current) assert.ok(beforeInput.includes('пример: https://panel.example.com/example'));
    else assert.ok(!beforeInput.includes(current));
  }
});

test('optional answers can be cleared or replaced without changing prompt visibility', async t => {
  for (const [typed, expected] of [['-', ''], ['new-value', 'new-value']]) {
    const tty = terminal(t);
    const answer = ask('Optional setting', {current: 'old-value', optional: true}, tty);
    const beforeInput = tty.read();
    tty.input.write(typed + '\r');
    assert.equal(await answer, expected);
    assertPromptVisible(beforeInput, 'Optional setting');
  }
});

test('Ctrl+C cancels ordinary and secret questions, restores terminal mode and does not leak input', async t => {
  for (const secret of [false, true]) {
    const tty = terminal(t);
    const answer = ask('Cancelable question', {secret}, tty);
    const rejection = assert.rejects(answer, /Установка прервана пользователем/);
    if (secret) tty.input.write('private-unsubmitted-value');
    tty.input.write('\x03');
    await rejection;
    assert.deepEqual(tty.rawModes, [true, false]);
    assert.ok(!tty.read().includes('private-unsubmitted-value'));
    assert.ok(tty.read().endsWith('\n'));
  }
});

test('closing input rejects ordinary and secret questions instead of silently accepting defaults', async t => {
  for (const secret of [false, true]) {
    const tty = terminal(t);
    const answer = ask('Disconnected terminal', {current: 'keep-existing', secret}, tty);
    const rejection = assert.rejects(answer, /Установка прервана пользователем/);
    tty.input.end();
    await rejection;
    assert.deepEqual(tty.rawModes, [true, false]);
  }
});
