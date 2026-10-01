# oh-my-claudecode v5.6.0: omc ralph verify, omc ralph afk, risk-ordered stories, repo

## Release Notes

Release with **19 new features**, **47 bug fixes**, **7 other changes** across **78 merged PRs**.

### Highlights

- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)

### New Features

- **feat(ralph): omc ralph verify — the single executor of the feedback diff** (#4188)
- **feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing** (#4187)
- **feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline** (#4184)
- **feat(session-end): let a route stage declare its AFK verify commands** (#4179)
- **feat(session-end): daily-chain-limit env override + diff-first gate doctrine** (#4182)
- **feat(factory): enforcement layer completion - CI trigger, factory init, check evidence, diff-first, daily cap** (#4183)
- **feat(factory): chain termination semantics + AFK hook isolation** (#4166)
- **feat(factory): v2 headless-chain hardening — AFK profile, cwd passthrough, watchdog, enqueuer registration** (#4153)
- **feat: software factory closed loop (SessionEnd chain trigger + tracker intake)** (#4151)
- **feat: host-load gate for concurrent sessions** (#4150)
- **feat(skills): unattended-run hardening - closeouts, AFK protocol, budget stop, guardrails, headless intake** (#4113)
- **feat(cli): omc intake - the harbor headless sweep and its host-native schedule** (#4143)
- **feat(hooks): budget-guard - enforce OMC_RUN_BUDGET_TOKENS at Stop** (#4117)
- **feat(skills): map - the yard's skill map, one router for 47 skills** (#4116)
- **feat(skills): close the delivery loop - tdd discipline, debugger seam findings, refit bite-proof, two-axis review** (#4112)
- **feat(skills): add refit and pr skills, harden launch frontier execution** (#4110)
- **feat(jev): record token usage in the shadow log and add OMC_JEV_QUIET** (#4107)
- **feat(jev): wire slop-warning through the script-side judgment channel** (#4095)
- **feat(jev): env-activated active mode and script-side judgment channel** (#4093)

### Bug Fixes

- **fix(team): make native addon error explicit for darwin** (#4197)
- **fix(team): add OMC_TEAM_WORKER_ENV_PASSTHROUGH for custom provider credentials** (#4196)
- **fix(team): use dynamic window index for detached sessions instead of hardcoded :0** (#4198)
- **fix(team): use load-buffer + paste-buffer for long tmux worker commands** (#4195)
- **fix(workflow-drift-guard): don't flag runtime-conditional test.skip as a skipped test** (#4190)
- **fix(lsp): normalize diagnostic URI keys so Windows drive-letter encoding matches** (#4186)
- **fix(session-end): pass model-provider auth through to action runner children** (#4178)
- **fix(hooks): stop the directory-context walk at the real working directory** (#4177)
- **fix(session-end): make the project route table the single source of truth** (#4176)
- **fix(bridge): symlink-robust main-module dispatch and loud session-end forward failures** (#4171)
- **fix(session-end): treat headless completion reason=other as success** (#4172)
- **fix(session-end): route gh tracker spawns through cmd.exe on win32** (#4174)
- **fix(session-end): always launch the worker once the chain is enqueued** (#4175)
- **fix(session-end): plan chain enqueue on the plugin-path SessionEnd bootstrap** (#4170)
- **fix(session-end): forward ANTHROPIC_* and OMC_HOOK_BRIDGE to session-end workers** (#4168)
- **fix(team): preserve Claude worker profile env** (#4167)
- **fix(hooks): read the XDG global config in the code-simplifier Stop hook** (#4160)
- **fix(rules-injector): let **/ match zero directories in rule globs** (#4161)
- **fix(installer): escape newlines in Codex MCP TOML strings** (#4158)
- **fix(atomic-write): tolerate zero lstat dev on Windows in file identity checks** (#4159)
- **fix(cli): launch claude via COMSPEC on Windows instead of shell:true** (#4155)
- **fix(hooks): skip every git global option in git-guardrails** (#4152)
- **fix: Handle non-interactive stdin in uninstall script** (#17)
- **fix: port Windows processStart encoding to .mjs copies** (#4148)
- **fix: state-lock owner-file fallback race condition breaks mutual exclusion** (#4149)
- **fix(omc-setup): drop leading slash from star endpoint for Git Bash** (#4145)
- **fix(team): give Claude startup evidence a final recheck window** (#4135)
- **fix(team): merge unobserved worker commits at shutdown** (#4133)
- **fix(team): recognize current Claude Code busy spinners** (#4132)
- **fix(team): clarify forced shutdown cleanup behavior** (#4131)
- **fix(jev): wire remaining judgment points into plugin hook scripts** (#4121)
- **fix(setup): stop shadowing plugin wiki skill on plugin installs** (#4119)
- **fix(hooks): resolve the state root without depending on git on PATH** (#4115)
- **fix(jev): validate numeric env overrides** (#4109)
- **fix(team): keep a claim error line on a busy startup miss** (#4105)
- **fix(team): accept baseline SystemRoot in Windows worker launch descriptors** (#4104)
- **fix(cli): group native-Windows claude guard so the launch chain runs** (#4101)
- **fix(team): distinguish a busy pane from startup success** (#4099)
- **fix(hud): stop stale stdin rate limits from hiding fresher usage API values** (#4098)
- **fix(installer): skip user-owned symlink/file collisions in bundled skill sync** (#4097)
- **fix(team): keep team surfaces and worker reaping distinct** (#4094)
- **fix(jev): send the request shape the TypeSafe API accepts** (#4092)
- **fix(team): report start failures and mixed-role prompts honestly** (#4090)
- **fix(hooks): validate the preemptive compaction cooldown override** (#4089)
- **fix(hooks): validate agent output limit overrides** (#4088)
- **fix(hooks): release the unread worker stdin that made every skipped hook pay its full timeout** (#4087)
- **fix(release): derive recovery identity from dispatch inputs and outlast registry propagation** (#4084)

### Documentation

- **docs(design): software factory final design - 13 foundation stones + v1.3 borrowings** (#4181)
- **docs(jev): document Jev configuration and judgment points** (#4165)
- **docs(design): P2 contract - run ledger and intake CLI** (#4141)
- **docs(skills): sync skills/AGENTS.md inventory with the actual skills directory** (#4114)

### Other Changes

- **fix(session-end)+feat(factory): name silent chain stalls, add 'omc factory status' audit view** (#4180)
- **Fix Windows standalone state-lock bridge paths** (#4140)
- **Fix team API lookup with OMC_STATE_DIR** (#4134)
- **Guard omc team against accidental starts** (#4137)
- **Fix Claude Code directory trust dialog detection** (#4136)
- **Sanitize tmux worker pane environments** (#4138)
- **Fix incorrect git remote -v example output in CONTRIBUTING.md** (#4108)

### Stats

- **78 PRs merged** | **19 new features** | **47 bug fixes** | **0 security/hardening improvements** | **7 other changes**
