'use strict';
const vscode = require('vscode');

const GROUP_NAMES = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
const CLAUDE_MARK = 'claudeVSCodePanel'; // the Claude Code extension's webview panel viewType

const out = vscode.window.createOutputChannel('Claude Default Group');
const log = (msg) => out.appendLine(`${new Date().toISOString()} ${msg}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (cmd, ...args) => vscode.commands.executeCommand(cmd, ...args);
const cfg = (key, dflt) => vscode.workspace.getConfiguration('claudeDefaultGroup').get(key, dflt);
const groups = () => vscode.window.tabGroups.all;
const activeGroup = () => vscode.window.tabGroups.activeTabGroup;

function isClaudeTab(tab) {
  const input = tab && tab.input;
  return input instanceof vscode.TabInputWebview && String(input.viewType).includes(CLAUDE_MARK);
}

function claudeTabsOutsideFirst() {
  const list = [];
  for (const g of groups()) {
    if (g.viewColumn === vscode.ViewColumn.One) continue;
    for (const t of g.tabs) if (isClaudeTab(t)) list.push(t);
  }
  return list;
}

async function focusGroup(viewColumn) {
  const name = GROUP_NAMES[viewColumn - 1];
  if (!name) return false;
  await run(`workbench.action.focus${name}EditorGroup`);
  for (let i = 0; i < 5 && activeGroup().viewColumn !== viewColumn; i++) await sleep(30);
  return activeGroup().viewColumn === viewColumn;
}

// Focus the tab's group and make that tab the active one in it.
async function activateTab(tab) {
  if (!(await focusGroup(tab.group.viewColumn))) return false;
  const same = (t) => t === tab || (isClaudeTab(t) && t.label === tab.label);
  let g = activeGroup();
  if (g.activeTab && same(g.activeTab)) return true;
  const index = g.tabs.findIndex(same);
  if (index >= 0) {
    await run('workbench.action.openEditorAtIndex', index);
    await sleep(30);
    g = activeGroup();
    if (g.activeTab && same(g.activeTab)) return true;
  }
  // Fallback: step through the group's tabs until the Claude tab is active.
  for (let i = 0; i < g.tabs.length; i++) {
    await run('workbench.action.nextEditorInGroup');
    await sleep(30);
    g = activeGroup();
    if (g.activeTab && same(g.activeTab)) return true;
  }
  return false;
}

async function moveToFirstGroup(tab) {
  const src = tab.group.viewColumn;
  if (src === vscode.ViewColumn.One) return false;
  if (!(await activateTab(tab))) {
    log(`could not activate Claude tab "${tab.label}" in group ${src}`);
    return false;
  }
  await run('workbench.action.moveEditorToFirstGroup');
  await sleep(30);
  log(`moved "${tab.label}" from group ${src} to group 1`);
  return true;
}

async function unlockActive() {
  try {
    await run('workbench.action.unlockEditorGroup');
  } catch (e) {
    log(`unlock failed: ${e}`);
  }
}

// A group emptied by a move normally closes itself (workbench.editor.closeEmptyGroups).
// If one is left behind, unlock it and close it.
async function closeEmptyGroups() {
  for (let i = 0; i < 8; i++) {
    const empty = groups().find((g) => g.tabs.length === 0);
    if (!empty) return;
    if (!(await focusGroup(empty.viewColumn))) return;
    await unlockActive();
    await run('workbench.action.closeGroup');
    await sleep(30);
  }
}

let busy = false;
let pending = false;

async function tidy(reason) {
  if (!cfg('enabled', true)) return;
  pending = true;
  if (busy) return;
  busy = true;
  try {
    while (pending) {
      pending = false;
      let moved = 0;
      for (let i = 0; i < 16; i++) {
        const tab = claudeTabsOutsideFirst()[0];
        if (!tab) break;
        if (!(await moveToFirstGroup(tab))) break;
        moved++;
      }
      if (moved) {
        await closeEmptyGroups();
        await focusGroup(vscode.ViewColumn.One);
        log(`${reason}: moved ${moved} Claude tab(s) to group 1`);
      }
      await unlockActive();
    }
  } catch (e) {
    log(`${reason}: ${e && e.stack ? e.stack : e}`);
  } finally {
    busy = false;
  }
}

async function unlockAllGroups() {
  const start = activeGroup().viewColumn;
  for (const g of groups()) {
    if (await focusGroup(g.viewColumn)) await unlockActive();
  }
  await focusGroup(start);
  log('unlocked every editor group');
}

function activate(context) {
  const delay = () => Math.max(0, Number(cfg('delayMs', 0)) || 0);

  context.subscriptions.push(
    out,
    vscode.commands.registerCommand('claudeDefaultGroup.moveClaudeTabs', () => tidy('command')),
    vscode.commands.registerCommand('claudeDefaultGroup.unlockAllGroups', unlockAllGroups),

    vscode.window.tabGroups.onDidChangeTabs((e) => {
      if (!cfg('enabled', true)) return;
      const hit = e.opened.some((t) => isClaudeTab(t) && t.group.viewColumn !== vscode.ViewColumn.One);
      if (hit) setTimeout(() => tidy('open'), delay());
    }),

    vscode.window.tabGroups.onDidChangeTabGroups(() => {
      if (!cfg('enabled', true) || !cfg('unlockOnGroupChange', true)) return;
      setTimeout(unlockActive, delay());
    })
  );

  // Tabs restored with the window may sit in other groups.
  setTimeout(() => tidy('startup'), 1500);
  log('activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
