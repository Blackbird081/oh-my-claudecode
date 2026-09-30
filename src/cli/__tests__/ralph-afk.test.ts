import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AFK_ALLOWED_TOOLS, AFK_SPAWN_FLAGS } from '../../hooks/session-end/spawn-next.js';
import { materializeRalphSkill, ralphAfkArgv } from '../commands/ralph.js';

const tempRoots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omc-ralph-afk-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('ralphAfkArgv', () => {
  it('invokes the project-scoped ralph skill with the task behind -p and a fresh session id', () => {
    const argv = ralphAfkArgv('raise coverage on the CLI helpers', [], 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(argv[0]).toBe('-p');
    expect(argv[1]).toBe('/ralph raise coverage on the CLI helpers');
    expect(argv[2]).toBe('--session-id');
    expect(argv[3]).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(argv.slice(4)).toEqual(AFK_SPAWN_FLAGS);
  });

  it('extends the AFK allowedTools with exactly the declared verify commands', () => {
    const argv = ralphAfkArgv('task', ['npm test', 'npm run build'], 'sess-x');
    const tools = argv[argv.indexOf('--allowedTools') + 1];
    expect(tools).toBe(`${AFK_ALLOWED_TOOLS},Bash(npm test),Bash(npm run build)`);
    // The allowedTools value is replaced in place — no stray base-profile token.
    expect(argv).toHaveLength(4 + AFK_SPAWN_FLAGS.length);
    expect(argv).not.toContain(AFK_ALLOWED_TOOLS);
  });

  it('drops verify commands that fail the argv-boundary recheck, leaving the base profile', () => {
    const argv = ralphAfkArgv('task', ['npm test && whoami', 'npm test,Write'], 'sess-y');
    expect(argv.slice(4)).toEqual(AFK_SPAWN_FLAGS);
  });
});

describe('materializeRalphSkill', () => {
  it('copies the bundled skill into the project scope and never overwrites', () => {
    const dir = tempDir();
    const target = join(dir, '.claude', 'skills', 'ralph', 'SKILL.md');
    const written = materializeRalphSkill(dir);
    // The bundled source ships with the package; when present it must land at
    // the project path the isolated session can actually load.
    if (written !== null) {
      expect(written).toBe(target);
      expect(readFileSync(target, 'utf8')).toContain('name: ralph');
    }
    writeFileSync(target, 'name: ralph\n# project-owned copy\n', 'utf8');
    expect(materializeRalphSkill(dir)).toBeNull();
    expect(readFileSync(target, 'utf8')).toContain('# project-owned copy');
  });
});

