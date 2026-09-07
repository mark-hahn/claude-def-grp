# Claude Default Group

A small VS Code extension that keeps Claude Code tabs in the first editor group.

The Claude Code extension opens its first tab in a new editor column and locks that
group, so files you open afterwards spawn more splits instead of joining your tabs.
This extension moves every Claude Code tab into the first editor group as soon as it
opens (and on startup), lets the emptied group close, and unlocks the active group
whenever editor groups change.

## Install

1. Download the latest `.vsix` from the
   [Releases page](https://github.com/mark-hahn/claude-def-grp/releases/latest).
2. Install it either from the command line

       code --install-extension claude-default-group-<version>.vsix

   or from the Extensions view: the `...` menu, then **Install from VSIX...**
3. Reload the window.

It runs on the local side of Remote-SSH and WSL windows, so one install covers them.

## Commands and settings

Commands: **Claude Default Group: Move Claude Tabs to First Group** and
**Claude Default Group: Unlock All Editor Groups**.

Settings under `claudeDefaultGroup`: `enabled`, `unlockOnGroupChange`, and `delayMs`
(how long to wait after a Claude tab opens before moving it).

Log: Output panel, channel "Claude Default Group".

## Build

    npx @vscode/vsce package
