'use strict';
const vscode = require('vscode');

const GROUP_NAMES = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
const CLAUDE_MARK = 'claudeVSCodePanel'; // the Claude Code extension's webview panel viewType
const FIRST = vscode.ViewColumn.One;

// A tab dragged (or moved by command) between groups reaches an extension as an "opened"
// event in the target group followed by a separate "closed" event in the source group.
// A tab Claude Code has just created only ever produces the "opened" event. So a Claude
// tab that appears outside the first group is held for the configured delay; if no
// matching close arrives, it was newly opened and gets moved. The delay can never go
// below this settle time: the setting declares it as its minimum, and it is clamped here
// in case a smaller value reaches settings.json by hand.
const MIN_DELAY_MS = 100;
const delayMs = () => Math.max(MIN_DELAY_MS, Number(cfg('delayMs', MIN_DELAY_MS)) || 0);

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

const isOpen = (tab) => groups().some((g) => g.tabs.includes(tab));

function claudeTabsOutsideFirst() {
  const list = [];
  for (const g of groups()) {
    if (g.viewColumn === FIRST) continue;
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
  if (src === FIRST) return false;
  if (!(await activateTab(tab))) {
    log(`could not activate Claude tab "${tab.label}" in group ${src}`);
    return false;
  }
  await run('workbench.action.moveEditorToFirstGroup');
  await sleep(30);
  log(`moved "${tab.label}" from group ${src} to group 1`);
  return true;
}

// A group emptied by a move normally closes itself (workbench.editor.closeEmptyGroups).
// If one is left behind, close it.
async function closeEmptyGroups() {
  for (let i = 0; i < 8; i++) {
    const empty = groups().find((g) => g.tabs.length === 0);
    if (!empty) return;
    if (!(await focusGroup(empty.viewColumn))) return;
    await run('workbench.action.closeGroup');
    await sleep(30);
  }
  if (groups().some((g) => g.tabs.length === 0)) log('an empty group could not be closed');
}

// Everything that shuffles focus and groups runs one job at a time.
let chain = Promise.resolve();
function serialize(job) {
  chain = chain.then(job).catch((e) => log(`${e && e.stack ? e.stack : e}`));
  return chain;
}

// Tabs this extension is moving right now; their own close events are not user moves.
const inFlight = new Set();

async function tidy(reason, tabs) {
  if (!cfg('enabled', true)) return;
  let moved = 0;
  for (const t of tabs) inFlight.add(t);
  try {
    for (const tab of tabs) {
      if (!isOpen(tab) || tab.group.viewColumn === FIRST) continue;
      if (await moveToFirstGroup(tab)) moved++;
    }
    if (moved) {
      await closeEmptyGroups();
      await focusGroup(FIRST);
      log(`${reason}: moved ${moved} Claude tab(s) to group 1`);
    }
  } catch (e) {
    log(`${reason}: ${e && e.stack ? e.stack : e}`);
  } finally {
    inFlight.clear();
  }
}

// Claude tabs that just appeared outside the first group, waiting for the settle period.
let candidates = [];
let settleTimer;

function onTabsChanged(e) {
  if (!cfg('enabled', true)) return;

  // A close matching a held tab means the user moved it between groups: leave it alone.
  for (const t of e.closed) {
    if (!isClaudeTab(t) || inFlight.has(t)) continue;
    const i = candidates.findIndex((c) => c.label === t.label);
    if (i < 0) continue;
    candidates.splice(i, 1);
    log(`"${t.label}" was moved to another group by hand; leaving it there`);
  }

  const fresh = e.opened.filter((t) => isClaudeTab(t) && t.group.viewColumn !== FIRST);
  if (!fresh.length) return;
  candidates.push(...fresh);
  const wait = delayMs();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    const tabs = candidates;
    candidates = [];
    if (tabs.length) serialize(() => tidy('open', tabs));
  }, wait);
}

function activate(context) {
  context.subscriptions.push(
    out,
    vscode.commands.registerCommand('claudeDefaultGroup.moveClaudeTabs', () =>
      serialize(() => tidy('command', claudeTabsOutsideFirst()))
    ),
    vscode.window.tabGroups.onDidChangeTabs(onTabsChanged)
  );

  // Tabs restored with the window stay where they were; only newly opened tabs are moved.
  log('activated');
}

function deactivate() {
  clearTimeout(settleTimer);
}

module.exports = { activate, deactivate };
