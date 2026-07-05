#!/usr/bin/env node
// Local Mac bridge that exposes Codex/Cursor agent session status over LAN
// for the e-ink device. Reads the same local state files as the Stream Deck
// plugin (~/.codex sqlite/jsonl and Cursor's state.vscdb) and serves:
//
//   GET http://<mac-lan-ip>:8788/agent-status.json
//   GET http://<mac-lan-ip>:8788/healthz
//
// Run:            node bridge/agent-status-bridge.mjs
// Options (env):  AGENT_BRIDGE_PORT=8788
//                 AGENT_BRIDGE_TOKEN=...   (optional Bearer auth)
//                 AGENT_BRIDGE_LIMIT=6     (sessions in the response)
//                 CODEX_HOME=~/.codex
//
// No npm dependencies: uses the macOS bundled `sqlite3` CLI.

"use strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";

// 8787 is taken by Cursor's own local listener on some machines.
const PORT = clampNumber(process.env.AGENT_BRIDGE_PORT, 8788, 1, 65535);
const TOKEN = (process.env.AGENT_BRIDGE_TOKEN || "").trim();
const DEFAULT_LIMIT = clampNumber(process.env.AGENT_BRIDGE_LIMIT, 6, 1, 12);
const REFRESH_MS = clampNumber(process.env.AGENT_BRIDGE_REFRESH_MS, 1500, 500, 60000);
const LOG_ACTIVE_MS = 75_000;
const RECENT_MINUTES = 10;
const MAX_THREADS = 50;

const tailCache = new Map();
// composerId -> { headerTime, data } so the expensive composerData row is
// re-read only when its header timestamp moves (state.vscdb rows are ~200KB
// and cost ~0.7s each to pull through the sqlite3 CLI).
const composerCache = new Map();

// ---------------------------------------------------------------------------
// Shared helpers (ported from the Stream Deck plugin)
// ---------------------------------------------------------------------------

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function expandHome(value, fallback) {
  if (!value) {
    return fallback;
  }
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function codexHomeDir() {
  return expandHome(process.env.CODEX_HOME, path.join(os.homedir(), ".codex"));
}

function cursorDbPath() {
  return expandHome(
    process.env.CURSOR_DB_PATH,
    path.join(os.homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb")
  );
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

function sqliteJson(dbPath, sql, timeout = 5000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) {
      resolve([]);
      return;
    }

    // -readonly + busy timeout: both DBs are actively written by Codex/Cursor,
    // so plain reads intermittently fail with SQLITE_BUSY and return nothing.
    const args = ["-readonly", "-json", "-cmd", ".timeout 2000", dbPath, sql];
    execFile("sqlite3", args, { timeout, maxBuffer: 1024 * 1024 * 4 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve([]);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve([]);
      }
    });
  });
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxChars) {
  const chars = [...cleanText(value)];
  if (chars.length <= maxChars) {
    return chars.join("");
  }
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`;
}

function parseJsonValue(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function readTail(filePath, maxBytes = 180_000) {
  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;
    const cached = tailCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    for (const key of tailCache.keys()) {
      if (key.startsWith(`${filePath}:`)) {
        tailCache.delete(key);
      }
    }

    const size = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(size);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, buffer, 0, size, stat.size - size);
    } finally {
      fs.closeSync(fd);
    }

    const text = buffer.toString("utf8");
    tailCache.set(cacheKey, text);
    return text;
  } catch {
    return "";
  }
}

function extractMessageContent(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  if (typeof payload.message === "string") {
    return payload.message;
  }
  if (typeof payload.delta === "string") {
    return payload.delta;
  }
  if (typeof payload.text === "string") {
    return payload.text;
  }
  return "";
}

function normalizeConversationText(value) {
  let text = cleanText(value
    .replace(/<image\b[\s\S]*?<\/image>/gi, " ")
    .replace(/::[a-z-]+\{[^}]*\}/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1"));

  const requestMarker = "## My request for Codex:";
  const requestIndex = text.indexOf(requestMarker);
  if (requestIndex >= 0) {
    text = text.slice(requestIndex + requestMarker.length);
  }

  text = text
    .replace(/^# Files mentioned by the user:\s*/i, "")
    .replace(/## [^:]+:\s*/g, " ")
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/g, " ");

  return truncateText(cleanText(text), 180);
}

function isInternalConversationText(value) {
  const text = cleanText(value);
  return /^\{[\s\S]*\}$/.test(text) || /^\[[\s\S]*\]$/.test(text);
}

// ---------------------------------------------------------------------------
// Codex readers
// ---------------------------------------------------------------------------

function readSessionIndex(codexHome) {
  const indexPath = path.join(codexHome, "session_index.jsonl");
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const lines = fs.readFileSync(indexPath, "utf8").trim().split("\n").slice(-MAX_THREADS).reverse();
  return lines.flatMap((line) => {
    try {
      const entry = JSON.parse(line);
      const updated = Date.parse(entry.updated_at || "") || 0;
      return [{
        id: entry.id,
        title: entry.thread_name || "Untitled",
        cwd: "",
        updated_at_ms: updated,
        recency_at_ms: updated,
        archived: 0,
        tokens_used: 0,
        rollout_path: "",
        preview: ""
      }];
    } catch {
      return [];
    }
  });
}

function readLatestConversationText(rolloutPath) {
  if (!rolloutPath) {
    return "";
  }

  const lines = readTail(rolloutPath).split("\n").reverse();
  for (const line of lines) {
    if (!line.includes("\"type\":\"event_msg\"")) {
      continue;
    }
    if (!line.includes("\"user_message\"") && !line.includes("\"agent_message\"")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const payload = event.payload || {};
      if (!["user_message", "agent_message"].includes(payload.type)) {
        continue;
      }
      const content = normalizeConversationText(extractMessageContent(payload));
      if (content && !isInternalConversationText(content)) {
        return content;
      }
    } catch {
      continue;
    }
  }

  return "";
}

function readTaskState(rolloutPath) {
  const state = {
    lastEvent: "",
    startedAtMs: 0,
    completedAtMs: 0
  };

  if (!rolloutPath) {
    return state;
  }

  const lines = readTail(rolloutPath).split("\n").reverse();
  for (const line of lines) {
    if (!line.includes("\"type\":\"event_msg\"")) {
      continue;
    }
    if (!line.includes("\"task_started\"") && !line.includes("\"task_complete\"")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const payload = event.payload || {};
      const timestampMs = Date.parse(event.timestamp || "") || 0;
      if (payload.type === "task_started" && !state.startedAtMs) {
        if (!state.lastEvent) {
          state.lastEvent = "task_started";
        }
        state.startedAtMs = Number(payload.started_at) * 1000 || timestampMs;
      }
      if (payload.type === "task_complete" && !state.completedAtMs) {
        if (!state.lastEvent) {
          state.lastEvent = "task_complete";
        }
        state.completedAtMs = Number(payload.completed_at) * 1000 || timestampMs;
      }
      if (state.startedAtMs && state.completedAtMs) {
        break;
      }
    } catch {
      continue;
    }
  }

  return state;
}

function readLatestTokenCount(rolloutPath) {
  if (!rolloutPath) {
    return null;
  }

  const lines = readTail(rolloutPath).split("\n").reverse();
  for (const line of lines) {
    if (!line.includes("\"type\":\"event_msg\"") || !line.includes("\"token_count\"")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const payload = event.payload || {};
      if (payload.type !== "token_count") {
        continue;
      }
      return {
        timestampMs: Date.parse(event.timestamp || "") || 0,
        info: payload.info || {},
        rateLimits: payload.rate_limits || {}
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function readCodexSnapshot() {
  const codexHome = codexHomeDir();
  const now = Date.now();
  const stateDb = path.join(codexHome, "state_5.sqlite");
  const logsDb = path.join(codexHome, "logs_2.sqlite");

  const [threads, logRows] = await Promise.all([
    sqliteJson(
      stateDb,
      `select id,
              coalesce(nullif(title, ''), nullif(first_user_message, ''), 'Untitled') as title,
              cwd,
              updated_at_ms,
              recency_at_ms,
              archived,
              tokens_used,
              rollout_path,
              substr(replace(replace(preview, char(10), ' '), char(13), ' '), 1, 90) as preview
         from threads
        where archived = 0 and coalesce(thread_source, '') != 'subagent'
        order by recency_at_ms desc
        limit ${MAX_THREADS}`
    ),
    sqliteJson(
      logsDb,
      `select thread_id, max(ts) * 1000 as last_log_ms
         from logs
        where thread_id is not null
        group by thread_id
        order by max(ts) desc
        limit 100`
    )
  ]);

  const logByThread = new Map(logRows.map((row) => [row.thread_id, Number(row.last_log_ms) || 0]));
  const sourceThreads = threads.length ? threads : readSessionIndex(codexHome);

  const snapshot = sourceThreads.map((thread) => {
    const dbActivityMs = Number(thread.recency_at_ms || thread.updated_at_ms) || 0;
    const lastLogMs = logByThread.get(thread.id) || 0;
    const taskState = readTaskState(thread.rollout_path);
    const dbAgeMs = now - dbActivityMs;
    const logAgeMs = now - lastLogMs;
    const hasFreshThread = dbAgeMs <= RECENT_MINUTES * 60_000;
    const taskIsOpen = taskState.lastEvent === "task_started";
    const hasOpenTaskState = Boolean(taskState.lastEvent);
    // A task_started without task_complete can linger forever (killed
    // sessions), so an open task only counts as active with recent activity.
    const hasRecentActivity = hasFreshThread || logAgeMs <= LOG_ACTIVE_MS;
    const hasFreshLog = hasOpenTaskState
      ? taskIsOpen && hasRecentActivity
      : logAgeMs <= LOG_ACTIVE_MS && hasFreshThread;
    const lastActivityMs = hasFreshLog ? Math.max(dbActivityMs, lastLogMs) : dbActivityMs;
    const status = hasFreshLog ? "active" : hasFreshThread ? "recent" : "idle";

    return {
      provider: "codex",
      id: thread.id,
      title: truncateText(thread.title || thread.preview || "Untitled", 120),
      cwd: cleanText(thread.cwd || ""),
      latestMessage: readLatestConversationText(thread.rollout_path),
      lastActivityMs,
      status
    };
  });

  return snapshot;
}

async function readTokenSnapshot() {
  const codexHome = codexHomeDir();
  const stateDb = path.join(codexHome, "state_5.sqlite");
  const rows = await sqliteJson(
    stateDb,
    `select id, rollout_path, recency_at_ms
       from threads
      where archived = 0
        and coalesce(thread_source, '') != 'subagent'
      order by recency_at_ms desc
      limit 20`
  );

  let latest = null;
  for (const row of rows) {
    const tokenEvent = readLatestTokenCount(row.rollout_path);
    if (!tokenEvent) {
      continue;
    }
    if (!latest || tokenEvent.timestampMs > latest.timestampMs) {
      latest = tokenEvent;
    }
  }

  return latest || { timestampMs: 0, info: {}, rateLimits: {} };
}

// ---------------------------------------------------------------------------
// Cursor readers
// ---------------------------------------------------------------------------

function parseCursorHeaders(rows) {
  if (Array.isArray(rows) && rows.length && rows[0] && rows[0].composerId !== undefined) {
    return rows.filter((entry) => entry && entry.composerId).map((entry) => ({
      ...entry,
      isArchived: Boolean(entry.isArchived),
      workspaceIdentifier: { id: entry.workspaceId }
    }));
  }
  return [];
}

function parseCursorProjects(value) {
  const projects = new Map();
  const data = parseJsonValue(value, []);
  if (!Array.isArray(data)) {
    return projects;
  }

  for (const project of data) {
    const workspace = project.workspace || {};
    const workspaceId = workspace.id;
    if (!workspaceId) {
      continue;
    }
    const fsPath = workspace.uri && workspace.uri.fsPath
      ? workspace.uri.fsPath
      : workspace.configPath && workspace.configPath.fsPath
        ? workspace.configPath.fsPath
        : "";
    projects.set(workspaceId, {
      id: project.id,
      name: cleanText(project.name || ""),
      path: cleanText(fsPath)
    });
  }

  return projects;
}

function parseCursorMembership(value) {
  const membership = new Map();
  const data = parseJsonValue(value, {});
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return membership;
  }
  for (const [composerId, projectId] of Object.entries(data)) {
    membership.set(composerId, projectId);
  }
  return membership;
}

function cursorHeaderTime(header) {
  return Number(header.lastUpdatedAt || header.recency || header.createdAt) || 0;
}

function cursorProjectForHeader(header, projects, membership) {
  const workspaceId = header.workspaceIdentifier && header.workspaceIdentifier.id;
  const directProject = workspaceId ? projects.get(workspaceId) : undefined;
  if (directProject) {
    return directProject;
  }

  const projectId = membership.get(header.composerId);
  if (projectId) {
    for (const project of projects.values()) {
      if (project.id === projectId) {
        return project;
      }
    }
  }

  return { id: "", name: "Cursor", path: "" };
}

// Only the real chat name. No message fallback here: composerData rows over
// 1MB get truncated and fail to parse, losing the name — the caller falls
// back to header.name (always available) before resorting to message text.
function cursorTitle(data) {
  return cleanText(data.name || data.title || data.conversationTitle || "");
}

function collectCursorMessages(value, output) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCursorMessages(entry, output));
    return;
  }
  if (typeof value !== "object") {
    return;
  }

  for (const key of ["text", "content", "message", "summary", "name", "title"]) {
    if (typeof value[key] === "string") {
      const text = cleanText(value[key]);
      if (text && text.length > 1) {
        output.push(text);
      }
    }
  }

  for (const key of ["bubble", "data", "header"]) {
    if (value[key] && typeof value[key] === "object") {
      collectCursorMessages(value[key], output);
    }
  }
}

function latestCursorMessage(data) {
  const messages = [];
  collectCursorMessages(data.conversation, messages);
  collectCursorMessages(data.conversationMap, messages);
  collectCursorMessages(data.fullConversationHeadersOnly, messages);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = normalizeConversationText(messages[index]);
    if (text && !isInternalConversationText(text)) {
      return text;
    }
  }
  return "";
}

// Live activity for a Cursor session, derived from bubbleId:<composerId>:*
// rows. These are appended in near-real-time while the agent works, unlike
// composerData whose status/lastUpdatedAt can stay stale for a whole turn
// (e.g. stuck on "aborted" while the agent is actively running). Returns:
//   latestMs        - newest bubble timestamp (true last activity)
//   latestText      - newest bubble with real text ([나] prefix for user)
//   waitingForUser  - newest bubble is an ask_question tool call, i.e. the
//                     agent asked something and is blocked on the user
async function readCursorBubbleState(cursorDb, composerId) {
  const rows = await sqliteJson(
    cursorDb,
    `select json_extract(value, '$.type') as type,
            json_extract(value, '$.createdAt') as createdAt,
            json_extract(value, '$.toolFormerData.name') as tool,
            substr(json_extract(value, '$.text'), 1, 400) as text
       from (select value from cursorDiskKV
              where key like 'bubbleId:${sqlString(composerId)}:%'
              order by rowid desc
              limit 80)`
  );

  // lastKind: what the newest meaningful bubble is — "question" (blocked on
  // the user), "tool" (mid-run: agents always finish a turn with a text
  // message, so a trailing tool call means work is still going), or "text".
  const state = { latestMs: 0, latestText: "", waitingForUser: false, lastKind: "" };
  for (const row of rows) {
    const timestampMs = Date.parse(row.createdAt || "") || 0;
    if (timestampMs > state.latestMs) {
      state.latestMs = timestampMs;
    }
    const tool = String(row.tool || "");
    const hasText = Boolean(row.text && row.text.length > 3);
    if (!state.lastKind && (tool || hasText)) {
      state.lastKind = tool === "ask_question" ? "question" : tool ? "tool" : "text";
      state.waitingForUser = state.lastKind === "question";
    }
    if (!state.latestText && hasText) {
      const text = normalizeConversationText(cleanText(row.text));
      if (text && !isInternalConversationText(text)) {
        state.latestText = Number(row.type) === 1 ? `[나] ${text}` : text;
      }
    }
  }
  return state;
}

async function readCursorComposerData(cursorDb, composerId, headerTime) {
  // The heavy composerData row is cached by headerTime, but the bubble
  // state is always re-read: it is the live signal (~10ms) that tells us
  // whether the agent is working right now.
  const bubbleState = await readCursorBubbleState(cursorDb, composerId);

  const cached = composerCache.get(composerId);
  if (cached && cached.headerTime === headerTime) {
    return {
      ...cached.data,
      latestMessage: bubbleState.latestText || cached.data.latestMessage,
      bubbleState
    };
  }

  const rows = await sqliteJson(
    cursorDb,
    `select length(value) as size,
            case when length(value) <= 1000000 then value else substr(value, 1, 250000) end as value
       from cursorDiskKV
      where key = 'composerData:${sqlString(composerId)}'`
  );
  const row = rows[0] || {};
  const data = parseJsonValue(row.value, {});
  const latestMessage = bubbleState.latestText || latestCursorMessage(data);
  const result = {
    status: data.status || "",
    title: cursorTitle(data),
    latestMessage,
    updatedAtMs: Number(data.lastUpdatedAt || data.updatedAt || data.recency || 0) || 0
  };

  composerCache.set(composerId, { headerTime, data: result });
  if (composerCache.size > 64) {
    composerCache.delete(composerCache.keys().next().value);
  }
  return { ...result, bubbleState };
}

async function readCursorSnapshot() {
  const cursorDb = cursorDbPath();
  const now = Date.now();

  const [headersRows, projectsRows, membershipRows] = await Promise.all([
    sqliteJson(
      cursorDb,
      `with raw as (
         select value from ItemTable where key = 'composer.composerHeaders'
       )
       select json_extract(j.value, '$.composerId') as composerId,
              json_extract(j.value, '$.unifiedMode') as unifiedMode,
              json_extract(j.value, '$.createdAt') as createdAt,
              json_extract(j.value, '$.lastUpdatedAt') as lastUpdatedAt,
              json_extract(j.value, '$.recency') as recency,
              json_extract(j.value, '$.isArchived') as isArchived,
              json_extract(j.value, '$.name') as name,
              json_extract(j.value, '$.workspaceIdentifier.id') as workspaceId
         from raw, json_each(raw.value, '$.allComposers') j
        where json_extract(j.value, '$.type') = 'head'
        order by coalesce(
          json_extract(j.value, '$.lastUpdatedAt'),
          json_extract(j.value, '$.recency'),
          json_extract(j.value, '$.createdAt')
        ) desc
        limit ${MAX_THREADS}`,
      5000
    ),
    sqliteJson(cursorDb, "select value from ItemTable where key='glass.localAgentProjects.v1'"),
    sqliteJson(cursorDb, "select value from ItemTable where key='glass.localAgentProjectMembership.v1'")
  ]);

  const headers = parseCursorHeaders(headersRows);
  const projects = parseCursorProjects(projectsRows[0] && projectsRows[0].value);
  const membership = parseCursorMembership(membershipRows[0] && membershipRows[0].value);
  const source = headers
    .filter((header) => !header.isArchived)
    .filter((header) => header.unifiedMode === "agent")
    .sort((a, b) => cursorHeaderTime(b) - cursorHeaderTime(a))
    .slice(0, 12);

  const snapshotRows = await Promise.all(source.map(async (header) => {
    const data = await readCursorComposerData(cursorDb, header.composerId, cursorHeaderTime(header));
    const project = cursorProjectForHeader(header, projects, membership);
    const bubbleState = data.bubbleState || { latestMs: 0, waitingForUser: false };
    const updatedAtMs = Math.max(cursorHeaderTime(header), data.updatedAtMs || 0, bubbleState.latestMs);
    const ageMs = now - updatedAtMs;
    const bubbleAgeMs = bubbleState.latestMs > 0 ? now - bubbleState.latestMs : Infinity;
    // Bubble rows are the only near-real-time signal: composerData's status
    // field can stay "aborted"/"completed" for a whole turn while the agent
    // is actually running. Bubbles pause during long tool calls (flash,
    // builds, waits), so when the newest meaningful bubble is a tool call
    // the run is considered still in flight for a longer grace window —
    // turns always end with a text message (or a question).
    let status;
    if (bubbleState.waitingForUser && bubbleAgeMs <= 60 * 60_000) {
      status = "waiting";
    } else if (bubbleAgeMs <= 3 * 60_000 ||
               (bubbleState.lastKind === "tool" && bubbleAgeMs <= 15 * 60_000)) {
      status = "active";
    } else if (ageMs <= RECENT_MINUTES * 60_000) {
      status = "recent";
    } else {
      status = "idle";
    }
    const title = data.title || cleanText(header.name || "") ||
      truncateText(data.latestMessage || "", 80) || project.name || "Cursor Agent";
    const hasVisibleContent = Boolean(data.title || data.latestMessage || project.path || project.name !== "Cursor");
    if (!hasVisibleContent && status !== "active" && status !== "waiting") {
      return null;
    }

    return {
      provider: "cursor",
      id: header.composerId,
      title: truncateText(title, 120),
      cwd: project.path || project.name || "Cursor",
      latestMessage: data.latestMessage,
      lastActivityMs: updatedAtMs,
      status
    };
  }));
  return snapshotRows.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Response assembly
// ---------------------------------------------------------------------------

function formatAgeShort(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return "0s";
  }
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function statusLabel(status) {
  if (status === "active") {
    return "진행중";
  }
  if (status === "waiting") {
    return "질문";
  }
  if (status === "recent") {
    return "최근";
  }
  return "대기";
}

function statusRank(status) {
  if (status === "active") {
    return 2;
  }
  if (status === "waiting") {
    return 1;
  }
  return 0;
}

function remainingPercent(limit) {
  const used = Number(limit && limit.used_percent);
  if (!Number.isFinite(used)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

function resetShort(limit, now) {
  const resetsAt = Number(limit && limit.resets_at);
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) {
    return "";
  }
  const ms = resetsAt * 1000 - now;
  return ms <= 0 ? "now" : formatAgeShort(ms);
}

function fnv1aHex(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function kstClock(now) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(now));
}

// Latest snapshots collected by the background refresh loop. HTTP requests
// never wait on sqlite reads; they assemble the response from this state.
const collected = {
  codexSessions: [],
  cursorSessions: [],
  tokenSnapshot: { timestampMs: 0, rateLimits: {} },
  updatedAtMs: 0,
  refreshing: false
};

async function refreshSnapshots() {
  if (collected.refreshing) {
    return;
  }
  collected.refreshing = true;
  try {
    const [codexResult, cursorResult, tokenResult] = await Promise.allSettled([
      readCodexSnapshot(),
      readCursorSnapshot(),
      readTokenSnapshot()
    ]);
    // An empty result while we previously had sessions is almost always a
    // transient SQLITE_BUSY read, not everything being archived; keep the
    // last good list in that case.
    if (codexResult.status === "fulfilled" &&
        (codexResult.value.length > 0 || collected.codexSessions.length === 0)) {
      collected.codexSessions = codexResult.value;
    }
    if (cursorResult.status === "fulfilled" &&
        (cursorResult.value.length > 0 || collected.cursorSessions.length === 0)) {
      collected.cursorSessions = cursorResult.value;
    }
    if (tokenResult.status === "fulfilled") {
      collected.tokenSnapshot = tokenResult.value;
    }
    collected.updatedAtMs = Date.now();
  } finally {
    collected.refreshing = false;
  }
}

function buildAgentStatus(limit) {
  const now = Date.now();
  const codexSessions = collected.codexSessions;
  const cursorSessions = collected.cursorSessions;
  const tokenSnapshot = collected.tokenSnapshot;

  const merged = [...codexSessions, ...cursorSessions]
    .sort((a, b) => {
      const rankDelta = statusRank(b.status) - statusRank(a.status);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return b.lastActivityMs - a.lastActivityMs;
    })
    .slice(0, limit);

  const sessions = merged.map((session) => {
    const ageMs = Math.max(0, now - session.lastActivityMs);
    return {
      provider: session.provider,
      id: session.id,
      status: session.status,
      statusLabel: statusLabel(session.status),
      project: truncateText(path.basename(session.cwd || "") || (session.provider === "codex" ? "Codex" : "Cursor"), 24),
      title: truncateText(session.title, 60),
      message: truncateText(session.latestMessage || "", 280),
      age: formatAgeShort(ageMs),
      updatedAt: session.lastActivityMs > 0 ? new Date(session.lastActivityMs).toISOString() : null,
      ageMinutes: Math.floor(ageMs / 60_000)
    };
  });

  const primary = tokenSnapshot.rateLimits && tokenSnapshot.rateLimits.primary ? tokenSnapshot.rateLimits.primary : {};
  const secondary = tokenSnapshot.rateLimits && tokenSnapshot.rateLimits.secondary ? tokenSnapshot.rateLimits.secondary : {};
  const tokens = {
    primaryLeftPercent: remainingPercent(primary),
    primaryReset: resetShort(primary, now),
    secondaryLeftPercent: remainingPercent(secondary),
    secondaryReset: resetShort(secondary, now)
  };

  const codexActive = codexSessions.filter((session) => session.status === "active").length;
  const cursorActive = cursorSessions.filter((session) => session.status === "active").length;

  // Hash only fields whose change should trigger an e-ink redraw. ageMinutes
  // buckets relative times so idle rows repaint at most once a minute.
  const stateHash = fnv1aHex(JSON.stringify([
    sessions.map((session) => [session.id, session.status, session.title, session.message, session.ageMinutes]),
    codexActive,
    cursorActive,
    tokens.primaryLeftPercent,
    tokens.secondaryLeftPercent
  ]));

  return {
    generatedAt: new Date(now).toISOString(),
    clock: kstClock(now),
    stateHash,
    summary: {
      activeCount: codexActive + cursorActive,
      codexActive,
      cursorActive,
      latestStatus: sessions.length ? sessions[0].status : "idle",
      latestTitle: sessions.length ? sessions[0].title : ""
    },
    tokens,
    sessions: sessions.map(({ ageMinutes, ...session }) => session)
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function isAuthorized(request) {
  if (!TOKEN) {
    return true;
  }
  const header = request.headers.authorization || "";
  return header === `Bearer ${TOKEN}`;
}

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "no-store");

  if (url.pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname !== "/agent-status.json" && url.pathname !== "/codex-status.json") {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (!isAuthorized(request)) {
    response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  if (collected.updatedAtMs === 0) {
    // First snapshot still loading; a 503 keeps the device showing its
    // previous data instead of a false "no sessions" frame.
    response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "warming up" }));
    return;
  }

  try {
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? clampNumber(limitParam, DEFAULT_LIMIT, 1, 12) : DEFAULT_LIMIT;
    const status = buildAgentStatus(limit);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(status));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "internal error" }));
  }
});

refreshSnapshots().catch(() => {});
setInterval(() => {
  refreshSnapshots().catch(() => {});
}, REFRESH_MS);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`agent-status-bridge listening on port ${PORT}`);
  // Prefer the Bonjour name on the device: it survives DHCP IP changes.
  const localName = os.hostname().replace(/\.local$/i, "");
  console.log(`  http://${localName}.local:${PORT}/agent-status.json  (recommended)`);
  for (const address of lanAddresses()) {
    console.log(`  http://${address}:${PORT}/agent-status.json`);
  }
  if (TOKEN) {
    console.log("  Bearer token auth enabled");
  }
});
