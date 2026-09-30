/**
 * `omc ralph afk "<task>" [--verify "<command>"]...` — launch a headless,
 * narrowly-permissioned ralph session and return to the prompt.
 *
 * Reuses the factory chain's AFK link profile (scoped allowlist +
 * project,local settings) and its argv builder, so a ralph run spawned here
 * obeys the same isolation contract as a chain link: no user-level hooks or
 * settings, no general Bash — only the gh/file/WebFetch surface, the
 * read-only git commands ralph's own stale-state detection needs, and
 * exactly the declared `--verify` commands.
 *
 * Two consequences of that isolation shape the launch:
 * - A session with `--setting-sources project,local` cannot see
 *   plugin-bundled skills, so a `/oh-my-claudecode:ralph` prompt degrades
 *   into a plain one-shot request. The ralph skill is materialized as a
 *   PROJECT skill before launch (the chain-ring contract) and invoked as
 *   `/ralph`.
 * - The mandatory deslop pass (Step 7.5) invokes the plugin-bundled
 *   `ai-slop-cleaner` skill, which such a session equally cannot see — the
 *   pass could never complete and the loop would stall. The launch
 *   therefore injects `--no-deslop`; HITL ralph runs keep the pass.
 */

import { randomUUID } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Command } from 'commander';
import { getSkillsDir } from '../../features/builtin-skills/skills.js';
import { defaultSpawnFn, factoryLinkArgv } from '../../hooks/session-end/spawn-next.js';
import { MAX_VERIFY_COMMANDS } from '../../hooks/session-end/routing.js';

/** Read-only git commands ralph's stale-PRD detection and gitGrep checks need. */
const RALPH_AFK_READONLY_GIT = ['git status', 'git log', 'git diff', 'git rev-parse', 'git show', 'git merge-base'];

/** Args (command excluded) for one headless AFK ralph launch. */
export function ralphAfkArgv(task: string, verifyCommands: readonly string[] = [], sessionId: string = randomUUID()): string[] {
  // ralph's read-only git set rides the fixed-entry slot so it never eats
  // into the MAX_VERIFY_COMMANDS budget of the declared --verify list.
  const prompt = `/ralph --no-deslop ${task}`;
  return factoryLinkArgv(prompt, sessionId, verifyCommands, RALPH_AFK_READONLY_GIT);
}

export type SkillMaterialization = { status: 'created'; path: string } | { status: 'present' | 'diverged'; path: string };

/**
 * Materialize the bundled ralph skill into the project's skill scope so the
 * isolated session can load it. An existing project copy is never clobbered:
 * identical content is a no-op, diverged content is reported so a stale copy
 * from an older OMC install cannot silently persist across upgrades.
 */
export function materializeRalphSkill(directory: string): SkillMaterialization | null {
  const target = join(directory, '.claude', 'skills', 'ralph', 'SKILL.md');
  const source = join(getSkillsDir(), 'ralph', 'SKILL.md');
  if (!existsSync(source)) return null;
  const bundled = readFileSync(source, 'utf8');
  if (existsSync(target)) {
    const status = readFileSync(target, 'utf8') === bundled ? 'present' : 'diverged';
    return { status, path: target };
  }
  mkdirSync(join(directory, '.claude', 'skills', 'ralph'), { recursive: true });
  copyFileSync(source, target);
  return { status: 'created', path: target };
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
  The spawned session runs /ralph (with --no-deslop: the mandatory deslop
  skill is plugin-bundled and invisible to the isolated session) under the
  factory AFK allowlist, read-only git, plus exactly the declared verify
  commands. The ralph skill is materialized as a project skill
  (.claude/skills/ralph) first — add it to .gitignore if the repo does not
  already ignore .claude/.`)
    .action((task: string, options: { verify: string[] }) => {
      if ((options.verify ?? []).length > MAX_VERIFY_COMMANDS) {
        console.error(`ralph afk refused: at most ${MAX_VERIFY_COMMANDS} --verify commands are allowed (got ${options.verify.length})`);
        process.exitCode = 1;
        return;
      }
      let materialized: SkillMaterialization | null;
      try {
        materialized = materializeRalphSkill(process.cwd());
      } catch (error) {
        console.error(`ralph afk refused: could not materialize the ralph skill (${error instanceof Error ? error.message : String(error)})`);
        process.exitCode = 1;
        return;
      }
      if (materialized?.status === 'diverged') {
        console.warn(`warning: ${materialized.path} differs from the bundled ralph skill — delete it to refresh, or keep it if the divergence is intentional`);
      }
      const sessionId = randomUUID();
      const argv = ralphAfkArgv(task, options.verify ?? [], sessionId);
      const child = defaultSpawnFn('claude', argv, { cwd: process.cwd() }) as { pid?: number; on?: (event: string, listener: (error: Error) => void) => void };
      if (typeof child.on === 'function') {
        child.on('error', (error) => {
          console.error(`ralph afk spawn failed: ${error.message}`);
          process.exitCode = 1;
        });
      }
      if (child.pid === undefined) {
        console.error('ralph afk spawn failed: no child process was created');
        process.exitCode = 1;
        return;
      }
      console.log(`ralph afk launched (session ${sessionId})`);
      console.log(`cwd ${process.cwd()}; verify: ${(options.verify ?? []).length > 0 ? options.verify.join(', ') : '(none declared)'}`);
      if (materialized?.status === 'created') console.log(`ralph skill materialized: ${materialized.path} (consider gitignoring .claude/)`);
    });
  return cmd;
}
