# OpenCode Sidebar Sessions

A TUI plugin that adds clickable session navigation to OpenCode's existing sidebar.

## Install

Install globally with OpenCode:

```bash
opencode plugin opencode-sidebar-sessions --global
```

OpenCode installs the package from npm, adds it to `~/.config/opencode/tui.json`, and loads its `./tui` export. Restart OpenCode if the plugin is not activated immediately.

You can also configure the published package manually:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-sidebar-sessions"]
}
```

## Features

- Shows root sessions from the current project.
- Places the session list directly below OpenCode's Context section.
- Uses each session's generated or renamed title.
- Groups sessions by local activity day.
- Sorts active sessions newest-first and places archived sessions at the bottom of their activity day.
- Highlights the current session.
- Keeps the full session list in a fixed 12-row scrollable pane.
- Truncates the current session title to one line so title changes do not shift the sidebar layout.
- Reuses OpenCode's native selector keybindings without opening its search UI.
- Archives the selected session with `a` after confirmation and strikes through archived titles.
- Refreshes when sessions are created, updated, renamed, or deleted.

OpenCode currently exposes `session.time.updated`, not a last-opened timestamp. The sidebar therefore groups by last activity, matching OpenCode's built-in session picker.

## Development

```bash
bun install
bun run check
```

## Local installation

Build the plugin:

```bash
bun run build
```

Add the built file to a project `tui.json` or to `~/.config/opencode/tui.json` for global use:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/absolute/path/to/opencode-sidebar-sessions/dist/tui.js"]
}
```

Restart OpenCode after changing `tui.json`.

The sidebar is part of OpenCode's session view. It opens automatically on terminals wider than 120 columns or with the configured sidebar toggle, which defaults to `<leader>b`.

Press `<leader>f` to focus the sidebar (`ctrl+x`, then `f`, with OpenCode's default leader). The displayed shortcut resolves the user's configured leader automatically. The sidebar uses the configured dialog-select controls: Up/`ctrl+p`, Down/`ctrl+n`, Page Up/Down, Home/End, and Enter. Press `a` to archive the selected session after confirmation; archived sessions remain at the bottom of their activity day with struck-through titles. Escape or `ctrl+c` returns to the prompt. Clicking the **Sessions** heading focuses the list, and rows remain directly clickable.

## Publishing

Releases are published to npm because OpenCode installs package plugins from the npm registry. npm Trusted Publishing cannot bootstrap a package, so publish the first version interactively:

```bash
npm login
npm whoami
npm publish --dry-run
npm publish
```

Then configure npm Trusted Publishing for the package with:

- Provider: GitHub Actions
- Organization or user: `swalker326`
- Repository: `opencode-sidebar-sessions`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Finally, enable automated publishing and run the workflow once:

```bash
gh variable set NPM_TRUSTED_PUBLISHING --body true
gh workflow run publish.yml
```

After that, pushing a new version in `package.json` to `main` publishes it automatically with GitHub OIDC and npm provenance. Pushes that do not change the version run CI and skip publishing. Verify releases with `npm view opencode-sidebar-sessions@latest version`.
