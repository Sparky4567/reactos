import type { FSNode } from '@/os/types';
import type { DesktopStyle } from '@/appearance/preferences';
import { cloneFS, createFile, createFolder, deleteNode, findNode, formatSize, pathStr, resolvePath } from '@/os/fs';
export interface ShellSession { cwd: string[]; previousCwd?: string[]; lastCode: number }
export interface ShellResult extends ShellSession { fs: FSNode; output: string; code: number; clear: boolean }
interface Result { out: string; code: number; clear?: boolean }
interface Token { value: string; operator: boolean }
interface Command { args: string[]; redirect?: { path: string; append: boolean } }
interface Group { commands: Command[]; successOnly: boolean }
export const COMMANDS = ['help', 'man', 'calc', 'pwd', 'ls', 'cd', 'cat', 'mkdir', 'touch', 'rm', 'rmdir', 'cp', 'mv', 'echo', 'head', 'tail', 'grep', 'wc', 'sort', 'uniq', 'find', 'tree', 'whoami', 'hostname', 'uname', 'date', 'uptime', 'neofetch', 'history', 'clear', 'bash', 'sh', 'run'];
const HELP = `ReactOS shell — commands operate on the desktop's virtual files.
Navigation:  pwd, ls [-lah] [path], cd [path | ~ | -]
Files:       cat [files], touch files, mkdir [-p] folders,
             cp [-r] source target, mv source target,
             rm [-rf] files, rmdir folders
Text:        echo [-n] text, head/tail [-n count] [file],
             grep [-invc] pattern [file], wc [-lwc] [file], sort, uniq
Browse:      find [path] [-name pattern], tree [path]
Math:        calc expression (arithmetic only)
System:      whoami, hostname, uname [-a], date, uptime, neofetch
Shell:       history, clear, help, man command, sh/bash/run script
Use quotes for spaces, | to pipe, > or >> to write output,
&& to continue on success, and ; to run commands in sequence.
Up/Down: history · Ctrl+L: clear · Ctrl+C: cancel input`;
export const freshSession = (style: DesktopStyle): ShellSession => ({ cwd: style === 'win11' ? [] : ['home', 'user'], lastCode: 0 });
export const displayPath = (cwd: string[], style: DesktopStyle) => style === 'win11' ? pathStr(cwd) : '/' + cwd.join('/');
export function prompt(cwd: string[], style: DesktopStyle) {
  if (style === 'win11') return `PS ${pathStr(cwd)}>`;
  const path = displayPath(cwd, style).replace(/^\/home\/user(?=\/|$)/, '~');
  return `user@reactos:${path}$`;
}
function tokenize(input: string, linux: boolean): Token[] {
  const tokens: Token[] = [];
  let value = '', quote = '', started = false;
  const push = () => { if (started) tokens.push({ value, operator: false }); value = ''; started = false; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '\\' && linux && quote !== "'") {
      if (i + 1 === input.length) throw new Error('Incomplete escape');
      value += input[++i]; started = true; continue;
    }
    if (quote) { if (c === quote) quote = ''; else value += c; started = true; continue; }
    if (c === '"' || c === "'") { quote = c; started = true; continue; }
    if (c === '#' && !started) { while (i < input.length && input[i] !== '\n') i++; push(); tokens.push({ value: ';', operator: true }); continue; }
    if (c === '\n' || c === ';' || c === '|' || c === '>' || c === '&' || c === '<') {
      push(); let operator = c === '\n' ? ';' : c;
      if ((c === '>' || c === '&' || c === '|') && input[i + 1] === c) operator += input[++i];
      if (['&', '<', '||'].includes(operator)) throw new Error(`Unsupported operator: ${operator}`);
      tokens.push({ value: operator, operator: true }); continue;
    }
    if (/\s/.test(c)) { push(); continue; }
    value += c; started = true;
  }
  if (quote) throw new Error('Unclosed quote');
  push(); return tokens;
}
function parse(tokens: Token[]): Group[] {
  const groups: Group[] = [];
  let group: Group = { commands: [], successOnly: false }, command: Command = { args: [] };
  const finishCommand = () => { if (!command.args.length) throw new Error('Expected a command'); group.commands.push(command); command = { args: [] }; };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.operator) { command.args.push(token.value); continue; }
    if (token.value === '>' || token.value === '>>') {
      const path = tokens[++i];
      if (!path || path.operator || !path.value || command.redirect) throw new Error('Invalid output redirection');
      command.redirect = { path: path.value, append: token.value === '>>' }; continue;
    }
    if (token.value === ';' && !command.args.length && !group.commands.length) continue;
    finishCommand();
    if (token.value === '|') continue;
    groups.push(group); group = { commands: [], successOnly: token.value === '&&' };
  }
  if (command.args.length) { finishCommand(); groups.push(group); }
  else if (group.commands.length || group.successOnly) throw new Error('Expected a command after operator');
  return groups;
}

export function executeShell(input: string, fs: FSNode, session: ShellSession, style: DesktopStyle, history: string[] = []): ShellResult {
  const linux = style !== 'win11';
  // Files is the user's home. Only /home/user is writable in the Linux view.
  let root: FSNode = linux ? { name: '/', type: 'folder', children: [
    { name: 'home', type: 'folder', children: [{ ...cloneFS(fs), name: 'user' }] },
    { name: 'etc', type: 'folder', children: [{ name: 'os-release', type: 'file', content: 'NAME="ReactOS Browser Desktop"\nID=reactos\nPRETTY_NAME="ReactOS Ubuntu-style desktop"\n' }] },
  ] } : cloneFS(fs);
  let cwd = [...session.cwd], previousCwd = session.previousCwd, code = session.lastCode, clear = false, count = 0;
  if (findNode(root, cwd)?.type !== 'folder') cwd = freshSession(style).cwd;
  const fail = (out: string): Result => ({ out: out + '\n', code: 1 });
  const ok = (out = ''): Result => ({ out, code: 0 });
  const print = (out: string) => ok(out ? out + '\n' : '');
  const resolve = (path: string) => {
    if (!linux) return resolvePath(cwd, path);
    if (path === '~' || path.startsWith('~/')) path = '/home/user' + path.slice(1);
    const result = path.startsWith('/') ? [] : [...cwd];
    for (const part of path.split('/')) { if (!part || part === '.') continue; if (part === '..') result.pop(); else result.push(part); }
    return result;
  };
  const writable = (path: string[]) => path.length > (linux ? 2 : 0) && (!linux || path[0] === 'home' && path[1] === 'user');
  const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
  const isAncestor = (a: string[], b: string[]) => a.length <= b.length && a.every((v, i) => b[i] === v);
  const ensureParent = (path: string[]) => writable(path) && findNode(root, path.slice(0, -1))?.type === 'folder';
  const read = (paths: string[], stdin: string): Result => {
    if (!paths.length) return ok(stdin);
    const content: string[] = [];
    for (const path of paths) { const node = findNode(root, resolve(path)); if (!node || node.type !== 'file') return fail(`cat: ${path}: No such file or is a directory`); content.push(node.content || ''); }
    return ok(content.join(''));
  };
  const write = (path: string[], content: string): Result => {
    if (!ensureParent(path)) return fail('Cannot write: missing parent directory or read-only path');
    if (findNode(root, path)?.type === 'folder') return fail('Cannot write: target is a directory');
    root = createFile(root, path.slice(0, -1), path.at(-1)!, content); return ok();
  };
  const shell = (text: string, depth = 0): Result => {
    if (depth > 8) return fail('Script nesting limit exceeded');
    let groups: Group[];
    try { groups = parse(tokenize(text, linux)); } catch (e) { return { out: `sh: ${(e as Error).message}\n`, code: 2 }; }
    const output: string[] = [];
    let cleared = false;
    for (const group of groups) {
      if (group.successOnly && code !== 0) continue;
      let stdin = '', result: Result = ok();
      for (const command of group.commands) {
        if (++count > 200) return fail('Command limit exceeded');
        result = atomic(command.args, stdin, depth);
        code = result.code;
        if (result.clear) { output.length = 0; cleared = true; }
        if (command.redirect && result.code === 0 && !result.clear) {
          const path = resolve(command.redirect.path);
          const existing = findNode(root, path);
          result = write(path, (command.redirect.append ? existing?.content || '' : '') + result.out);
          code = result.code;
        }
        stdin = result.out;
      }
      if (result.out) output.push(result.out);
    }
    return { out: output.join(''), code, clear: cleared };
  };
  const atomic = (argv: string[], stdin: string, depth: number): Result => {
    const name = linux ? argv[0]! : argv[0]!.toLowerCase();
    const args = argv.slice(1);
    const flags = args.filter(a => /^-[^-]/.test(a)).map(a => a.slice(1)).join('');
    const paths = args.filter(a => !a.startsWith('-'));
    const runFile = (path: string) => {
      const node = findNode(root, resolve(path));
      return node?.type === 'file' ? shell(node.content || '', depth + 1) : fail(`${name}: ${path}: No such file`);
    };
    switch (name) {
      case 'help': return print(HELP);
      case 'man': return COMMANDS.includes(args[0] || '') ? print(HELP) : fail(`man: no entry for ${args[0] || '(missing command)'}`);
      case 'clear': case 'cls': return { out: '', code: 0, clear: true };
      case 'echo': return ok((args[0] === '-n' ? args.slice(1) : args).join(' ') + (args[0] === '-n' ? '' : '\n'));
      case 'pwd': return print(displayPath(cwd, style));
      case 'cd': {
        if (args.length > 1) return fail('cd: too many arguments');
        if (args[0] === '-' && !previousCwd) return fail('cd: previous directory not set');
        const target = args[0] === '-' ? previousCwd! : resolve(args[0] || (linux ? '~' : '/'));
        if (findNode(root, target)?.type !== 'folder') return fail(`cd: ${args[0]}: No such directory`);
        previousCwd = cwd; cwd = [...target]; return args[0] === '-' ? print(displayPath(cwd, style)) : ok();
      }
      case 'ls': case 'dir': {
        if (/[^lah]/.test(flags)) return fail('ls: supported options: -l, -a, -h');
        const listings: string[] = [];
        for (const path of paths.length ? paths : ['.']) {
          const node = findNode(root, resolve(path)); if (!node) return fail(`ls: ${path}: No such file or directory`);
          const nodes = node.type === 'folder' ? node.children || [] : [node];
          const visible = nodes.filter(n => flags.includes('a') || !n.name.startsWith('.'));
          listings.push(visible.map(n => flags.includes('l') ? `${n.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--'} user user ${(flags.includes('h') ? formatSize(n.size ?? new TextEncoder().encode(n.content || '').length) : String(n.size ?? new TextEncoder().encode(n.content || '').length)).padStart(5)} ${n.name}${n.type === 'folder' ? '/' : ''}` : n.name + (n.type === 'folder' ? '/' : '')).join(flags.includes('l') ? '\n' : '  '));
        }
        return print(listings.filter(Boolean).join('\n'));
      }
      case 'cat': case 'type': return read(args, stdin);
      case 'mkdir': {
        if (/[^p]/.test(flags) || !paths.length) return fail('Usage: mkdir [-p] folder…');
        for (const path of paths) {
          const target = resolve(path), existing = findNode(root, target);
          if (existing) { if (flags.includes('p') && existing.type === 'folder') continue; return fail(`mkdir: ${path}: File exists`); }
          if (!writable(target)) return fail(`mkdir: ${path}: Read-only path`);
          for (let i = 1; i <= target.length; i++) {
            const prefix = target.slice(0, i), node = findNode(root, prefix);
            if (node?.type === 'file') return fail(`mkdir: ${path}: Not a directory`);
            if (!node) {
              if ((!flags.includes('p') && i !== target.length) || !ensureParent(prefix)) return fail(`mkdir: ${path}: Parent directory does not exist`);
              root = createFolder(root, prefix.slice(0, -1), prefix.at(-1)!);
            }
          }
        }
        return ok();
      }
      case 'touch': {
        if (!args.length) return fail('touch: missing file');
        for (const path of args) { const target = resolve(path); if (!writable(target)) return fail(`touch: ${path}: Protected path`); const existing = findNode(root, target); if (existing) { existing.modified = Date.now(); continue; } const result = write(target, ''); if (result.code) return result; }
        return ok();
      }
      case 'rm': case 'del': case 'rmdir': {
        if (/[^rf]/.test(flags) || !paths.length) return fail(`Usage: ${name} ${name === 'rm' ? '[-rf] ' : ''}path…`);
        for (const path of paths) {
          const target = resolve(path), node = findNode(root, target);
          if (!writable(target)) return fail(`${name}: ${path}: Protected path`);
          if (!node) { if (flags.includes('f')) continue; return fail(`${name}: ${path}: No such file`); }
          if (node.type === 'folder' && name !== 'rmdir' && !flags.includes('r')) return fail(`${name}: ${path}: Is a directory (use -r)`);
          if (name === 'rmdir' && (node.type !== 'folder' || node.children?.length)) return fail(`rmdir: ${path}: Not an empty directory`);
          if (isAncestor(target, cwd)) return fail(`${name}: ${path}: Directory is in use`);
          root = deleteNode(root, target);
        }
        return ok();
      }
      case 'cp': case 'copy': case 'mv': case 'move': {
        if (paths.length !== 2 || /[^rR]/.test(flags)) return fail(`Usage: ${name} [-r] source destination`);
        const source = resolve(paths[0]!), node = findNode(root, source);
        if (!node) return fail(`${name}: ${paths[0]}: No such file`);
        const moving = name === 'mv' || name === 'move';
        if (node.type === 'folder' && !moving && !/[rR]/.test(flags)) return fail('cp: source is a directory (use -r)');
        let target = resolve(paths[1]!);
        if (findNode(root, target)?.type === 'folder') target = [...target, node.name];
        if (!ensureParent(target) || (moving && !writable(source))) return fail(`${name}: missing parent or protected path`);
        if (same(source, target) || node.type === 'folder' && isAncestor(source, target)) return fail(`${name}: source and destination overlap`);
        if (moving && isAncestor(source, cwd)) return fail('mv: source directory is in use');
        const existing = findNode(root, target);
        if (existing?.type === 'folder' || existing && node.type === 'folder') return fail(`${name}: destination already exists`);
        const copied = { ...cloneFS(node), name: target.at(-1)!, modified: Date.now() };
        if (existing) root = deleteNode(root, target);
        const parent = findNode(root, target.slice(0, -1))!;
        parent.children = parent.children || []; parent.children.push(copied);
        if (moving) root = deleteNode(root, source);
        return ok();
      }
      case 'head': case 'tail': {
        let n = 10, rest = args;
        if (args[0] === '-n') { if (!/^\d+$/.test(args[1] || '')) return fail(`${name}: invalid line count`); n = Number(args[1]); rest = args.slice(2); }
        const result = read(rest, stdin); if (result.code) return result;
        const lines = result.out.replace(/\n$/, '').split('\n');
        return print(n && result.out ? (name === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n') : '');
      }
      case 'grep': {
        if (/[^invc]/.test(flags) || !paths.length) return fail('Usage: grep [-invc] pattern [file]');
        const result = read(paths.slice(1), stdin); if (result.code) return result;
        let regex: RegExp; try { regex = new RegExp(paths[0]!, flags.includes('i') ? 'i' : ''); } catch { return fail('grep: invalid pattern'); }
        const lines = result.out ? result.out.replace(/\n$/, '').split('\n') : [];
        const matches = lines.map((line, i) => ({ line, number: i + 1 })).filter(({ line }) => regex.test(line) !== flags.includes('v'));
        return { out: flags.includes('c') ? String(matches.length) + '\n' : matches.map(m => (flags.includes('n') ? `${m.number}:` : '') + m.line).join('\n') + (matches.length ? '\n' : ''), code: matches.length ? 0 : 1 };
      }
      case 'wc': {
        if (/[^lwc]/.test(flags)) return fail('Usage: wc [-lwc] [file]');
        const result = read(paths, stdin); if (result.code) return result;
        const counts = { l: (result.out.match(/\n/g) || []).length, w: (result.out.match(/\S+/g) || []).length, c: new TextEncoder().encode(result.out).length };
        return print([...(flags || 'lwc')].map(flag => counts[flag as keyof typeof counts]).join(' '));
      }
      case 'sort': case 'uniq': {
        const result = read(args, stdin); if (result.code) return result;
        if (!result.out) return ok();
        const lines = result.out.replace(/\n$/, '').split('\n');
        return print((name === 'sort' ? lines.sort() : lines.filter((line, i) => !i || line !== lines[i - 1])).join('\n'));
      }
      case 'tree': case 'find': {
        let path = args[0] || '.', pattern: RegExp | undefined;
        if (name === 'find') {
          const at = args.indexOf('-name'); if (at === 0) path = '.';
          if (at >= 0) { if (!args[at + 1]) return fail('find: missing name pattern'); pattern = new RegExp('^' + args[at + 1]!.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); }
        }
        const node = findNode(root, resolve(path)); if (!node) return fail(`${name}: ${path}: No such file or directory`);
        const lines: string[] = [];
        const walk = (n: FSNode, p: string, indent: string) => { if (!pattern || pattern.test(n.name)) lines.push(name === 'tree' ? indent + n.name + (n.type === 'folder' ? '/' : '') : p); for (const child of n.children || []) walk(child, p.replace(/\/$/, '') + '/' + child.name, indent + '  '); };
        walk(node, path, ''); return print(lines.join('\n'));
      }
      case 'calc': { try { return print(String(arithmetic(args.join(' ')))); } catch (e) { return fail(`calc: ${(e as Error).message}`); } }
      case 'whoami': return print('user');
      case 'hostname': return print('reactos');
      case 'uname': return print(args.includes('-a') ? 'ReactOS-browser 1.0 web JavaScript' : 'ReactOS-browser');
      case 'date': return print(new Date().toString());
      case 'uptime': return print(`${Math.floor(performance.now() / 1000)} seconds since page load`);
      case 'neofetch': return print(`OS: ReactOS Browser Desktop\nDesktop: ${style === 'ubuntu' ? 'Ubuntu' : style === 'chromeos' ? 'ChromeOS' : 'Windows 11'} style\nShell: ReactOS sh\nFilesystem: shared virtual desktop files\nUptime: ${Math.floor(performance.now() / 1000)}s`);
      case 'history': return print(history.map((line, i) => `${i + 1}  ${line}`).join('\n'));
      case 'sh': case 'bash': case 'run': return args[0] ? runFile(args[0]) : fail(`${name}: provide a script file`);
      case 'sudo': case 'apt': case 'apt-get': return fail(`${name}: host system commands are unavailable in this virtual terminal. Type help for supported commands.`);
      default: return (name.startsWith('./') || !linux && findNode(root, resolve(name))?.type === 'file') ? runFile(name) : { out: `${name}: command not found\n`, code: 127 };
    }
  };
  const result = shell(input);
  code = result.code; clear = !!result.clear;
  const home = linux ? findNode(root, ['home', 'user'])! : root;
  return { fs: JSON.stringify(home.children) === JSON.stringify(fs.children) ? fs : { ...fs, children: home.children }, cwd, previousCwd, lastCode: code, code, output: result.out, clear };
}

// Keep the existing calculator command without executing JavaScript from input.
function arithmetic(input: string): number {
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/%\-]/g) || [];
  if (tokens.join('') !== input.replace(/\s/g, '') || !tokens.length) throw new Error('Use numbers and + - * / % ( )');
  let position = 0;
  const atom = (): number => {
    const token = tokens[position++];
    if (token === '+') return atom();
    if (token === '-') return -atom();
    if (token === '(') { const value = sum(); if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis'); return value; }
    if (!token || !/^(\d|\.)/.test(token)) throw new Error('Expected a number');
    return Number(token);
  };
  const product = (): number => {
    let value = atom();
    while (['*', '/', '%'].includes(tokens[position] || '')) { const op = tokens[position++]; const right = atom(); value = op === '*' ? value * right : op === '/' ? value / right : value % right; }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[position] === '+' || tokens[position] === '-') { const op = tokens[position++]; const right = product(); value = op === '+' ? value + right : value - right; }
    return value;
  };
  const value = sum();
  if (position !== tokens.length || !Number.isFinite(value)) throw new Error('Invalid arithmetic expression');
  return value;
}
