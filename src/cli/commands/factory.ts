/**
 * Factory command (spec: OMC 软件工厂闭环, tracker issue #9).
 *
 * `omc factory listen` — the resident intake daemon. Transport adapters
 * (smee.io / cloudflared / direct) live outside the OMC boundary: the daemon
 * only receives already-unpacked webhook events as POSTs and does the OMC-side
 * work itself (HMAC verification, repo whitelist, intake label gate, routing
 * through the shared pure function, headless intent session spawn).
 *
 * Liveness: pid file at <omc root>/state/factory-listener.json (SessionStart
 * supervision reads it) plus a GET /status endpoint on the listening port.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { startListener, stopListener } from '../../factory/listener.js';

export function factoryCommand(): Command {
  const cmd = new Command('factory');
  cmd.description('Software factory automation (chain trigger + intake listener)');

  cmd
    .command('listen')
    .description('Run the intake listener daemon: HMAC-verified webhook events -> intake label gate -> headless intent sessions')
    .option('--port <n>', 'port to listen on (transport adapters forward here)', '7788')
    .option('--secret <s>', 'HMAC secret (defaults to OMC_FACTORY_HMAC_SECRET env)')
    .requiredOption('--repo <names>', 'repository whitelist, comma-separated owner/name')
    .option('--cwd <dir>', 'repository whose .omc state root the daemon writes to', process.cwd())
    .action((options: { port: string; secret?: string; repo: string; cwd: string }) => {
      const secret = options.secret ?? process.env.OMC_FACTORY_HMAC_SECRET;
      if (!secret) {
        console.error(chalk.red('refused: no HMAC secret. Pass --secret or set OMC_FACTORY_HMAC_SECRET.'));
        process.exitCode = 1;
        return;
      }
      const whitelist = options.repo.split(',').map((s) => s.trim()).filter(Boolean);
      if (whitelist.length === 0) {
        console.error(chalk.red('refused: --repo whitelist is empty.'));
        process.exitCode = 1;
        return;
      }
      const cwd = resolve(options.cwd);
      void startListener({ port: Number(options.port), secret, whitelist, cwd }).then((server) => {
        const addr = server.address();
        const port = addr && typeof addr !== 'string' ? addr.port : options.port;
        console.log(chalk.green(`factory listener on :${port} — whitelist: ${whitelist.join(', ')}`));
        console.log(chalk.gray('liveness: GET /status on the port above, or the pid file in .omc/state/factory-listener.json'));
        const stop = () => {
          stopListener(server, cwd);
          process.exit(0);
        };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
      });
    });

  return cmd;
}
