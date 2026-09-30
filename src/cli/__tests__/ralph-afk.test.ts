import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const spawnMock = vi.hoisted(() => ({ defaultSpawnFn: vi.fn(() => ({ pid: 4242, unref: vi.fn() })) }));
vi.mock('../../hooks/session-end/spawn-next.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/session-end/spawn-next.js')>();
  return { ...actual, defaultSpawnFn: spawnMock.defaultSpawnFn };
});

import { AFK_ALLOWED_TOOLS, AFK_SPAWN_FLAGS } from '../../hooks/session-end/spawn-next.js';
import { materializeRalphSkill, ralphAfkArgv, ralphCommand } from '../commands/ralph.js';
import { Command } from 'commander';

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omc-ralph-afk-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
  spawnMock.defaultSpawnFn.mockClear();
});

describe('ralphAfkArgv', () => {
  it('invokes /ralph with --no-deslop, the task, and a fresh session id', () => {
    const argv = ralphAfkArgv('raise coverage on the CLI helpers', [], 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(argv[0]).toBe('-p');
    expect(argv[1]).toBe('/ralph --no-deslop raise coverage on the CLI helpers');
    expect(argv[2]).toBe('--session-id');
    expect(argv[3]).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    // Base profile shape, with the always-present read-only git extension.
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
    expect(argv[argv.indexOf('--setting-sources') + 1]).toBe('project,local');
    expect(argv[argv.indexOf('--allowedTools') + 1]).toContain(AFK_ALLOWED_TOOLS);
    expect(argv).toHaveLength(4 + AFK_SPAWN_FLAGS.length);
  });

  it('extends the AFK allowedTools with the read-only git set plus the declared verify commands', () => {
    const argv = ralphAfkArgv('task', ['npm test'], 'sess-x');
    const tools = argv[argv.indexOf('--allowedTools') + 1];
    expect(tools).toBe(`${AFK_ALLOWED_TOOLS},Bash(git status),Bash(git log),Bash(git diff),Bash(git rev-parse),Bash(git show),Bash(git merge-base),Bash(npm test)`);
    // The allowedTools value is replaced in place — no stray base-profile token.
    expect(argv).toHaveLength(4 + AFK_SPAWN_FLAGS.length);
    expect(argv).not.toContain(AFK_ALLOWED_TOOLS);
  });

  it('drops verify commands that fail the argv-boundary recheck, keeping the git set', () => {
    const argv = ralphAfkArgv('task', ['npm test && whoami', 'npm test,Write'], 'sess-y');
    const tools = argv[argv.indexOf('--allowedTools') + 1];
    expect(tools).toContain('Bash(git status)');
    expect(tools).not.toContain('whoami');
  });

  it('keeps the full verify budget on top of the read-only git set', () => {
    const verify = Array.from({ length: 10 }, (_, i) => `npm run check${i}`);
    const argv = ralphAfkArgv('task', verify, 'sess-z');
    const tools = argv[argv.indexOf('--allowedTools') + 1];
    expect(tools).toContain('Bash(git merge-base)');
    for (const command of verify) expect(tools).toContain(`Bash(${command})`);
  });
});

describe('materializeRalphSkill', () => {
  it('copies the bundled skill and reports created, then present when identical', () => {
    const dir = tempDir();
    const target = join(dir, '.claude', 'skills', 'ralph', 'SKILL.md');
    const first = materializeRalphSkill(dir);
    expect(first).toEqual({ status: 'created', path: target });
    expect(readFileSync(target, 'utf8')).toContain('name: ralph');
    expect(materializeRalphSkill(dir)).toEqual({ status: 'present', path: target });
  });

  it('never clobbers a diverged project copy — it reports the divergence', () => {
    const dir = tempDir();
    const target = join(dir, '.claude', 'skills', 'ralph', 'SKILL.md');
    mkdirSync(join(dir, '.claude', 'skills', 'ralph'), { recursive: true });
    writeFileSync(target, 'name: ralph\n# project-owned customization\n', 'utf8');
    expect(materializeRalphSkill(dir)).toEqual({ status: 'diverged', path: target });
    expect(readFileSync(target, 'utf8')).toContain('# project-owned customization');
  });
});

describe('omc ralph afk command', () => {
  it('accumulates repeatable --verify options and spawns claude in the invocation cwd', async () => {
    const dir = tempDir();
    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const program = new Command();
      program.exitOverride();
      ralphCommand(program);
      await program.parseAsync(['ralph', 'afk', 'do the thing', '--verify', 'npm test', '--verify', 'npm run build'], { from: 'user' });

      expect(spawnMock.defaultSpawnFn).toHaveBeenCalledTimes(1);
      const [command, args, ctx] = spawnMock.defaultSpawnFn.mock.calls[0] as unknown as [string, string[], { cwd?: string }];
      expect(command).toBe('claude');
      expect(args[1]).toBe('/ralph --no-deslop do the thing');
      const tools = args[args.indexOf('--allowedTools') + 1];
      expect(tools).toContain('Bash(npm test)');
      expect(tools).toContain('Bash(npm run build)');
      expect(ctx.cwd).toBe(dir);
      // The ralph skill must be loadable by the isolated session.
      expect(readFileSync(join(dir, '.claude', 'skills', 'ralph', 'SKILL.md'), 'utf8')).toContain('name: ralph');
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('refuses more --verify commands than the budget instead of dropping them', async () => {
    const program = new Command();
    program.exitOverride();
    ralphCommand(program);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const verifyArgs = Array.from({ length: 11 }, (_, i) => ['--verify', `npm run check${i}`]).flat();
    try {
      await program.parseAsync(['ralph', 'afk', 't', ...verifyArgs], { from: 'user' });
      expect(spawnMock.defaultSpawnFn).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(errorSpy.mock.calls[0][0]).toContain('at most 10 --verify');
    } finally {
      process.exitCode = undefined;
      errorSpy.mockRestore();
    }
  });
});
