import { describe, expect, test } from 'bun:test';
import { cloneFS, createFile, DEFAULT_FS, findNode } from '@/os/fs';
import { executeShell, freshSession, prompt } from './shell';
const run = (command: string) => executeShell(command, cloneFS(DEFAULT_FS), freshSession('ubuntu'), 'ubuntu');
describe('Ubuntu virtual shell', () => {
  test('uses home paths, absolute paths, parent paths, and previous directories', () => {
    const result = run('pwd; cd Documents; pwd; cd ..; cd /; pwd; cd ~; cd -; pwd');
    expect(result.code).toBe(0);
    expect(result.output).toBe('/home/user\n/home/user/Documents\n/\n/\n/\n');
    expect(prompt(['home', 'user', 'Documents'], 'ubuntu')).toBe('user@reactos:~/Documents$');
    expect(run('cat /etc/os-release').output).toContain('ID=reactos');
  });
  test('chains filesystem changes against current state and shares them with Files', () => {
    const result = run('mkdir -p Projects/demo/sub && cd Projects/demo && echo "Hello Ubuntu" > "hello world.txt" && cat "hello world.txt"');
    expect(result.code).toBe(0);
    expect(result.output).toBe('Hello Ubuntu\n');
    expect(findNode(result.fs, ['Projects', 'demo', 'hello world.txt'])?.content).toBe('Hello Ubuntu\n');
    expect(findNode(DEFAULT_FS, ['Projects', 'demo'])).toBeNull();
  });
  test('preserves quoted shell punctuation, spaces, empty strings and output append', () => {
    const result = run('echo "a && b; c | d > e" > "quoted name.txt"; echo \'next line\' >> "quoted name.txt"; echo -n "" >> "quoted name.txt"; cat "quoted name.txt"');
    expect(result.code).toBe(0);
    expect(result.output).toBe('a && b; c | d > e\nnext line\n');
  });
  test('pipes text through grep, sorting, deduplication and word/line counts', () => {
    const result = run('echo "beta\nalpha\nalpha" > lines.txt; cat lines.txt | sort | uniq | grep -n alpha; cat lines.txt | head -n 2 | wc -l; tail -n 1 lines.txt');
    expect(result.code).toBe(0);
    expect(result.output).toBe('1:alpha\n2\nalpha\n');
    expect(run('echo "one two" | wc -w').output.trim()).toBe('2');
  });
  test('failed commands stop && while semicolons continue', () => {
    const result = run('cd missing && touch should-not-exist.txt; echo continued');
    expect(result.code).toBe(0);
    expect(result.output).toContain('continued');
    expect(findNode(result.fs, ['should-not-exist.txt'])).toBeNull();
    expect(run('echo hello | grep missing').code).toBe(1);
  });
  test('touch does not truncate, cp copies and mv renames without stale reads', () => {
    const result = run('mkdir sandbox; echo content > sandbox/a; touch sandbox/a; cp sandbox/a sandbox/b; mv sandbox/b sandbox/renamed; cat sandbox/renamed');
    expect(result.code).toBe(0);
    expect(result.output).toBe('content\n');
    expect(findNode(result.fs, ['sandbox', 'b'])).toBeNull();
    expect(findNode(result.fs, ['sandbox', 'a'])?.content).toBe('content\n');
    expect(findNode(result.fs, ['sandbox', 'renamed'])?.content).toBe('content\n');
  });
  test('recursive copying and removal preserve sensible directory errors', () => {
    const result = run('mkdir -p source/nested; touch source/nested/file; cp -r source copied; rm -r source; find copied -name file');
    expect(result.code).toBe(0);
    expect(result.output).toBe('copied/nested/file\n');
    expect(findNode(result.fs, ['source'])).toBeNull();
    expect(run('rm Documents').code).toBe(1);
    expect(run('rmdir Documents').code).toBe(1);
    expect(run('cp Documents duplicate').code).toBe(1);
    expect(run('cp -r Documents Documents/nested').code).toBe(1);
    expect(run('mv Documents Missing/renamed').code).toBe(1);
  });
  test('protects the virtual root and rejects bad redirects and malformed commands', () => {
    expect(run('rm -rf /').code).toBe(1);
    expect(run('touch /etc/changed').code).toBe(1);
    expect(run('echo x > /etc/os-release').code).toBe(1);
    expect(run('echo x > Missing/file').code).toBe(1);
    expect(run('echo x > Documents').code).toBe(1);
    const malformed = run('touch untouched; echo "unterminated');
    expect(malformed.code).toBe(2);
    expect(findNode(malformed.fs, ['untouched'])).toBeNull();
    expect(run('echo hello &&').code).toBe(2);
    expect(run('echo hello |').code).toBe(2);
  });
  test('runs script files and bounds recursive scripts', () => {
    const fs = createFile(cloneFS(DEFAULT_FS), [], 'demo.sh', '# comment\nmkdir demo\necho script > demo/file\ncat demo/file');
    const result = executeShell('sh demo.sh', fs, freshSession('ubuntu'), 'ubuntu');
    expect(result.code).toBe(0);
    expect(result.output).toBe('script\n');
    const loop = createFile(fs, [], 'loop.sh', 'sh loop.sh');
    expect(executeShell('./loop.sh', loop, freshSession('ubuntu'), 'ubuntu').output).toContain('nesting limit');
  });
  test('keeps calculator, history, clear and Windows aliases without evaluating JavaScript', () => {
    expect(run('calc (2 + 3) * -4').output).toBe('-20\n');
    expect(run('calc globalThis.process.exit()').code).toBe(1);
    expect(run('echo before; clear; echo after').output).toBe('after\n');
    expect(run('echo before; clear; echo after').clear).toBe(true);
    const history = executeShell('history', cloneFS(DEFAULT_FS), freshSession('ubuntu'), 'ubuntu', ['pwd', 'history']);
    expect(history.output).toBe('1  pwd\n2  history\n');
    const windows = executeShell('cd Documents; type Notes.txt', cloneFS(DEFAULT_FS), freshSession('win11'), 'win11');
    expect(windows.output).toContain('Meeting notes');
    expect(prompt(windows.cwd, 'win11')).toBe('PS C:\\Documents>');
    const original = cloneFS(DEFAULT_FS);
    expect(executeShell('pwd', original, freshSession('ubuntu'), 'ubuntu').fs).toBe(original);
  });
});
