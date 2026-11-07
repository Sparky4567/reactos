import { expect, test } from 'bun:test';
import { wakeCommand } from './wakeWord';

test('accepts a sentence prefix, strips the wake phrase and preserves the message', () => {
  expect(wakeCommand('  REACTOS, what time is it?', 'ReactOS')).toBe('what time is it?');
  expect(wakeCommand('Hey   computer: open settings', 'hey computer')).toBe('open settings');
  expect(wakeCommand('ReactOS', 'ReactOS')).toBe('');
});

test('ignores ambient speech, mid-sentence mentions and partial word matches', () => {
  expect(wakeCommand('I mentioned ReactOS yesterday', 'ReactOS')).toBeNull();
  expect(wakeCommand('ReactOSaurus open settings', 'ReactOS')).toBeNull();
  expect(wakeCommand('hello there', 'ReactOS')).toBeNull();
  expect(wakeCommand('anything', '   ')).toBeNull();
});

test('treats custom wake words as literal text rather than regular expressions', () => {
  expect(wakeCommand('c++: explain pointers', 'c++')).toBe('explain pointers');
  expect(wakeCommand('robotX open settings', 'robot.')).toBeNull();
});
