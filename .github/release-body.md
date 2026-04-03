# oh-my-claudecode v4.10.0: HUD upgrades, LSP diagnostics, security hardening, and workflow polish

## Release Notes

Release 4.10.0 delivers a meaningful usability bump across the HUD, LSP integrations, security boundaries, and hook/runtime correctness. Highlights include configurable HUD layouts with worktree awareness, Kotlin LSP 3.17 pull diagnostics support, stronger worker/security enforcement, better setup reliability, and several fixes around persistent modes, skill state cleanup, and installed-build behavior.

### Highlights

- **feat(hud): add worktree detection and configurable element ordering** — adds worktree-aware HUD context plus layout customization for element ordering and grouping. (#2083)
- **feat(lsp): support LSP 3.17 pull diagnostics for kotlin-lsp** — expands editor/runtime tooling support for Kotlin workflows. (#2007)
- **feat(skill): add self-improve autonomous code improvement skill** — introduces a new builtin workflow for autonomous code improvement loops. (#2074)
- **fix(security): harden worker/tool boundaries and sandbox behavior** — tightens Python sandboxing, worker command constraints, and external LLM enforcement. (#2047, #2028, #2022, #2010, #2009, #2005)
- **fix(runtime): resolve persistent-mode, stop-hook, and installed-build edge cases** — improves session continuation safety, skill-state cleanup, CLAUDE config profile handling, and installed HUD fallback behavior. (#2104, #2088, #2086, #2066, #2050)

### HUD & UX Improvements

- **feat(hud): add worktree detection and configurable element ordering** (#2083)
- **feat(hud): show elapsed time since prompt instead of clock timestamp** (#1934)
- **feat(hud): add per-model weekly quota display (sn:/op:)** (#1935)
- **feat(hud): add last tool name display (tool:Read)** (#1947)
- **feat(hud): add OSC 8 terminal hyperlinks for cwd element** (#1948)
- **fix(hud): canonicalize git paths and validate layout arrays**
- **fix(hud): support detail elements moved to inline groups via layout**
- **fix(hud): support inline elements moved to detail group via layout**
- **fix(hud): pass layout through config merge and fix detail ordering**
- **fix(hud): preserve legacy detail line ordering for agents multiline**
- **fix(hud): respect explicit safeMode: false on Windows** (#2037)
- **fix(hud): mark stale background tasks as failed before filtering** (#1968)
- **fix(hud): resolve autopilot phase undefined display** (#2039)
- **fix(hud): npm package fallback for installed builds** (#2066)

### Tools, Skills & Workflow

- **feat(lsp): support LSP 3.17 pull diagnostics for kotlin-lsp** (#2007)
- **feat(skill): add self-improve autonomous code improvement skill** (#2074)
- **feat(ralph): enforce prompt prerequisite sections as blocking gates** (#2044)
- **feat(teleport): symlink node_modules from parent repo** (#2043)
- **improve(skill): improve skill discoverability from frontmatter hints** (#2080)
- **internal(workflows): expose skininthegamebros-only builtin workflows for internal users** (#2078)
- **fix(keyword-detector): inject skill content directly instead of Skill tool dependency** (#2068)
- **fix(keyword-detector): prevent mode-message keywords from dispatching as missing skills** (#2055)
- **fix: prevent nested skill invocations from orphaning skill-active-state** (#2025)

### Runtime, Hooks & Reliability

- **fix: prevent stale Skill state from blocking session stop** (#2104)
- **fix: prevent Ralph stop-hook cancels from trapping continued sessions** (#2088)
- **fix: respect custom Claude config profiles during setup** (#2086)
- **fix(state-tools): write cancel signal in state_clear when no session_id provided** (#2102)
- **fix(pre-tool-enforcer): allow tier aliases when OMC_SUBAGENT_MODEL is set** (#2064, #2041)
- **fix(installer): update CLAUDE.md even when running in plugin context** (#2002)
- **fix(hooks): consolidate state management patterns across template hooks** (#1986)
- **fix(ask): strip CLAUDECODE env from advisor spawns** (#1984)
- **fix(ci/scripts): make version sync and release prep more reliable across platforms** (#2021)

### Security & Hardening

- **fix(security): harden python sandbox module blocklist (v2)** (#2047)
- **fix(security): block tmux send-keys in worker bash commands** (#2028)
- **fix(security): enforce disableExternalLLM in team worker contracts** (#2022)
- **fix(security): add hard max iteration limit for persistent modes** (#2010)
- **fix(security): add sandbox mode for python_repl** (#2009)
- **refactor(security): unify security config with OMC_SECURITY=strict** (#2006)
- **fix(security): restrict ast_grep_search/replace path to project root** (#2005)
- **fix: resolve security vulnerabilities, lint warnings, and CJS runtime bug** (#1994)

### Documentation

- **docs: restore shared/ directory (referenced by skills)** (#2046)
- **docs: add Getting Started, Hooks, and Tools guides** (#2029)
- **docs(security): add SECURITY.md with deployment guide** (#2023)
- **docs: fix REFERENCE.md accuracy and remove stale files** (#2035)
- **docs: remove unreferenced docs/ko/ translations** (#2032)
- **docs: remove stale partials/ and ANALYTICS-SYSTEM.md** (#2030)
- **docs: fix agent count in README (32 → 19)** (#2027)

### Stats

- **35+ merged PRs** | **8 major user-facing feature improvements** | **20+ bug/runtime fixes** | **7 security/hardening improvements**

### Install / Update

```bash
npm install -g oh-my-claude-sisyphus@4.10.0
```

Or reinstall the plugin:

```bash
claude /install-plugin oh-my-claudecode
```

**Full Changelog**: https://github.com/Yeachan-Heo/oh-my-claudecode/compare/v4.9.3...v4.10.0

## Contributors

Thank you to all contributors who made this release possible!

@Yeachan-Heo @blue-int @2233admin @EthanJStark @lonj7798 @ZHbin0 @devswha @DdangJin @Songgyubin @riftzen-bit @sercankaya @tjsingleton
