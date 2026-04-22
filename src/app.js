/**
 * Foxyverse Owlbear plugin — main app.
 * State-driven UI with tab navigation and translation.
 */
import OBR from "@owlbear-rodeo/sdk";
import { t, setLocale, enterField } from "./i18n/translations.js";
import addIcon from "./data/icons/Icons_add.svg?raw";
import removeIcon from "./data/icons/Icons_remove.svg?raw";
import arrowIcon from "./data/icons/Icons_arrow.svg?raw";
import tabIcon from "./data/icons/Icons_tab.svg?raw";
import bioIcon from "./data/icons/Icons_bio.svg?raw";
import statsIcon from "./data/icons/Icons_stats.svg?raw";
import magicIcon from "./data/icons/Icons_magic.svg?raw";
import inventoryIcon from "./data/icons/Icons_inventory.svg?raw";
import chatIcon from "./data/icons/Icons_chat.svg?raw";
import notesIcon from "./data/icons/Icons_notes.svg?raw";
import settingsIcon from "./data/icons/Icons_settings.svg?raw";
import editIcon from "./data/icons/Icons_edit.svg?raw";
import frenchFlagIcon from "./data/icons/Icons_francais.svg";
import englishFlagIcon from "./data/icons/Icons_anglais.svg";
import {
  createEmptySheet,
  getDisplayName,
  getMaxHP,
  getMaxMP,
  getMaxFavor,
  getActionCount,
  getSpeedFormula,
  getStatTotal,
  evalModifier,
  STAT_IDS,
  SLOT_IDS,
  findItemById,
  getSheetDefense,
  getSheetMagicalDefense,
} from "./data/schema.js";
import * as storage from "./data/storage.js";
import {
  executeRoll,
  getInlineButtons,
  parseChatCommand,
  applyPhysicalDamage,
  applyMagicDamage,
  applyTrueDamage,
  applyHeal,
  applyOverHeal,
  applyMana,
  canReroll,
  pickInlineDiceIconKey,
} from "./dice/roller.js";
import d4Icon from "./data/icons/Icons_d4.svg?raw";
import d6Icon from "./data/icons/Icons_d6.svg?raw";
import d8Icon from "./data/icons/Icons_d8.svg?raw";
import d10Icon from "./data/icons/Icons_d10.svg?raw";
import d12Icon from "./data/icons/Icons_d12.svg?raw";
import d20Icon from "./data/icons/Icons_d20.svg?raw";

const ROOT_ID = "app";
const TABS = ["bio", "stats", "spells", "inventory", "chat", "notes", "settings"];
let svgInstanceCounter = 0;
const TAB_META = {
  bio: { icon: bioIcon, label: "Bio" },
  stats: { icon: statsIcon, label: "Stats" },
  spells: { icon: magicIcon, label: "Spells" },
  inventory: { icon: inventoryIcon, label: "Inventory" },
  chat: { icon: chatIcon, label: "Chat" },
  notes: { icon: notesIcon, label: "Notes" },
  settings: { icon: settingsIcon, label: "Settings" },
};

const state = {
  locale: "en",
  roomId: null,
  sheetIds: [],
  sheetNames: {},
  permissions: {},
  tokenToSheet: {},
  activeSheetId: null,
  sheet: null,
  isGM: false,
  playerId: null,
  activeTab: "bio",
  chatMessages: [],
  _chatUnsub: null,
  _lastChatToastAt: 0,
  _chatStickToBottom: true,
  rollModalOpen: false,
  lastRoll: null,
  lastRollPayload: null,
  /** Session-only: lines the user sent from chat (oldest → newest). */
  _chatSendHistory: [],
  _chatHistoryIndex: null,
  _chatHistoryDraft: "",
  notesEditMode: false,
  sheetMenuOpen: false,
  colors: {
    bg: "#4b002c",
    ui: "#ffdbff",
    text: "#eba5ff",
  },
  playerDirectory: {},
  incomingSheets: {},
  pendingSheetId: null,
  pendingSheetTimer: null,
  startupError: "",
  fieldLocks: {},
  isEditingField: false,
  _realtimePendingAfterEdit: false,
  _scheduleRealtimeFlush: null,
  _debouncedSaves: {},
};

function canView(sheetId) {
  if (state.isGM) return true;
  const per = state.permissions[state.playerId];
  if (!per || !per.view) return false;
  return per.view.includes(sheetId);
}

function canEdit(sheetId) {
  if (state.isGM) return true;
  const per = state.permissions[state.playerId];
  if (!per || !per.edit) return false;
  return per.edit.includes(sheetId);
}

function getVisibleSheets() {
  return state.sheetIds.filter(canView);
}

async function loadRoomData() {
  state.roomId = await storage.getRoomId();
  const roomData = await storage.getRoomData();
  state.sheetIds = roomData.sheetIds || [];
  state.sheetNames = Object.fromEntries(
    Object.entries(roomData.sheetNames || {}).map(([id, name]) => {
      const normalized = String(name || "").trim();
      if (!normalized || normalized === "Name" || normalized === "Unnamed") {
        return [id, "Name Surname"];
      }
      return [id, normalized];
    })
  );
  state.permissions = roomData.permissions || {};
  state.tokenToSheet = roomData.tokenToSheet || {};
  state.playerDirectory = roomData.playerDirectory || {};
  state.fieldLocks = roomData.fieldLocks || {};
  state.isGM = (await storage.getPlayerRole()) === "GM";
  state.playerId = await storage.getPlayerId();
  const locale = localStorage.getItem("foxyverse_locale") || roomData.locale || "en";
  state.locale = locale;
  setLocale(locale);
}

async function loadSheet(sheetId, options = {}) {
  const { forceRefresh = false } = options;
  if (!sheetId || !state.roomId) {
    state.rollModalOpen = false;
    state.lastRoll = null;
    state.lastRollPayload = null;
    state.sheet = null;
    state.activeSheetId = sheetId;
    state.pendingSheetId = null;
    clearPendingSheetTimeout();
    return;
  }
  let sheet = await storage.getSheet(state.roomId, sheetId, { forceRefresh });
  if (!sheet) {
    // If we forced refresh and the sheet is gone remotely, drop any stale cache.
    if (forceRefresh) {
      try { storage.removeSheetFromStorage(state.roomId, sheetId); } catch (_) {}
    }
    if (state.isGM) {
      sheet = createEmptySheet(sheetId);
      storage.saveSheetToStorage(state.roomId, sheet, { persistRemote: false });
      await storage.addSheetToRoom(sheetId, "Name Surname");
    } else {
      state.pendingSheetId = sheetId;
      state.sheet = null;
      startPendingSheetTimeout(sheetId);
      sheet = await storage.getSheet(state.roomId, sheetId, { forceRefresh: true });
      if (!sheet) return;
      storage.saveSheetToStorage(state.roomId, sheet, { persistRemote: false });
    }
  }
  if (!sheet.theme) {
    sheet.theme = { ...state.colors };
    storage.saveSheetToStorage(state.roomId, sheet, { persistRemote: false });
    storage.updateSheetCore(state.roomId, sheet.id, { theme: sheet.theme }).catch(console.error);
  }
  if (state.activeSheetId && state.activeSheetId !== sheetId) {
    state.rollModalOpen = false;
    state.lastRoll = null;
    state.lastRollPayload = null;
  }
  state.sheet = sheet;
  state.activeSheetId = sheetId;
  state.pendingSheetId = null;
  clearPendingSheetTimeout();
}

function saveSheet() {
  if (!state.sheet || !state.roomId) return;
  // Local-only save: remote persistence is handled per-field to avoid overwriting other users' edits.
  storage.saveSheetToStorage(state.roomId, state.sheet, { persistRemote: false });
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

async function applySheetMutation(mutator) {
  if (!state.sheet || !state.roomId || !state.activeSheetId) return null;
  const latest = await storage.getSheet(state.roomId, state.activeSheetId, { forceRefresh: true }) || structuredClone(state.sheet);
  mutator(latest);
  if (!latest.theme) latest.theme = { ...state.colors };
  state.sheet = latest;
  storage.saveSheetToStorage(state.roomId, latest, { persistRemote: false });
  await storage.persistSheet(state.roomId, latest);
  return latest;
}

function applyLocalMutation(mutator) {
  if (!state.sheet || !state.roomId) return null;
  const next = structuredClone(state.sheet);
  mutator(next);
  if (!next.theme) next.theme = { ...state.colors };
  state.sheet = next;
  storage.saveSheetToStorage(state.roomId, next, { persistRemote: false });
  return next;
}

function scheduleDebouncedSave(key, delayMs, fn) {
  if (!state._debouncedSaves) state._debouncedSaves = {};
  const prev = state._debouncedSaves[key];
  if (prev) clearTimeout(prev);
  state._debouncedSaves[key] = setTimeout(() => {
    delete state._debouncedSaves[key];
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }, delayMs);
}

function computeUsedSlots(sheet, item) {
  const equippedSlots = Object.keys(sheet.equipped || {}).filter((slotId) => sheet.equipped?.[slotId] === item.id);
  const out = {};
  if (equippedSlots.length) out.equippedSlots = equippedSlots;
  if (item.weaponSlots != null) out.weaponSlots = item.weaponSlots;
  return Object.keys(out).length ? out : null;
}

function computeUsableSlots(item) {
  return item?.equippableSlots?.length ? { slots: item.equippableSlots } : null;
}

function pickRandom(max) {
  return Math.floor(Math.random() * max) + 1;
}

function getSheetTheme(sheet = state.sheet) {
  return {
    bg: sheet?.theme?.bg || state.colors.bg,
    ui: sheet?.theme?.ui || state.colors.ui,
    text: sheet?.theme?.text || state.colors.text,
  };
}

function getKnownPlayers() {
  const connected = new Map((state.partyPlayers || []).map((p) => [p.id, p]));
  const knownIds = new Set([
    ...Object.keys(state.playerDirectory || {}),
    ...Object.keys(state.permissions || {}),
    ...connected.keys(),
  ]);
  return [...knownIds].map((id) => {
    const live = connected.get(id);
    const saved = state.playerDirectory?.[id] || {};
    return {
      id,
      name: live?.name || saved.name || id,
      role: live?.role || saved.role || "PLAYER",
    };
  });
}

function inlineSvg(svg, className = "", color = "var(--text)") {
  const prefix = `fvsvg${svgInstanceCounter++}`;
  const idMap = new Map();
  const classMap = new Map();
  let cleaned = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<svg\b/, `<svg class="${className}" style="color:${color};"`)
    .replace(/#4b002c/gi, "currentColor")
    .replace(/fill:\s*currentColor/g, "fill:currentColor")
    .replace(/fill="currentColor"/g, 'fill="currentColor"')
    .replace(/stroke="currentColor"/g, 'stroke="currentColor"');
  cleaned = cleaned.replace(/\sid="([^"]+)"/g, (match, id) => {
    const nextId = `${prefix}-${id}`;
    idMap.set(id, nextId);
    return ` id="${nextId}"`;
  });
  cleaned = cleaned.replace(/\sclass="([^"]+)"/g, (match, classNames) => {
    const nextClasses = classNames
      .split(/\s+/)
      .filter(Boolean)
      .map((classNamePart) => {
        if (classNamePart.startsWith("cls-")) {
          if (!classMap.has(classNamePart)) {
            classMap.set(classNamePart, `${prefix}-${classNamePart}`);
          }
          return classMap.get(classNamePart);
        }
        return classNamePart;
      })
      .join(" ");
    return ` class="${nextClasses}"`;
  });
  idMap.forEach((nextId, oldId) => {
    const refPattern = new RegExp(`url\\(#${oldId}\\)`, "g");
    cleaned = cleaned.replace(refPattern, `url(#${nextId})`);
    const hrefPattern = new RegExp(`(["'])#${oldId}\\1`, "g");
    cleaned = cleaned.replace(hrefPattern, `"#${nextId}"`);
  });
  classMap.forEach((nextClass, oldClass) => {
    const classSelectorPattern = new RegExp(`\\.${oldClass}\\b`, "g");
    cleaned = cleaned.replace(classSelectorPattern, `.${nextClass}`);
  });
  return cleaned;
}

const INLINE_DICE_SVG = {
  d4: d4Icon,
  d6: d6Icon,
  d8: d8Icon,
  d10: d10Icon,
  d12: d12Icon,
  d20: d20Icon,
};

function formatInlineRollButtonCaption(btn) {
  const override = String(btn.customLabel ?? "").trim();
  if (override) return override;
  const formula = String(btn.formula ?? "").trim();
  const cnt = Math.max(1, Number(btn.count) || 1);
  if (btn.kind === "stat" && btn.stat) {
    const abbr = t(`statAbbr_${btn.stat}`);
    if (!formula) return abbr;
    if (/^[+-]/.test(formula)) return `${abbr}${formula}`;
    const base = `${abbr} ${formula}`;
    return cnt > 1 ? `${base} ×${cnt}` : base;
  }
  const typeLbl = t(`inlineRoll_${btn.kind}`);
  const base = formula ? `${typeLbl} ${formula}` : typeLbl;
  return cnt > 1 ? `${base} ×${cnt}` : base;
}

function inlineDiceMarkupForButton(btn) {
  const key = pickInlineDiceIconKey(String(btn.formula ?? ""));
  const raw = INLINE_DICE_SVG[key] || d20Icon;
  return inlineSvg(raw, "inline-svg inline-roll-dice", "var(--bg)");
}

function applyInlineMdFormatting(escapedText) {
  // escapedText is already HTML-escaped. We only inject <strong>/<em>/<u>.
  let out = String(escapedText || "");
  // Support escaping formatting markers with a leading backslash.
  // Examples: \* \** \__ \# and \--- should render literally.
  const ESC = {
    "\\**": "\uE000",
    "\\*": "\uE001",
    "\\__": "\uE002",
    "\\_": "\uE003",
  };
  out = out
    .split("\\**").join(ESC["\\**"])
    .split("\\*").join(ESC["\\*"])
    .split("\\__").join(ESC["\\__"])
    .split("\\_").join(ESC["\\_"]);
  // Bold: **text**
  out = out.replace(/\*\*([^*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  // Underline: __text__ (common lightweight convention; not standard Markdown)
  out = out.replace(/__([^_][\s\S]*?)__/g, "<u>$1</u>");
  // Italic: *text* (avoid matching **)
  out = out.replace(/(^|[^*])\*([^*\s][\s\S]*?)\*(?!\*)/g, "$1<em>$2</em>");
  // Restore escaped markers.
  out = out
    .split(ESC["\\**"]).join("**")
    .split(ESC["\\*"]).join("*")
    .split(ESC["\\__"]).join("__")
    .split(ESC["\\_"]).join("_");
  return out;
}

function renderNotesBody(raw) {
  const s = String(raw ?? "");
  const lines = s.split(/\r?\n/);
  let html = lines
    .map((ln) => {
      const trimmed = ln.replace(/\s+$/, "");
      if (!trimmed) return `<div class="notes-line notes-line--empty">&nbsp;</div>`;
      if (/^\\---+$/.test(trimmed)) {
        // Escaped separator line, show as raw text.
        const text = applyInlineMdFormatting(escapeAttr(trimmed.slice(1)));
        return `<div class="notes-line">${text}</div>`;
      }
      if (/^---+$/.test(trimmed)) return `<hr class="notes-hr" />`;
      const m = /^(#{1,3})\s+(.*)$/.exec(trimmed);
      if (m) {
        const level = m[1].length;
        const text = applyInlineMdFormatting(escapeAttr(m[2] || ""));
        return `<div class="notes-line notes-h notes-h${level}">${text}</div>`;
      }
      // Escaped headings: \# Title should show as "# Title"
      const escHead = /^\\(#{1,3}\s+.*)$/.exec(trimmed);
      if (escHead) {
        const text = applyInlineMdFormatting(escapeAttr(escHead[1]));
        return `<div class="notes-line">${text}</div>`;
      }
      const text = applyInlineMdFormatting(escapeAttr(trimmed));
      return `<div class="notes-line">${text}</div>`;
    })
    .join("");

  // Inline roll buttons: replace bracket syntax with interactive buttons.
  const buttons = getInlineButtons(s);
  buttons.forEach((btn) => {
    const stat = (btn.stat || "").toString();
    const formula = (btn.formula || "").toString();
    const caption = escapeAttr(formatInlineRollButtonCaption(btn));
    const iconHtml = inlineDiceMarkupForButton(btn);
    html = html.split(escapeAttr(btn.raw)).join(
      `<button type="button" class="inline-roll-btn" data-kind="${escapeAttr(btn.kind)}" data-formula="${escapeAttr(formula)}" data-stat="${escapeAttr(stat)}" aria-label="${caption}">${iconHtml}<span class="inline-roll-caption">${caption}</span></button>`
    );
  });
  return html;
}

function getSheetTitle() {
  const visible = getVisibleSheets();
  if (!state.sheet && !state.pendingSheetId && visible.length === 0) {
    return escapeAttr(t("noAvailableSheet"));
  }
  const name = (state.sheet?.bio?.name || "").trim();
  const surname = (state.sheet?.bio?.surname || "").trim();
  const display = [name, surname].filter(Boolean).join(" ");
  const fallbackId = state.pendingSheetId || state.activeSheetId;
  const fallback = state.sheetNames[fallbackId] || "Name Surname";
  return escapeAttr(display || fallback);
}

function requestVisibleSheets() {
  if (state.isGM || !state.roomId) return;
  getVisibleSheets().forEach((sheetId) => {
    if (!storage.getSheetFromStorage(state.roomId, sheetId)) {
      storage.getSheet(state.roomId, sheetId).catch(() => {});
    }
  });
}

function startPendingSheetTimeout(sheetId) {
  if (state.pendingSheetTimer) clearTimeout(state.pendingSheetTimer);
  state.pendingSheetTimer = setTimeout(() => {
    if (state.pendingSheetId === sheetId) {
      state.pendingSheetId = null;
      render();
    }
  }, 3000);
}

function clearPendingSheetTimeout() {
  if (!state.pendingSheetTimer) return;
  clearTimeout(state.pendingSheetTimer);
  state.pendingSheetTimer = null;
}

function buildExportFilename(sheet, roomName = state.roomId || "Room") {
  const name = (sheet?.bio?.name || "").replace(/\s+/g, "");
  const surname = (sheet?.bio?.surname || "").replace(/\s+/g, "");
  const person = `${name}${surname}` || "NameSurname";
  const room = String(roomName || "Room").replace(/[^\w-]+/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${person}_${room || "Room"}_${stamp}.json`;
}

function getRoomLabel() {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    const last = ref?.pathname?.split("/").filter(Boolean).pop() || "";
    if (last && last !== state.roomId && last.length < 80) {
      return decodeURIComponent(last);
    }
  } catch (_) {}
  return state.roomId || "Room";
}

function normalizeImportedSheet(raw, options = {}) {
  const { targetSheetId = null, regenerateNestedIds = false } = options;
  const base = createEmptySheet(raw?.id || crypto.randomUUID());
  const next = {
    ...base,
    ...raw,
    id: targetSheetId || raw?.id || base.id,
    theme: { ...base.theme, ...(raw?.theme || {}) },
    bio: { ...base.bio, ...(raw?.bio || {}) },
    stats: { ...base.stats, ...(raw?.stats || {}) },
    knowledge: Array.isArray(raw?.knowledge) ? raw.knowledge.map((entry) => ({ ...entry })) : base.knowledge,
    spells: Array.isArray(raw?.spells) ? raw.spells.map((entry) => ({ ...entry })) : base.spells,
    consumables: Array.isArray(raw?.consumables) ? raw.consumables.map((entry) => ({ ...entry })) : base.consumables,
    others: Array.isArray(raw?.others) ? raw.others.map((entry) => ({ ...entry })) : base.others,
    weapons: Array.isArray(raw?.weapons) ? raw.weapons.map((entry) => ({ ...entry })) : base.weapons,
    armor: Array.isArray(raw?.armor) ? raw.armor.map((entry) => ({ ...entry })) : base.armor,
    bags: Array.isArray(raw?.bags) ? raw.bags.map((entry) => ({ ...entry })) : base.bags,
    equipped: raw?.equipped && typeof raw.equipped === "object" ? raw.equipped : base.equipped,
    currency: raw?.currency && typeof raw.currency === "object"
      ? { gold: Number(raw.currency.gold) || 0, silver: Number(raw.currency.silver) || 0, copper: Number(raw.currency.copper) || 0 }
      : { gold: 0, silver: 0, copper: 0 },
  };

  if (regenerateNestedIds) {
    next.knowledge = next.knowledge.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
    next.spells = next.spells.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
    const itemIdMap = new Map();
    ["consumables", "others", "weapons", "armor", "bags"].forEach((section) => {
      next[section] = next[section].map((entry) => {
        const nextId = crypto.randomUUID();
        itemIdMap.set(entry.id, nextId);
        return { ...entry, id: nextId };
      });
    });
    next.equipped = Object.fromEntries(
      Object.entries(next.equipped || {}).map(([slotId, itemId]) => [slotId, itemIdMap.get(itemId) || itemId])
    );
  }

  return next;
}

function resolvePlayerDisplayName(playerId) {
  if (!playerId) return "Player";
  const d = state.playerDirectory?.[playerId];
  if (d?.name) return d.name;
  const p = state.partyPlayers?.find((x) => x.id === playerId);
  if (p?.name) return p.name;
  return playerId.length > 12 ? `${playerId.slice(0, 8)}…` : playerId;
}

function resolveCharacterDisplayName(sheetId) {
  if (!sheetId) return "Name Surname";
  const n = state.sheetNames?.[sheetId];
  if (n && String(n).trim()) return String(n).trim();
  return "Name Surname";
}

function mapChatRow(row) {
  return {
    id: row.id,
    playerId: row.player_id || "",
    sheetId: row.sheet_id || null,
    body: storage.getChatMessageText(row),
  };
}

function appendChatMessageIfNew(row) {
  const msg = mapChatRow(row);
  if (!msg.id || state.chatMessages.some((m) => m.id === msg.id)) return false;
  state.chatMessages.push(msg);
  if (state.chatMessages.length > 250) state.chatMessages = state.chatMessages.slice(-200);
  return true;
}

function canDeleteChatMessage(m) {
  if (!m?.id) return false;
  if (state.isGM) return true;
  if (!state.playerId) return false;
  return String(m.playerId || "") === String(state.playerId);
}

/** Remove one message from state and the chat list DOM without full render (live delete + broadcast). */
function handleChatMessageRemoved(messageId) {
  if (messageId == null) return;
  const sid = String(messageId);
  if (!state.chatMessages.some((m) => String(m.id) === sid)) return;
  state.chatMessages = state.chatMessages.filter((m) => String(m.id) !== sid);
  const root = document.getElementById("chat-messages");
  if (!root) return;
  const safe = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(sid) : sid;
  root.querySelector(`.chat-msg[data-chat-id="${safe}"]`)?.remove();
  setupChatScrollbar();
  // Notes scrollbar is initialized from render() when the notes tab is active.
}

function getLockOwner(lockId) {
  return null;
}

function hasOwnedFieldLock() {
  return false;
}

function isLockedByOther(lockId) {
  return false;
}

function getElementLockId(el) {
  return null;
}

async function acquireFieldLock(lockId) {
  return true;
}

async function releaseFieldLock(lockId) {
  return;
}

function syncFieldLockStates() {
  return;
}

function renderHeader() {
  const visible = getVisibleSheets();
  const menuItems = visible
    .map((id) => {
      const name = escapeAttr(state.sheetNames[id] || "Name Surname");
      return `<button type="button" class="sheet-menu-item ${id === (state.pendingSheetId || state.activeSheetId) ? "active" : ""}" data-sheet-id="${id}">${name}</button>`;
    })
    .join("");
  return `
    <header class="app-header">
      <div class="header-top">
        <div class="sheet-picker">
          <div class="sheet-title">${getSheetTitle()}</div>
          <button type="button" id="btn-sheet-menu" class="header-icon-btn sheet-arrow-btn ${state.sheetMenuOpen ? "open" : ""}" aria-label="${t("selectSheet")}">
            ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
          </button>
          ${state.sheetMenuOpen ? `<div class="sheet-menu">${menuItems}</div>` : ""}
        </div>
        ${state.isGM ? `<button type="button" id="btn-new-sheet" class="header-icon-btn plain-icon-btn" title="${t("newSheet")}">${inlineSvg(addIcon, "inline-svg header-icon-svg plus-minus-icon-svg", "var(--accent)")}</button>` : ""}
        ${state.isGM ? `<button type="button" id="btn-delete-sheet" class="header-icon-btn plain-icon-btn" title="${t("remove")}">${inlineSvg(removeIcon, "inline-svg header-icon-svg plus-minus-icon-svg", "var(--accent)")}</button>` : ""}
        <div class="lang-flags">
          <button type="button" class="flag-icon-btn ${state.locale === "fr" ? "active" : ""}" data-lang="fr" title="Français" aria-label="Français"><img src="${frenchFlagIcon}" alt="Français" class="flag-img" /></button>
          <button type="button" class="flag-icon-btn ${state.locale === "en" ? "active" : ""}" data-lang="en" title="English" aria-label="English"><img src="${englishFlagIcon}" alt="English" class="flag-img" /></button>
        </div>
      </div>
    </header>
  `;
}

function renderTabs() {
  const tabsHtml = TABS.map(
    (tab) =>
      `<button type="button" class="tab-icon-btn ${state.activeTab === tab ? "active" : ""}" data-tab="${tab}" title="${TAB_META[tab].label}" aria-label="${TAB_META[tab].label}">
        ${inlineSvg(tabIcon, "inline-svg tab-bg-icon-svg", state.activeTab === tab ? "var(--text)" : "var(--accent)")}
        ${inlineSvg(TAB_META[tab].icon, `inline-svg tab-foreground-icon-svg ${tab === "stats" ? "tab-foreground-icon-stats" : ""}`, "var(--bg)")}
      </button>`
  ).join("");
  return `<nav class="tabs">${tabsHtml}</nav>`;
}

function renderBioTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${state.pendingSheetId ? "Loading sheet..." : t("noSheet")}</p></div>`;
  const b = s.bio || {};
  const editable = canEdit(s.id);
  return `
    <div class="card bio-card">
      <div class="bio-fields">
        <div class="bio-field-group">
          <label class="label bio-label">${t("name")}</label>
          <input type="text" class="bio-input" value="${escapeAttr(b.name)}" data-field="bio.name" placeholder="${escapeAttr(enterField("name"))}" ${editable ? "" : "readonly"} />
        </div>
        <div class="bio-field-group">
          <label class="label bio-label">${t("surname")}</label>
          <input type="text" class="bio-input" value="${escapeAttr(b.surname)}" data-field="bio.surname" placeholder="${escapeAttr(enterField("surname"))}" ${editable ? "" : "readonly"} />
        </div>
        <div class="bio-field-group">
          <label class="label bio-label">${t("element")}</label>
          <input type="text" class="bio-input" value="${escapeAttr(b.element)}" data-field="bio.element" placeholder="${escapeAttr(enterField("element"))}" ${editable ? "" : "readonly"} />
        </div>
        <div class="bio-field-group">
          <label class="label bio-label">${t("class")}</label>
          <input type="text" class="bio-input" value="${escapeAttr(b.class)}" data-field="bio.class" placeholder="${escapeAttr(enterField("class"))}" ${editable ? "" : "readonly"} />
        </div>
        <div class="bio-level-row">
          <label class="label bio-level-label">${t("level")}</label>
          <div class="bio-level-control ${editable ? "" : "readonly"}">
            <input type="number" min="1" class="bio-level-input" value="${Number(b.level) || 1}" data-field="bio.level" placeholder="${escapeAttr(enterField("level"))}" ${editable ? "" : "readonly"} />
            <div class="bio-level-arrows">
              <button type="button" class="bio-level-arrow-btn bio-level-arrow-up" data-level-step="1" ${editable ? "" : "disabled"} aria-label="Increase level">
                ${inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)")}
              </button>
              <button type="button" class="bio-level-arrow-btn bio-level-arrow-down" data-level-step="-1" ${editable ? "" : "disabled"} aria-label="Decrease level">
                ${inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function escapeAttr(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function formatI18nTemplate(key, vars) {
  let s = t(key);
  if (!vars) return s;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v));
  }
  return s;
}

const CHAT_APPLY_ROLL_KINDS = new Set(["pdmg", "mdmg", "tdmg", "heal", "theal", "mana"]);

function chatRollApplyButtonLabel(kind) {
  switch (kind) {
    case "pdmg":
      return t("applyPhysicalDamages");
    case "mdmg":
      return t("applyMagicalDamages");
    case "tdmg":
      return t("applyTrueDamages");
    case "heal":
      return t("applyHeal");
    case "theal":
      return t("applyOverHeal");
    case "mana":
      return t("applyMana");
    default:
      return t("applyDamage");
  }
}

function formatSystemChatApplyPayload(applyFx) {
  const clean = Array.isArray(applyFx) ? applyFx.filter(Boolean) : [];
  return `[[sys]]${JSON.stringify({ applyFx: clean })}`;
}

/** Localized line for structured apply-effect events (locale at view time). */
function renderSysApplyFx(ev) {
  if (!ev || typeof ev !== "object") return "";
  switch (ev.fx) {
    case "pdmgApply":
      return formatI18nTemplate("chatApplyPhysicalDamage", {
        name: ev.name,
        actual: ev.actual,
        raw: ev.raw,
        def: ev.def,
      });
    case "mdmgApply":
      return formatI18nTemplate("chatApplyMagicalDamage", {
        name: ev.name,
        actual: ev.actual,
        raw: ev.raw,
        def: ev.def,
      });
    case "tdmgApply":
      return formatI18nTemplate("chatApplyTrueDamage", { name: ev.name, actual: ev.actual });
    case "healAlreadyFull":
      return `${ev.name} ${t("alreadyAtFullHealth")}`;
    case "healGain":
      return `${ev.name} ${t("healedFor")} ${ev.gained}`;
    case "healNowFull":
      return `${ev.name} ${t("nowAtFullHealth")}`;
    case "thealGain":
      return `${ev.name} ${t("gainedVerb")} ${ev.amount} ${t("temporaryHitPointsPhrase")}`;
    case "manaAlreadyFull":
      return `${ev.name} ${t("alreadyAtFullMana")}`;
    case "manaGain":
      return `${ev.name} ${t("regainedMana")} ${ev.gained} ${t("manaPoints")}`;
    case "manaNowFull":
      return `${ev.name} ${t("nowAtFullMana")}`;
    default:
      return "";
  }
}

function rollTypeLabelFromPayload(payload) {
  const kind = String(payload?.kind || "");
  if (kind === "stat") {
    const sid = String(payload.stat || "").toLowerCase();
    if (sid) return t(sid);
  }
  if (kind === "pdmg") return t("physicalDamage");
  if (kind === "mdmg") return t("magicDamage");
  if (kind === "tdmg") return t("trueDamage");
  if (kind === "heal") return t("heal");
  if (kind === "theal") return t("overHeal");
  if (kind === "mana") return t("mana");
  if (kind === "roll") return t("roll");
  return String(payload?.typeLabel || "").trim();
}

function rollWinFromPayload(payload) {
  const o = payload?.outcome;
  if (o === "critical_success") return t("criticalSuccess");
  if (o === "success") return t("success");
  if (o === "failure") return t("failure");
  if (o === "critical_failure") return t("criticalFailure");
  if (typeof payload?.cmpSuccess === "boolean") return t(payload.cmpSuccess ? "success" : "failure");
  return String(payload?.win || "").trim();
}

/**
 * Apply damage/heal/mana from a chat roll to the active sheet.
 * @returns {{ success: true, applyFx: object[] } | { success: false }}
 */
function applyChatRollToActiveSheet(kind, valueOrValues) {
  if (!state.sheet || !state.roomId || !state.activeSheetId) return { success: false };
  const name = resolveCharacterDisplayName(state.activeSheetId);
  const roomId = state.roomId;
  const sheetId = state.activeSheetId;
  const values = Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues];
  const cleanValues = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (!cleanValues.length) return { success: false };
  const applyFx = [];

  switch (kind) {
    case "pdmg": {
      const def = Math.floor(Math.max(0, Number(getSheetDefense(state.sheet)) || 0));
      cleanValues.forEach((val) => {
        const raw = Math.max(0, Math.floor(Number(val) || 0));
        const actual = Math.max(0, raw - def);
        const next = applyPhysicalDamage(state.sheet, val);
        Object.assign(state.sheet, next);
        applyFx.push({ fx: "pdmgApply", name, actual, raw, def });
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentHP: state.sheet.currentHP, tempHP: state.sheet.tempHP }).catch(console.error);
      return { success: true, applyFx };
    }
    case "mdmg": {
      const def = Math.floor(Math.max(0, Number(getSheetMagicalDefense(state.sheet)) || 0));
      cleanValues.forEach((val) => {
        const raw = Math.max(0, Math.floor(Number(val) || 0));
        const actual = Math.max(0, raw - def);
        const next = applyMagicDamage(state.sheet, val);
        Object.assign(state.sheet, next);
        applyFx.push({ fx: "mdmgApply", name, actual, raw, def });
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentHP: state.sheet.currentHP, tempHP: state.sheet.tempHP }).catch(console.error);
      return { success: true, applyFx };
    }
    case "tdmg": {
      cleanValues.forEach((val) => {
        const actual = Math.max(0, Math.floor(Number(val) || 0));
        const next = applyTrueDamage(state.sheet, val);
        Object.assign(state.sheet, next);
        applyFx.push({ fx: "tdmgApply", name, actual });
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentHP: state.sheet.currentHP, tempHP: state.sheet.tempHP }).catch(console.error);
      return { success: true, applyFx };
    }
    case "heal": {
      const maxHP = getMaxHP(state.sheet);
      const cur = Math.max(0, Number(state.sheet.currentHP) || 0);
      if (maxHP > 0 && cur >= maxHP) {
        applyFx.push({ fx: "healAlreadyFull", name });
        return { success: true, applyFx };
      }
      let totalGained = 0;
      cleanValues.forEach((val) => {
        const before = Math.max(0, Number(state.sheet.currentHP) || 0);
        const space = Math.max(0, maxHP - before);
        const gained = Math.min(Math.max(0, Number(val) || 0), space);
        const next = applyHeal(state.sheet, val, maxHP);
        Object.assign(state.sheet, next);
        totalGained += Math.floor(gained);
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentHP: state.sheet.currentHP, tempHP: state.sheet.tempHP }).catch(console.error);
      applyFx.push({ fx: "healGain", name, gained: totalGained });
      const after = Math.max(0, Number(state.sheet.currentHP) || 0);
      if (maxHP > 0 && after >= maxHP) applyFx.push({ fx: "healNowFull", name });
      return { success: true, applyFx };
    }
    case "theal": {
      const total = cleanValues.reduce((a, v) => a + Math.max(0, Math.floor(Number(v) || 0)), 0);
      cleanValues.forEach((val) => {
        const next = applyOverHeal(state.sheet, val);
        Object.assign(state.sheet, next);
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentHP: state.sheet.currentHP, tempHP: state.sheet.tempHP }).catch(console.error);
      applyFx.push({ fx: "thealGain", name, amount: total });
      return { success: true, applyFx };
    }
    case "mana": {
      const maxMP = getMaxMP(state.sheet);
      const cur = Math.max(0, Number(state.sheet.currentMP) || 0);
      if (maxMP > 0 && cur >= maxMP) {
        applyFx.push({ fx: "manaAlreadyFull", name });
        return { success: true, applyFx };
      }
      let totalGained = 0;
      cleanValues.forEach((val) => {
        const before = Math.max(0, Number(state.sheet.currentMP) || 0);
        const space = Math.max(0, maxMP - before);
        const gained = Math.min(Math.max(0, Number(val) || 0), space);
        const next = applyMana(state.sheet, val, maxMP);
        Object.assign(state.sheet, next);
        totalGained += Math.floor(gained);
      });
      saveSheet();
      storage.updateSheetCore(roomId, sheetId, { currentMP: state.sheet.currentMP }).catch(console.error);
      applyFx.push({ fx: "manaGain", name, gained: totalGained });
      const after = Math.max(0, Number(state.sheet.currentMP) || 0);
      if (maxMP > 0 && after >= maxMP) applyFx.push({ fx: "manaNowFull", name });
      return { success: true, applyFx };
    }
    default:
      return { success: false };
  }
}

function syncRollModalRerollState() {
  const modal = document.getElementById("roll-modal");
  const rerollBtn = document.getElementById("roll-reroll-btn");
  if (!modal || !rerollBtn || modal.classList.contains("hidden")) return;
  const result = state.lastRoll;
  if (!result) {
    rerollBtn.disabled = true;
    return;
  }
  const eligible = !!state.sheet && canReroll(result) && !!state.lastRollPayload;
  const favor = Math.max(0, Number(state.sheet?.currentFavor) || 0);
  const hasFavor = !!state.sheet && favor >= 1;
  rerollBtn.disabled = !eligible || !hasFavor;
}

function showRollResult(result) {
  const modal = document.getElementById("roll-modal");
  const text = document.getElementById("roll-result-text");
  const applyBox = document.getElementById("roll-apply-buttons");
  if (!modal || !text) return;
  state.lastRoll = result;
  state.rollModalOpen = true;
  modal.classList.remove("hidden");
  const cnt = Math.max(1, Number(result.count) || 1);
  const cntSeg = cnt > 1 ? ` ×${cnt}` : "";
  if (Array.isArray(result.multi) && result.multi.length) {
    const total = result.multi.reduce((a, r) => a + (Number(r?.value) || 0), 0);
    const isSucceedableMulti = result.kind === "stat" || result.multi.some((r) => r?.comparison && typeof r.comparison.success === "boolean");
    const succ = isSucceedableMulti ? result.multi.filter((r) => r?.outcome === "success").length : 0;
    const fail = isSucceedableMulti ? result.multi.filter((r) => r?.outcome === "failure").length : 0;
    const critSucc = isSucceedableMulti ? result.multi.filter((r) => r?.outcome === "critical_success").length : 0;
    const critFail = isSucceedableMulti ? result.multi.filter((r) => r?.outcome === "critical_failure").length : 0;
    if (result.kind === "stat") {
      const parts = result.multi.map((r) => {
        const o = r?.outcome;
        const tag = o ? t(o === "critical_success" ? "criticalSuccess" : o === "success" ? "success" : o === "failure" ? "failure" : "criticalFailure") : "";
        return `${r?.value ?? 0}${tag ? " [" + tag + "]" : ""}`;
      });
      const totalLine = `${succ} ${t("success")}${fail ? `, ${fail} ${t("failure")}` : ""}${critSucc ? `, ${critSucc} ${t("criticalSuccess")}` : ""}${critFail ? `, ${critFail} ${t("criticalFailure")}` : ""}`;
      text.textContent = `${t("rolled")}${cntSeg} ${result.translatedFormula || result.formula || ""} : ${parts.join(" | ")}\nTotal : ${totalLine}`;
    } else {
      const parts = result.multi.map((r) => {
        const o = r?.outcome;
        const critTag = o === "critical_success" ? t("criticalSuccess") : o === "critical_failure" ? t("criticalFailure") : "";
        const winTag =
          !critTag && r?.comparison && typeof r.comparison.success === "boolean"
            ? t(r.comparison.success ? "success" : "failure")
            : "";
        const tag = critTag || winTag;
        return `${r?.value ?? 0}${tag ? " [" + tag + "]" : ""}`;
      });
      const totalLine = isSucceedableMulti
        ? `${succ} ${t("success")}${fail ? `, ${fail} ${t("failure")}` : ""}${critSucc ? `, ${critSucc} ${t("criticalSuccess")}` : ""}${critFail ? `, ${critFail} ${t("criticalFailure")}` : ""}`
        : String(total);
      text.textContent = `${t("rolled")}${cntSeg} ${result.translatedFormula || result.formula || ""} : ${parts.join(" | ")}\nTotal : ${totalLine}`;
    }
  } else if (result.kind === "stat") {
    const dice = Array.isArray(result.diceResults) ? result.diceResults.join(", ") : "";
    text.textContent = `${t("rolled")}${cntSeg} ${result.translatedFormula} : [${dice}] ${result.value} [${t(result.outcome === "critical_success" ? "criticalSuccess" : result.outcome === "success" ? "success" : result.outcome === "failure" ? "failure" : "criticalFailure")}]`;
  } else {
    const dice = Array.isArray(result.diceResults) ? result.diceResults.join(", ") : "";
    const o = result?.outcome;
    const critTag = o === "critical_success" ? t("criticalSuccess") : o === "critical_failure" ? t("criticalFailure") : "";
    const winTag =
      !critTag && result.comparison && typeof result.comparison.success === "boolean"
        ? t(result.comparison.success ? "success" : "failure")
        : "";
    const tag = critTag || winTag;
    const suffix = tag ? ` [${tag}]` : "";
    text.textContent = `${t("rolled")}${cntSeg} ${result.translatedFormula || result.formula || ""} : [${dice}] ${result.value}${suffix}`;
  }
  syncRollModalRerollState();
  if (applyBox) {
    applyBox.innerHTML = "";
    applyBox.classList.add("hidden");
  }
}

function renderStatsTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${t("noSheet")}</p></div>`;
  const maxHP = getMaxHP(s);
  const maxMP = getMaxMP(s);
  const maxFavor = getMaxFavor(s);
  const actions = getActionCount(s);
  const speedFormula = getSpeedFormula(s);
  const editable = canEdit(s.id);

  let hpMp = `
    <div class="stat-row">
      <span class="label">${t("tempHP")}</span>
      <input type="number" min="0" value="${s.tempHP ?? 0}" data-field="tempHP" placeholder="${escapeAttr(enterField("tempHP"))}" ${editable ? "" : "readonly"} />
    </div>
    <div class="stat-row">
      <span class="label">${t("currentHP")}</span>
      <input type="number" min="0" max="${maxHP}" value="${s.currentHP ?? 0}" data-field="currentHP" placeholder="${escapeAttr(enterField("currentHP"))}" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxHP}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("currentMP")}</span>
      <input type="number" min="0" max="${maxMP}" value="${s.currentMP ?? 0}" data-field="currentMP" placeholder="${escapeAttr(enterField("currentMP"))}" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxMP}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("currentFavor")}</span>
      <input type="number" min="0" max="${maxFavor}" value="${s.currentFavor ?? 0}" data-field="currentFavor" placeholder="${escapeAttr(enterField("currentFavor"))}" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxFavor}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("action")}</span>
      <span>${actions}</span>
      ${editable ? `<input type="text" placeholder="${escapeAttr(enterField("actionModifier"))}" value="${escapeAttr(s.actionModifier)}" data-field="actionModifier" class="short-input" />` : ""}
    </div>
    <div class="stat-row">
      <span class="label">${t("speed")}</span>
      <span class="formula">${speedFormula}</span>
      ${editable ? `<input type="text" placeholder="${escapeAttr(enterField("speedModifier"))}" value="${escapeAttr(s.speedModifier)}" data-field="speedModifier" class="short-input" />` : ""}
      <button type="button" id="btn-roll-speed" class="btn-sm">${t("rollSpeed")}</button>
    </div>
  `;

  const knowledgeList = (s.knowledge || []).map(
    (k, i) => `
    <div class="knowledge-item" data-idx="${i}">
      <input type="text" value="${escapeAttr(k.name)}" data-knowledge-name="${i}" placeholder="${escapeAttr(enterField("knowledge"))}" ${editable ? "" : "readonly"} />
      <select data-knowledge-tier="${i}" ${editable ? "" : "disabled"}>
        ${[1, 2, 3, 4].map((tier) => `<option value="${tier}" ${k.tier === tier ? "selected" : ""}>${t("tier" + tier)}</option>`).join("")}
      </select>
      <label><input type="checkbox" data-knowledge-enabled="${i}" ${k.enabled ? "checked" : ""} ${editable ? "" : "disabled"} /> On</label>
      ${editable ? `<button type="button" class="btn-sm" data-remove-knowledge="${i}">${t("remove")}</button>` : ""}
    </div>
  `
  ).join("");

  let statsTable = "";
  STAT_IDS.forEach((statId) => {
    const st = s.stats[statId] || {};
    const total = getStatTotal(s, statId);
    const labelKey = statId.charAt(0).toUpperCase() + statId.slice(1);
    const label = t(statId);
    statsTable += `
      <tr>
        <td>${label}</td>
        <td><input type="number" data-stat="${statId}.base" value="${st.base ?? 0}" placeholder="${escapeAttr(enterField("baseStat"))}" ${editable ? "" : "readonly"} /></td>
        <td><input type="number" data-stat="${statId}.xpBonus" value="${st.xpBonus ?? 0}" placeholder="${escapeAttr(enterField("xpBonus"))}" ${editable ? "" : "readonly"} /></td>
        <td><input type="number" data-stat="${statId}.itemBonus" value="${st.itemBonus ?? 0}" readonly /></td>
        <td><input type="number" data-stat="${statId}.passiveBonus" value="${st.passiveBonus ?? 0}" placeholder="${escapeAttr(enterField("passiveBonus"))}" ${editable ? "" : "readonly"} /></td>
        <td class="total">${total}</td>
        <td>
          <button type="button" class="btn-roll-stat" data-stat="${statId}" data-dc="${total}">${t("roll")}</button>
          <div class="quick-mods" data-stat="${statId}">
            <button type="button" data-mod="-10">-10</button>
            <button type="button" data-mod="-5">-5</button>
            <button type="button" data-mod="-3">-3</button>
            <button type="button" data-mod="-1">-1</button>
            <button type="button" data-mod="+1">+1</button>
            <button type="button" data-mod="+3">+3</button>
            <button type="button" data-mod="+5">+5</button>
            <button type="button" data-mod="+10">+10</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="card stats-tab-card">
      <h2>${t("tabStats")}</h2>
      <div class="hp-mp-block">${hpMp}</div>
      <h3>${t("knowledge")}</h3>
      <div class="knowledge-list">${knowledgeList}</div>
      ${editable ? `<button type="button" id="btn-add-knowledge" class="btn-sm">${t("addKnowledge")}</button>` : ""}
      <table class="stats-table">
        <thead><tr><th></th><th>${t("baseStat")}</th><th>${t("xpBonus")}</th><th>${t("itemBonus")}</th><th>${t("passiveBonus")}</th><th>${t("total")}</th><th>${t("roll")}</th></tr></thead>
        <tbody>${statsTable}</tbody>
      </table>
    </div>
  `;
}

/** Roll result + stat modifier modals: must live outside tab content so chat/notes rolls can use them. */
function renderRollModals() {
  return `
    <div id="roll-modal" class="modal hidden">
      <div class="modal-content roll-modal-content">
        <h3 id="roll-result-title">${t("result")}</h3>
        <p id="roll-result-text"></p>
        <div id="roll-apply-buttons" class="roll-apply-buttons hidden"></div>
        <div class="roll-modal-footer">
          <button type="button" id="roll-reroll-btn" class="roll-modal-reroll-btn" disabled title="${escapeAttr(t("rerollCost"))}">${t("reroll")}</button>
          <button type="button" id="roll-close-btn" class="roll-modal-close-btn">${t("close")}</button>
        </div>
      </div>
    </div>
    <div id="stat-roll-modal" class="modal hidden">
      <div class="modal-content">
        <label>${t("modifier")}</label>
        <input type="text" id="stat-roll-modifier" placeholder="${escapeAttr(t("statRollModifierPlaceholder"))}" />
        <button type="button" id="stat-roll-do">${t("roll")}</button>
        <button type="button" id="stat-roll-cancel">${t("cancel")}</button>
      </div>
    </div>
  `;
}

function renderSpellsTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${t("noSheet")}</p></div>`;
  const editable = canEdit(s.id);
  const spells = s.spells || [];
  const list = spells
    .map(
      (sp, i) => `
    <div class="spell-item card" data-idx="${i}">
      <label class="spell-element-row">${t("spellElement")} <input type="text" class="spell-element" value="${escapeAttr(sp.element || "")}" data-spell-element="${i}" placeholder="${escapeAttr(enterField("spellElement"))}" ${editable ? "" : "readonly"} /></label>
      <input type="text" class="spell-name" value="${escapeAttr(sp.name)}" data-spell-name="${i}" placeholder="${escapeAttr(enterField("spellName"))}" ${editable ? "" : "readonly"} />
      <textarea class="spell-effect" data-spell-effect="${i}" placeholder="${escapeAttr(enterField("spellEffect"))}" ${editable ? "" : "readonly"} rows="2">${escapeAttr(sp.effect)}</textarea>
      <div class="spell-cost">
        <input type="number" min="0" value="${sp.cost ?? 0}" data-spell-cost="${i}" placeholder="${escapeAttr(enterField("spellCost"))}" ${editable ? "" : "readonly"} />
        <label><input type="radio" name="costType-${i}" value="mp" ${(sp.costType || "mp") === "mp" ? "checked" : ""} ${editable ? "" : "disabled"} /> ${t("costMP")}</label>
        <label><input type="radio" name="costType-${i}" value="hp" ${sp.costType === "hp" ? "checked" : ""} ${editable ? "" : "disabled"} /> ${t("costHP")}</label>
        ${editable ? `<button type="button" class="btn-deduct-cost" data-idx="${i}">${t("deductCost")}</button>` : ""}
      </div>
      ${editable ? `<button type="button" class="btn-sm" data-remove-spell="${i}">${t("remove")}</button>` : ""}
    </div>
  `
    )
    .join("");
  return `
    <div class="card">
      <h2>${t("tabSpells")}</h2>
      <div class="spell-list">${list}</div>
      ${editable ? `<button type="button" id="btn-add-spell">${t("add")}</button>` : ""}
    </div>
  `;
}

function slotLabel(slotId) {
  const key = "slot" + slotId;
  return t(key) || slotId;
}

function itemsForSlot(sheet, slotId) {
  const weaponSlots = ["Weapon1", "Weapon2", "Weapon3"];
  if (weaponSlots.includes(slotId)) {
    return (sheet.weapons || []).map((it) => ({ id: it.id, name: it.name || it.id?.slice(0, 8) }));
  }
  if (slotId === "Other") {
    const out = [];
    (sheet.weapons || []).forEach((it) => out.push({ id: it.id, name: (it.name || it.id?.slice(0, 8)) + " (W)" }));
    (sheet.armor || []).forEach((it) => out.push({ id: it.id, name: (it.name || it.id?.slice(0, 8)) + " (A)" }));
    (sheet.others || []).forEach((it) => out.push({ id: it.id, name: (it.name || it.id?.slice(0, 8)) + " (O)" }));
    return out;
  }
  return (sheet.armor || []).filter((it) => {
    const slots = it.equippableSlots || [];
    return slots.length === 0 || slots.includes(slotId);
  }).map((it) => ({ id: it.id, name: it.name || it.id?.slice(0, 8) }));
}

function renderInventoryTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${state.pendingSheetId ? "Loading sheet..." : t("noSheet")}</p></div>`;
  const editable = canEdit(s.id);
  const equipped = s.equipped || {};
  const equippedRows = SLOT_IDS.map((slotId) => {
    const currentId = equipped[slotId];
    const options = itemsForSlot(s, slotId);
    return `<div class="equip-row"><span class="equip-slot-label">${slotLabel(slotId)}</span><select class="equip-select" data-slot="${slotId}" ${editable ? "" : "disabled"}><option value="">—</option>${options.map((it) => `<option value="${it.id}" ${currentId === it.id ? "selected" : ""}>${escapeAttr(it.name)}</option>`).join("")}</select></div>`;
  }).join("");
  let html = `
    <div class="card inventory-tab-card"><h2>${t("tabInventory")}</h2>
    <h3>${t("equipped")}</h3>
    <div class="equipped-grid">${equippedRows}</div>
  `;
  const sections = [
    { key: "consumables", label: t("consumables") },
    { key: "others", label: t("others") },
    { key: "weapons", label: t("weapons") },
    { key: "armor", label: t("armor") },
    { key: "bags", label: t("bags") },
  ];
  sections.forEach(({ key, label }) => {
    const items = s[key] || [];
    html += `
      <h3>${label}</h3>
      <ul class="item-list" data-section="${key}">
        ${items
          .map(
            (it, i) => `
          <li class="item-line" data-section="${key}" data-idx="${i}">
            <input type="text" class="item-name-inp" value="${escapeAttr(it.name || "")}" data-item-name="${key}-${i}" placeholder="${escapeAttr(enterField("itemName"))}" ${editable ? "" : "readonly"} />
            <input type="number" min="0" class="item-count-inp" value="${it.count != null ? it.count : 1}" data-item-count="${key}-${i}" placeholder="${escapeAttr(enterField("numberOwned"))}" ${editable ? "" : "readonly"} />
            <span class="item-toggle" data-toggle-item="${key}-${i}" title="${t("itemDescription")}">▼</span>
            <div class="item-detail hidden" id="item-detail-${key}-${i}">
              <textarea data-item-desc="${key}-${i}" ${editable ? "" : "readonly"} placeholder="${escapeAttr(enterField("itemDescription"))}">${escapeAttr(it.description)}</textarea>
              ${key === "weapons" ? `<label>${t("weaponSlots")}: <input type="number" min="1" data-item-weapon-slots="${key}-${i}" value="${it.weaponSlots ?? 1}" placeholder="${escapeAttr(enterField("weaponSlots"))}" ${editable ? "" : "readonly"} /></label>` : ""}
              ${key === "armor" ? `<label>${t("defense")}: <input type="number" data-item-defense="${key}-${i}" value="${it.defense ?? ""}" placeholder="${escapeAttr(enterField("defense"))}" ${editable ? "" : "readonly"} /></label><label>${t("magicalDefense")}: <input type="number" data-item-magdef="${key}-${i}" value="${it.magicalDefense ?? ""}" placeholder="${escapeAttr(enterField("magicalDefense"))}" ${editable ? "" : "readonly"} /></label><label>${t("equippableSlots")}: <input type="text" data-item-equip-slots="${key}-${i}" value="${Array.isArray(it.equippableSlots) ? it.equippableSlots.join(", ") : (it.equippableSlots || "")}" placeholder="${escapeAttr(enterField("equippableSlots"))}" ${editable ? "" : "readonly"} /></label>` : ""}
              ${it.defense != null && key !== "armor" ? `<span>${t("defense")}: ${it.defense}</span>` : ""}
              ${it.magicalDefense != null && key !== "armor" ? `<span> ${t("magicalDefense")}: ${it.magicalDefense}</span>` : ""}
            </div>
            ${editable ? `<button type="button" class="btn-sm" data-remove-item="${key}-${i}">${t("remove")}</button>` : ""}
          </li>
        `
          )
          .join("")}
      </ul>
      ${editable ? `<button type="button" class="btn-add-item" data-section="${key}">${t("add")}</button>` : ""}
    `;
  });
  html += "</div>";
  return html;
}

function renderChatTab() {
  const messages = state.chatMessages || [];
  const list = messages
    .map(
      (m) => {
        const char = escapeAttr(resolveCharacterDisplayName(m.sheetId));
        const player = escapeAttr(resolvePlayerDisplayName(m.playerId));
        const deleteBtn =
          m.id && canDeleteChatMessage(m)
            ? `<button type="button" class="chat-msg-delete-btn" data-chat-id="${escapeAttr(m.id)}" aria-label="${t("remove")}" title="${t("remove")}">${inlineSvg(removeIcon, "inline-svg chat-msg-delete-icon", "var(--text)")}</button>`
            : "";
        const bubbleInner = `<div class="chat-body">${renderChatBody(m.body)}</div>`;
        return `
        <div class="chat-msg" ${m.id ? `data-chat-id="${escapeAttr(m.id)}"` : ""}>
          <div class="chat-msg-header">
            <div class="chat-msg-header-text"><strong class="chat-char-name">${char}</strong> <span class="chat-player-name">(${player})</span></div>
            ${deleteBtn}
          </div>
          <div class="chat-msg-bubble">${bubbleInner}</div>
        </div>`;
      }
    )
    .join("");
  const sendIcon = inlineSvg(arrowIcon, "inline-svg chat-send-arrow-svg", "var(--text)");
  return `
    <div class="card chat-card chat-tab-layout">
      <h2 class="sr-only">${t("tabChat")}</h2>
      <div class="chat-messages-outer">
        <div class="chat-messages-scroll">
          <div class="chat-messages" id="chat-messages">${list}</div>
        </div>
        <div class="chat-scrollbar-col" aria-hidden="true">
          <button type="button" class="chat-scroll-arrow chat-scroll-up" id="chat-scroll-up" tabindex="-1" title="${t("scrollUp")}">${inlineSvg(arrowIcon, "inline-svg chat-scroll-arrow-svg", "var(--text)")}</button>
          <div class="chat-scroll-track-outer">
            <div class="chat-scroll-track" id="chat-scroll-track"><div class="chat-scroll-thumb" id="chat-scroll-thumb"></div></div>
          </div>
          <button type="button" class="chat-scroll-arrow chat-scroll-down" id="chat-scroll-down" tabindex="-1" title="${t("scrollDown")}">${inlineSvg(arrowIcon, "inline-svg chat-scroll-arrow-svg", "var(--text)")}</button>
        </div>
      </div>
      <div class="chat-input-row">
        <div class="chat-input-pill">
          <input type="text" id="chat-input" placeholder="${t("chatWritePlaceholder")}" autocomplete="off" />
          <button type="button" id="chat-send" class="chat-send-btn" aria-label="${t("send")}">${sendIcon}</button>
        </div>
      </div>
    </div>
  `;
}

function renderChatBody(body) {
  if (!body) return "";
  const bodyTrim = String(body).trimStart();
  if (bodyTrim.startsWith("[[sys]]")) {
    try {
      const payload = JSON.parse(bodyTrim.slice("[[sys]]".length));
      if (Array.isArray(payload.applyFx) && payload.applyFx.length) {
        return payload.applyFx
          .map((ev) => {
            const line = renderSysApplyFx(ev);
            return line ? `<em class="chat-sys-line">${escapeAttr(line)}</em>` : "";
          })
          .filter(Boolean)
          .join("<br />");
      }
      if (Array.isArray(payload.lines) && payload.lines.length) {
        return payload.lines
          .map((ln) => `<em class="chat-sys-line">${escapeAttr(String(ln || ""))}</em>`)
          .join("<br />");
      }
      const text = escapeAttr(String(payload.text || ""));
      return `<em class="chat-sys-line">${text}</em>`;
    } catch (_) {
      // fall through to normal escaping
    }
  }
  // Render roll lines with formatting (safe; only for our own roll marker).
  if (bodyTrim.startsWith("[[roll]]")) {
    try {
      const payload = JSON.parse(bodyTrim.slice("[[roll]]".length));
      const rawType = rollTypeLabelFromPayload(payload);
      const typeSeg = rawType ? ` ${rawType}` : "";
      const cnt = Math.max(1, Number(payload.count) || 1);
      const cntSeg = cnt > 1 ? ` ×${cnt}` : "";
      const headPlain = payload.isFavorReroll
        ? `${t("rerolled")}${typeSeg} ${t("usingAFavor")}`.trim()
        : `${t("rolled")}${typeSeg}`.trim();
      const headWithCount = `${headPlain}${cntSeg}`.trim();
      const headHtml = escapeAttr(headWithCount);
      const formulaText = escapeAttr(String(payload.formula || ""));
      const diceText = escapeAttr(String(payload.dice || ""));
      const isMulti = Array.isArray(payload.values) && payload.values.length;
      const total = isMulti ? payload.values.reduce((a, v) => a + (Number(v) || 0), 0) : Number(payload.value ?? 0);
      const isComparatorMulti = isMulti && Array.isArray(payload.cmpList) && payload.cmpList.some((x) => typeof x === "boolean");
      const hasOutcomeList = isMulti && Array.isArray(payload.outcomes) && payload.outcomes.some(Boolean);
      const critSucc = hasOutcomeList ? payload.outcomes.filter((o) => o === "critical_success").length : 0;
      const critFail = hasOutcomeList ? payload.outcomes.filter((o) => o === "critical_failure").length : 0;
      const succ = hasOutcomeList ? payload.outcomes.filter((o) => o === "success").length : (isComparatorMulti ? payload.cmpList.filter((b) => b === true).length : 0);
      const fail = hasOutcomeList ? payload.outcomes.filter((o) => o === "failure").length : (isComparatorMulti ? payload.cmpList.filter((b) => b === false).length : 0);
      const resultText = escapeAttr(
        isMulti ? payload.values.map((v) => String(v ?? 0)).join(", ") : String(payload.value ?? 0)
      );
      const winStr = rollWinFromPayload(payload);
      const winText = winStr ? `<em class="chat-roll-win">${escapeAttr(winStr)}</em>` : "";
      const line = `
        <div class="chat-roll-row chat-roll-row-head"><strong class="chat-roll-head">${headHtml}</strong></div>
        <div class="chat-roll-row chat-roll-row-formula"><em class="chat-roll-formula">${formulaText}</em> : <span class="chat-roll-dice">[${diceText}]</span></div>
        <div class="chat-roll-row chat-roll-row-result"><strong class="chat-roll-result">${resultText}</strong> ${winText}</div>
        ${isMulti ? `<div class="chat-roll-row chat-roll-row-total"><span class="chat-roll-total-label">Total :</span> <strong class="chat-roll-total">${
          (payload.kind === "stat" || isComparatorMulti)
            ? escapeAttr(`${succ} ${t("success")}${fail ? `, ${fail} ${t("failure")}` : ""}${critSucc ? `, ${critSucc} ${t("criticalSuccess")}` : ""}${critFail ? `, ${critFail} ${t("criticalFailure")}` : ""}`)
            : escapeAttr(String(total))
        }</strong></div>` : ""}
      `.trim();
      const rk = String(payload.kind || "");
      const v = Number(payload.value);
      let applyBlock = "";
      if (CHAT_APPLY_ROLL_KINDS.has(rk) && (isMulti || Number.isFinite(v))) {
        const canUse = !!(state.sheet && state.activeSheetId && canEdit(state.activeSheetId));
        const lbl = escapeAttr(chatRollApplyButtonLabel(rk));
        const dis = canUse ? "" : " disabled";
        const vals = isMulti ? escapeAttr(JSON.stringify(payload.values)) : "";
        const valAttr = isMulti ? "" : ` data-apply-value="${escapeAttr(String(v))}"`;
        const valsAttr = isMulti ? ` data-apply-values="${vals}"` : "";
        applyBlock = `<div class="chat-roll-apply-row"><button type="button" class="chat-roll-apply-btn btn-sm"${dis} data-apply-kind="${escapeAttr(rk)}"${valAttr}${valsAttr}>${lbl}</button></div>`;
      }
      return `<div class="chat-roll-wrap">${line}${applyBlock}</div>`;
    } catch (_) {
      // fall through to normal escaping
    }
  }
  const buttons = getInlineButtons(body);
  let text = escapeAttr(body);
  buttons.forEach((btn) => {
    const stat = (btn.stat || "").toString();
    const formula = (btn.formula || "").toString();
    const caption = escapeAttr(formatInlineRollButtonCaption(btn));
    const iconHtml = inlineDiceMarkupForButton(btn);
    const rawEsc = escapeAttr(btn.raw);
    const html = `<button type="button" class="inline-roll-btn" data-kind="${escapeAttr(btn.kind)}" data-formula="${escapeAttr(formula)}" data-stat="${escapeAttr(stat)}" data-count="${escapeAttr(String(btn.count || 1))}" aria-label="${caption}">${iconHtml}<span class="inline-roll-caption">${caption}</span></button>`;
    // Replace in escaped text so special chars like < or > don't break matching.
    text = text.split(rawEsc).join(html);
  });
  return text;
}

function formatRollChatLine(result, options = {}) {
  const formula = (result?.translatedFormula || result?.formula || "").toString();
  const dice =
    Array.isArray(result?.multi) && result.multi.length
      ? result.multi.map((r) => (Array.isArray(r?.diceResults) ? r.diceResults.join(", ") : "")).join(" | ")
      : Array.isArray(result?.diceResults)
        ? result.diceResults.join(", ")
        : "";

  // Locale-neutral payload: labels/outcomes resolved in renderChatBody via t() for current locale.
  const payload = {
    kind: result?.kind ?? "",
    formula,
    dice,
    value: result?.value ?? 0,
  };
  if (result?.count && Number(result.count) > 1) payload.count = Number(result.count) || 1;
  if (Array.isArray(result?.multi) && result.multi.length) {
    payload.values = result.multi.map((r) => r?.value ?? 0);
    payload.diceList = result.multi.map((r) => Array.isArray(r?.diceResults) ? r.diceResults.join(", ") : "");
    payload.outcomes = result.multi.map((r) => r?.outcome || "");
    payload.cmpList = result.multi.map((r) => (r?.comparison && typeof r.comparison.success === "boolean") ? !!r.comparison.success : null);
  }
  if (result?.kind === "stat" && result.stat) payload.stat = String(result.stat).toLowerCase();
  if (result?.outcome) payload.outcome = result.outcome;
  else if (result?.comparison && typeof result.comparison.success === "boolean") {
    payload.cmpSuccess = result.comparison.success;
  }
  if (options.favorReroll) payload.isFavorReroll = true;
  return `[[roll]]${JSON.stringify(payload)}`;
}

function formatChatToastBody(rawBody) {
  const s = String(rawBody || "").trim();
  if (!s) return "";
  if (s.startsWith("[[roll]]")) {
    try {
      const payload = JSON.parse(s.slice("[[roll]]".length));
      const typeLabel = rollTypeLabelFromPayload(payload);
      const formula = String(payload.formula || "").trim();
      const dice = String(payload.dice || "").trim();
      const value = payload.value ?? 0;
      const win = rollWinFromPayload(payload);
      const typeSeg = typeLabel ? ` ${typeLabel}` : "";
      if (payload.isFavorReroll) {
        return `${t("rerolled")}${typeSeg} ${t("usingAFavor")} ${formula} : [${dice}] ${value}${win ? " " + win : ""}`.trim();
      }
      return `${t("rolled")}${typeSeg} ${formula} : [${dice}] ${value}${win ? " " + win : ""}`.trim();
    } catch (_) {
      return s.slice(0, 120);
    }
  }
  if (s.startsWith("[[sys]]")) {
    try {
      const payload = JSON.parse(s.slice("[[sys]]".length));
      if (Array.isArray(payload.applyFx) && payload.applyFx.length) {
        return payload.applyFx.map((ev) => renderSysApplyFx(ev)).filter(Boolean).join(" ");
      }
    } catch (_) {
      /* fall through */
    }
  }
  return s.slice(0, 120);
}

function setupChatScrollbar() {
  const scrollEl = document.getElementById("chat-messages");
  const track = document.getElementById("chat-scroll-track");
  const thumb = document.getElementById("chat-scroll-thumb");
  const btnUp = document.getElementById("chat-scroll-up");
  const btnDown = document.getElementById("chat-scroll-down");
  if (!scrollEl || !track || !thumb) return;

  const updateThumb = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const trackH = track.clientHeight;
    const thumbH = Math.max(22, Math.min(trackH, (clientHeight / Math.max(scrollHeight, 1)) * trackH));
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const maxThumbTop = Math.max(0, trackH - thumbH);
    const top = maxScroll <= 0 ? 0 : (scrollTop / maxScroll) * maxThumbTop;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  };

  const updateStick = () => {
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const fromBottom = Math.max(0, maxScroll - scrollEl.scrollTop);
    state._chatStickToBottom = fromBottom <= 18;
  };

  scrollEl.addEventListener(
    "scroll",
    () => {
      updateThumb();
      updateStick();
    },
    { passive: true }
  );
  try {
    const ro = new ResizeObserver(() => updateThumb());
    ro.observe(scrollEl);
    ro.observe(track);
  } catch (_) {}

  const step = () => Math.max(60, Math.floor(scrollEl.clientHeight * 0.85));
  btnUp?.addEventListener("click", () => {
    scrollEl.scrollBy({ top: -step(), behavior: "smooth" });
  });
  btnDown?.addEventListener("click", () => {
    scrollEl.scrollBy({ top: step(), behavior: "smooth" });
  });

  track.addEventListener("click", (e) => {
    if (e.target === thumb || thumb.contains(e.target)) return;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const pct = clickY / rect.height;
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollEl.scrollTop = pct * maxScroll;
  });

  thumb.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startScroll = scrollEl.scrollTop;
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const trackH = track.clientHeight;
    const thumbH = thumb.offsetHeight;
    const denom = Math.max(1, trackH - thumbH);
    const scrollPerPx = maxScroll / denom;
    function onMove(e2) {
      const dy = e2.clientY - startY;
      scrollEl.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + dy * scrollPerPx));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      thumb.classList.remove("dragging");
    }
    thumb.classList.add("dragging");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  updateThumb();
  updateStick();
}

function setupNotesScrollbar() {
  const scrollWrap = document.getElementById("notes-scroll");
  const scrollEl = scrollWrap;
  const track = document.getElementById("notes-scroll-track");
  const thumb = document.getElementById("notes-scroll-thumb");
  const btnUp = document.getElementById("notes-scroll-up");
  const btnDown = document.getElementById("notes-scroll-down");
  if (!scrollEl || !track || !thumb) return;

  const updateThumb = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const trackH = track.clientHeight;
    const thumbH = Math.max(22, Math.min(trackH, (clientHeight / Math.max(scrollHeight, 1)) * trackH));
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const maxThumbTop = Math.max(0, trackH - thumbH);
    const top = maxScroll <= 0 ? 0 : (scrollTop / maxScroll) * maxThumbTop;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  };

  const scrollByPx = (dy) => {
    scrollEl.scrollTop = Math.max(0, Math.min(scrollEl.scrollHeight - scrollEl.clientHeight, scrollEl.scrollTop + dy));
  };

  scrollEl.addEventListener("scroll", () => updateThumb(), { passive: true });
  try {
    const ro = new ResizeObserver(() => updateThumb());
    ro.observe(scrollEl);
    ro.observe(track);
  } catch (_) {}

  const step = () => Math.max(60, Math.floor(scrollEl.clientHeight * 0.85));
  btnUp?.addEventListener("click", () => scrollByPx(-step()));
  btnDown?.addEventListener("click", () => scrollByPx(step()));

  track.addEventListener("click", (e) => {
    if (e.target === thumb || thumb.contains(e.target)) return;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const pct = clickY / rect.height;
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollEl.scrollTop = pct * maxScroll;
  });

  thumb.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startScroll = scrollEl.scrollTop;
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const trackH = track.clientHeight;
    const thumbH = thumb.offsetHeight;
    const denom = Math.max(1, trackH - thumbH);
    const scrollPerPx = maxScroll / denom;
    function onMove(e2) {
      const dy = e2.clientY - startY;
      scrollEl.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + dy * scrollPerPx));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      thumb.classList.remove("dragging");
    }
    thumb.classList.add("dragging");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  requestAnimationFrame(() => updateThumb());
}

function syncNotesEditorHeight() {
  const ta = document.getElementById("notes-area");
  const scrollWrap = document.getElementById("notes-scroll");
  if (!(ta instanceof HTMLTextAreaElement) || !scrollWrap) return;
  const maxScroll = Math.max(0, scrollWrap.scrollHeight - scrollWrap.clientHeight);
  const fromBottom = Math.max(0, maxScroll - scrollWrap.scrollTop);
  const wasAtBottom = fromBottom <= 4;
  const prevTop = scrollWrap.scrollTop;
  // Auto-size textarea so the outer wrapper is the only scroller.
  ta.style.height = "0px";
  const next = Math.max(scrollWrap.clientHeight, ta.scrollHeight);
  ta.style.height = `${next}px`;
  // Prevent the scroll container from jumping while typing.
  if (wasAtBottom) scrollWrap.scrollTop = scrollWrap.scrollHeight;
  else scrollWrap.scrollTop = prevTop;
}

function renderNotesTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${state.pendingSheetId ? "Loading sheet..." : t("noSheet")}</p></div>`;
  const notes = s?.notes ?? "";
  const editable = canEdit(state.activeSheetId);
  const viewing = !editable || !state.notesEditMode;
  const bodyHtml = viewing ? renderNotesBody(notes) : "";
  const editBtn = editable
    ? `<button type="button" class="notes-edit-btn" id="notes-edit-toggle" aria-label="${escapeAttr(state.notesEditMode ? t("done") : t("edit"))}" title="${escapeAttr(state.notesEditMode ? t("done") : t("edit"))}">
        ${inlineSvg(editIcon, "inline-svg notes-edit-icon", "var(--text)")}
      </button>`
    : "";
  const toolbar = editable && state.notesEditMode
    ? `<div class="notes-toolbar" role="toolbar" aria-label="${escapeAttr(t("formatting"))}">
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="bold"><strong>B</strong></button>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="italic"><em>I</em></button>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="underline"><u>U</u></button>
        <span class="notes-tbar-sep" aria-hidden="true"></span>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="hr" title="${escapeAttr(t("separator"))}" aria-label="${escapeAttr(t("separator"))}">─</button>
        <span class="notes-tbar-sep" aria-hidden="true"></span>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="h1">H1</button>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="h2">H2</button>
        <button type="button" class="notes-tbar-btn btn-sm" data-notes-format="h3">H3</button>
      </div>`
    : "";
  return `
    <div class="card notes-card">
      <div class="notes-header-row">
        <h2 class="notes-title">${t("tabNotes")}</h2>
        ${editBtn}
      </div>
      <div class="notes-bubble">
        ${toolbar}
        <div class="notes-scroll-outer">
          <div class="notes-scroll" id="notes-scroll">
            ${viewing
              ? `<div id="notes-view" class="notes-view">${bodyHtml || `<span class="muted">${escapeAttr(t("notesEmpty"))}</span>`}</div>`
              : `<textarea id="notes-area" class="notes-area" rows="14" placeholder="${t("notesPlaceholder")}" ${editable ? "" : "readonly"}>${escapeAttr(notes)}</textarea>`
            }
          </div>
          <div class="notes-scrollbar-col" aria-hidden="true">
            <button type="button" class="notes-scroll-arrow notes-scroll-up" id="notes-scroll-up" tabindex="-1" title="${t("scrollUp")}">${inlineSvg(arrowIcon, "inline-svg notes-scroll-arrow-svg", "var(--text)")}</button>
            <div class="notes-scroll-track-outer">
              <div class="notes-scroll-track" id="notes-scroll-track"><div class="notes-scroll-thumb" id="notes-scroll-thumb"></div></div>
            </div>
            <button type="button" class="notes-scroll-arrow notes-scroll-down" id="notes-scroll-down" tabindex="-1" title="${t("scrollDown")}">${inlineSvg(arrowIcon, "inline-svg notes-scroll-arrow-svg", "var(--text)")}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsTab() {
  const c = getSheetTheme();
  const editable = canEdit(state.activeSheetId);
  const players = getKnownPlayers();
  const activeSheetId = state.activeSheetId;
  const permsSection = state.isGM && activeSheetId
    ? `
      <h3 class="settings-section-title">${t("sheetPermissions")}</h3>
      <div class="permissions-panel">
        <div class="permissions-header-row">
          <span></span>
          <span>${t("canSee")}</span>
          <span>${t("canEdit")}</span>
        </div>
        ${players.map((p) => {
          const isGMRow = p.role === "GM";
          const canSeeSelected = isGMRow || (state.permissions[p.id]?.view || []).includes(activeSheetId) || (state.permissions[p.id]?.edit || []).includes(activeSheetId);
          const canEditSelected = isGMRow || (state.permissions[p.id]?.edit || []).includes(activeSheetId);
          return `
            <div class="permissions-player-row">
              <span class="permissions-player-name">${escapeAttr(p.name)}</span>
              <button type="button" class="perm-circle-btn ${canSeeSelected ? "selected" : ""}" data-perm-mode="view" data-player="${p.id}" ${isGMRow ? "disabled" : ""} aria-label="${t("canSee")}"></button>
              <button type="button" class="perm-circle-btn ${canEditSelected ? "selected" : ""}" data-perm-mode="edit" data-player="${p.id}" ${isGMRow ? "disabled" : ""} aria-label="${t("canEdit")}"></button>
            </div>
          `;
        }).join("")}
      </div>
    `
    : "";
  return `
    <div class="card settings-card">
      <h2 class="settings-title">${t("tabSettings")}</h2>
      <div class="settings-color-row">
        <span class="settings-pill-label">${t("uiColors")}</span>
        <div class="settings-color-strip">
          <label class="settings-color-stop"><input type="color" value="${c.bg}" data-color="bg" ${editable ? "" : "disabled"} /></label>
          <label class="settings-color-stop"><input type="color" value="${c.ui}" data-color="ui" ${editable ? "" : "disabled"} /></label>
        <label class="settings-color-stop"><input type="color" value="${c.text}" data-color="text" ${editable ? "" : "disabled"} /></label>
        </div>
      </div>
      <div class="settings-actions settings-actions-top">
        <button type="button" id="btn-import-sheet" class="settings-pill-btn">${t("importSheet")}</button>
        <button type="button" id="btn-export-sheet" class="settings-pill-btn">${t("exportSheet")}</button>
        <input type="file" id="import-file-input" accept=".json" class="hidden" />
      </div>
      ${permsSection}
      ${state.isGM ? `
        <div class="settings-actions settings-actions-bottom">
          <button type="button" id="btn-import-all" class="settings-pill-btn">${t("importEverything")}</button>
          <button type="button" id="btn-export-all" class="settings-pill-btn">${t("exportEverything")}</button>
          <input type="file" id="import-all-file-input" accept=".json" class="hidden" />
        </div>
      ` : ""}
    </div>
  `;
}

function renderTabContent() {
  switch (state.activeTab) {
    case "bio":
      return renderBioTab();
    case "stats":
      return renderStatsTab();
    case "spells":
      return renderSpellsTab();
    case "inventory":
      return renderInventoryTab();
    case "chat":
      return renderChatTab();
    case "notes":
      return renderNotesTab();
    case "settings":
      return renderSettingsTab();
    default:
      return renderBioTab();
  }
}

function applyColors() {
  const theme = getSheetTheme();
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--surface", theme.bg);
  root.style.setProperty("--border", theme.ui);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--accent", theme.ui);
  root.style.setProperty("--muted", theme.text);
}

function render() {
  const app = document.getElementById(ROOT_ID);
  if (!app) return;
  if (state.startupError) {
    app.innerHTML = `<main class="tab-content"><div class="card"><h2>Error</h2><p>${escapeAttr(state.startupError)}</p></div></main>`;
    return;
  }

  let prevChatFromBottom = null;
  if (state.activeTab === "chat" && state._chatStickToBottom === false) {
    const prev = document.getElementById("chat-messages");
    if (prev) {
      const maxScroll = Math.max(0, prev.scrollHeight - prev.clientHeight);
      prevChatFromBottom = Math.max(0, maxScroll - prev.scrollTop);
    }
  }

  app.innerHTML = `
    ${renderHeader()}
    ${renderTabs()}
    <main class="tab-content">${renderTabContent()}</main>
    ${renderRollModals()}
  `;
  applyColors();
  bindEvents();
  if (state.activeTab === "chat") {
    const el = document.getElementById("chat-messages");
    if (el) {
      const stick = state._chatStickToBottom !== false;
      /* Sync scroll before paint so the list does not flash. */
      if (stick) {
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      } else if (prevChatFromBottom != null) {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = Math.max(0, Math.min(maxScroll, maxScroll - prevChatFromBottom));
      } else {
        // We can't preserve position (chat DOM wasn't mounted previously), default to latest message.
        el.scrollTop = el.scrollHeight;
      }
    }
  }
  if (state.activeTab === "notes") {
    // Notes scrollbar needs layout to settle (flex heights + rich content).
    requestAnimationFrame(() => {
      setupNotesScrollbar();
      requestAnimationFrame(() => setupNotesScrollbar());
    });
  }
  if (state.rollModalOpen && state.lastRoll) {
    requestAnimationFrame(() => showRollResult(state.lastRoll));
  }
}

function bindEvents() {
  const app = document.getElementById(ROOT_ID);
  if (!app) return;

  if (!app.dataset.outsideClickBound) {
    app.addEventListener("click", (e) => {
      if (!state.sheetMenuOpen) return;
      const picker = e.target.closest(".sheet-picker");
      if (!picker) {
        state.sheetMenuOpen = false;
        render();
      }
    });
    app.addEventListener("focusin", (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.closest(".chat-card")) return;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      if (el.hasAttribute("readonly") || el.hasAttribute("disabled")) return;
      if (!canEdit(state.activeSheetId)) return;
      state.isEditingField = true;
    }, true);
    app.addEventListener("focusout", () => {
      state.isEditingField = false;
      if (state._realtimePendingAfterEdit) {
        state._realtimePendingAfterEdit = false;
        state._scheduleRealtimeFlush?.();
      }
    }, true);
    app.dataset.outsideClickBound = "true";
  }

  app.querySelectorAll("input, textarea, select").forEach((el) => {
    const lockId = getElementLockId(el);
    if (!lockId) return;
    el.addEventListener("focus", async (e) => {
      if (!canEdit(state.activeSheetId)) return;
      const ok = await acquireFieldLock(lockId);
      if (!ok) {
        e.target.blur();
      }
    });
    el.addEventListener("blur", () => {
      releaseFieldLock(lockId).catch(() => {});
    });
  });
  syncFieldLockStates();

  // Inline roll buttons: bind once (render() is called often).
  if (!app.dataset.inlineRollBound) {
    app.addEventListener("click", async (e) => {
      const btn = e.target.closest(".inline-roll-btn");
      if (!btn || !state.sheet || !state.roomId) return;
      const kind = btn.dataset.kind || "";
      const stat = btn.dataset.stat || "";
      const formula = btn.dataset.formula || "";
      const count = Math.max(1, Math.min(100, Number(btn.dataset.count) || 1));
      const payload = kind === "stat" ? { kind: "stat", stat, formula, count } : { kind, formula, count };
      const result = executeRoll(payload, state.sheet);
      if (!result) return;
      state.lastRoll = result;
      state.lastRollPayload = payload;
      try {
        const row = await storage.insertChatMessage(state.roomId, {
          playerId: state.playerId || "",
          sheetId: state.activeSheetId || null,
          body: formatRollChatLine(result),
        });
        appendChatMessageIfNew(row);
        if (state.activeTab !== "chat") {
          const sheetName = resolveCharacterDisplayName(row?.sheet_id);
          const body = storage.getChatMessageText(row);
          const short = formatChatToastBody(body);
          OBR.notification.show(`${sheetName} sent ${short || "a message"}`);
        }
        render();
        requestAnimationFrame(() => {
          showRollResult(result);
          document.getElementById("chat-input")?.focus();
        });
      } catch (err) {
        console.error(err);
        const detail = err?.message || err?.details || String(err);
        OBR.notification.show(detail ? `Chat send failed: ${detail}` : "Chat send failed");
      }
    });
    app.dataset.inlineRollBound = "true";
  }

  if (!app.dataset.chatRollApplyBound) {
    app.addEventListener("click", async (e) => {
      const btn = e.target.closest(".chat-roll-apply-btn");
      if (!btn) return;
      if (btn.disabled) return;
      const kind = btn.dataset.applyKind || "";
      const valuesRaw = btn.dataset.applyValues;
      const value = Number(btn.dataset.applyValue);
      const values = valuesRaw ? JSON.parse(valuesRaw) : value;
      if (!CHAT_APPLY_ROLL_KINDS.has(kind)) return;
      if (!canEdit(state.activeSheetId)) return;
      const applied = applyChatRollToActiveSheet(kind, values);
      if (!applied.success) return;
      try {
        if (state.roomId && applied.applyFx?.length) {
          const row = await storage.insertChatMessage(state.roomId, {
            playerId: state.playerId || "",
            sheetId: state.activeSheetId || null,
            body: formatSystemChatApplyPayload(applied.applyFx),
          });
          appendChatMessageIfNew(row);
        }
      } catch (err) {
        console.error(err);
      }
      state._chatStickToBottom = true;
      render();
    });
    app.dataset.chatRollApplyBound = "true";
  }

  app.querySelector("#btn-sheet-menu")?.addEventListener("click", () => {
    state.sheetMenuOpen = !state.sheetMenuOpen;
    render();
  });

  app.querySelectorAll("[data-sheet-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.sheetMenuOpen = false;
      await loadSheet(btn.dataset.sheetId || null, { forceRefresh: true });
      render();
    });
  });

  app.querySelector("#btn-new-sheet")?.addEventListener("click", async () => {
    const sheet = createEmptySheet();
    state.roomId = state.roomId || await storage.getRoomId();
    storage.saveSheetToStorage(state.roomId, sheet, { persistRemote: false });
    await storage.addSheetToRoom(sheet.id, "Name Surname");
    state.sheetIds = await storage.getSheetList();
    state.sheetNames = { ...state.sheetNames, [sheet.id]: "Name Surname" };
    await loadSheet(sheet.id);
    render();
  });

  app.querySelector("#btn-delete-sheet")?.addEventListener("click", async () => {
    if (!state.isGM || !state.activeSheetId || !state.roomId) return;
    const confirmed = window.confirm(`Delete ${getSheetTitle()}?`);
    if (!confirmed) return;
    const deletedId = state.activeSheetId;
    storage.removeSheetFromStorage(state.roomId, deletedId);
    await storage.removeSheetFromRoom(deletedId);
    await loadRoomData();
    const nextSheetId = getVisibleSheets()[0] || null;
    await loadSheet(nextSheetId);
    render();
  });

  app.querySelector("#btn-link-token")?.addEventListener("click", async () => {
    const ids = await OBR.player.getSelection();
    if (!ids?.length) {
      OBR.notification.show(t("noTokenSelected"));
      return;
    }
    await storage.linkTokenToSheet(ids[0], state.activeSheetId);
    const roomData = await storage.getRoomData();
    state.tokenToSheet = roomData.tokenToSheet || {};
    render();
  });

  app.querySelectorAll(".btn-unlink[data-token-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await storage.linkTokenToSheet(btn.dataset.tokenId, null);
      const roomData = await storage.getRoomData();
      state.tokenToSheet = roomData.tokenToSheet || {};
      render();
    });
  });

  app.querySelectorAll(".flag-icon-btn[data-lang]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lang = btn.dataset.lang;
      setLocale(lang);
      state.locale = lang;
      localStorage.setItem("foxyverse_locale", lang);
      render();
    });
  });

  app.querySelectorAll(".tab-icon-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      render();
    });
  });

  // Bio inputs
  app.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      if (!state.sheet) return;
      const field = e.target.dataset.field;
      let val = e.target.value;
      if (field === "bio.level") val = parseInt(val, 10) || 1;
      const next = applyLocalMutation((sheet) => {
        if (field.startsWith("bio.")) {
          setByPath(sheet, field, val);
        } else {
          sheet[field] = isNaN(Number(val)) ? val : Number(val);
        }
      });
      if (!state.roomId || !state.activeSheetId || !next) return;
      if (field.startsWith("bio.")) {
        const bioKey = field.replace("bio.", "");
        storage.updateBio(state.roomId, state.activeSheetId, { [bioKey]: val }).catch(console.error);
        const displayName = [next.bio?.name || "", next.bio?.surname || ""].join(" ").trim() || "Name Surname";
        state.sheetNames[state.activeSheetId] = displayName;
      } else if (field === "currentHP" || field === "tempHP" || field === "currentMP" || field === "currentFavor" || field === "actionModifier" || field === "speedModifier" || field === "notes" || field === "isElemental") {
        storage.updateSheetCore(state.roomId, state.activeSheetId, { [field]: next[field] }).catch(console.error);
      }
      if (field === "currentFavor") syncRollModalRerollState();
      if (field === "bio.name" || field === "bio.surname") render();
    });
  });
  app.querySelector('[data-field="currentFavor"]')?.addEventListener("input", (e) => {
    if (!state.sheet) return;
    state.sheet.currentFavor = Number(e.target.value) || 0;
    syncRollModalRerollState();
  });

  app.querySelectorAll("[data-level-step]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.sheet) return;
      const delta = Number(btn.dataset.levelStep) || 0;
      const current = Number(state.sheet.bio?.level) || 1;
      const nextLevel = Math.max(1, current + delta);
      const next = applyLocalMutation((sheet) => {
        if (!sheet.bio) sheet.bio = {};
        sheet.bio.level = nextLevel;
      });
      if (state.roomId && state.activeSheetId && next) {
        const roomId = state.roomId;
        const sheetId = state.activeSheetId;
        scheduleDebouncedSave(`bio.level:${sheetId}`, 1000, () => {
          const latestLevel = Number(state.sheet?.bio?.level) || 1;
          storage.updateBio(roomId, sheetId, { level: latestLevel }).catch(console.error);
        });
      }
      if (next) render();
    });
  });

  // Stats inputs
  app.querySelectorAll("[data-stat]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      if (!state.sheet) return;
      const [statId, key] = e.target.dataset.stat.split(".");
      applyLocalMutation((sheet) => {
        if (!sheet.stats[statId]) sheet.stats[statId] = {};
        sheet.stats[statId][key] = parseInt(e.target.value, 10) || 0;
      });
      if (state.roomId && state.activeSheetId) {
        const statPatch = {};
        if (key === "base") statPatch.base = parseInt(e.target.value, 10) || 0;
        if (key === "passiveBonus") statPatch.passiveBonus = parseInt(e.target.value, 10) || 0;
        storage.updateStat(state.roomId, state.activeSheetId, statId, statPatch).catch(console.error);
      }
      if (state.activeTab === "stats") render();
    });
  });

  // Knowledge
  app.querySelector("#btn-add-knowledge")?.addEventListener("click", async () => {
    if (!state.sheet) return;
    const next = applyLocalMutation((sheet) => {
      if (!sheet.knowledge) sheet.knowledge = [];
      sheet.knowledge.push({ id: crypto.randomUUID(), name: "", tier: 1, enabled: true });
    });
    if (state.roomId && state.activeSheetId && next) {
      const idx = next.knowledge.length - 1;
      const k = next.knowledge[idx];
      storage.upsertTalent(state.roomId, state.activeSheetId, {
        id: k.id,
        position: idx,
        name: k.name || "",
        description: k.description || "",
        tier: k.tier ?? 1,
        bonus_override: k.bonusOverride ?? null,
        is_enabled: !!k.enabled,
      }).catch(console.error);
    }
    render();
  });
  app.querySelectorAll("[data-remove-knowledge]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.removeKnowledge, 10);
      const removedId = state.sheet?.knowledge?.[idx]?.id;
      const next = applyLocalMutation((sheet) => {
        sheet.knowledge.splice(idx, 1);
      });
      if (state.roomId && state.activeSheetId) {
        if (removedId) storage.deleteTalent(state.roomId, state.activeSheetId, removedId).catch(console.error);
        const ordered = (next?.knowledge || []).map((k) => k.id);
        storage.setTalentPositions(state.roomId, state.activeSheetId, ordered).catch(console.error);
      }
      render();
    });
  });
  app.querySelectorAll("[data-knowledge-name], [data-knowledge-tier], [data-knowledge-enabled]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const d = e.target.dataset;
      const idx = parseInt(d.knowledgeName ?? d.knowledgeTier ?? d.knowledgeEnabled, 10);
      const next = applyLocalMutation((sheet) => {
        if (isNaN(idx) || !sheet.knowledge[idx]) return;
        const k = sheet.knowledge[idx];
        if (d.knowledgeName !== undefined) k.name = e.target.value;
        if (d.knowledgeTier !== undefined) k.tier = parseInt(e.target.value, 10);
        if (d.knowledgeEnabled !== undefined) k.enabled = e.target.checked;
      });
      if (state.roomId && state.activeSheetId && next?.knowledge?.[idx]) {
        const k = next.knowledge[idx];
        const patch = {};
        if (d.knowledgeName !== undefined) patch.name = k.name || "";
        if (d.knowledgeTier !== undefined) patch.tier = k.tier ?? 1;
        if (d.knowledgeEnabled !== undefined) patch.is_enabled = !!k.enabled;
        storage.updateTalentFields(state.roomId, state.activeSheetId, k.id, patch).catch(console.error);
      }
    });
  });

  // Stat roll buttons
  app.querySelectorAll(".btn-roll-stat").forEach((btn) => {
    btn.addEventListener("click", () => {
      state._rollStat = btn.dataset.stat;
      document.getElementById("stat-roll-modal")?.classList.remove("hidden");
    });
  });
  app.querySelector("#stat-roll-do")?.addEventListener("click", () => {
    const mod = document.getElementById("stat-roll-modifier")?.value || "";
    if (!state.sheet) return;
    const payload = { kind: "stat", stat: state._rollStat, formula: mod };
    const result = executeRoll(payload, state.sheet);
    if (!result) return;
    state.lastRoll = result;
    state.lastRollPayload = payload;
    document.getElementById("stat-roll-modal")?.classList.add("hidden");
    showRollResult(result);
    OBR.notification.show(result.outcome === "critical_success" ? t("criticalSuccess") : result.outcome === "success" ? t("success") : result.outcome === "failure" ? t("failure") : t("criticalFailure"));
  });
  app.querySelector("#stat-roll-cancel")?.addEventListener("click", () => {
    document.getElementById("stat-roll-modal")?.classList.add("hidden");
  });

  app.querySelector("#btn-roll-speed")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const agi = getStatTotal(state.sheet, "agility");
    const d6 = Math.floor(Math.random() * 6) + 1;
    const mod = evalModifier(state.sheet.speedModifier || "");
    const value = Math.floor(agi / 4) + d6 + mod;
    state.lastRoll = { kind: "roll", value, diceResults: [d6], translatedFormula: "", formula: "" };
    state.lastRollPayload = null;
    showRollResult(state.lastRoll);
  });

  app.querySelectorAll(".quick-mods button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const stat = e.target.closest(".quick-mods").dataset.stat;
      const mod = e.target.dataset.mod;
      if (!state.sheet) return;
      const payload = { kind: "stat", stat, formula: mod };
      const result = executeRoll(payload, state.sheet);
      if (!result) return;
      state.lastRoll = result;
      state.lastRollPayload = payload;
      showRollResult(result);
    });
  });

  app.querySelector("#roll-close-btn")?.addEventListener("click", () => {
    state.rollModalOpen = false;
    document.getElementById("roll-modal")?.classList.add("hidden");
  });
  if (!app.dataset.rollModalEscapeBound) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("roll-modal");
      if (!modal || modal.classList.contains("hidden") || !state.rollModalOpen) return;
      e.preventDefault();
      state.rollModalOpen = false;
      modal.classList.add("hidden");
    });
    app.dataset.rollModalEscapeBound = "true";
  }
  app.querySelector("#roll-reroll-btn")?.addEventListener("click", async () => {
    const rr = document.getElementById("roll-reroll-btn");
    if (rr?.disabled) return;
    if (!state.sheet || state.sheet.currentFavor < 1) return;
    if (!state.lastRollPayload || !state.roomId) return;
    state.sheet.currentFavor--;
    saveSheet();
    if (state.roomId && state.activeSheetId) {
      storage.updateSheetCore(state.roomId, state.activeSheetId, { currentFavor: state.sheet.currentFavor }).catch(console.error);
    }
    const result = executeRoll(state.lastRollPayload, state.sheet);
    if (!result) return;
    state.lastRoll = result;
    state.rollModalOpen = true;
    try {
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: formatRollChatLine(result, { favorReroll: true }),
      });
      appendChatMessageIfNew(row);
    } catch (err) {
      console.error(err);
    }
    state._chatStickToBottom = true;
    render();
  });

  // Spells
  app.querySelector("#btn-add-spell")?.addEventListener("click", async () => {
    if (!state.sheet) return;
    const next = applyLocalMutation((sheet) => {
      if (!sheet.spells) sheet.spells = [];
      sheet.spells.push({ id: crypto.randomUUID(), name: "", effect: "", element: "", cost: 0, costType: "mp" });
    });
    if (state.roomId && state.activeSheetId && next) {
      const idx = next.spells.length - 1;
      const sp = next.spells[idx];
      storage.upsertSpell(state.roomId, state.activeSheetId, {
        id: sp.id,
        position: idx,
        name: sp.name || "",
        description: sp.effect || "",
        element: sp.element || "",
        cost: sp.cost ?? 0,
        is_hp: (sp.costType || "mp") === "hp",
        is_continuous: !!sp.isContinuous,
        use_counter: sp.useCounter ?? 0,
      }).catch(console.error);
    }
    render();
  });
  app.querySelectorAll("[data-remove-spell]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.removeSpell, 10);
      const removedId = state.sheet?.spells?.[idx]?.id;
      const next = applyLocalMutation((sheet) => {
        sheet.spells.splice(idx, 1);
      });
      if (state.roomId && state.activeSheetId) {
        if (removedId) storage.deleteSpell(state.roomId, state.activeSheetId, removedId).catch(console.error);
        const ordered = (next?.spells || []).map((s) => s.id);
        storage.setSpellPositions(state.roomId, state.activeSheetId, ordered).catch(console.error);
      }
      render();
    });
  });
  app.querySelectorAll("[data-spell-name], [data-spell-effect], [data-spell-cost], [data-spell-element]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const idx = parseInt(el.dataset.spellName ?? el.dataset.spellEffect ?? el.dataset.spellCost ?? el.dataset.spellElement, 10);
      const next = applyLocalMutation((sheet) => {
        const sp = sheet.spells[idx];
        if (!sp) return;
        if (el.dataset.spellName !== undefined) sp.name = e.target.value;
        if (el.dataset.spellEffect !== undefined) sp.effect = e.target.value;
        if (el.dataset.spellCost !== undefined) sp.cost = parseInt(e.target.value, 10) || 0;
        if (el.dataset.spellElement !== undefined) sp.element = e.target.value;
      });
      if (state.roomId && state.activeSheetId && next?.spells?.[idx]) {
        const sp = next.spells[idx];
        const patch = {};
        if (el.dataset.spellName !== undefined) patch.name = sp.name || "";
        if (el.dataset.spellEffect !== undefined) patch.description = sp.effect || "";
        if (el.dataset.spellCost !== undefined) patch.cost = sp.cost ?? 0;
        if (el.dataset.spellElement !== undefined) patch.element = sp.element || "";
        storage.updateSpellFields(state.roomId, state.activeSheetId, sp.id, patch).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[name^='costType-']").forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      const idx = parseInt(e.target.name.replace("costType-", ""), 10);
      const next = applyLocalMutation((sheet) => {
        if (sheet.spells[idx]) sheet.spells[idx].costType = e.target.value;
      });
      if (state.roomId && state.activeSheetId && next?.spells?.[idx]) {
        const sp = next.spells[idx];
        storage.updateSpellFields(state.roomId, state.activeSheetId, sp.id, { is_hp: (sp.costType || "mp") === "hp" }).catch(console.error);
      }
    });
  });
  app.querySelectorAll(".btn-deduct-cost").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const sp = state.sheet.spells[idx];
      const cost = sp.cost || 0;
      const isMP = (sp.costType || "mp") === "mp";
      if (isMP) {
        const mp = state.sheet.currentMP || 0;
        if (mp >= cost) {
          state.sheet.currentMP = mp - cost;
        } else {
          const needHP = cost - mp;
          if (!confirm(t("confirmUseHP"))) return;
          state.sheet.currentMP = 0;
          state.sheet.currentHP = Math.max(0, (state.sheet.currentHP || 0) - needHP);
        }
      } else {
        state.sheet.currentHP = Math.max(0, (state.sheet.currentHP || 0) - cost);
      }
      saveSheet();
      if (state.roomId && state.activeSheetId) {
        storage.updateSheetCore(state.roomId, state.activeSheetId, {
          currentHP: state.sheet.currentHP,
          currentMP: state.sheet.currentMP,
        }).catch(console.error);
      }
      render();
    });
  });

  // Inventory
  app.querySelectorAll(".equip-select").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const slotId = el.dataset.slot;
      const itemId = e.target.value || null;
      if (!state.sheet) return;
      const beforeEq = { ...(state.sheet.equipped || {}) };
      const next = applyLocalMutation((sheet) => {
        const eq = { ...(sheet.equipped || {}) };
        if (itemId) {
          Object.keys(eq).forEach((s) => { if (eq[s] === itemId) delete eq[s]; });
          eq[slotId] = itemId;
          const item = findItemById(sheet, itemId);
          if (item?.equippableSlots?.length) {
            item.equippableSlots.forEach((s) => { eq[s] = itemId; });
          }
        } else {
          const prevId = eq[slotId];
          delete eq[slotId];
          if (prevId) {
            Object.keys(eq).forEach((s) => { if (eq[s] === prevId) delete eq[s]; });
          }
        }
        sheet.equipped = eq;
      });
      if (state.roomId && state.activeSheetId && next) {
        const afterEq = { ...(next.equipped || {}) };
        const affected = new Set([...Object.values(beforeEq), ...Object.values(afterEq)].filter(Boolean));
        const allItems = [
          ...(next.consumables || []),
          ...(next.others || []),
          ...(next.weapons || []),
          ...(next.armor || []),
          ...(next.bags || []),
        ];
        allItems.forEach((it) => {
          if (!affected.has(it.id)) return;
          storage.updateItemFields(state.roomId, state.activeSheetId, it.id, { used_slots: computeUsedSlots(next, it) }).catch(console.error);
        });
      }
      render();
    });
  });

  app.querySelectorAll("[data-toggle-item]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggleItem;
      const detail = document.getElementById("item-detail-" + id);
      if (detail) detail.classList.toggle("hidden");
    });
  });
  app.querySelectorAll("[data-item-name], [data-item-count]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = el.dataset.itemName ?? el.dataset.itemCount;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      const next = applyLocalMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        const it = sheet[section][idx];
        if (el.dataset.itemName !== undefined) it.name = e.target.value;
        if (el.dataset.itemCount !== undefined) it.count = parseInt(e.target.value, 10) || 0;
      });
      if (state.roomId && state.activeSheetId && next?.[section]?.[idx]) {
        const it = next[section][idx];
        const patch = {};
        if (el.dataset.itemName !== undefined) patch.name = it.name || "";
        if (el.dataset.itemCount !== undefined) patch.quantity = Number(it.count) || 0;
        storage.updateItemFields(state.roomId, state.activeSheetId, it.id, patch).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[data-item-desc]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = el.dataset.itemDesc;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      const next = applyLocalMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        sheet[section][idx].description = e.target.value;
      });
      if (state.roomId && state.activeSheetId && next?.[section]?.[idx]) {
        const it = next[section][idx];
        storage.updateItemFields(state.roomId, state.activeSheetId, it.id, { description: it.description || "" }).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[data-item-weapon-slots], [data-item-defense], [data-item-magdef]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = (el.dataset.itemWeaponSlots || el.dataset.itemDefense || el.dataset.itemMagdef || "");
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      const next = applyLocalMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        const it = sheet[section][idx];
        if (el.dataset.itemWeaponSlots !== undefined) it.weaponSlots = parseInt(e.target.value, 10) || 1;
        if (el.dataset.itemDefense !== undefined) it.defense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
        if (el.dataset.itemMagdef !== undefined) it.magicalDefense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
      });
      if (state.roomId && state.activeSheetId && next?.[section]?.[idx]) {
        const it = next[section][idx];
        const patch = {};
        if (el.dataset.itemDefense !== undefined) patch.physical_defense = it.defense ?? 0;
        if (el.dataset.itemMagdef !== undefined) patch.magical_defense = it.magicalDefense ?? 0;
        if (el.dataset.itemWeaponSlots !== undefined) patch.used_slots = computeUsedSlots(next, it);
        storage.updateItemFields(state.roomId, state.activeSheetId, it.id, patch).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[data-item-equip-slots]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = el.dataset.itemEquipSlots;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      const raw = (e.target.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      const next = applyLocalMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        sheet[section][idx].equippableSlots = raw;
      });
      if (state.roomId && state.activeSheetId && next?.[section]?.[idx]) {
        const it = next[section][idx];
        storage.updateItemFields(state.roomId, state.activeSheetId, it.id, { usable_slots: computeUsableSlots(it) }).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const raw = btn.dataset.removeItem;
      const lastHyphen = raw.lastIndexOf("-");
      const section = raw.slice(0, lastHyphen);
      const idx = parseInt(raw.slice(lastHyphen + 1), 10);
      const removedId = state.sheet?.[section]?.[idx]?.id;
      applyLocalMutation((sheet) => {
        if (sheet[section]) sheet[section].splice(idx, 1);
      });
      if (state.roomId && state.activeSheetId && removedId) {
        storage.deleteItem(state.roomId, state.activeSheetId, removedId).catch(console.error);
      }
      render();
    });
  });
  app.querySelectorAll(".btn-add-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const section = btn.dataset.section;
      const next = applyLocalMutation((sheet) => {
        if (!sheet[section]) sheet[section] = [];
        sheet[section].push({ id: crypto.randomUUID(), type: section === "weapons" ? "weapon" : section === "armor" ? "armor" : section === "consumables" ? "consumable" : section === "bags" ? "bag" : "other", name: "", count: 1, description: "" });
      });
      if (state.roomId && state.activeSheetId && next?.[section]?.length) {
        const it = next[section][next[section].length - 1];
        storage.upsertItem(state.roomId, state.activeSheetId, {
          id: it.id,
          type: it.type || "other",
          position: Date.now(),
          name: it.name || "",
          description: it.description || "",
          quantity: Number(it.count) || 1,
          physical_defense: Number(it.defense) || 0,
          magical_defense: Number(it.magicalDefense) || 0,
          constitution: Number(it.constitution) || 0,
          strength: Number(it.strength) || 0,
          intelligence: Number(it.intelligence) || 0,
          perception: Number(it.perception) || 0,
          social: Number(it.social) || 0,
          agility: Number(it.agility) || 0,
          focus: Number(it.focus) || 0,
          usable_slots: computeUsableSlots(it),
          used_slots: computeUsedSlots(next, it),
        }).catch(console.error);
      }
      render();
    });
  });

  // Notes
  app.querySelector("#notes-edit-toggle")?.addEventListener("click", () => {
    if (!canEdit(state.activeSheetId)) return;
    state.notesEditMode = !state.notesEditMode;
    render();
    requestAnimationFrame(() => {
      if (state.notesEditMode) {
        syncNotesEditorHeight();
        document.getElementById("notes-area")?.focus();
      }
      setupNotesScrollbar();
    });
  });

  const notesArea = app.querySelector("#notes-area");
  notesArea?.addEventListener("input", (e) => {
    if (!state.sheet) return;
    const val = e.target.value;
    state.sheet.notes = val;
    syncNotesEditorHeight();
    setupNotesScrollbar();
  });
  notesArea?.addEventListener("change", async (e) => {
    if (state.sheet) {
      applyLocalMutation((sheet) => {
        sheet.notes = e.target.value;
      });
      if (state.roomId && state.activeSheetId) {
        storage.updateSheetCore(state.roomId, state.activeSheetId, { notes: e.target.value }).catch(console.error);
      }
    }
  });

  app.querySelectorAll("[data-notes-format]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-notes-format");
      const ta = document.getElementById("notes-area");
      if (!kind || !(ta instanceof HTMLTextAreaElement)) return;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const value = ta.value || "";
      const before = value.slice(0, start);
      const sel = value.slice(start, end);
      const after = value.slice(end);

      const setVal = (next, nextStart, nextEnd) => {
        ta.value = next;
        ta.focus();
        ta.setSelectionRange(nextStart, nextEnd);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      };

      if (kind === "bold") {
        const wrap = "**";
        if (sel.includes("\n")) {
          const lines = sel.split("\n").map((ln) => (ln ? `${wrap}${ln}${wrap}` : ln));
          const replaced = lines.join("\n");
          setVal(`${before}${replaced}${after}`, start, start + replaced.length);
        } else {
          const placeholder = sel || t("bold");
          setVal(`${before}${wrap}${placeholder}${wrap}${after}`, start + wrap.length, start + wrap.length + placeholder.length);
        }
        return;
      }
      if (kind === "italic") {
        const wrap = "*";
        if (sel.includes("\n")) {
          const lines = sel.split("\n").map((ln) => (ln ? `${wrap}${ln}${wrap}` : ln));
          const replaced = lines.join("\n");
          setVal(`${before}${replaced}${after}`, start, start + replaced.length);
        } else {
          const placeholder = sel || t("italic");
          setVal(`${before}${wrap}${placeholder}${wrap}${after}`, start + wrap.length, start + wrap.length + placeholder.length);
        }
        return;
      }
      if (kind === "underline") {
        const wrap = "__";
        if (sel.includes("\n")) {
          const lines = sel.split("\n").map((ln) => (ln ? `${wrap}${ln}${wrap}` : ln));
          const replaced = lines.join("\n");
          setVal(`${before}${replaced}${after}`, start, start + replaced.length);
        } else {
          const placeholder = sel || t("underline");
          setVal(`${before}${wrap}${placeholder}${wrap}${after}`, start + wrap.length, start + wrap.length + placeholder.length);
        }
        return;
      }
      if (kind === "hr") {
        const insert = "\n---\n";
        const next = `${before}${insert}${after}`;
        const caret = start + insert.length;
        setVal(next, caret, caret);
        return;
      }
      if (kind === "h1" || kind === "h2" || kind === "h3") {
        const hashes = kind === "h1" ? "# " : kind === "h2" ? "## " : "### ";
        const selStart = Math.min(start, end);
        const selEnd = Math.max(start, end);

        const blockStart = value.lastIndexOf("\n", selStart - 1) + 1;
        const blockEndIdx = value.indexOf("\n", selEnd);
        const blockEnd = blockEndIdx >= 0 ? blockEndIdx : value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split("\n");
        const nextLines = lines.map((ln) => {
          const stripped = ln.replace(/^#{1,3}\s+/, "");
          return `${hashes}${stripped}`;
        });
        const nextBlock = nextLines.join("\n");
        const next = `${value.slice(0, blockStart)}${nextBlock}${value.slice(blockEnd)}`;
        const nextSelStart = blockStart + hashes.length;
        const nextSelEnd = blockStart + nextBlock.length;
        setVal(next, nextSelStart, nextSelEnd);
      }
    });
  });

  // Chat
  const chatInput = app.querySelector("#chat-input");
  const CHAT_HISTORY_CAP = 80;
  app.querySelector("#chat-send")?.addEventListener("click", () => sendChat());
  chatInput?.addEventListener("input", () => {
    state._chatHistoryIndex = null;
    state._chatHistoryDraft = "";
  });
  chatInput?.addEventListener("keydown", (e) => {
    const hist = state._chatSendHistory;
    if (e.key === "ArrowUp" && hist.length) {
      e.preventDefault();
      if (state._chatHistoryIndex == null) {
        state._chatHistoryDraft = chatInput.value;
        state._chatHistoryIndex = hist.length - 1;
      } else if (state._chatHistoryIndex > 0) {
        state._chatHistoryIndex -= 1;
      }
      chatInput.value = hist[state._chatHistoryIndex] ?? "";
      return;
    }
    if (e.key === "ArrowDown" && hist.length && state._chatHistoryIndex != null) {
      e.preventDefault();
      if (state._chatHistoryIndex < hist.length - 1) {
        state._chatHistoryIndex += 1;
        chatInput.value = hist[state._chatHistoryIndex] ?? "";
      } else {
        state._chatHistoryIndex = null;
        chatInput.value = state._chatHistoryDraft;
        state._chatHistoryDraft = "";
      }
      return;
    }
    if (e.key === "Enter") sendChat();
  });
  app.querySelectorAll(".chat-msg-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!state.roomId) return;
      const id = btn.getAttribute("data-chat-id");
      if (!id) return;
      const msg = state.chatMessages.find((x) => String(x.id) === String(id));
      if (!msg || !canDeleteChatMessage(msg)) return;
      try {
        await storage.deleteChatMessage(state.roomId, id);
        handleChatMessageRemoved(id);
        await storage.broadcastChatMessageDeleted(state.roomId, id);
      } catch (err) {
        console.error(err);
        const detail = err?.message || err?.details || String(err);
        OBR.notification.show(detail ? `Could not delete message: ${detail}` : "Could not delete message");
      }
    });
  });
  async function sendChat() {
    const line = chatInput?.value?.trim();
    if (!line || !state.roomId) return;
    const cmd = parseChatCommand(line);
    let bodyToSend = line;
    let rollResultToShow = null;
    if (cmd && state.sheet) {
      const result = executeRoll(cmd, state.sheet);
      if (result) {
        state.lastRoll = result;
        state.lastRollPayload = cmd;
        bodyToSend = formatRollChatLine(result);
        rollResultToShow = result;
      }
    }
    try {
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: bodyToSend,
      });
      appendChatMessageIfNew(row);
      const hist = state._chatSendHistory;
      const last = hist[hist.length - 1];
      if (last !== line) {
        hist.push(line);
        if (hist.length > CHAT_HISTORY_CAP) hist.splice(0, hist.length - CHAT_HISTORY_CAP);
      }
      state._chatHistoryIndex = null;
      state._chatHistoryDraft = "";
      chatInput.value = "";
      render();
      requestAnimationFrame(() => {
        if (rollResultToShow) showRollResult(rollResultToShow);
        document.getElementById("chat-input")?.focus();
      });
    } catch (err) {
      console.error(err);
      const detail = err?.message || err?.details || String(err);
      OBR.notification.show(detail ? `Chat send failed: ${detail}` : "Chat send failed");
    }
  }

  setupChatScrollbar();

  // Settings
  app.querySelectorAll("[data-color]").forEach((input) => {
    input.addEventListener("input", (e) => {
      if (!state.sheet) return;
      state.sheet.theme = {
        ...getSheetTheme(),
        [e.target.dataset.color]: e.target.value,
      };
      applyColors();
      saveSheet();
      if (state.roomId && state.activeSheetId) {
        storage.updateSheetCore(state.roomId, state.activeSheetId, { theme: state.sheet.theme }).catch(console.error);
      }
    });
  });
  app.querySelectorAll("[data-perm-mode]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!state.isGM) return;
      const sheetId = state.activeSheetId;
      if (!sheetId) return;
      const playerId = el.dataset.player;
      const kind = el.dataset.permMode;
      const perms = JSON.parse(JSON.stringify(state.permissions));
      if (!perms[playerId]) perms[playerId] = { view: [], edit: [] };
      const currentView = new Set(perms[playerId].view || []);
      const currentEdit = new Set(perms[playerId].edit || []);
      if (kind === "edit") {
        if (currentEdit.has(sheetId)) {
          currentEdit.delete(sheetId);
          currentView.add(sheetId);
        } else {
          currentEdit.add(sheetId);
          currentView.add(sheetId);
        }
      } else {
        if (currentView.has(sheetId) && !currentEdit.has(sheetId)) {
          currentView.delete(sheetId);
        } else {
          currentView.add(sheetId);
          currentEdit.delete(sheetId);
        }
      }
      perms[playerId].view = [...currentView];
      perms[playerId].edit = [...currentEdit];
      await storage.setPermissions(perms);
      state.permissions = perms;
      render();
    });
  });

  app.querySelector("#btn-export-sheet")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const blob = new Blob([JSON.stringify(state.sheet, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = buildExportFilename(state.sheet, getRoomLabel());
    a.click();
    URL.revokeObjectURL(a.href);
  });
  app.querySelector("#btn-import-sheet")?.addEventListener("click", () => document.getElementById("import-file-input")?.click());
  app.querySelector("#btn-export-all")?.addEventListener("click", async () => {
    if (!state.isGM || !state.roomId) return;
    const sheets = await storage.getAllSheets(state.roomId);
    const payload = {
      exportedAt: Date.now(),
      roomId: state.roomId,
      sheets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = buildExportFilename({ bio: { name: "All", surname: "Sheets" } }, getRoomLabel());
    a.click();
    URL.revokeObjectURL(a.href);
  });
  app.querySelector("#btn-import-all")?.addEventListener("click", () => document.getElementById("import-all-file-input")?.click());

  app.querySelector("#import-file-input")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !state.roomId) return;
    const text = await file.text();
    try {
      const overwritingActive = !!state.activeSheetId;
      const imported = normalizeImportedSheet(JSON.parse(text), {
        targetSheetId: overwritingActive ? state.activeSheetId : null,
        regenerateNestedIds: overwritingActive,
      });
      if (state.activeSheetId) {
        const confirmed = window.confirm(`Overwrite ${getSheetTitle()} with imported sheet?`);
        if (!confirmed) {
          e.target.value = "";
          return;
        }
      }
      storage.saveSheetToStorage(state.roomId, imported, { persistRemote: false });
      await storage.persistSheet(state.roomId, imported);
      state.sheetIds = await storage.getSheetList();
      const names = await storage.getRoomData();
      state.sheetNames = names.sheetNames || {};
      await loadSheet(imported.id);
      render();
    } catch (err) {
      OBR.notification.show("Invalid file");
    }
    e.target.value = "";
  });
  app.querySelector("#import-all-file-input")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !state.roomId || !state.isGM) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const sheets = Array.isArray(parsed) ? parsed : parsed.sheets;
      if (!Array.isArray(sheets)) throw new Error("Invalid bundle");
      for (const sheet of sheets) {
        const nextSheet = normalizeImportedSheet(structuredClone(sheet), {
          // Always generate a new sheet id when importing a bundle, so we never
          // accidentally move an existing sheet to this room by reusing its id.
          targetSheetId: crypto.randomUUID(),
          regenerateNestedIds: true,
        });
        storage.saveSheetToStorage(state.roomId, nextSheet, { persistRemote: false });
        await storage.persistSheet(state.roomId, nextSheet);
      }
      await loadRoomData();
      if (!state.activeSheetId && state.sheetIds.length) {
        await loadSheet(state.sheetIds[0]);
      } else if (state.activeSheetId) {
        await loadSheet(state.activeSheetId);
      }
      render();
    } catch (_) {
      OBR.notification.show("Invalid file");
    }
    e.target.value = "";
  });
}

export async function initApp() {
  try {
    await loadRoomData();
    state.playerName = await storage.getPlayerName();
    try {
      state.partyPlayers = await OBR.party.getPlayers();
    } catch (_) {
      state.partyPlayers = [];
    }
    const updatedDirectory = {
      ...state.playerDirectory,
      ...Object.fromEntries((state.partyPlayers || []).map((p) => [p.id, { name: p.name, role: p.role }])),
    };
    state.playerDirectory = updatedDirectory;
    await storage.setRoomData({ playerDirectory: updatedDirectory });
    requestVisibleSheets();
    try {
      const rows = await storage.listRecentChat(state.roomId, 200);
      state.chatMessages = rows.map(mapChatRow);
    } catch (e) {
      console.error(e);
      state.chatMessages = [];
    }
    if (state._chatUnsub) {
      try { state._chatUnsub(); } catch (_) {}
      state._chatUnsub = null;
    }
    state._chatUnsub = storage.subscribeToChat(
      state.roomId,
      (row) => {
        if (appendChatMessageIfNew(row)) {
          render();
          // Discreet toast if you're not currently on the chat tab.
          if (state.activeTab !== "chat") {
            const sheetName = resolveCharacterDisplayName(row?.sheet_id);
            const body = storage.getChatMessageText(row);
            const short = formatChatToastBody(body);
            OBR.notification.show(`${sheetName} sent ${short || "a message"}`);
          }
        }
      },
      (oldRow) => {
        handleChatMessageRemoved(oldRow?.id);
      },
      (id) => {
        handleChatMessageRemoved(id);
      }
    );
    if (state.sheetIds.length && !state.activeSheetId) {
      await loadSheet(getVisibleSheets()[0] || null);
    } else if (state.activeSheetId) {
      await loadSheet(state.activeSheetId);
    }
    render();

    const realtimeState = {
      timer: null,
      inProgress: false,
      needsRoomReload: false,
      changedSheetIds: new Set(),
      deletedSheetIds: new Set(),
    };
    async function flushRealtime() {
      if (realtimeState.inProgress) {
        realtimeState.needsRoomReload = true;
        return;
      }
      realtimeState.inProgress = true;
      try {
        if (hasOwnedFieldLock()) return;
        const selectedSheetId = state.pendingSheetId || state.activeSheetId;

        const mustReloadRoom = realtimeState.needsRoomReload || realtimeState.deletedSheetIds.size > 0;
        if (mustReloadRoom) {
          await loadRoomData();

          // Purge deleted sheets from local cache immediately.
          realtimeState.deletedSheetIds.forEach((sid) => {
            try { storage.removeSheetFromStorage(state.roomId, sid); } catch (_) {}
          });

          const visible = getVisibleSheets();
          const activeExists = selectedSheetId && state.sheetIds.includes(selectedSheetId);
          if (!selectedSheetId || !activeExists || !canView(selectedSheetId)) {
            state.pendingSheetId = null;
            await loadSheet(visible[0] || null);
            render();
            return;
          }
        }

        // For most events (bio/stat/item/spell/talent), avoid the expensive full room reload;
        // only refresh the active sheet if it was affected.
        if (selectedSheetId && realtimeState.changedSheetIds.has(selectedSheetId)) {
          await loadSheet(selectedSheetId, { forceRefresh: true });
          render();
        } else if (mustReloadRoom) {
          // Room data changed (permissions/list/deletes) but active sheet didn’t—still rerender header/menu.
          render();
        }
      } finally {
        realtimeState.changedSheetIds.clear();
        realtimeState.deletedSheetIds.clear();
        realtimeState.needsRoomReload = false;
        realtimeState.inProgress = false;
      }
    }
    function scheduleRealtimeFlush() {
      if (realtimeState.timer) return;
      realtimeState.timer = setTimeout(async () => {
        realtimeState.timer = null;
        await flushRealtime();
      }, 150);
    }
    state._scheduleRealtimeFlush = scheduleRealtimeFlush;
    storage.subscribeToRoom(state.roomId, async (payload) => {
      if (state.isEditingField) {
        // Don’t cut user input by reloading/rerendering mid-edit.
        state._realtimePendingAfterEdit = true;
        realtimeState.needsRoomReload = true;
        const sheetId = payload?.new?.sheet_id || payload?.old?.sheet_id || payload?.new?.id || payload?.old?.id;
        if (sheetId) realtimeState.changedSheetIds.add(sheetId);
        if (payload?.table === "sheet" && payload?.eventType === "DELETE") {
          const sid = payload?.old?.id;
          if (sid) realtimeState.deletedSheetIds.add(sid);
        }
        return;
      }
      if (payload?.table === "sheet" && payload?.eventType === "DELETE") {
        const sid = payload?.old?.id;
        if (sid) realtimeState.deletedSheetIds.add(sid);
        realtimeState.needsRoomReload = true;
        scheduleRealtimeFlush();
        return;
      }
      const sheetId = payload?.new?.sheet_id || payload?.old?.sheet_id || payload?.new?.id || payload?.old?.id;
      if (sheetId) realtimeState.changedSheetIds.add(sheetId);
      if (payload?.table === "sheet_permissions") realtimeState.needsRoomReload = true;
      scheduleRealtimeFlush();
    });

    OBR.room.onMetadataChange(async () => {
      const meta = await OBR.room.getMetadata();
      const roomMeta = meta?.foxyverse || {};

      const nextLocale = localStorage.getItem("foxyverse_locale") || state.locale;
      const nextTokenToSheet = roomMeta.tokenToSheet || {};
      const nextPlayerDirectory = roomMeta.playerDirectory || {};
      const nextFieldLocks = roomMeta.fieldLocks || {};

      const localeChanged = nextLocale !== state.locale;
      const tokenChanged = JSON.stringify(nextTokenToSheet) !== JSON.stringify(state.tokenToSheet || {});
      const directoryChanged = JSON.stringify(nextPlayerDirectory) !== JSON.stringify(state.playerDirectory || {});
      const lockChanged = JSON.stringify(nextFieldLocks) !== JSON.stringify(state.fieldLocks || {});

      state.tokenToSheet = nextTokenToSheet;
      state.playerDirectory = nextPlayerDirectory;
      state.fieldLocks = nextFieldLocks;

      if (localeChanged) {
        state.locale = nextLocale;
        setLocale(nextLocale);
        render();
        // no return; room metadata changes (tokens/locks) can still apply
      }

      if (lockChanged) {
        syncFieldLockStates();
      }

      if (tokenChanged || directoryChanged) {
        render();
      }
    });
    OBR.party.onChange(async (players) => {
      state.partyPlayers = players || [];
      const updatedDirectory = {
        ...state.playerDirectory,
        ...Object.fromEntries((state.partyPlayers || []).map((p) => [p.id, { name: p.name, role: p.role }])),
      };
      state.playerDirectory = updatedDirectory;
      await storage.setRoomData({ playerDirectory: updatedDirectory });
      requestVisibleSheets();
      render();
    });
  } catch (error) {
    console.error(error);
    state.startupError = error?.message || "Failed to initialize plugin";
    render();
  }
}
