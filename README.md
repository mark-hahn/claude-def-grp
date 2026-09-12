# Claude Default Group

A small VS Code extension that keeps newly opened Claude Code tabs in the first editor group.

The Claude Code extension opens a tab from its sidebar in a new editor column and locks that
group, so files you open afterwards spawn more splits instead of joining your tabs.
This extension moves a Claude Code tab into the first editor group at the moment it is
opened, lets the emptied group close, and unlocks the active group whenever editor groups
change.

Only tabs that have just been opened are moved. Tabs restored with the window stay where
they were, and a Claude tab you drag to another group stays there. To gather every Claude
tab into the first group on demand, run the command below.

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
(how long to wait after a Claude tab opens before moving it; default and minimum 100 ms,
the settle time needed to tell a newly opened tab from one dragged between groups).

Log: Output panel, channel "Claude Default Group".

## Build

    npx @vscode/vsce package
