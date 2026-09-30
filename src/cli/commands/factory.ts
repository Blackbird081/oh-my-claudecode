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
import { readChainStatus, type ChainStatus } from '../../factory/status.js';

function renderChainStatus(status: ChainStatus): string {
  const lines: string[] = [];
  lines.push(`链状态 ${status.directory}`);
  lines.push(`路由表（.omc/factory-routes.json，单一权威）: ${status.routeKeys.length} 键${status.routeKeys.length > 0 ? ` — ${status.routeKeys.join(', ')}` : ''}`);
  lines.push(`活跃 ledger: ${status.activeLedgers}`);
  lines.push(`意图（${status.intents.length}）:`);
  if (status.intents.length === 0) lines.push('  （无决策记录）');
  for (const intent of status.intents) {
    const last = intent.lastDecision ? `${intent.lastDecision} @ ${intent.lastDecisionAt ?? '?'}` : '无';
    const stopped = intent.stopped ? `  停链[${intent.stopped.reason}]` : '';
    lines.push(`  ${intent.intentId}  决策 ${intent.decisionCount}  末次 ${last}${stopped}`);
  }
  lines.push(`停滞环（阈值 30min 未推进）: ${status.stalled.length}`);
  for (const stall of status.stalled) {
    lines.push(`  ${stall.intentId} stage=${stall.stage} 停滞 ${Math.round(stall.stalledForMs / 60_000)}min session=${stall.session}`);
  }
  return lines.join('\n');
}

export function factoryCommand(): Command {
  const cmd = new Command('factory');
  cmd.description('Software factory automation (chain trigger + intake listener)');

  cmd
    .command('listen')
    .description('Run the intake listener daemon: HMAC-verified webhook events -> intake label gate -> headless intent sessions')
    .option('--port <n>', 'port to listen on (transport adapters forward here)', '7788')
    .option('--host <addr>', 'host to bind to (default: 127.0.0.1 for localhost only; set to 0.0.0.0 only when transport adapter runs on another machine)', '127.0.0.1')
    .requiredOption('--repo <names>', 'repository whitelist, comma-separated owner/name')
    .option('--cwd <dir>', 'repository whose .omc state root the daemon writes to', process.cwd())
    .action((options: { port: string; host: string; repo: string; cwd: string }) => {
      const secret = process.env.OMC_FACTORY_HMAC_SECRET;
      if (!secret) {
        console.error(chalk.red('refused: no HMAC secret. Set OMC_FACTORY_HMAC_SECRET.'));
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
      void startListener({ port: Number(options.port), secret, whitelist, cwd, host: options.host }).then((server) => {
        const addr = server.address();
        const port = addr && typeof addr !== 'string' ? addr.port : options.port;
        const host = addr && typeof addr !== 'string' ? addr.address : options.host;
        console.log(chalk.green(`factory listener on ${host}:${port} — whitelist: ${whitelist.join(', ')}`));
        console.log(chalk.gray(`liveness: GET http://${host === '::' ? '[::1]' : host}:${port}/status or check .omc/state/factory-listener.json`));
        const stop = () => {
          stopListener(server, cwd);
          process.exit(0);
        };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
      });
    });

  // Read-only audit view of this project's chain: decision trail, stop
  // markers, live ledgers, stalled links (D2). Never writes.
  cmd
    .command('status')
    .description('Summarize this project\'s chain decisions, stop markers, and stalled links (read-only)')
    .option('--json', 'Output as JSON')
    .action((options: { json?: boolean }) => {
      const status = readChainStatus(process.cwd());
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(renderChainStatus(status));
    });

  return cmd;
}
