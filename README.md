# Claude Default Group

Personal VS Code extension. The Claude Code extension opens its first tab in a new
editor column and locks that group. This extension moves every Claude Code tab into
the first editor group as soon as it opens (and on startup), lets the emptied group
close, and unlocks the active group whenever editor groups change.

Commands: "Claude Default Group: Move Claude Tabs to First Group" and
"Claude Default Group: Unlock All Editor Groups". Settings live under `claudeDefaultGroup`.
Log: Output panel, channel "Claude Default Group".

Build: `npx @vscode/vsce package --allow-missing-repository --skip-license`
Install: `code --install-extension claude-default-group-<version>.vsix --force`
