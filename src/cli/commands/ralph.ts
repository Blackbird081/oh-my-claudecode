/**
 * `omc ralph afk "<task>" [--verify "<command>"]...` — launch a headless,
 * narrowly-permissioned ralph session and return to the prompt.
 *
 * Reuses the factory chain's AFK link profile (scoped allowlist +
 * project,local settings) and its argv builder, so a ralph run spawned here
 * obeys the same isolation contract as a chain link: no user-level hooks or
 * settings, no general Bash — only the gh/file/WebFetch surface plus exactly
 * the `--verify` commands, which pass the same routing validation and are
 * appended as exact `Bash(...)` entries.
 *
 * One consequence of that isolation drives the launch shape: a session with
 * `--setting-sources project,local` cannot see plugin-bundled skills, so a
 * `/oh-my-claudecode:ralph` prompt degrades into a plain one-shot request
 * (observed live). The ralph skill is therefore materialized as a PROJECT
 * skill before launch — the same contract chain rings already follow — and
 * invoked as `/ralph`.
 */

import { randomUUID } from 'crypto';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Command } from 'commander';
import { getSkillsDir } from '../../features/builtin-skills/skills.js';
import { defaultSpawnFn, factoryLinkArgv } from '../../hooks/session-end/spawn-next.js';

/** Args (command excluded) for one headless AFK ralph launch. */
export function ralphAfkArgv(task: string, verifyCommands: readonly string[] = [], sessionId: string = randomUUID()): string[] {
  return factoryLinkArgv(`/ralph ${task}`, sessionId, verifyCommands);
}

/**
 * Materialize the bundled ralph skill into the project's skill scope so the
 * isolated session can load it. Returns the written path, or null when a copy
 * already exists or the bundled source is unavailable.
 */
export function materializeRalphSkill(directory: string): string | null {
  const target = join(directory, '.claude', 'skills', 'ralph', 'SKILL.md');
  if (existsSync(target)) return null;
  const source = join(getSkillsDir(), 'ralph', 'SKILL.md');
  if (!existsSync(source)) return null;
  mkdirSync(join(directory, '.claude', 'skills', 'ralph'), { recursive: true });
  copyFileSync(source, target);
  return target;
}

export function ralphCommand(program: Command): Command {
  const cmd = program
    .command('ralph')
    .description('Ralph persistence loop launchers');
  cmd
    .command('afk')
    .description('Launch a headless ralph session with the factory AFK permission profile (scoped allowlist, project,local settings)')
    .argument('<task>', 'task description handed to the ralph loop')
    .option('--verify <command>', 'verification command the session may run (repeatable; validated like route-table verify entries)', (value: string, previous: string[]) => [...previous, value], [] as string[])
    .addHelpText('after', `
Examples:
  $ omc ralph afk "increase test coverage on the CLI helpers" --verify "npm test" --verify "npm run build"
  The spawned session runs /ralph with the factory AFK allowlist plus exactly
  the declared verify commands. The ralph skill is materialized as a project
  skill (.claude/skills/ralph) first — the isolated session cannot see
  plugin-bundled skills.`)
    .action((task: string, options: { verify: string[] }) => {
      const sessionId = randomUUID();
      const materialized = materializeRalphSkill(process.cwd());
      const argv = ralphAfkArgv(task, options.verify ?? [], sessionId);
      defaultSpawnFn('claude', argv, { cwd: process.cwd() });
      console.log(`ralph afk launched (session ${sessionId})`);
      console.log(`cwd ${process.cwd()}; verify: ${(options.verify ?? []).length > 0 ? options.verify.join(', ') : '(none declared)'}`);
      if (materialized) console.log(`ralph skill materialized: ${materialized}`);
    });
  return cmd;
}
