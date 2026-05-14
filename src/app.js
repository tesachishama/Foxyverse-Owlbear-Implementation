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
import handleIcon from "./data/icons/Icons_handle.svg?raw";
import transferIcon from "./data/icons/Icons_transfer.svg?raw";
import weaponIcon from "./data/icons/Icons_weapon.svg?raw";
import helmetSlotIcon from "./data/icons/Icons_helmet.svg?raw";
import faceSlotIcon from "./data/icons/Icons_face.svg?raw";
import pendant1SlotIcon from "./data/icons/Icons_pendant1.svg?raw";
import pendant2SlotIcon from "./data/icons/Icons_pendant2.svg?raw";
import pendant3SlotIcon from "./data/icons/Icons_pendant3.svg?raw";
import chestSlotIcon from "./data/icons/Icons_chest.svg?raw";
import rshoulderSlotIcon from "./data/icons/Icons_rshoulder.svg?raw";
import lshoulderSlotIcon from "./data/icons/Icons_lshoulder.svg?raw";
import rarmSlotIcon from "./data/icons/Icons_rightArm.svg?raw";
import larmSlotIcon from "./data/icons/Icons_leftArm.svg?raw";
import rwristSlotIcon from "./data/icons/Icons_rightWrist.svg?raw";
import lwristSlotIcon from "./data/icons/Icons_leftWrist.svg?raw";
import rthumbSlotIcon from "./data/icons/Icons_rightThumb.svg?raw";
import rindexSlotIcon from "./data/icons/Icons_rightIndex.svg?raw";
import rmiddleSlotIcon from "./data/icons/Icons_rightMiddle.svg?raw";
import rringSlotIcon from "./data/icons/Icons_rightRing.svg?raw";
import rpinkySlotIcon from "./data/icons/Icons_rightPinky.svg?raw";
import lthumbSlotIcon from "./data/icons/Icons_leftThumb.svg?raw";
import lindexSlotIcon from "./data/icons/Icons_leftIndex.svg?raw";
import lmiddleSlotIcon from "./data/icons/Icons_leftMiddle.svg?raw";
import lringSlotIcon from "./data/icons/Icons_leftRing.svg?raw";
import lpinkySlotIcon from "./data/icons/Icons_leftPinky.svg?raw";
import beltSlotIcon from "./data/icons/Icons_belt.svg?raw";
import rlegSlotIcon from "./data/icons/Icons_rightLeg.svg?raw";
import llegSlotIcon from "./data/icons/Icons_leftLeg.svg?raw";
import rankleSlotIcon from "./data/icons/Icons_rightAnkle.svg?raw";
import lankleSlotIcon from "./data/icons/Icons_leftAnkle.svg?raw";
import rfootSlotIcon from "./data/icons/Icons_rightFoot.svg?raw";
import lfootSlotIcon from "./data/icons/Icons_leftFoot.svg?raw";
import equipmentSlotsSvg from "./data/icons/Icons_equipmentSlots.svg?raw";
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
import { evalEquipSlotsExpr, canonizeSlotToken } from "./data/equipSlots.js";
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

// Spell reorder drag state (event-delegated; survives re-render).
let spellReorderDrag = null;
// Inventory reorder drag state (per section; event-delegated).
let invReorderDrag = null;

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
  notesDraft: "",
  /** Spells UI state (session-only) */
  _openSpells: {}, // spellId -> boolean
  _editingSpellId: null,
  _spellEditDraft: null, // { id, name, effect, element, cost, costType, isContinuous }
  sheetMenuOpen: false,
  /** Remove-spell modal: header-style dropdown */
  spellRemoveModalOpen: false,
  spellRemoveMenuOpen: false,
  spellRemoveSelectedId: "",
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
  // Talents (stats tab) modal state
  talentModalOpen: false,
  talentDraft: null, // { id, name, description, tier, bonusOverride }
  talentTierMenuOpen: false,
  _tabScrollTop: {}, // tabId -> number
  _pageScrollTop: 0,
  _scrollToTalents: false,
  // Inventory: currency modals
  currencyModalOpen: false,
  currencyModalMode: "transfer", // "transfer" | "add" | "remove" | "confirm"
  currencyRecipientMenuOpen: false,
  currencyRecipientSheetId: "",
  currencyDraft: { gold: 0, silver: 0, copper: 0 },
  currencyPendingAction: null, // { mode, recipientSheetId, draft }
  // Inventory: section UI state
  _openItems: {}, // itemId -> boolean
  _editingItemId: null,
  _itemEditDraft: null, // { id, name, description }
  itemRemoveModalOpen: false,
  itemRemoveMenuOpen: false,
  itemRemoveSection: "", // section key
  itemRemoveSelectedId: "",
  invSlotMenuOpenFor: "", // itemId
  // Inventory: consumable transfer modal
  consumableTransferOpen: false,
  consumableTransferMode: "draft", // "draft" | "confirm"
  consumableTransferRecipientMenuOpen: false,
  consumableTransferItemMenuOpen: false,
  consumableTransferRecipientSheetId: "",
  consumableTransferItemId: "",
  consumableTransferQty: 1,
  consumableTransferPending: null, // { recipientSheetId, itemId, qty }
  consumableTransferSection: "consumables", // inventory section key
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

/** Prefer `talents[]`; support legacy single `talent` on items. */
function getItemTalentsArray(it) {
  if (!it) return [];
  if (Array.isArray(it.talents) && it.talents.length) return it.talents;
  if (it.talent) return [it.talent];
  return [];
}

function itemHasEquippedSlots(it) {
  const slots = it?.usedSlots?.equippedSlots;
  return Array.isArray(slots) && slots.length > 0;
}

function computeUsedSlots(sheet, item) {
  const equippedSlots = Object.keys(sheet.equipped || {}).filter((slotId) => sheet.equipped?.[slotId] === item.id);
  const out = {};
  if (equippedSlots.length) out.equippedSlots = equippedSlots;
  if (item.weaponSlots != null) out.weaponSlots = item.weaponSlots;
  return Object.keys(out).length ? out : null;
}

/** DB shape for `used_slots` from current item fields (equippedSlots + optional weaponSlots). */
function packItemUsedSlotsForDb(item) {
  const out = {};
  const arr = item?.usedSlots?.equippedSlots;
  if (Array.isArray(arr) && arr.length) out.equippedSlots = arr;
  if (item?.weaponSlots != null) out.weaponSlots = item.weaponSlots;
  return Object.keys(out).length ? out : null;
}

/** Rebuild `sheet.equipped` from all items' `usedSlots.equippedSlots` (single source of truth). */
function rebuildSheetEquippedFromUsedSlots(sheet) {
  if (!sheet) return;
  const eq = {};
  const all = [
    ...(sheet.consumables || []),
    ...(sheet.weapons || []),
    ...(sheet.armor || []),
    ...(sheet.others || []),
    ...(sheet.bags || []),
  ];
  all.forEach((it) => {
    const xs = it?.usedSlots?.equippedSlots;
    if (!Array.isArray(xs)) return;
    xs.forEach((slotId) => {
      if (slotId == null || String(slotId) === "") return;
      const c = canonizeSlotToken(slotId);
      const key = c || String(slotId);
      if (c === "other") {
        eq.other = it.id;
        return;
      }
      if (c) eq[c] = it.id;
      else eq[String(slotId)] = it.id;
    });
  });
  sheet.equipped = eq;
}

function computeUsableSlots(item) {
  const expr = String(item?.equippableExpr || "").trim();
  if (expr) return { expr };
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
  if (btn?.hasCustomLabel) return String(btn.customLabel ?? "").trim();
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
    const captionRaw = formatInlineRollButtonCaption(btn);
    const caption = escapeAttr(captionRaw);
    const aria = escapeAttr(captionRaw || formatInlineRollButtonCaption({ ...btn, hasCustomLabel: false }) || t("roll"));
    const iconHtml = inlineDiceMarkupForButton(btn);
    const captionSpan = captionRaw ? `<span class="inline-roll-caption">${caption}</span>` : "";
    html = html.split(escapeAttr(btn.raw)).join(
      `<button type="button" class="inline-roll-btn" data-kind="${escapeAttr(btn.kind)}" data-formula="${escapeAttr(formula)}" data-stat="${escapeAttr(stat)}" aria-label="${aria}">${iconHtml}${captionSpan}</button>`
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
        const cloned = { ...entry, id: nextId };
        if (section === "weapons" || section === "armor") {
          if (Array.isArray(cloned.talents) && cloned.talents.length) {
            cloned.talents = cloned.talents.map((tal) => ({ ...tal, id: crypto.randomUUID() }));
          } else if (cloned.talent) {
            cloned.talent = { ...cloned.talent, id: crypto.randomUUID() };
          }
        }
        return cloned;
      });
    });
    next.equipped = Object.fromEntries(
      Object.entries(next.equipped || {}).map(([slotId, itemId]) => [slotId, itemIdMap.get(itemId) || itemId])
    );
  }

  return next;
}

function finalizeNotesEditIfOpen() {
  if (!state.notesEditMode) return;
  const draft = String(state.notesDraft ?? "");
  state.notesEditMode = false;
  state.notesDraft = "";
  if (state.sheet) {
    applyLocalMutation((sheet) => {
      sheet.notes = draft;
    });
    if (state.roomId && state.activeSheetId) {
      storage.updateSheetCore(state.roomId, state.activeSheetId, { notes: draft }).catch(console.error);
    }
  }
}

function isSpellOpen(spellId) {
  return !!state._openSpells?.[String(spellId || "")];
}

function setSpellOpen(spellId, open) {
  const id = String(spellId || "");
  state._openSpells = { ...(state._openSpells || {}), [id]: !!open };
}

function setEditingSpellId(spellIdOrNull) {
  state._editingSpellId = spellIdOrNull ? String(spellIdOrNull) : null;
}

function startSpellEditDraft(spellId) {
  const id = String(spellId || "");
  const sp = (state.sheet?.spells || []).find((x) => String(x.id) === id);
  if (!sp) return;
  state._spellEditDraft = {
    id,
    name: sp.name || "",
    effect: sp.effect || "",
    cost: Math.max(0, Number(sp.cost) || 0),
    costType: (sp.costType || "mp") === "hp" ? "hp" : "mp",
    isContinuous: !!sp.isContinuous,
  };
}

function finalizeSpellEditIfOpen() {
  if (!state._editingSpellId || !state._spellEditDraft || !state.sheet) return;
  const id = String(state._editingSpellId);
  const d = state._spellEditDraft;
  if (String(d.id) !== id) return;
  const fallbackName = t("spellName");
  const nameOut = String(d.name ?? "").trim() || fallbackName;
  const next = applyLocalMutation((sheet) => {
    const sp = (sheet.spells || []).find((x) => String(x.id) === id);
    if (!sp) return;
    sp.name = nameOut;
    sp.effect = d.effect || "";
    sp.cost = Math.max(0, Number(d.cost) || 0);
    sp.costType = d.costType === "hp" ? "hp" : "mp";
    sp.isContinuous = !!d.isContinuous;
  });
  const sp = next?.spells?.find((x) => String(x.id) === id);
  if (sp && state.roomId && state.activeSheetId) {
    // Use upsert instead of update so newly-added spells always persist
    // even if the initial insert failed (permissions/race/etc).
    const position = Math.max(0, (next?.spells || []).findIndex((x) => String(x.id) === String(sp.id)));
    storage.upsertSpell(state.roomId, state.activeSheetId, {
      id: sp.id,
      position,
      name: sp.name || fallbackName,
      description: sp.effect || "",
      cost: sp.cost ?? 0,
      is_hp: (sp.costType || "mp") === "hp",
      is_continuous: !!sp.isContinuous,
      use_counter: sp.useCounter ?? 0,
    }).catch((err) => {
      console.error(err);
      const msg = err?.message || err?.details || String(err);
      try { OBR.notification.show(`Spell save failed: ${msg}`); } catch (_) {}
    });
  }
  state._editingSpellId = null;
  state._spellEditDraft = null;
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

function wrapWordsByLen(str, maxLen) {
  const max = Math.max(1, Number(maxLen) || 1);
  const raw = String(str || "").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/g).filter(Boolean);
  const lines = [];
  let cur = "";
  const pushCur = () => {
    if (cur) lines.push(cur);
    cur = "";
  };
  const hyphenateWord = (w) => {
    // If a single word exceeds max, split with hyphens.
    if (w.length <= max) return [w];
    if (max === 1) return w.split(""); // can't hyphenate meaningfully
    const parts = [];
    let rest = w;
    while (rest.length > max) {
      const take = max - 1; // reserve last char for '-'
      parts.push(rest.slice(0, take) + "-");
      rest = rest.slice(take);
    }
    if (rest) parts.push(rest);
    return parts;
  };
  for (const w of words) {
    const chunks = hyphenateWord(w);
    for (const chunk of chunks) {
      if (!cur) {
        cur = chunk;
        continue;
      }
      if ((cur.length + 1 + chunk.length) <= max) {
        cur = `${cur} ${chunk}`;
      } else {
        pushCur();
        cur = chunk;
      }
    }
  }
  pushCur();
  return lines;
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
  if (kind === "roll") {
    const key = String(payload?.typeLabelKey || "").trim();
    if (key) return t(key);
    const lbl = String(payload?.typeLabel || "").trim();
    return lbl || t("roll");
  }
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
  const editable = canEdit(s.id);

  // Item-bound talents: appended after sheet talents. Shown for all weapons/armor
  // that have talents; equipped ones are normal, unequipped are muted in the grid.
  const itemBoundTalents = (() => {
    const out = [];
    [...(s.weapons || []), ...(s.armor || [])].forEach((it) => {
      const talents = getItemTalentsArray(it);
      if (!talents.length) return;
      const section = (s.weapons || []).some((w) => w.id === it.id) ? "weapons" : "armor";
      const equipped = itemHasEquippedSlots(it);
      talents.forEach((tl) => {
        out.push({
          ...tl,
          __itemId: it.id,
          __itemName: it.name || "",
          __itemSection: section,
          __itemEquipped: equipped,
        });
      });
    });
    out.sort((a, b) => Number(!!b.__itemEquipped) - Number(!!a.__itemEquipped));
    return out;
  })();
  const talents = [...(s.knowledge || []), ...itemBoundTalents];

  const insertSoftHyphens = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const tokens = raw.split(/\s+/).filter(Boolean);
    const first = tokens[0] || "";
    const totalLen = raw.replace(/\s+/g, " ").length;

    // Only hyphenate when needed:
    // - first word is very long (tends to overflow line 1), OR
    // - overall label likely won't fit in 2 lines.
    const shouldHyphenate =
      (tokens.length > 1 && first.length >= 6) ||
      first.length >= 12 ||
      totalLen >= 28;
    if (!shouldHyphenate) return raw;

    const hyphenateWord = (w) => {
      if (w.length < 6) return w;
      const step = w.length < 10 ? 3 : 4;
      let out = "";
      for (let i = 0; i < w.length; i += step) {
        out += w.slice(i, i + step);
        if (i + step < w.length) out += "\u00AD";
      }
      return out;
    };

    // Hyphenate only the first word if it's the problem; otherwise hyphenate the longest word.
    const idxToHyphenate =
      first.length >= 12
        ? 0
        : tokens.reduce((bestIdx, w, i) => (w.length > tokens[bestIdx].length ? i : bestIdx), 0);
    const out = tokens.map((w, i) => (i === idxToHyphenate ? hyphenateWord(w) : w)).join(" ");
    return out;
  };

  const signed = (n) => {
    const v = Number(n) || 0;
    return v >= 0 ? `+${v}` : String(v);
  };

  const pill = (value, { signedValue = false, extraClass = "" } = {}) => {
    const cls = `stats-pill stats-pill--counter${extraClass ? ` ${extraClass}` : ""}`;
    return `<div class="${cls}">${escapeAttr(signedValue ? signed(value) : String(value))}</div>`;
  };

  const stepper = (key, value, opts = {}) => {
    const {
      min = null,
      max = null,
      allowNegative = false,
      signedValue = false,
      aria = "",
      variant = "",
    } = opts;
    const v = Number(value) || 0;
    const minAttr = min == null ? "" : ` data-min="${escapeAttr(String(min))}"`;
    const maxAttr = max == null ? "" : ` data-max="${escapeAttr(String(max))}"`;
    const negAttr = allowNegative ? ` data-allow-negative="1"` : "";
    const signedAttr = signedValue ? ` data-signed="1"` : "";
    const display = signedValue ? signed(v) : String(v);
    const readOnlyAttr = editable ? "" : " readonly";
    const varCls = variant ? ` ${variant}` : "";
    return `
      <div class="stats-pill-stepper${varCls}" data-stepper="${escapeAttr(key)}"${minAttr}${maxAttr}${negAttr}${signedAttr} aria-label="${escapeAttr(aria || key)}">
        <input type="text" class="stats-pill-input" inputmode="numeric" data-stepper-input="${escapeAttr(key)}" value="${escapeAttr(display)}"${readOnlyAttr} spellcheck="false" aria-label="${escapeAttr(aria || key)}" />
        <div class="stats-pill-arrows">
          <button type="button" class="stats-pill-arrow stats-pill-arrow-up" data-stepper-step="${escapeAttr(key)}" data-delta="1" ${editable ? "" : "disabled"} aria-label="${escapeAttr(t("add"))}">${inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)")}</button>
          <button type="button" class="stats-pill-arrow stats-pill-arrow-down" data-stepper-step="${escapeAttr(key)}" data-delta="-1" ${editable ? "" : "disabled"} aria-label="${escapeAttr(t("remove"))}">${inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)")}</button>
        </div>
      </div>
    `;
  };

  const itemBonusFor = (statId) => {
    const equipped = s.equipped || {};
    const seen = new Set();
    let sum = 0;
    Object.values(equipped).forEach((itemId) => {
      if (!itemId || seen.has(itemId)) return;
      seen.add(itemId);
      const it = findItemById(s, itemId);
      if (!it) return;
      sum += Number(it[statId]) || 0;
    });
    return sum;
  };

  const totalStatValueFor = (statId) => {
    const st = s.stats?.[statId] || {};
    const base = Number(st.base) || 0;
    const passive = Number(st.passiveBonus) || 0;
    const item = itemBonusFor(statId);
    return base + passive + item;
  };

  const statRollBracketLine = STAT_IDS.map((statId) => {
    const total = totalStatValueFor(statId);
    return `[${statId} | ${total}]`;
  }).join("");
  const statRollButtonsRow = renderChatBody(statRollBracketLine);
  const statAbbrCells = STAT_IDS.map((statId) => {
    const abbr = escapeAttr(t(`statAbbr_${statId}`));
    return `<div class="stats-strip-abbr-cell" title="${escapeAttr(t(statId))}">${abbr}</div>`;
  }).join("");

  // Backward-compatible: older builds stored formula overrides in description with a [[override]] marker.
  const legacyOverrideFromDescription = (raw) => {
    const s = String(raw || "");
    const idx = s.lastIndexOf("[[override]]");
    if (idx < 0) return "";
    return s.slice(idx + "[[override]]".length).trim();
  };

  const talentBonusText = (tl) => {
    const tier = Math.max(0, Math.min(4, Number(tl.tier) || 0));
    const tierMap = { 0: "+0", 1: "+1", 2: "+3", 3: "+5", 4: "+10" };
    const override = (tl.bonusOverride != null && String(tl.bonusOverride).trim())
      ? String(tl.bonusOverride)
      : legacyOverrideFromDescription(tl.description || "");
    if (!override) return tierMap[tier] || "+0";
    const raw = String(override).trim();
    const condensed = raw.length > 3 ? "±X" : raw;
    return escapeAttr(condensed);
  };

  const talentsGrid = talents
    .map((tl, idx) => {
      const name = String(tl.name || "").trim() || t("talentDefault");
      const nameDisplay = insertSoftHyphens(name);
      const tier = Math.max(0, Math.min(4, Number(tl.tier) || 0));
      const tierLbl = `T${tier}`;
      const bonusLbl = talentBonusText(tl);
      const rawOverride = (tl.bonusOverride != null && String(tl.bonusOverride).trim())
        ? String(tl.bonusOverride).trim()
        : legacyOverrideFromDescription(tl.description || "");
      const bonusTitle = rawOverride && rawOverride.length > 3 ? ` title="${escapeAttr(rawOverride)}"` : "";
      const bonusClass = rawOverride && rawOverride.length > 3 ? "talent-bonus talent-bonus--custom" : "talent-bonus";
      const isItemBound = !!tl.__itemId;
      const itemMarker = isItemBound
        ? `<div class="talent-item-marker" title="${escapeAttr(tl.__itemName || "")}">${inlineSvg(tl.__itemSection === "armor" ? chestSlotIcon : weaponIcon, "inline-svg talent-item-marker-svg", "var(--text)")}</div>`
        : "";
      const itemUnequipped = isItemBound && !tl.__itemEquipped;
      const pillClass = `talent-pill${isItemBound ? " talent-pill--item-bound" : ""}${itemUnequipped ? " talent-pill--item-unequipped" : ""}`;
      const talentIdStr = String(tl.id || idx);
      const itemAttr = isItemBound ? ` data-talent-item-id="${escapeAttr(String(tl.__itemId))}"` : "";
      return `
        <div class="${pillClass}" data-talent-id="${escapeAttr(talentIdStr)}"${itemAttr}>
          ${itemMarker}
          <div class="talent-name">${escapeAttr(nameDisplay)}</div>
          <div class="talent-tier">${escapeAttr(tierLbl)}</div>
          <div class="${bonusClass}"${bonusTitle}>${bonusLbl.startsWith("+") || bonusLbl.startsWith("-") ? bonusLbl : escapeAttr(bonusLbl)}</div>
          ${editable ? `<button type="button" class="talent-edit-btn" data-talent-edit="${escapeAttr(talentIdStr)}"${itemAttr} aria-label="${escapeAttr(t("edit"))}">${inlineSvg(editIcon, "inline-svg talent-edit-svg", "var(--text)")}</button>` : ""}
        </div>
      `;
    })
    .join("");

  const level = Number(s.bio?.level) || 1;
  const totalPoints = (() => {
    const costFor = (val) => {
      const v = Math.max(0, Number(val) || 0);
      const extra = Math.max(0, v - 5);
      let cost = 0;
      for (let i = 1; i <= extra; i++) {
        const statVal = 5 + i;
        // Cost per point:
        // - 6..20 => 1
        // - 21..30 => 2
        // - 31..40 => 3
        // - ...
        const perPoint = statVal <= 20 ? 1 : Math.floor((statVal - 21) / 10) + 2;
        cost += perPoint;
      }
      return cost;
    };
    return STAT_IDS.reduce((sum, id) => sum + costFor(s.stats?.[id]?.base), 0);
  })();

  const detailedStatRows = STAT_IDS.map((statId) => {
    const st = s.stats?.[statId] || {};
    const base = Number(st.base) || 0;
    const passive = Number(st.passiveBonus) || 0;
    const item = itemBonusFor(statId);
    const minBase = level === 1 ? 5 : null;
    const maxBase = level === 1 ? 15 : null;
    return `
      <tr>
        <th scope="row" class="stats-detail-stat-name">${escapeAttr(t(statId))}</th>
        <td class="stats-detail-val"><div class="stats-detail-cell">${stepper(`stat:${statId}:base`, base, {
          min: minBase,
          max: maxBase,
          allowNegative: false,
          variant: "stats-pill-stepper--detail stats-pill-stepper--detail-base",
        })}</div></td>
        <td class="stats-detail-val stats-detail-col-item"><div class="stats-detail-cell">${pill(item, { signedValue: true, extraClass: "stats-pill--detail-readonly" })}</div></td>
        <td class="stats-detail-val"><div class="stats-detail-cell">${stepper(`stat:${statId}:passive`, passive, {
          allowNegative: true,
          signedValue: true,
          variant: "stats-pill-stepper--detail stats-pill-stepper--detail-passive",
        })}</div></td>
      </tr>
    `;
  }).join("");

  const defensesPhysical = getSheetDefense(s);
  const defensesMagical = getSheetMagicalDefense(s);

  const speedRollBtn = `
    <button type="button" id="btn-roll-speed" class="stats-speed-btn stats-speed-btn--circle" aria-label="${escapeAttr(t("speed"))}">
      ${inlineSvg(d6Icon, "inline-svg stats-speed-d6", "var(--bg)")}
    </button>
  `;

  const renderRadarSvg = () => {
    const labels = [
      t("statAbbr_constitution"),
      t("statAbbr_strength"),
      t("statAbbr_intelligence"),
      t("statAbbr_perception"),
      t("statAbbr_social"),
      t("statAbbr_agility"),
      t("statAbbr_focus"),
    ];
    const stats = ["constitution", "strength", "intelligence", "perception", "social", "agility", "focus"];
    const baseVals = stats.map((id) => Number(s.stats?.[id]?.base) || 0);
    const totalVals = stats.map((id) => totalStatValueFor(id));
    const SCALE_MAX = 30;
    const size = 260;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 95;
    const angleStep = (Math.PI * 2) / stats.length;
    const rot = -Math.PI / 2;
    const clipOuterId = `radar-clip-outer-${String(s.id || "sheet").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const clipTotalId = `radar-clip-total-${String(s.id || "sheet").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const clipBaseId = `radar-clip-base-${String(s.id || "sheet").replace(/[^a-zA-Z0-9_-]/g, "-")}`;

    // Do not cap at SCALE_MAX: values may exceed 30, but are visually clipped to the outer ring.
    const rFor = (val) => (Math.max(0, Number(val) || 0) / SCALE_MAX) * radius;

    const pt = (score, i) => {
      const r = rFor(score);
      const a = rot + i * angleStep;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    const polyPts = (vals) => vals.map((v, i) => pt(v, i).map((n) => n.toFixed(1)).join(",")).join(" ");

    const outerRingPts = stats
      .map((_, i) => {
        const a = rot + i * angleStep;
        return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius].map((n) => n.toFixed(1)).join(",");
      })
      .join(" ");

    const ringPolys = [10, 20, 30]
      .map((tick) => {
        const rr = (tick / SCALE_MAX) * radius;
        const pts = stats
          .map((_, i) => {
            const a = rot + i * angleStep;
            return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr].map((n) => n.toFixed(1)).join(",");
          })
          .join(" ");
        return `<polygon points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3.2" />`;
      })
      .join("");

    const axes = stats
      .map((_, i) => {
        const a = rot + i * angleStep;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--accent)" stroke-width="2.8" />`;
      })
      .join("");

    const textLabels = stats
      .map((_, i) => {
        const a = rot + i * angleStep;
        const x = cx + Math.cos(a) * (radius + 10);
        const y = cy + Math.sin(a) * (radius + 10);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const dy = Math.sin(a) > 0.7 ? "0.9em" : Math.sin(a) < -0.7 ? "-0.2em" : "0.35em";
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dy="${dy}" font-weight="900" font-size="18" fill="var(--text)">${escapeAttr(labels[i])}</text>`;
      })
      .join("");

    const basePoly = polyPts(baseVals);
    const totalPoly = polyPts(totalVals);

    return `
      <svg class="stats-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeAttr(t("graphTitle"))}">
        <defs>
          <clipPath id="${clipOuterId}"><polygon points="${outerRingPts}" /></clipPath>
          <clipPath id="${clipTotalId}"><polygon points="${escapeAttr(totalPoly)}" /></clipPath>
          <clipPath id="${clipBaseId}"><polygon points="${escapeAttr(basePoly)}" /></clipPath>
        </defs>
        <!-- Filled shapes (overflow clipped to outer ring) -->
        <g clip-path="url(#${clipOuterId})">
          <!-- Total polygon under base (ui-color, full opacity) -->
          <polygon points="${escapeAttr(totalPoly)}" fill="var(--accent)" fill-opacity="1" stroke="none" />

          <!-- Base polygon: 50% opacity everywhere... -->
          <polygon points="${escapeAttr(basePoly)}" fill="var(--text)" fill-opacity="0.5" stroke="none" />
          <!-- ...then full opacity where base overlaps the total polygon -->
          <g clip-path="url(#${clipTotalId})">
            <polygon points="${escapeAttr(basePoly)}" fill="var(--text)" fill-opacity="1" stroke="none" />
          </g>
          <!-- Base outline always visible -->
          <polygon points="${escapeAttr(basePoly)}" fill="none" stroke="var(--text)" stroke-width="2.2" />
        </g>

        <!-- Grid + axes: draw on top of fills, clipped to outer ring -->
        <g clip-path="url(#${clipOuterId})">
          ${ringPolys}
          ${axes}
        </g>
        <!-- Grid + axes where they are over the total polygon: text-color -->
        <g clip-path="url(#${clipTotalId})">
          ${ringPolys.replaceAll("stroke=\"var(--accent)\"", "stroke=\"var(--text)\"")}
          ${axes.replaceAll("stroke=\"var(--accent)\"", "stroke=\"var(--text)\"")}
        </g>
        <!-- Ensure grid/spokes remain visible over base polygon (ui-color) -->
        <g clip-path="url(#${clipBaseId})">
          ${ringPolys}
          ${axes}
        </g>
        ${textLabels}
      </svg>
    `;
  };

  return `
    <div class="card stats-tab-card stats-template">
      <div class="stats-bubble stats-bubble--health">
        <div class="stats-bubble-title">${t("health")}</div>
        <div class="stats-3col">
          <div class="stats-col">
            <div class="stats-col-label">${t("labelMaximum")}</div>
            ${pill(maxHP, { extraClass: "stats-pill--readonly" })}
          </div>
          <div class="stats-col">
            <div class="stats-col-label">${t("labelCurrent")}</div>
            ${stepper("currentHP", s.currentHP ?? 0, { max: maxHP, allowNegative: true, aria: t("currentHP") })}
          </div>
          <div class="stats-col">
            <div class="stats-col-label">${t("labelTemporary")}</div>
            ${stepper("tempHP", s.tempHP ?? 0, { min: 0, allowNegative: false, aria: t("tempHP") })}
          </div>
        </div>
      </div>

      <div class="stats-2col-line">
        <div class="stats-bubble">
          <div class="stats-bubble-title">${t("mana")}</div>
          <div class="stats-2col stats-2col--even-pills">
            <div class="stats-col">
              <div class="stats-col-label">${t("labelMaximum")}</div>
              ${pill(maxMP, { extraClass: "stats-pill--readonly stats-pill--pair" })}
            </div>
            <div class="stats-col">
              <div class="stats-col-label">${t("labelCurrent")}</div>
              ${stepper("currentMP", s.currentMP ?? 0, { min: 0, max: maxMP, aria: t("currentMP"), variant: "stats-pill-stepper--pair" })}
            </div>
          </div>
        </div>
        <div class="stats-bubble">
          <div class="stats-bubble-title">${t("favor")}</div>
          <div class="stats-2col stats-2col--even-pills">
            <div class="stats-col">
              <div class="stats-col-label">${t("labelMaximum")}</div>
              ${pill(maxFavor, { extraClass: "stats-pill--readonly stats-pill--pair" })}
            </div>
            <div class="stats-col">
              <div class="stats-col-label">${t("labelCurrent")}</div>
              ${stepper("currentFavor", s.currentFavor ?? 0, { min: 0, max: maxFavor, aria: t("currentFavor"), variant: "stats-pill-stepper--pair" })}
            </div>
          </div>
        </div>
      </div>

      <div class="stats-bubble stats-bubble--3sub">
        <div class="stats-3sub">
          <div class="stats-sub">
            <div class="stats-sub-title">${t("action")}</div>
            <div class="stats-sub-row stats-sub-row--compact">
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("total")}</div>
                ${pill(actions, { extraClass: "stats-pill--compact stats-pill--readonly" })}
              </div>
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("statBonusShort")}</div>
                ${stepper("bonusAction", s.bonusAction ?? 0, {
                  allowNegative: true,
                  signedValue: true,
                  aria: t("actionModifier"),
                  variant: "stats-pill-stepper--compact",
                })}
              </div>
            </div>
          </div>
          <div class="stats-sub">
            <div class="stats-sub-title">${t("speed")}</div>
            <div class="stats-sub-row stats-sub-row--compact">
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("roll")}</div>
                ${speedRollBtn}
              </div>
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("statBonusShort")}</div>
                ${stepper("bonusSpeed", s.bonusSpeed ?? 0, {
                  allowNegative: true,
                  signedValue: true,
                  aria: t("speedModifier"),
                  variant: "stats-pill-stepper--compact",
                })}
              </div>
            </div>
          </div>
          <div class="stats-sub">
            <div class="stats-sub-title">${t("defensesBlock")}</div>
            <div class="stats-sub-row stats-sub-row--compact">
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("labelPhysicalShort")}</div>
                ${pill(defensesPhysical, { extraClass: "stats-pill--compact stats-pill--readonly" })}
              </div>
              <div class="stats-mini-col">
                <div class="stats-mini-label">${t("labelMagicalShort")}</div>
                ${pill(defensesMagical, { extraClass: "stats-pill--compact stats-pill--readonly" })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-bubble stats-bubble--strip">
        <div class="stats-bubble-title">${t("tabStats")}</div>
        <div class="stats-strip-wrap">
          <div class="stats-strip-abbr-row">${statAbbrCells}</div>
          <div class="stats-strip-roll-row">${statRollButtonsRow}</div>
        </div>
      </div>

      <div class="stats-bubble" id="stats-talents-block">
        <div class="stats-bubble-title-row">
          <div class="stats-bubble-title">${t("talentsBlock")}</div>
          ${editable ? `<button type="button" class="stats-add-icon" id="btn-add-talent" aria-label="${escapeAttr(t("add"))}">${inlineSvg(addIcon, "inline-svg stats-add-svg", "var(--accent)")}</button>` : ""}
        </div>
        <div class="talents-grid">${talentsGrid}</div>
      </div>

      <div class="stats-bubble">
        <div class="stats-bubble-title">${t("detailedStatistics") || "Detailled Statistics"}</div>
        <table class="stats-detail-table">
          <thead>
            <tr>
              <th class="stats-detail-corner"></th>
              <th class="stats-detail-col-h">${t("baseStat")}</th>
              <th class="stats-detail-col-h stats-detail-col-item">${t("itemBonus")}</th>
              <th class="stats-detail-col-h">${t("passiveBonus")}</th>
            </tr>
          </thead>
          <tbody>
            ${detailedStatRows}
          </tbody>
          <tfoot>
            <tr class="stats-detail-total-row">
              <th scope="row" class="stats-detail-stat-name stats-detail-total-label">${t("totalPointsLabel")}</th>
              <td class="stats-detail-val stats-detail-pts-cell">
                <span class="stats-detail-pts-num">${escapeAttr(String(totalPoints))}</span><span class="stats-detail-pts-suffix">${escapeAttr(t("ptsSuffix"))}</span>
              </td>
              <td class="stats-detail-val stats-detail-empty"></td>
              <td class="stats-detail-val stats-detail-empty"></td>
            </tr>
          </tfoot>
        </table>
        <div class="stats-graph-block">
          <div class="stats-bubble-title stats-graph-title">${t("graphTitle")}</div>
          <div class="stats-graph-wrap">${renderRadarSvg()}</div>
        </div>
      </div>
    </div>
    ${editable ? renderTalentModal() : ""}
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
    ${renderCurrencyModals()}
    ${renderActiveItemRemoveModal()}
    ${renderConsumableTransferModal()}
  `;
}

function renderActiveItemRemoveModal() {
  if (!state.itemRemoveModalOpen || !state.sheet) return "";
  const key = String(state.itemRemoveSection || "");
  const items =
    key === "consumables" ? (state.sheet.consumables || [])
      : key === "weapons" ? (state.sheet.weapons || [])
        : key === "armor" ? (state.sheet.armor || [])
          : key === "bags" ? (state.sheet.bags || [])
            : (state.sheet.others || []);
  return renderItemRemoveModal(key, items);
}

function renderConsumableTransferModal() {
  if (!state.consumableTransferOpen || !state.sheet) return "";
  const s = state.sheet;
  const vis = getVisibleSheets().filter((id) => id !== state.activeSheetId);
  const recipId = String(state.consumableTransferRecipientSheetId || "") || (vis[0] || "");
  const recipName = state.sheetNames[recipId] || "Name Surname";
  const sec = String(state.consumableTransferSection || "consumables");
  const items =
    sec === "weapons" ? (s.weapons || [])
      : sec === "armor" ? (s.armor || [])
        : sec === "bags" ? (s.bags || [])
          : sec === "others" ? (s.others || [])
            : (s.consumables || []);
  const itemId = String(state.consumableTransferItemId || "") || (items[0]?.id ? String(items[0].id) : "");
  const item = itemId ? (items || []).find((x) => String(x.id) === itemId) : null;
  const itemName = item?.name || (t("itemName") || "Item");
  const qty = Math.max(1, clampInt(state.consumableTransferQty || 1));

  const recipMenu = vis
    .map((id) => `<button type="button" class="sheet-menu-item ${id === recipId ? "active" : ""}" data-cons-xfer-recipient-pick="${escapeAttr(id)}">${escapeAttr(state.sheetNames[id] || "Name Surname")}</button>`)
    .join("");
  const itemMenu = items
    .map((it) => `<button type="button" class="sheet-menu-item ${String(it.id) === itemId ? "active" : ""}" data-cons-xfer-item-pick="${escapeAttr(String(it.id))}">${escapeAttr(String(it.name || t("itemName") || "Item").replace(/\[[^\]]+\]/g, "").trim())}</button>`)
    .join("");

  const pickerRow = `
    <label class="label">${escapeAttr(t("recipient") || "Recipient")}</label>
    <div class="sheet-picker inv-currency-recipient-picker">
      <div class="sheet-title">${escapeAttr(recipName)}</div>
      <button type="button" id="btn-cons-xfer-recipient-menu" class="header-icon-btn sheet-arrow-btn ${state.consumableTransferRecipientMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("selectSheet") || "Select sheet")}">
        ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
      </button>
      ${state.consumableTransferRecipientMenuOpen ? `<div class="sheet-menu">${recipMenu}</div>` : ""}
    </div>
    <label class="label" style="margin-top:0.35rem">${escapeAttr(t("item") || "Item")}</label>
    <div class="inv-cons-xfer-item-row">
      <div class="sheet-picker inv-cons-xfer-item-picker">
        <div class="sheet-title">${escapeAttr(itemName)}</div>
        <button type="button" id="btn-cons-xfer-item-menu" class="header-icon-btn sheet-arrow-btn ${state.consumableTransferItemMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("item") || "Item")}">
          ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
        </button>
        ${state.consumableTransferItemMenuOpen ? `<div class="sheet-menu">${itemMenu}</div>` : ""}
      </div>
      <div class="inv-cons-xfer-qty">
        <button type="button" class="inv-qty-btn" id="cons-xfer-qty-minus" aria-label="${escapeAttr(t("remove"))}">−</button>
        <div class="inv-qty-pill" id="cons-xfer-qty-val">${escapeAttr(String(qty))}</div>
        <button type="button" class="inv-qty-btn" id="cons-xfer-qty-plus" aria-label="${escapeAttr(t("add"))}">+</button>
      </div>
    </div>
  `;

  const confirmText = state.consumableTransferMode === "confirm" && state.consumableTransferPending
    ? `${t("confirmSending") || "Confirm sending"} ${qty} ${itemName} ${t("to") || "to"} ${recipName}`
    : "";

  return `
    <div id="consumable-transfer-modal" class="modal">
      <div class="modal-content inv-currency-modal-content">
        <h3>${escapeAttr(t("transfer") || "Transfer")}</h3>
        ${state.consumableTransferMode === "confirm" ? `<p class="inv-currency-confirm-text">${escapeAttr(confirmText)}</p>` : pickerRow}
        <div class="roll-modal-footer">
          ${state.consumableTransferMode === "confirm"
            ? `<button type="button" id="cons-xfer-confirm" class="btn-sm">${t("confirm") || "Confirm"}</button>`
            : `<button type="button" id="cons-xfer-send" class="btn-sm">${t("send") || "Send"}</button>`
          }
          <button type="button" id="cons-xfer-cancel" class="btn-sm">${t("cancel")}</button>
        </div>
      </div>
    </div>
  `;
}

function clampInt(n) {
  const v = Math.trunc(Number(n) || 0);
  return Number.isFinite(v) ? v : 0;
}

function coinsToCopper({ gold = 0, silver = 0, copper = 0 } = {}) {
  return Math.max(0, clampInt(copper)) + Math.max(0, clampInt(silver)) * 100 + Math.max(0, clampInt(gold)) * 100 * 100;
}

function copperToCoins(totalCopper) {
  const t = Math.max(0, clampInt(totalCopper));
  const gold = Math.floor(t / 10000);
  const rem1 = t - gold * 10000;
  const silver = Math.floor(rem1 / 100);
  const copper = rem1 - silver * 100;
  return { gold, silver, copper };
}

function simplifyCoins(coins) {
  return copperToCoins(coinsToCopper(coins));
}

function addCoinsExact(cur, delta) {
  const a = cur || { gold: 0, silver: 0, copper: 0 };
  const d = delta || { gold: 0, silver: 0, copper: 0 };
  return {
    gold: Math.max(0, clampInt(a.gold ?? 0) + clampInt(d.gold ?? 0)),
    silver: Math.max(0, clampInt(a.silver ?? 0) + clampInt(d.silver ?? 0)),
    copper: Math.max(0, clampInt(a.copper ?? 0) + clampInt(d.copper ?? 0)),
  };
}

function subCoinsWithBorrow(cur, delta) {
  const a = cur || { gold: 0, silver: 0, copper: 0 };
  const d = delta || { gold: 0, silver: 0, copper: 0 };
  let g = Math.max(0, clampInt(a.gold ?? 0));
  let s = Math.max(0, clampInt(a.silver ?? 0));
  let c = Math.max(0, clampInt(a.copper ?? 0));
  const dg = Math.max(0, clampInt(d.gold ?? 0));
  const ds = Math.max(0, clampInt(d.silver ?? 0));
  const dc = Math.max(0, clampInt(d.copper ?? 0));

  // Allow minimal conversions both ways, only as needed for the payment.
  // 1g = 100s, 1s = 100c.

  // Pay gold requirement: allow building silver from copper, then gold from silver.
  while (g < dg) {
    if (s >= 100) {
      s -= 100;
      g += 1;
      continue;
    }
    if (c >= 100) {
      const needS = 100 - s;
      const takeC = Math.min(c, needS * 100);
      const convS = Math.floor(takeC / 100);
      if (convS <= 0) break;
      c -= convS * 100;
      s += convS;
      continue;
    }
    break;
  }
  if (g < dg) return null;
  g -= dg;

  // Pay silver requirement: build from copper, or break gold if needed.
  while (s < ds) {
    if (c >= 100) {
      const need = ds - s;
      const convS = Math.min(need, Math.floor(c / 100));
      if (convS > 0) {
        c -= convS * 100;
        s += convS;
        continue;
      }
    }
    if (g > 0) {
      g -= 1;
      s += 100;
      continue;
    }
    break;
  }
  if (s < ds) return null;
  s -= ds;

  // Pay copper requirement: break silver then gold if needed.
  while (c < dc) {
    if (s > 0) {
      s -= 1;
      c += 100;
      continue;
    }
    if (g > 0) {
      g -= 1;
      c += 10000;
      continue;
    }
    break;
  }
  if (c < dc) return null;
  c -= dc;

  if (g < 0 || s < 0 || c < 0) return null;
  return { gold: g, silver: s, copper: c };
}

function getScrollSnapshot(app) {
  const scrollingEl = document.scrollingElement || document.documentElement;
  const prevPageTop = scrollingEl ? scrollingEl.scrollTop : 0;
  const prevWinY = typeof window !== "undefined" ? (window.scrollY || 0) : 0;
  const prevAppTop = app?.scrollTop || 0;
  const prevMain = app?.querySelector?.("main.tab-content");
  const prevMainTop = prevMain ? prevMain.scrollTop : 0;
  return { prevPageTop, prevWinY, prevAppTop, prevMainTop };
}

function renderCoinCounter(kind, value, { inputIdPrefix = "", disabled = false, scope = "draft" } = {}) {
  const v = Math.max(0, clampInt(value));
  const dis = disabled ? " disabled" : "";
  const up = inlineSvg(arrowIcon, "inline-svg spell-cost-arrow-svg", "var(--text)");
  const down = inlineSvg(arrowIcon, "inline-svg spell-cost-arrow-svg spell-cost-arrow-down", "var(--text)");
  const inputId = inputIdPrefix ? `${inputIdPrefix}-${kind}` : "";
  const idAttr = inputId ? ` id="${escapeAttr(inputId)}"` : "";
  const scopeAttr = ` data-coin-scope="${escapeAttr(String(scope || "draft"))}"`;
  return `
    <div class="spell-cost-pill inv-coin-pill" data-coin-pill="${escapeAttr(kind)}">
      <input type="text" class="inv-coin-value" data-coin-input="${escapeAttr(kind)}"${scopeAttr}${idAttr} value="${escapeAttr(String(v))}" inputmode="numeric" ${disabled ? "readonly" : ""} />
      <div class="spell-cost-arrows inv-coin-arrows">
        <button type="button" class="spell-cost-arrow-btn" data-coin-delta="${escapeAttr(kind)}"${scopeAttr} data-delta="1"${dis} aria-label="${escapeAttr(t("add"))}">${up}</button>
        <button type="button" class="spell-cost-arrow-btn" data-coin-delta="${escapeAttr(kind)}"${scopeAttr} data-delta="-1"${dis} aria-label="${escapeAttr(t("remove"))}">${down}</button>
      </div>
    </div>
  `;
}

function coinLabelHtml(labelText) {
  const raw = String(labelText || "").trim();
  const safe = escapeAttr(raw);
  // In FR we intentionally use two lines for all three coin names.
  const isFr = String(state?.locale || "en") === "fr";
  if (!isFr) return safe;
  const m = raw.match(/^(\S+)\s+(.+)$/);
  if (!m) return safe;
  return `${escapeAttr(m[1])}<br>${escapeAttr(m[2])}`;
}

function renderCurrencyModals() {
  const open = !!state.currencyModalOpen;
  if (!open) return "";

  const mode = String(state.currencyModalMode || "transfer");
  const draft = state.currencyDraft || { gold: 0, silver: 0, copper: 0 };
  const curWallet = state.sheet?.currency || { gold: 0, silver: 0, copper: 0 };
  const walletText = `${Math.max(0, clampInt(curWallet.gold ?? 0))}GC ${Math.max(0, clampInt(curWallet.silver ?? 0))}SC ${Math.max(0, clampInt(curWallet.copper ?? 0))}CC`;
  const vis = getVisibleSheets();
  const recipientId = String(state.currencyRecipientSheetId || "");
  const canPick = vis.filter((id) => id !== state.activeSheetId);
  const safeRecipient = recipientId && canPick.includes(recipientId) ? recipientId : (canPick[0] || "");
  const recipientName = state.sheetNames[safeRecipient] || "Name Surname";
  const senderName = resolveCharacterDisplayName(state.activeSheetId);
  const menuItems = canPick
    .map((id) => `<button type="button" class="sheet-menu-item ${id === safeRecipient ? "active" : ""}" data-currency-recipient-pick="${escapeAttr(id)}">${escapeAttr(state.sheetNames[id] || "Name Surname")}</button>`)
    .join("");

  const title = mode === "transfer"
    ? (t("transfer") || "Transfer")
    : mode === "add"
      ? (t("add") || "Add")
      : mode === "remove"
        ? (t("remove") || "Remove")
        : (t("confirm") || "Confirm");

  const coinRow = `
    <div class="inv-currency-row inv-currency-row--modal">
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("goldCoin") || "Gold Coin")}</div>
        ${renderCoinCounter("gold", draft.gold, { inputIdPrefix: "currency-draft", scope: "draft" })}
      </div>
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("silverCoin") || "Silver Coin")}</div>
        ${renderCoinCounter("silver", draft.silver, { inputIdPrefix: "currency-draft", scope: "draft" })}
      </div>
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("copperCoin") || "Copper Coin")}</div>
        ${renderCoinCounter("copper", draft.copper, { inputIdPrefix: "currency-draft", scope: "draft" })}
      </div>
    </div>
  `;

  const recipientPicker = mode === "transfer" ? `
    <label class="label">${escapeAttr(t("recipient") || "Recipient")}</label>
    <div class="sheet-picker inv-currency-recipient-picker">
      <div class="sheet-title">${escapeAttr(recipientName)}</div>
      <button type="button" id="btn-currency-recipient-menu" class="header-icon-btn sheet-arrow-btn ${state.currencyRecipientMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("selectSheet") || "Select sheet")}">
        ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
      </button>
      ${state.currencyRecipientMenuOpen ? `<div class="sheet-menu">${menuItems}</div>` : ""}
    </div>
  ` : "";

  const confirmText = mode === "confirm" && state.currencyPendingAction ? (() => {
    const d = state.currencyPendingAction.draft || { gold: 0, silver: 0, copper: 0 };
    const to = state.sheetNames[state.currencyPendingAction.recipientSheetId] || "Name Surname";
    return `${t("confirmSending") || "Confirm sending"} ${d.gold} ${t("goldCoin") || "gold"} ${d.silver} ${t("silverCoin") || "silver"} ${d.copper} ${t("copperCoin") || "copper"} ${t("to") || "to"} ${to}`;
  })() : "";

  const footer = mode === "confirm"
    ? `
      <div class="roll-modal-footer">
        <button type="button" id="currency-confirm-send" class="btn-sm">${t("confirm") || "Confirm"}</button>
        <button type="button" id="currency-cancel" class="btn-sm">${t("cancel")}</button>
      </div>
    `
    : `
      <div class="roll-modal-footer">
        ${mode === "add" || mode === "remove" ? `<button type="button" id="currency-simplify" class="btn-sm">${t("simplify") || "Simplify"}</button>` : ""}
        <button type="button" id="currency-cancel" class="btn-sm">${t("cancel")}</button>
        <button type="button" id="currency-save" class="btn-sm">${
          mode === "transfer"
            ? (t("send") || "Send")
            : mode === "add"
              ? (t("add") || "Add")
              : mode === "remove"
                ? (t("remove") || "Remove")
                : (t("save") || "Save")
        }</button>
      </div>
    `;

  const body = mode === "confirm"
    ? `<p class="inv-currency-confirm-text">${escapeAttr(confirmText)}</p>`
    : `${recipientPicker}${coinRow}`;

  return `
    <div id="currency-modal" class="modal">
      <div class="modal-content inv-currency-modal-content">
        <div class="inv-currency-modal-header">
          <h3>${escapeAttr(title)}</h3>
          <div class="inv-currency-wallet-row">
            <div class="inv-currency-wallet" aria-label="${escapeAttr(t("currency") || "Currency")}">${escapeAttr(walletText)}</div>
          </div>
        </div>
        ${body}
        ${footer}
      </div>
    </div>
  `;
}

function renderSpellRemoveModal(spells) {
  const stripInlineButtons = (text) => {
    // Hide inline roll button tokens like "[r 1d20]" in the picker UI.
    return String(text || "")
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
  const list = spells || [];
  const firstId = list[0]?.id != null ? String(list[0].id) : "";
  const selRaw = String(state.spellRemoveSelectedId || "");
  const selId = selRaw && list.some((sp) => String(sp.id) === selRaw) ? selRaw : firstId;
  const selSpell = list.find((sp) => String(sp.id) === selId);
  const title = stripInlineButtons(selSpell?.name || "").trim() || t("spellName");
  const menuItems = list
    .map((sp) => {
      const id = String(sp.id || "");
      const name = stripInlineButtons(sp.name || "").trim() || t("spellName");
      return `<button type="button" class="sheet-menu-item spell-remove-menu-item ${id === selId ? "active" : ""}" data-spell-remove-pick="${escapeAttr(id)}">${escapeAttr(name)}</button>`;
    })
    .join("");
  return `
    <div id="spell-remove-modal" class="modal ${state.spellRemoveModalOpen ? "" : "hidden"}">
      <div class="modal-content spell-remove-modal-content">
        <h3>${t("remove")}</h3>
        <label class="label">${t("selectSpellToRemove")}</label>
        <div class="sheet-picker spell-remove-picker">
          <div class="sheet-title">${escapeAttr(title)}</div>
          <button type="button" id="btn-spell-remove-menu" class="header-icon-btn sheet-arrow-btn ${state.spellRemoveMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("selectSpellToRemove"))}">
            ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
          </button>
          ${state.spellRemoveMenuOpen ? `<div class="sheet-menu">${menuItems}</div>` : ""}
        </div>
        <div class="roll-modal-footer">
          <button type="button" id="spell-remove-confirm" class="btn-sm">${t("remove")}</button>
          <button type="button" id="spell-remove-cancel" class="btn-sm">${t("cancel")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderItemRemoveModal(sectionKey, items) {
  const stripInlineButtons = (text) => String(text || "").replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
  const list = items || [];
  const firstId = list[0]?.id != null ? String(list[0].id) : "";
  const selRaw = String(state.itemRemoveSelectedId || "");
  const selId = selRaw && list.some((it) => String(it.id) === selRaw) ? selRaw : firstId;
  const selItem = list.find((it) => String(it.id) === String(selId));
  const title = stripInlineButtons(selItem?.name || "").trim() || (t("itemName") || "Item");
  const menuItems = list
    .map((it) => {
      const id = String(it.id || "");
      const name = stripInlineButtons(it.name || "").trim() || (t("itemName") || "Item");
      return `<button type="button" class="sheet-menu-item spell-remove-menu-item ${id === selId ? "active" : ""}" data-item-remove-pick="${escapeAttr(id)}">${escapeAttr(name)}</button>`;
    })
    .join("");
  return `
    <div id="item-remove-modal" class="modal ${state.itemRemoveModalOpen ? "" : "hidden"}">
      <div class="modal-content spell-remove-modal-content">
        <h3>${t("remove")}</h3>
        <label class="label">${escapeAttr(t("selectItemToRemove") || "Select item to remove")}</label>
        <div class="sheet-picker spell-remove-picker">
          <div class="sheet-title">${escapeAttr(title)}</div>
          <button type="button" id="btn-item-remove-menu" class="header-icon-btn sheet-arrow-btn ${state.itemRemoveMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("selectItemToRemove") || "Select item")}">
            ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
          </button>
          ${state.itemRemoveMenuOpen ? `<div class="sheet-menu">${menuItems}</div>` : ""}
        </div>
        <div class="roll-modal-footer">
          <button type="button" id="item-remove-confirm" class="btn-sm" data-item-remove-section="${escapeAttr(sectionKey)}">${t("remove")}</button>
          <button type="button" id="item-remove-cancel" class="btn-sm">${t("cancel")}</button>
        </div>
      </div>
    </div>
  `;
}

function renderTalentModal() {
  if (!state.talentModalOpen || !state.talentDraft) return "";
  const d = state.talentDraft;
  const tier = Math.max(0, Math.min(4, Number(d.tier) || 0));
  const bonusText = d.bonusOverride == null || d.bonusOverride === "" ? "" : String(d.bonusOverride);
  const desc = String(d.description || "");
  const descTitle = desc.trim() ? escapeAttr(t("talentDescTooltip")) : "";
  const tierLabel = `T${tier}`;
  const tierMenuItems = [0, 1, 2, 3, 4]
    .map((n) => `<button type="button" class="sheet-menu-item ${tier === n ? "active" : ""}" data-talent-tier-pick="${n}">T${n}</button>`)
    .join("");
  return `
    <div id="talent-modal" class="modal">
      <div class="modal-content talent-modal-content">
        <div class="talent-modal-scroll">
          <div class="talent-modal-fields">
            <input type="text" id="talent-name-inp" class="talent-modal-full" value="${escapeAttr(d.name || "")}" placeholder="${escapeAttr(t("talentDefault"))}" />
            <textarea id="talent-desc-inp" class="talent-modal-full" rows="5" placeholder="${escapeAttr(t("talentDescPlaceholder"))}" title="${descTitle}">${escapeAttr(desc)}</textarea>
          </div>
        </div>
        <div class="talent-modal-row">
          <div class="sheet-picker talent-tier-picker">
            <div class="sheet-title">${escapeAttr(tierLabel)}</div>
            <button type="button" id="btn-talent-tier-menu" class="header-icon-btn sheet-arrow-btn ${state.talentTierMenuOpen ? "open" : ""}" aria-label="${escapeAttr(t("tier"))}">
              ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
            </button>
            ${state.talentTierMenuOpen ? `<div class="sheet-menu">${tierMenuItems}</div>` : ""}
          </div>
          <input type="text" id="talent-override-inp" value="${escapeAttr(bonusText)}" placeholder="${escapeAttr(t("overwriteBonusesHere") || "Overwrite bonuses here")}" />
        </div>
        <div class="talent-modal-footer">
          <button type="button" id="talent-delete" class="btn-sm">${t("remove")}</button>
          <div class="talent-modal-actions">
            <button type="button" id="talent-cancel" class="btn-sm">${t("cancel")}</button>
            <button type="button" id="talent-save" class="btn-sm">${t("save") || "Save"}</button>
          </div>
        </div>
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
    .map((sp, i) => {
      const id = String(sp.id || i);
      const open = isSpellOpen(id);
      const editing = editable && String(state._editingSpellId || "") === id;
      const draft = editing && state._spellEditDraft && String(state._spellEditDraft.id) === id ? state._spellEditDraft : null;
      const displayName = (draft ? draft.name : sp.name || "").trim() || t("spellName");
      const used = Math.max(0, Number(sp.useCounter) || 0);
      const cost = Math.max(0, Number(sp.cost) || 0);
      const costType = (sp.costType || "mp") === "hp" ? "hp" : "mp";
      const cont = !!sp.isContinuous;
      const arrow = inlineSvg(arrowIcon, "inline-svg spell-chevron-svg", "var(--text)");
      const handle = inlineSvg(handleIcon, "inline-svg spell-handle-svg", "var(--text)");
      const edit = inlineSvg(editIcon, "inline-svg spell-edit-svg", "var(--text)");

      const viewNameHtml = renderChatBody(displayName);
      const viewEffectHtml = renderChatBody(sp.effect || "") || `<span class="muted">${escapeAttr(t("spellEffect"))}</span>`;

      const viewDetails = `
        <div class="spell-effect-row">
          <div class="spell-effect-text">${viewEffectHtml}</div>
          ${editable ? `<button type="button" class="spell-edit-btn" data-spell-edit="${escapeAttr(id)}" aria-label="${escapeAttr(t("edit"))}" title="${escapeAttr(t("edit"))}">${edit}</button>` : ""}
        </div>
        <div class="spell-meta-row">
          <span class="spell-cost-label">${t("cost")}</span>
          <span class="spell-cost-pill">${escapeAttr(String(cost))}</span>
          <button type="button" class="spell-pill-toggle ${costType === "mp" ? "active" : ""}" disabled>MP</button>
          <button type="button" class="spell-pill-toggle ${costType === "hp" ? "active" : ""}" disabled>HP</button>
          <button type="button" class="spell-pill-toggle ${cont ? "active" : ""}" disabled>${t("continuous")}</button>
        </div>
      `;

      const editDetails = `
        <div class="spell-edit-fields">
          <div class="spell-effect-row">
            <div class="spell-effect-edit-row">
              <textarea class="spell-effect-inp" data-spell-effect="${escapeAttr(id)}" placeholder="${escapeAttr(enterField("spellEffect"))}" rows="3">${escapeAttr(draft ? draft.effect : (sp.effect || ""))}</textarea>
            </div>
            ${editable ? `<button type="button" class="spell-edit-btn" data-spell-edit="${escapeAttr(id)}" aria-label="${escapeAttr(t("edit"))}" title="${escapeAttr(t("edit"))}">${edit}</button>` : ""}
          </div>
          <div class="spell-edit-meta">
            <div class="spell-cost-pill-control" data-spell-cost-pill="${escapeAttr(id)}">
              <span class="spell-cost-label">${t("cost")}</span>
              <div class="spell-cost-pill">
                <span class="spell-cost-value" data-spell-cost-value="${escapeAttr(id)}">${escapeAttr(String(draft ? draft.cost : cost))}</span>
                <div class="spell-cost-arrows">
                  <button type="button" class="spell-cost-arrow-btn" data-spell-cost-arrow="${escapeAttr(id)}" data-cost-delta="1" aria-label="${escapeAttr(t("add"))}">${inlineSvg(arrowIcon, "inline-svg spell-cost-arrow-svg", "var(--text)")}</button>
                  <button type="button" class="spell-cost-arrow-btn" data-spell-cost-arrow="${escapeAttr(id)}" data-cost-delta="-1" aria-label="${escapeAttr(t("remove"))}">${inlineSvg(arrowIcon, "inline-svg spell-cost-arrow-svg spell-cost-arrow-down", "var(--text)")}</button>
                </div>
              </div>
            </div>
            <div class="spell-toggle-row">
              <button type="button" class="spell-pill-toggle ${(draft ? draft.costType : costType) === "mp" ? "active" : ""}" data-spell-cost-type="${escapeAttr(id)}" data-cost-type="mp">MP</button>
              <button type="button" class="spell-pill-toggle ${(draft ? draft.costType : costType) === "hp" ? "active" : ""}" data-spell-cost-type="${escapeAttr(id)}" data-cost-type="hp">HP</button>
              <button type="button" class="spell-pill-toggle ${(draft ? draft.isContinuous : cont) ? "active" : ""}" data-spell-cont="${escapeAttr(id)}">${t("continuous")}</button>
            </div>
          </div>
        </div>
      `;

      const nameCell = editing
        ? `<input type="text" class="spell-name spell-name-inp" value="${escapeAttr(draft ? draft.name : (sp.name || ""))}" data-spell-name="${escapeAttr(id)}" placeholder="${escapeAttr(enterField("spellName"))}" />`
        : `<div class="spell-name spell-name-display">${viewNameHtml}</div>`;

      return `
        <div class="spell-item-wrap ${open ? "open" : "wrapped"}" data-spell-id="${escapeAttr(id)}" draggable="false">
          <div class="spell-row">
            <button type="button" class="spell-handle-btn" data-spell-handle="${escapeAttr(id)}" draggable="${editable ? "true" : "false"}" title="${escapeAttr(t("reorder"))}" aria-label="${escapeAttr(t("reorder"))}">${handle}</button>
            ${nameCell}
            <button type="button" class="spell-use-btn" data-spell-use="${escapeAttr(id)}">${t("use")}</button>
            <button type="button" class="spell-toggle-btn ${open ? "open" : ""}" data-spell-toggle="${escapeAttr(id)}" aria-label="${escapeAttr(t("toggle"))}">${arrow}</button>
          </div>
          ${open ? `<div class="spell-details">${editing ? editDetails : viewDetails}</div>` : ""}
          <div class="spell-used-row ${open ? "" : "hidden"}">
            <div class="spell-used-cluster">
              <span class="spell-used-text">${t("used")} ${escapeAttr(String(used))} ${t("times")}</span>
              <button type="button" class="spell-used-step" data-spell-used-delta="${escapeAttr(id)}" data-delta="-1" aria-label="${escapeAttr(t("remove"))}">${inlineSvg(removeIcon, "inline-svg spell-used-step-svg", "var(--accent)")}</button>
              <button type="button" class="spell-used-step" data-spell-used-delta="${escapeAttr(id)}" data-delta="1" aria-label="${escapeAttr(t("add"))}">${inlineSvg(addIcon, "inline-svg spell-used-step-svg", "var(--accent)")}</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
  const titleBtns = editable
    ? `<div class="spells-title-btns">
        <button type="button" class="spells-title-icon-btn" id="btn-add-spell" aria-label="${escapeAttr(t("add"))}" title="${escapeAttr(t("add"))}">${inlineSvg(addIcon, "inline-svg spells-title-icon", "var(--text)")}</button>
        <button type="button" class="spells-title-icon-btn" id="btn-remove-spell" aria-label="${escapeAttr(t("remove"))}" title="${escapeAttr(t("remove"))}">${inlineSvg(removeIcon, "inline-svg spells-title-icon", "var(--text)")}</button>
      </div>`
    : "";
  return `
    <div class="card spells-card">
      <div class="spells-title-row">
        <div class="spells-title-spacer"></div>
        <h2 class="spells-title">${t("tabSpells")}</h2>
        ${titleBtns}
      </div>
      <div class="spell-list">${list}</div>
      ${editable ? renderSpellRemoveModal(spells) : ""}
    </div>
  `;
}

function renderInventoryTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${state.pendingSheetId ? "Loading sheet..." : t("noSheet")}</p></div>`;
  const editable = canEdit(s.id);

  const SLOT_LEGACY_TO_CANON = {
    Weapon1: "weapon1",
    Weapon2: "weapon2",
    Weapon3: "weapon3",
    Hat: "hat",
    Face: "face",
    Pendant1: "pendant1",
    Pendant2: "pendant2",
    Pendant3: "pendant3",
    Torso: "torso",
    RightShoulder: "rshoulder",
    LeftShoulder: "lshoulder",
    RightArm: "rarm",
    LeftArm: "larm",
    RightWrist: "rwrist",
    LeftWrist: "lwrist",
    RightThumb: "rthumb",
    RightIndex: "rindex",
    RightMiddle: "rmiddle",
    RightRing: "rring",
    RightPinky: "rpinky",
    LeftThumb: "lthumb",
    LeftIndex: "lindex",
    LeftMiddle: "lmiddle",
    LeftRing: "lring",
    LeftPinky: "lpinky",
    Belt: "belt",
    RightLeg: "rleg",
    LeftLeg: "lleg",
    RightAnkle: "rankle",
    LeftAnkle: "lankle",
    RightFoot: "rfoot",
    LeftFoot: "lfoot",
    Other: "other",
  };

  const slotIconByCanon = {
    hat: helmetSlotIcon,
    face: faceSlotIcon,
    pendant1: pendant1SlotIcon,
    pendant2: pendant2SlotIcon,
    pendant3: pendant3SlotIcon,
    torso: chestSlotIcon,
    rshoulder: rshoulderSlotIcon,
    lshoulder: lshoulderSlotIcon,
    rarm: rarmSlotIcon,
    larm: larmSlotIcon,
    rwrist: rwristSlotIcon,
    lwrist: lwristSlotIcon,
    rthumb: rthumbSlotIcon,
    rindex: rindexSlotIcon,
    rmiddle: rmiddleSlotIcon,
    rring: rringSlotIcon,
    rpinky: rpinkySlotIcon,
    lthumb: lthumbSlotIcon,
    lindex: lindexSlotIcon,
    lmiddle: lmiddleSlotIcon,
    lring: lringSlotIcon,
    lpinky: lpinkySlotIcon,
    belt: beltSlotIcon,
    rleg: rlegSlotIcon,
    lleg: llegSlotIcon,
    rankle: rankleSlotIcon,
    lankle: lankleSlotIcon,
    rfoot: rfootSlotIcon,
    lfoot: lfootSlotIcon,
  };

  const slotTitle = (canon) => {
    // i18n keys follow schema SLOT_IDS style today; we keep best-effort fallback.
    // e.g. slotWeapon1, slotRightWrist, ...
    const legacy = Object.keys(SLOT_LEGACY_TO_CANON).find((k) => SLOT_LEGACY_TO_CANON[k] === canon) || canon;
    const key = "slot" + legacy;
    return t(key) || canon;
  };

  const deriveEquipped = () => {
    const canonToItem = {};
    const all = [
      ...(s.consumables || []),
      ...(s.weapons || []),
      ...(s.armor || []),
      ...(s.others || []),
      ...(s.bags || []),
    ];
    all.forEach((it) => {
      const id = String(it?.id || "");
      const slots = it?.usedSlots?.equippedSlots;
      if (!id || !Array.isArray(slots) || !slots.length) return;
      slots.forEach((raw) => {
        const canon = canonizeSlotToken(raw) || SLOT_LEGACY_TO_CANON[raw] || String(raw || "").toLowerCase();
        if (!canon || canon === "other") return;
        canonToItem[canon] = id;
      });
    });
    // Backward-compat fallback: legacy cache
    const eq = s.equipped || {};
    Object.entries(eq).forEach(([legacySlot, itemId]) => {
      const canon = canonizeSlotToken(legacySlot) || SLOT_LEGACY_TO_CANON[legacySlot] || null;
      if (!canon || !itemId) return;
      if (!canonToItem[canon]) canonToItem[canon] = itemId;
    });
    return canonToItem;
  };
  const canonEquipped = deriveEquipped();

  const inlineSvgKeepIds = (svg, className, color) => {
    return String(svg || "")
      .replace(/<\?xml[\s\S]*?\?>/g, "")
      .replace(/<svg\b/, `<svg class="${className}" style="color:${color};"`)
      .replace(/#4b002c/gi, "currentColor")
      .replace(/#ffdbff/gi, "currentColor")
      .replace(/fill:\s*currentColor/g, "fill:currentColor")
      .replace(/fill=\"currentColor\"/g, 'fill="currentColor"')
      .replace(/stroke=\"currentColor\"/g, 'stroke="currentColor"');
  };

  const renderEquipmentSlotsSvg = () => {
    const equippedSlots = new Set(Object.keys(canonEquipped || {}));
    const base = inlineSvgKeepIds(equipmentSlotsSvg, "inv-equip-svg", "var(--accent)");
    // Mark slot elements with classes + data attributes (avoid injecting duplicate style="").
    return base.replace(/\sid=\"([a-z0-9]+)\"/g, (m, id) => {
      const itemId = canonEquipped[id];
      const isEquipped = !!itemId && equippedSlots.has(id);
      const item = isEquipped ? findItemById(s, itemId) : null;
      const slot = slotTitle(id);
      const itemName = (item?.name || "").trim();
      const cls = `inv-equip-part${isEquipped ? " equipped" : ""}`;
      const itemAttr = isEquipped ? ` data-equip-item="${escapeAttr(String(itemId))}"` : "";
      const tip =
        ` data-equip-tip-slot="${escapeAttr(slot)}"` +
        (isEquipped && itemName ? ` data-equip-tip-item="${escapeAttr(itemName)}"` : "");
      return ` id="${id}" class="${cls}" data-equip-slot="${escapeAttr(id)}"${itemAttr}${tip}`;
    });
  };

  const renderSlotIcon = (canon, extraClass = "") => {
    const itemId = canonEquipped[canon] || null;
    const item = itemId ? findItemById(s, itemId) : null;
    const equipped = !!itemId;
    const color = equipped ? "var(--text)" : "var(--accent)";
    const title = equipped ? `${slotTitle(canon)}: ${item?.name || ""}`.trim() : slotTitle(canon);
    const svg = slotIconByCanon[canon];
    if (!svg) return "";
    const itemAttr = itemId ? ` data-equip-item="${escapeAttr(String(itemId))}"` : "";
    return `<button type="button" class="inv-slot-btn ${extraClass} ${equipped ? "equipped" : ""}" data-equip-slot="${escapeAttr(canon)}"${itemAttr} title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}">${inlineSvg(svg, "inline-svg inv-slot-svg", color)}</button>`;
  };

  const invBubbleTitleRow = (title, leftHtml, rightHtml, extraClass = "") => `
    <div class="inv-bubble-title-row ${extraClass}">
      <div class="inv-bubble-title-left">${leftHtml || ""}</div>
      <div class="inv-bubble-title">${escapeAttr(title)}</div>
      <div class="inv-bubble-title-right">${rightHtml || ""}</div>
    </div>
  `;

  const iconBtn = (id, svg, color, aria, extraClass = "") =>
    `<button type="button" id="${escapeAttr(id)}" class="inv-icon-btn ${extraClass}" aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}">${inlineSvg(svg, "inline-svg inv-icon-svg", color)}</button>`;

  const bubble = (inner, extraClass = "") => `<div class="stats-bubble inv-bubble ${extraClass}">${inner}</div>`;

  // Equipment slots block (visual-only layout for now; behavior added in later todos)
  const renderWeaponSlotIcon = (canon) => {
    const itemId = canonEquipped[canon] || null;
    const item = itemId ? findItemById(s, itemId) : null;
    const equipped = !!itemId;
    const color = equipped ? "var(--text)" : "var(--accent)";
    const slot = slotTitle(canon);
    const itemName = (item?.name || "").trim();
    const title = equipped && itemName ? `${slot} ${itemName}` : slot;
    const itemAttr = itemId ? ` data-equip-item="${escapeAttr(String(itemId))}"` : "";
    const tip =
      ` data-equip-tip-slot="${escapeAttr(slot)}"` +
      (equipped && itemName ? ` data-equip-tip-item="${escapeAttr(itemName)}"` : "");
    return `
      <button type="button"
        class="inv-weapon-btn ${equipped ? "equipped" : ""}"
        data-equip-slot="${escapeAttr(canon)}"${itemAttr}${tip}
        aria-label="${escapeAttr(title)}"
        title="${escapeAttr(title)}">
        ${inlineSvg(weaponIcon, "inline-svg inv-weapon-svg", color)}
      </button>
    `;
  };
  const equipLeft = `
    <div class="inv-equip-left">
      <div class="inv-equip-title">${escapeAttr(t("equipmentSlots") || "Equipment Slots")}</div>
      <div class="inv-weapon-col">
        <div class="inv-weapon-ico">${renderWeaponSlotIcon("weapon1")}</div>
        <div class="inv-weapon-ico">${renderWeaponSlotIcon("weapon2")}</div>
        <div class="inv-weapon-ico">${renderWeaponSlotIcon("weapon3")}</div>
      </div>
    </div>
  `;
  const equipRight = `
    <div class="inv-equip-silhouette" aria-label="${escapeAttr(t("equipmentSlots") || "Equipment Slots")}">
      ${renderEquipmentSlotsSvg()}
    </div>
  `;
  const equipBlock = bubble(
    `<div class="inv-equip-wrap">${equipLeft}${equipRight}<div class="inv-equip-tooltip hidden" id="inv-equip-tooltip"></div></div>`,
    "inv-bubble--equip"
  );

  // Currency block (layout; modals + logic in later todos)
  const cur = s.currency || { gold: 0, silver: 0, copper: 0 };
  const transferBtn = iconBtn("btn-currency-transfer", transferIcon, "var(--accent)", t("transfer") || "Transfer");
  const addBtn = iconBtn("btn-currency-add", addIcon, "var(--accent)", t("add") || "Add");
  const removeBtn = iconBtn("btn-currency-remove", removeIcon, "var(--accent)", t("remove") || "Remove");
  const currencyTitle = invBubbleTitleRow(
    t("currency") || "Currency",
    `<div class="inv-title-icon-row">${transferBtn}</div>`,
    `<div class="inv-title-icon-row">${addBtn}${removeBtn}</div>`
  );
  const currencyBody = `
    <div class="inv-currency-row">
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("goldCoin") || "Gold Coin")}</div>
        ${renderCoinCounter("gold", cur.gold ?? 0, { scope: "sheet" })}
      </div>
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("silverCoin") || "Silver Coin")}</div>
        ${renderCoinCounter("silver", cur.silver ?? 0, { scope: "sheet" })}
      </div>
      <div class="inv-currency-col">
        <div class="stats-col-label">${coinLabelHtml(t("copperCoin") || "Copper Coin")}</div>
        ${renderCoinCounter("copper", cur.copper ?? 0, { scope: "sheet" })}
      </div>
    </div>
  `;
  const currencyBlock = `<div id="inv-currency-block">${bubble(`${currencyTitle}${currencyBody}`, "inv-bubble--currency")}</div>`;

  const sectionHeader = (key, title, { allowTransfer = false } = {}) => {
    const left = allowTransfer ? `<div class="inv-title-icon-row">${iconBtn(`btn-${key}-transfer`, transferIcon, "var(--accent)", t("transfer") || "Transfer")}</div>` : "";
    const right = editable
      ? `<div class="inv-title-icon-row">${iconBtn(`btn-${key}-add`, addIcon, "var(--accent)", t("add") || "Add")}${iconBtn(`btn-${key}-remove`, removeIcon, "var(--accent)", t("remove") || "Remove")}</div>`
      : "";
    return invBubbleTitleRow(title, left, right);
  };

  const renderQtyCounter = (id, count) => {
    const v = Math.max(0, clampInt(count ?? 0));
    const dis = canEdit(state.activeSheetId) ? "" : "readonly";
    const addSvg = inlineSvg(addIcon, "inline-svg inv-qty-ico", "var(--accent)");
    const remSvg = inlineSvg(removeIcon, "inline-svg inv-qty-ico", "var(--accent)");
    return `
      <div class="inv-qty-counter" data-inv-qty="${escapeAttr(id)}">
        <button type="button" class="inv-qty-btn" data-inv-qty-delta="${escapeAttr(id)}" data-delta="-1" aria-label="${escapeAttr(t("remove"))}">${remSvg}</button>
        <input type="text" class="inv-qty-pill inv-qty-inp" data-inv-qty-input="${escapeAttr(id)}" value="${escapeAttr(String(v))}" inputmode="numeric" size="2" ${dis} />
        <button type="button" class="inv-qty-btn" data-inv-qty-delta="${escapeAttr(id)}" data-delta="1" aria-label="${escapeAttr(t("add"))}">${addSvg}</button>
      </div>
    `;
  };

  const renderInvItem = (sectionKey, it) => {
    const id = String(it.id || "");
    const open = !!state._openItems?.[id];
    const editing = state._editingItemId === id;
    const draft = editing && state._itemEditDraft && String(state._itemEditDraft.id) === id ? state._itemEditDraft : null;
    const name = (draft ? draft.name : it.name) || "";
    const desc = (draft ? draft.description : it.description) || "";
    const handle = inlineSvg(handleIcon, "inline-svg spell-handle-svg", "var(--text)");
    const chevron = inlineSvg(arrowIcon, "inline-svg spell-chevron-svg", "var(--text)");
    const editSvg = inlineSvg(editIcon, "inline-svg spell-edit-svg", "var(--accent)");

    const nameNode = editing
      ? `<input type="text" class="spell-name spell-name-inp" value="${escapeAttr(name)}" data-inv-item-name="${escapeAttr(id)}" placeholder="${escapeAttr(t("itemName") || "Item name")}" />`
      : `<div class="spell-name-display inv-item-title">${renderChatBody(name || (t("itemName") || "Item"))}</div>`;

    const descNode = editing
      ? `<textarea class="spell-effect-inp" rows="3" data-inv-item-desc="${escapeAttr(id)}" placeholder="${escapeAttr(t("itemDescription") || "Description")}">${escapeAttr(desc)}</textarea>`
      : `<div class="spell-effect-text">${renderChatBody(desc || "")}</div>`;

    const signed = (n) => {
      const v = clampInt(n);
      return v > 0 ? `+${v}` : String(v);
    };
    const invItemStatKey = (itemId, field) => `invitem|${itemId}|${field}`;
    const invItemStatStepper = (field, value) => {
      const k = invItemStatKey(id, field);
      const v = clampInt(value ?? 0);
      const dis = editable ? "" : " disabled";
      const ro = editable ? "" : " readonly";
      const unsignedInput = String(v);
      const up = inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)");
      const down = inlineSvg(arrowIcon, "inline-svg bio-level-arrow-icon", "var(--text)");
      if (editing) {
        return `
        <div class="stats-pill-stepper inv-item-stat-stepper inv-item-stat-stepper--edit" data-inv-item-stat-wrap="${escapeAttr(k)}" data-allow-negative="1">
          <input type="text" class="stats-pill-input" inputmode="numeric" data-inv-item-stat-input="${escapeAttr(k)}" value="${escapeAttr(unsignedInput)}"${ro} spellcheck="false" aria-label="${escapeAttr(field)}" />
          <div class="stats-pill-arrows">
            <button type="button" class="stats-pill-arrow stats-pill-arrow-up" data-inv-item-stat-delta="${escapeAttr(k)}" data-delta="1"${dis} aria-label="${escapeAttr(t("add"))}">${up}</button>
            <button type="button" class="stats-pill-arrow stats-pill-arrow-down" data-inv-item-stat-delta="${escapeAttr(k)}" data-delta="-1"${dis} aria-label="${escapeAttr(t("remove"))}">${down}</button>
          </div>
        </div>
      `;
      }
      return `
        <div class="inv-item-stat-stepper inv-item-stat-stepper--view" data-inv-item-stat-wrap="${escapeAttr(k)}">
          <span class="inv-item-stat-signed" aria-label="${escapeAttr(field)}">${escapeAttr(signed(v))}</span>
        </div>
      `;
    };

    const weaponArmorExtras = (() => {
      if (!(sectionKey === "weapons" || sectionKey === "armor")) return "";

      const statKeys = ["constitution", "strength", "intelligence", "perception", "social", "agility", "focus"];
      const statAbbrLabel = (statId) => {
        const raw = String(t(`statAbbr_${statId}`) || statId).trim();
        if (!raw) return statId;
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      };
      const strip = `
        <div class="inv-item-strip">
          ${statKeys.map((k) => {
            const val = clampInt(it?.[k] ?? 0);
            return `
              <div class="inv-item-strip-col">
                <div class="inv-item-strip-lbl">${escapeAttr(statAbbrLabel(k))}</div>
                ${invItemStatStepper(k, val)}
              </div>
            `;
          }).join("")}
        </div>
      `;

      const defRow = sectionKey === "armor" ? `
        <div class="inv-armor-def-row">
          <div class="inv-armor-def-col">
            <div class="inv-armor-def-lbl">${escapeAttr(t("physicalDefense"))}</div>
            ${invItemStatStepper("physical_defense", clampInt(it.defense ?? 0))}
          </div>
          <div class="inv-armor-def-col">
            <div class="inv-armor-def-lbl">${escapeAttr(t("magicalDefense"))}</div>
            ${invItemStatStepper("magical_defense", clampInt(it.magicalDefense ?? 0))}
          </div>
        </div>
      ` : "";

      const exprText = String(it.equippableExpr || "").trim();
      const usable = exprText ? exprText : "";
      const { options } = usable ? evalEquipSlotsExpr(usable) : { options: [] };
      const occupied = new Set();
      const occItems = [
        ...(s.consumables || []),
        ...(s.weapons || []),
        ...(s.armor || []),
        ...(s.others || []),
        ...(s.bags || []),
      ];
      occItems.forEach((oit) => {
        if (!oit || String(oit.id) === String(id)) return;
        const arr = oit?.usedSlots?.equippedSlots;
        if (!Array.isArray(arr) || !arr.length) return;
        arr.forEach((raw) => {
          const c = canonizeSlotToken(raw) || SLOT_LEGACY_TO_CANON[raw] || String(raw || "").toLowerCase();
          if (c && c !== "other") occupied.add(c);
        });
      });
      Object.entries(s.equipped || {}).forEach(([legacyKey, itemId]) => {
        if (!itemId || String(itemId) === String(id)) return;
        const c = canonizeSlotToken(legacyKey) || SLOT_LEGACY_TO_CANON[legacyKey] || null;
        if (c && c !== "other") occupied.add(c);
      });
      const choices = [
        { key: "unequipped", label: t("unequipped") || "Unequipped", slots: [] },
        ...options.map((slots) => ({ key: slots.join("+"), label: slots.join(" + "), slots })),
        { key: "other", label: "other", slots: ["other"] },
      ];
      const selectedSlots = Array.isArray(it?.usedSlots?.equippedSlots) ? it.usedSlots.equippedSlots : [];
      const selectedKey = selectedSlots.length ? selectedSlots.join("+") : "unequipped";

      const menuItems = choices.map((c) => {
        const disabled = c.slots.some((sl) => {
          const cc = canonizeSlotToken(sl) || SLOT_LEGACY_TO_CANON[sl] || String(sl || "").toLowerCase();
          return cc && cc !== "other" && occupied.has(cc);
        });
        return { ...c, disabled };
      }).sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled));

      const shown = menuItems.find((m) => m.key === selectedKey) || menuItems[0];
      const slotsUI = editing
        ? `<input type="text" class="inv-slot-expr-inp" data-inv-slot-expr="${escapeAttr(id)}" value="${escapeAttr(usable)}" placeholder="${escapeAttr(t("slots") || "Slots")}" />`
        : `
          <div class="sheet-picker inv-slot-picker" data-inv-slot-picker="${escapeAttr(id)}">
            <div class="sheet-title">${escapeAttr(shown?.label || (t("unequipped") || "Unequipped"))}</div>
            <button type="button" class="header-icon-btn sheet-arrow-btn ${state.invSlotMenuOpenFor === id ? "open" : ""}" data-inv-slot-menu="${escapeAttr(id)}" aria-label="${escapeAttr(t("slots") || "Slots")}">
              ${inlineSvg(arrowIcon, "inline-svg header-icon-svg", "var(--text)")}
            </button>
            ${state.invSlotMenuOpenFor === id ? `<div class="sheet-menu">${menuItems.map((m) => `<button type="button" class="sheet-menu-item ${m.key === shown.key ? "active" : ""} ${m.disabled ? "disabled" : ""}" ${m.disabled ? "disabled" : ""} data-inv-slot-pick="${escapeAttr(id)}" data-slot-key="${escapeAttr(m.key)}" data-slot-json="${escapeAttr(JSON.stringify(m.slots))}">${escapeAttr(m.label)}</button>`).join("")}</div>` : ""}
          </div>
        `;

      const itemTalentsList = getItemTalentsArray(it);
      const talentTitle = escapeAttr(t("itemTalent") || "Item talent");
      const talentRows = itemTalentsList.map((tal) => {
        const tid = String(tal.id || "");
        const nm = String(tal.name || "").trim() || (t("talentDefault") || "Talent");
        const removeBtn = editable
          ? `<button type="button" class="inv-item-talent-btn" data-inv-item-talent-remove="${escapeAttr(id)}" data-inv-talent-id="${escapeAttr(tid)}" aria-label="${escapeAttr(t("remove"))}" title="${escapeAttr(t("remove"))}">${inlineSvg(removeIcon, "inline-svg inv-item-talent-icon", "var(--accent)")}</button>`
          : "";
        const nameCell = editing
          ? `<input type="text" class="inv-item-talent-name-inp" data-inv-item-talent-name="${escapeAttr(id)}" data-inv-talent-id="${escapeAttr(tid)}" value="${escapeAttr(nm)}" placeholder="${escapeAttr(t("talentDefault") || "")}" />`
          : `<span class="inv-item-talent-name-txt">${escapeAttr(nm)}</span>`;
        return `
          <div class="inv-item-talent-line">
            <div class="inv-item-talent-name-cell">${nameCell}</div>
            <div class="inv-item-talent-actions">${removeBtn}</div>
          </div>
        `;
      }).join("");
      const emptyTalentHint = !itemTalentsList.length
        ? `<div class="inv-item-talent-line inv-item-talent-line--empty"><span class="inv-item-talent-empty">${escapeAttr(t("none") || "—")}</span></div>`
        : "";
      const addBtnRow = editable
        ? `<div class="inv-item-talent-add-row"><button type="button" class="inv-item-talent-btn" data-inv-item-talent-add="${escapeAttr(id)}" aria-label="${escapeAttr(t("add"))}" title="${escapeAttr(t("add"))}">${inlineSvg(addIcon, "inline-svg inv-item-talent-icon", "var(--accent)")}</button></div>`
        : "";
      const talentsBlock = `
        <div class="inv-item-talents-block">
          <div class="inv-item-talents-title">${talentTitle}</div>
          ${emptyTalentHint}${talentRows}
          ${addBtnRow}
        </div>
      `;

      return `
        ${strip}
        ${defRow}
        ${talentsBlock}
        <div class="inv-slots-row">
          <div class="inv-slots-title">${escapeAttr(t("slots") || "Slots")}</div>
          ${slotsUI}
        </div>
      `;
    })();

    return `
      <div class="spell-item-wrap ${open ? "open" : "wrapped"} inv-item-wrap" id="inv-item-${escapeAttr(id)}" data-inv-item-id="${escapeAttr(id)}" data-inv-section="${escapeAttr(sectionKey)}" draggable="false">
        <div class="spell-row inv-item-row">
          <button type="button" class="spell-handle-btn" data-inv-handle="${escapeAttr(id)}" draggable="${editable ? "true" : "false"}" title="${escapeAttr(t("reorder"))}" aria-label="${escapeAttr(t("reorder"))}">${handle}</button>
          ${nameNode}
          ${renderQtyCounter(id, it.count ?? it.quantity ?? 1)}
          <button type="button" class="spell-toggle-btn ${open ? "open" : ""}" data-inv-toggle="${escapeAttr(id)}" aria-label="${escapeAttr(t("toggle"))}">${chevron}</button>
        </div>
        ${open ? `
          <div class="spell-details inv-item-details">
            <div class="spell-effect-row">
              ${descNode}
              ${editable ? `<button type="button" class="spell-edit-btn" data-inv-edit="${escapeAttr(id)}" aria-label="${escapeAttr(t("edit"))}" title="${escapeAttr(t("edit"))}">${editSvg}</button>` : ""}
            </div>
            ${weaponArmorExtras}
          </div>
        ` : ""}
      </div>
    `;
  };

  const renderSectionList = (sectionKey, items) => {
    const list = (items || []).map((it) => renderInvItem(sectionKey, it)).join("");
    return `<div class="spell-list inv-list" data-inv-list="${escapeAttr(sectionKey)}">${list}</div>`;
  };

  const wrapSection = (key, html) => `<div id="inv-sec-${escapeAttr(key)}">${html}</div>`;
  const consumablesBlock = wrapSection("consumables", bubble(`${sectionHeader("consumables", t("consumables") || "Consumables", { allowTransfer: true })}${renderSectionList("consumables", s.consumables || [])}`, "inv-bubble--section"));
  const weaponsBlock = wrapSection("weapons", bubble(`${sectionHeader("weapons", t("weapons") || "Weapons", { allowTransfer: true })}${renderSectionList("weapons", s.weapons || [])}`, "inv-bubble--section"));
  const armorBlock = wrapSection("armor", bubble(`${sectionHeader("armor", t("armor") || "Armor", { allowTransfer: true })}${renderSectionList("armor", s.armor || [])}`, "inv-bubble--section"));
  const othersBlock = wrapSection("others", bubble(`${sectionHeader("others", t("others") || "Others", { allowTransfer: true })}${renderSectionList("others", s.others || [])}`, "inv-bubble--section"));
  const bagsBlock = wrapSection("bags", bubble(`${sectionHeader("bags", t("bags") || "Bags", { allowTransfer: true })}${renderSectionList("bags", s.bags || [])}`, "inv-bubble--section"));

  return `
    <div class="card inventory-tab-card inventory-template">
      ${equipBlock}
      ${currencyBlock}
      ${consumablesBlock}
      ${weaponsBlock}
      ${armorBlock}
      ${othersBlock}
      ${bagsBlock}
    </div>
  `;
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
    const captionRaw = formatInlineRollButtonCaption(btn);
    const caption = escapeAttr(captionRaw);
    const aria = escapeAttr(captionRaw || formatInlineRollButtonCaption({ ...btn, hasCustomLabel: false }) || t("roll"));
    const iconHtml = inlineDiceMarkupForButton(btn);
    const rawEsc = escapeAttr(btn.raw);
    const captionSpan = captionRaw ? `<span class="inline-roll-caption">${caption}</span>` : "";
    const html = `<button type="button" class="inline-roll-btn" data-kind="${escapeAttr(btn.kind)}" data-formula="${escapeAttr(formula)}" data-stat="${escapeAttr(stat)}" data-count="${escapeAttr(String(btn.count || 1))}" aria-label="${aria}">${iconHtml}${captionSpan}</button>`;
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
  const optKey = String(options?.typeLabelKey || "").trim();
  if (optKey) payload.typeLabelKey = optKey;
  const optLabel = String(options?.typeLabel || "").trim();
  if (optLabel) payload.typeLabel = optLabel;
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
              : `<textarea id="notes-area" class="notes-area" rows="14" placeholder="${t("notesPlaceholder")}" ${editable ? "" : "readonly"}>${escapeAttr(state.notesDraft ?? notes)}</textarea>`
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
  // Expose locale for CSS-only layout tweaks (avoid locale-driven reflows).
  app.dataset.locale = String(state.locale || "en");
  if (state.startupError) {
    app.innerHTML = `<main class="tab-content"><div class="card"><h2>Error</h2><p>${escapeAttr(state.startupError)}</p></div></main>`;
    return;
  }

  // Preserve scroll position per tab (e.g., closing modals should not jump).
  // In Owlbear the scroll container can be the document scrollingElement (most common),
  // not `main.tab-content`, so we track both.
  const scrollingEl = document.scrollingElement || document.documentElement;
  const prevPageTop = scrollingEl ? scrollingEl.scrollTop : 0;
  const prevWinY = typeof window !== "undefined" ? (window.scrollY || 0) : 0;
  const prevAppTop = app.scrollTop || 0;
  const prevMain = app.querySelector("main.tab-content");
  const prevMainTop = prevMain ? prevMain.scrollTop : 0;
  state._tabScrollTop[state.activeTab] = prevMainTop;
  state._pageScrollTop = prevPageTop;

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
  // Prevent background scrolling when a modal is open.
  app.classList.toggle("modal-open", !!app.querySelector(".modal:not(.hidden)"));
  applyColors();
  bindEvents();
  const scrollToTalentsNow = () => {
    const targetEl = document.getElementById("stats-talents-block");
    if (!targetEl) return false;
    const containers = [
      app.querySelector("main.tab-content"),
      app,
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    let did = false;
    for (const c of containers) {
      try {
        const cRect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
        const tRect = targetEl.getBoundingClientRect ? targetEl.getBoundingClientRect() : null;
        if (!cRect || !tRect) continue;
        const delta = tRect.top - cRect.top;
        if (!Number.isFinite(delta)) continue;
        if (typeof c.scrollTop === "number") {
          c.scrollTop = Math.max(0, c.scrollTop + delta - 8);
          did = true;
        }
      } catch (_) {}
    }
    try {
      const tRect = targetEl.getBoundingClientRect();
      if (tRect && Number.isFinite(tRect.top)) {
        window.scrollTo(0, (window.scrollY || 0) + tRect.top - 60);
        did = true;
      }
    } catch (_) {}
    return did;
  };

  const scrollToInventoryItemNow = () => {
    const id = String(state._scrollToInventoryItemId || "").trim();
    if (!id) return false;
    const targetEl = document.getElementById(`inv-item-${id}`);
    if (!targetEl) return false;
    const containers = [
      app.querySelector("main.tab-content"),
      app,
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    let did = false;
    for (const c of containers) {
      try {
        const cRect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
        const tRect = targetEl.getBoundingClientRect ? targetEl.getBoundingClientRect() : null;
        if (!cRect || !tRect) continue;
        const delta = tRect.top - cRect.top;
        if (!Number.isFinite(delta)) continue;
        if (typeof c.scrollTop === "number") {
          c.scrollTop = Math.max(0, c.scrollTop + delta - 8);
          did = true;
        }
      } catch (_) {}
    }
    try {
      const tRect = targetEl.getBoundingClientRect();
      if (tRect && Number.isFinite(tRect.top)) {
        window.scrollTo(0, (window.scrollY || 0) + tRect.top - 60);
        did = true;
      }
    } catch (_) {}
    return did;
  };

  const scrollToCurrencyBlockNow = () => {
    const targetEl = document.getElementById("inv-currency-block");
    if (!targetEl) return false;
    const containers = [
      app.querySelector("main.tab-content"),
      app,
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    let did = false;
    for (const c of containers) {
      try {
        const cRect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
        const tRect = targetEl.getBoundingClientRect ? targetEl.getBoundingClientRect() : null;
        if (!cRect || !tRect) continue;
        const delta = tRect.top - cRect.top;
        if (!Number.isFinite(delta)) continue;
        if (typeof c.scrollTop === "number") {
          c.scrollTop = Math.max(0, c.scrollTop + delta - 8);
          did = true;
        }
      } catch (_) {}
    }
    try {
      const tRect = targetEl.getBoundingClientRect();
      if (tRect && Number.isFinite(tRect.top)) {
        window.scrollTo(0, (window.scrollY || 0) + tRect.top - 60);
        did = true;
      }
    } catch (_) {}
    return did;
  };

  const scrollToInvSectionNow = (sectionKey) => {
    const key = String(sectionKey || "").trim();
    if (!key) return false;
    const targetEl = document.getElementById(`inv-sec-${key}`);
    if (!targetEl) return false;
    const containers = [
      app.querySelector("main.tab-content"),
      app,
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    let did = false;
    for (const c of containers) {
      try {
        const cRect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
        const tRect = targetEl.getBoundingClientRect ? targetEl.getBoundingClientRect() : null;
        if (!cRect || !tRect) continue;
        const delta = tRect.top - cRect.top;
        if (!Number.isFinite(delta)) continue;
        if (typeof c.scrollTop === "number") {
          c.scrollTop = Math.max(0, c.scrollTop + delta - 8);
          did = true;
        }
      } catch (_) {}
    }
    try {
      const tRect = targetEl.getBoundingClientRect();
      if (tRect && Number.isFinite(tRect.top)) {
        window.scrollTo(0, (window.scrollY || 0) + tRect.top - 60);
        did = true;
      }
    } catch (_) {}
    return did;
  };

  const shouldScrollToTalents = state.activeTab === "stats" && state._scrollToTalents;
  if (shouldScrollToTalents) {
    state._scrollToTalents = false;
    requestAnimationFrame(() => {
      scrollToTalentsNow();
      requestAnimationFrame(scrollToTalentsNow);
      setTimeout(scrollToTalentsNow, 0);
      setTimeout(scrollToTalentsNow, 30);
    });
  }
  const shouldScrollToInvItem = state.activeTab === "inventory" && !!state._scrollToInventoryItemId;
  if (shouldScrollToInvItem) {
    const id = state._scrollToInventoryItemId;
    // Clear only after a successful scroll, so subsequent renders can still try.
    requestAnimationFrame(() => {
      const did = scrollToInventoryItemNow();
      requestAnimationFrame(scrollToInventoryItemNow);
      setTimeout(scrollToInventoryItemNow, 0);
      setTimeout(() => {
        // Important: only clear the scroll request if it hasn't been replaced
        // by a newer click since we scheduled this RAF/timeout chain.
        if (state._scrollToInventoryItemId !== id) return;
        if (did) state._scrollToInventoryItemId = "";
        else state._scrollToInventoryItemId = id;
      }, 40);
    });
  }
  const shouldScrollToCurrency = state.activeTab === "inventory" && !!state._scrollToCurrencyBlock;
  if (shouldScrollToCurrency) {
    state._scrollToCurrencyBlock = false;
    requestAnimationFrame(() => {
      scrollToCurrencyBlockNow();
      requestAnimationFrame(scrollToCurrencyBlockNow);
      setTimeout(scrollToCurrencyBlockNow, 0);
      setTimeout(scrollToCurrencyBlockNow, 30);
    });
  }
  const shouldScrollToInvSection = state.activeTab === "inventory" && !!state._scrollToInvSectionKey;
  if (shouldScrollToInvSection) {
    const key = String(state._scrollToInvSectionKey || "");
    state._scrollToInvSectionKey = "";
    requestAnimationFrame(() => {
      scrollToInvSectionNow(key);
      requestAnimationFrame(() => scrollToInvSectionNow(key));
      setTimeout(() => scrollToInvSectionNow(key), 0);
      setTimeout(() => scrollToInvSectionNow(key), 30);
    });
  }
  if (state.activeTab !== "chat") {
    if (shouldScrollToTalents) return;
    // If we explicitly requested a scroll-to-item, don't restore the previous scroll position
    // on this render; that restoration can race and undo the scroll, making it feel like a
    // "double click" is required.
    if (shouldScrollToInvItem || shouldScrollToCurrency || shouldScrollToInvSection) return;
    const target = Math.max(0, Number(state._tabScrollTop[state.activeTab]) || 0);
    const pageTarget = Math.max(0, Number(state._pageScrollTop) || 0);
    const restore = () => {
      const nextMain = app.querySelector("main.tab-content");
      if (nextMain) nextMain.scrollTop = target;
      const se = document.scrollingElement || document.documentElement;
      if (se) se.scrollTop = pageTarget;
      app.scrollTop = prevAppTop;
      // Some embeds only honor window scrolling.
      try { window.scrollTo(0, prevWinY); } catch (_) {}
    };
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
      requestAnimationFrame(restore);
    });
    setTimeout(restore, 0);
  }
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

/** Parse integer from stats stepper pill input (+/- allowed when data-signed=1). */
function parseStatsStepperRawInput(raw, wrap) {
  const s = String(raw ?? "").trim();
  if (s === "") return 0;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clampIntForStepperWrap(n, wrap) {
  let out = Number(n);
  if (!Number.isFinite(out)) out = 0;
  out = Math.trunc(out);
  const minRaw = wrap?.getAttribute("data-min");
  const maxRaw = wrap?.getAttribute("data-max");
  const allowNeg = wrap?.getAttribute("data-allow-negative") === "1";
  if (!allowNeg) out = Math.max(0, out);
  const min = minRaw == null ? null : Number(minRaw);
  const max = maxRaw == null ? null : Number(maxRaw);
  if (Number.isFinite(min)) out = Math.max(min, out);
  if (Number.isFinite(max)) out = Math.min(max, out);
  return out;
}

function bindEvents() {
  const app = document.getElementById(ROOT_ID);
  if (!app) return;

  if (!app.dataset.outsideClickBound) {
    app.addEventListener("click", (e) => {
      if (state.sheetMenuOpen) {
        const picker = e.target.closest(".header-top .sheet-picker");
        if (!picker) {
          state.sheetMenuOpen = false;
          render();
        }
      }
      if (state.spellRemoveMenuOpen) {
        const rmPicker = e.target.closest(".spell-remove-picker");
        if (!rmPicker) {
          state.spellRemoveMenuOpen = false;
          render();
        }
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

  // Spells reorder (event delegated; survives re-render; works without HTML5 DnD)
  if (!app.dataset.spellReorderBound) {
    const beginDrag = (clientX, clientY, handleEl) => {
      if (!canEdit(state.activeSheetId)) return;
      if (state.activeTab !== "spells") return;
      const item = handleEl.closest(".spell-item-wrap");
      const list = item?.closest(".spell-list");
      if (!item || !list) return;
      const spellId = item.dataset.spellId;
      if (!spellId) return;

      const rect = item.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      const ghost = item.cloneNode(true);
      ghost.classList.add("spell-drag-ghost");
      ghost.style.width = rect.width + "px";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      document.body.appendChild(ghost);

      const ph = document.createElement("div");
      ph.className = "spell-drag-placeholder";
      ph.style.height = rect.height + "px";
      ph.style.borderRadius = getComputedStyle(item).borderRadius;

      item.classList.add("dragging");
      list.classList.add("dragging-active");
      item.replaceWith(ph);

      spellReorderDrag = {
        list,
        item,
        placeholder: ph,
        ghost,
        offsetY,
      };
    };

    const moveDrag = (clientX, clientY) => {
      const d = spellReorderDrag;
      if (!d) return;
      d.ghost.style.top = Math.round(clientY - d.offsetY) + "px";

      const elAtPoint = document.elementFromPoint(clientX, clientY);
      const over = elAtPoint?.closest?.(".spell-item-wrap, .spell-drag-placeholder");
      if (!over) return;
      if (over === d.placeholder) return;
      const overItem = over.classList.contains("spell-item-wrap") ? over : null;
      if (!overItem) return;

      const r = overItem.getBoundingClientRect();
      const before = clientY < r.top + r.height / 2;
      d.list.insertBefore(d.placeholder, before ? overItem : overItem.nextSibling);
    };

    const endDrag = async (persist = true) => {
      const d = spellReorderDrag;
      if (!d) return;
      d.ghost.remove();
      d.placeholder.replaceWith(d.item);
      d.item.classList.remove("dragging");
      d.list.classList.remove("dragging-active");
      spellReorderDrag = null;

      if (!persist || !state.sheet || !state.roomId || !state.activeSheetId) {
        render();
        return;
      }
      const orderedIds = Array.from(d.list.querySelectorAll(".spell-item-wrap"))
        .map((el) => el.dataset.spellId)
        .filter(Boolean);
      const next = applyLocalMutation((sheet) => {
        const map = new Map((sheet.spells || []).map((sp) => [String(sp.id), sp]));
        sheet.spells = orderedIds.map((id) => map.get(String(id))).filter(Boolean);
      });
      if (next?.spells?.length) {
        try {
          // Persist *all* positions immediately on drop to avoid duplicates.
          await storage.setSpellPositions(state.roomId, state.activeSheetId, next.spells.map((s) => s.id));
        } catch (err) {
          console.error(err);
          const msg = err?.message || err?.details || String(err);
          try { OBR.notification.show(`Spell reorder save failed: ${msg}`); } catch (_) {}
        }
      }
      render();
    };

    // Mouse
    app.addEventListener("mousedown", (e) => {
      const handle = e.target.closest?.("[data-spell-handle]");
      if (!handle) return;
      e.preventDefault();
      beginDrag(e.clientX, e.clientY, handle);
    });
    document.addEventListener("mousemove", (e) => {
      if (!spellReorderDrag) return;
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }, { passive: false });
    document.addEventListener("mouseup", (e) => {
      if (!spellReorderDrag) return;
      e.preventDefault();
      endDrag(true);
    }, { passive: false });

    // Touch
    app.addEventListener("touchstart", (e) => {
      const handle = e.target.closest?.("[data-spell-handle]");
      if (!handle) return;
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      beginDrag(t.clientX, t.clientY, handle);
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
      if (!spellReorderDrag) return;
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener("touchend", (e) => {
      if (!spellReorderDrag) return;
      e.preventDefault();
      endDrag(true);
    }, { passive: false });
    document.addEventListener("touchcancel", () => {
      if (!spellReorderDrag) return;
      endDrag(false);
    }, { passive: true });

    // Escape to cancel
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!spellReorderDrag) return;
      endDrag(false);
    });

    app.dataset.spellReorderBound = "true";
  }

  // Inventory reorder (event delegated; similar to spells)
  if (!app.dataset.invReorderBound) {
    const beginDrag = (clientX, clientY, handleEl) => {
      if (!canEdit(state.activeSheetId)) return;
      if (state.activeTab !== "inventory") return;
      const item = handleEl.closest(".inv-item-wrap");
      const list = item?.closest(".inv-list");
      if (!item || !list) return;
      const itemId = item.dataset.invItemId;
      const section = item.dataset.invSection;
      if (!itemId || !section) return;

      const rect = item.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      const ghost = item.cloneNode(true);
      ghost.classList.add("spell-drag-ghost");
      ghost.style.width = rect.width + "px";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      document.body.appendChild(ghost);

      const ph = document.createElement("div");
      ph.className = "spell-drag-placeholder";
      ph.style.height = rect.height + "px";
      ph.style.borderRadius = getComputedStyle(item).borderRadius;

      item.classList.add("dragging");
      list.classList.add("dragging-active");
      item.replaceWith(ph);

      invReorderDrag = { list, item, placeholder: ph, ghost, offsetY, section };
    };

    const moveDrag = (clientX, clientY) => {
      const d = invReorderDrag;
      if (!d) return;
      d.ghost.style.top = Math.round(clientY - d.offsetY) + "px";
      const elAtPoint = document.elementFromPoint(clientX, clientY);
      const over = elAtPoint?.closest?.(".inv-item-wrap, .spell-drag-placeholder");
      if (!over) return;
      if (over === d.placeholder) return;
      const overItem = over.classList.contains("inv-item-wrap") ? over : null;
      if (!overItem) return;
      const r = overItem.getBoundingClientRect();
      const before = clientY < r.top + r.height / 2;
      d.list.insertBefore(d.placeholder, before ? overItem : overItem.nextSibling);
    };

    const endDrag = async (persist = true) => {
      const d = invReorderDrag;
      if (!d) return;
      d.ghost.remove();
      d.placeholder.replaceWith(d.item);
      d.item.classList.remove("dragging");
      d.list.classList.remove("dragging-active");
      invReorderDrag = null;

      if (!persist || !state.sheet || !state.roomId || !state.activeSheetId) {
        render();
        return;
      }
      const orderedIds = Array.from(d.list.querySelectorAll(".inv-item-wrap"))
        .map((el) => el.dataset.invItemId)
        .filter(Boolean);
      const section = d.section;
      const next = applyLocalMutation((sheet) => {
        const arr = sheet[section] || [];
        const map = new Map(arr.map((it) => [String(it.id), it]));
        sheet[section] = orderedIds.map((id) => map.get(String(id))).filter(Boolean);
      });
      if (next?.[section]?.length) {
        try {
          await storage.setItemPositions(state.roomId, state.activeSheetId, next[section].map((it) => it.id));
        } catch (err) {
          console.error(err);
          const msg = err?.message || err?.details || String(err);
          try { OBR.notification.show(`Item reorder save failed: ${msg}`); } catch (_) {}
        }
      }
      render();
    };

    // Mouse
    app.addEventListener("mousedown", (e) => {
      const handle = e.target.closest?.("[data-inv-handle]");
      if (!handle) return;
      e.preventDefault();
      beginDrag(e.clientX, e.clientY, handle);
    });
    document.addEventListener("mousemove", (e) => {
      if (!invReorderDrag) return;
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }, { passive: false });
    document.addEventListener("mouseup", (e) => {
      if (!invReorderDrag) return;
      e.preventDefault();
      endDrag(true);
    }, { passive: false });

    // Touch
    app.addEventListener("touchstart", (e) => {
      const handle = e.target.closest?.("[data-inv-handle]");
      if (!handle) return;
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      beginDrag(t.clientX, t.clientY, handle);
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
      if (!invReorderDrag) return;
      const t = e.touches?.[0];
      if (!t) return;
      e.preventDefault();
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener("touchend", (e) => {
      if (!invReorderDrag) return;
      e.preventDefault();
      endDrag(true);
    }, { passive: false });
    document.addEventListener("touchcancel", () => {
      if (!invReorderDrag) return;
      endDrag(false);
    }, { passive: true });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!invReorderDrag) return;
      endDrag(false);
    });

    app.dataset.invReorderBound = "true";
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
      finalizeNotesEditIfOpen();
      finalizeSpellEditIfOpen();
      state.sheetMenuOpen = false;
      state.spellRemoveModalOpen = false;
      state.spellRemoveMenuOpen = false;
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
      finalizeNotesEditIfOpen();
      finalizeSpellEditIfOpen();
      state.spellRemoveModalOpen = false;
      state.spellRemoveMenuOpen = false;
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

  // Stats steppers (sheet core + stat base/passive)
  app.querySelectorAll("[data-stepper-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const key = btn.getAttribute("data-stepper-step") || "";
      const delta = Number(btn.getAttribute("data-delta"));
      if (!key || !Number.isFinite(delta) || delta === 0) return;
      const wrap = app.querySelector(`[data-stepper="${CSS.escape(key)}"]`);
      if (!wrap) return;
      const applyClamp = (v) => clampIntForStepperWrap(v, wrap);

      // Stat fields: stat:<id>:base|passive
      if (key.startsWith("stat:")) {
        const parts = key.split(":");
        const statId = parts[1];
        const field = parts[2];
        if (!statId || !field) return;
        const next = applyLocalMutation((sheet) => {
          if (!sheet.stats) sheet.stats = {};
          if (!sheet.stats[statId]) sheet.stats[statId] = { base: 5, xpBonus: 0, itemBonus: 0, passiveBonus: 0 };
          const cur = Number(sheet.stats[statId][field === "base" ? "base" : "passiveBonus"]) || 0;
          const nxt = applyClamp(cur + delta);
          if (field === "base") sheet.stats[statId].base = nxt;
          else sheet.stats[statId].passiveBonus = nxt;
        });
        scheduleDebouncedSave(`stat_${statId}_${field}`, 450, () => {
          const st = next?.stats?.[statId];
          if (!st) return;
          storage.updateStat(state.roomId, state.activeSheetId, statId, {
            base: st.base,
            passiveBonus: st.passiveBonus,
          }).catch(console.error);
        });
        render();
        return;
      }

      // Sheet core steppers
      const next = applyLocalMutation((sheet) => {
        const cur = Number(sheet[key]) || 0;
        sheet[key] = applyClamp(cur + delta);
      });
      scheduleDebouncedSave(`sheet_${key}`, 450, () => {
        storage.updateSheetCore(state.roomId, state.activeSheetId, { [key]: next?.[key] }).catch(console.error);
      });
      render();
    });
  });

  if (!app.dataset.statsStepperBlurBound) {
    app.addEventListener("focusout", (e) => {
      const inp = e.target;
      if (!inp || inp.tagName !== "INPUT" || !inp.getAttribute("data-stepper-input")) return;
      if (!app.contains(inp)) return;
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      if (inp.readOnly || inp.disabled) return;
      const key = inp.getAttribute("data-stepper-input") || "";
      const wrap = inp.closest("[data-stepper]");
      if (!key || !wrap) return;
      const parsed = parseStatsStepperRawInput(inp.value, wrap);
      if (parsed === null) {
        render();
        return;
      }
      const nxt = clampIntForStepperWrap(parsed, wrap);
      if (key.startsWith("stat:")) {
        const parts = key.split(":");
        const statId = parts[1];
        const field = parts[2];
        if (!statId || !field) return;
        const cur = Number(state.sheet.stats?.[statId]?.[field === "base" ? "base" : "passiveBonus"]) || 0;
        if (nxt !== cur) {
          const next = applyLocalMutation((sheet) => {
            if (!sheet.stats) sheet.stats = {};
            if (!sheet.stats[statId]) sheet.stats[statId] = { base: 5, xpBonus: 0, itemBonus: 0, passiveBonus: 0 };
            if (field === "base") sheet.stats[statId].base = nxt;
            else sheet.stats[statId].passiveBonus = nxt;
          });
          scheduleDebouncedSave(`stat_${statId}_${field}`, 450, () => {
            const st = next?.stats?.[statId];
            if (!st) return;
            storage.updateStat(state.roomId, state.activeSheetId, statId, {
              base: st.base,
              passiveBonus: st.passiveBonus,
            }).catch(console.error);
          });
        }
        render();
        return;
      }
      const curCore = Number(state.sheet[key]) || 0;
      if (nxt !== curCore) {
        const next = applyLocalMutation((sheet) => {
          sheet[key] = nxt;
        });
        scheduleDebouncedSave(`sheet_${key}`, 450, () => {
          storage.updateSheetCore(state.roomId, state.activeSheetId, { [key]: next?.[key] }).catch(console.error);
        });
      }
      render();
    });
    app.dataset.statsStepperBlurBound = "1";
  }

  // Speed roll button (standard roll behavior + chat message labeled as Speed)
  app.querySelector("#btn-roll-speed")?.addEventListener("click", async () => {
    if (!state.sheet || !state.roomId) return;
    const payload = { kind: "roll", formula: "1d6+agi%5+bonspe", count: 1, typeLabelKey: "speed" };
    const result = executeRoll(payload, state.sheet);
    if (!result) return;
    state.lastRoll = result;
    state.lastRollPayload = payload;
    try {
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: formatRollChatLine(result, { typeLabelKey: "speed" }),
      });
      appendChatMessageIfNew(row);
    } catch (err) {
      console.error(err);
    }
    render();
    requestAnimationFrame(() => showRollResult(result));
  });

  // Talents (stored in sheet.knowledge)
  app.querySelector("#btn-add-talent")?.addEventListener("click", async () => {
    if (!state.sheet || !state.roomId || !state.activeSheetId) return;
    if (!canEdit(state.activeSheetId)) return;
    const id = crypto.randomUUID();
    const defaultName = t("talentDefault");
    const next = applyLocalMutation((sheet) => {
      if (!sheet.knowledge) sheet.knowledge = [];
      sheet.knowledge.push({ id, name: defaultName, description: "", tier: 0, bonusOverride: null, enabled: false });
    });
    const idx = (next?.knowledge || []).findIndex((x) => String(x.id) === String(id));
    if (idx >= 0) {
      storage.upsertTalent(state.roomId, state.activeSheetId, {
        id,
        position: idx,
        name: defaultName,
        description: "",
        tier: 0,
        bonus_override: null,
        is_enabled: false,
      }).catch(console.error);
    }
    render();
  });

  app.querySelectorAll("[data-talent-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.talentEdit;
      if (!id || !state.sheet) return;
      const itemIdAttr = btn.getAttribute("data-talent-item-id") || "";
      let tl = null;
      let itemId = "";
      if (itemIdAttr) {
        const it = findItemById(state.sheet, itemIdAttr);
        if (it) {
          const arr = getItemTalentsArray(it);
          const found = arr.find((x) => String(x.id) === String(id));
          if (found) {
            tl = found;
            itemId = String(it.id);
          }
        }
      }
      if (!tl) {
        tl = (state.sheet.knowledge || []).find((x) => String(x.id) === String(id));
      }
      if (!tl) return;
      const descFull = String(tl.description || "");
      const idx = descFull.lastIndexOf("[[override]]");
      const desc = idx < 0 ? descFull : descFull.slice(0, idx).replace(/\s+$/, "");
      const overrideFromDesc = idx < 0 ? "" : descFull.slice(idx + "[[override]]".length).trim();
      state.talentModalOpen = true;
      state.talentDraft = {
        id: String(tl.id),
        name: tl.name || "",
        description: desc,
        tier: Number(tl.tier) || 0,
        bonusOverride: (tl.bonusOverride == null ? "" : String(tl.bonusOverride)) || overrideFromDesc,
        __itemId: itemId || null,
      };
      state.talentTierMenuOpen = false;
      render();
    });
  });

  const closeTalentModal = () => {
    state.talentModalOpen = false;
    state.talentDraft = null;
    state.talentTierMenuOpen = false;
    state._scrollToTalents = true;
  };

  app.querySelector("#talent-cancel")?.addEventListener("click", () => {
    closeTalentModal();
    render();
  });

  app.querySelector("#talent-save")?.addEventListener("click", async () => {
    if (!state.talentDraft || !state.sheet || !state.roomId || !state.activeSheetId) return;
    const id = String(state.talentDraft.id);
    const itemId = state.talentDraft.__itemId ? String(state.talentDraft.__itemId) : "";
    const name = String(document.getElementById("talent-name-inp")?.value || "").trim() || t("talentDefault");
    const descriptionRaw = String(document.getElementById("talent-desc-inp")?.value || "");
    const ovRaw = String(document.getElementById("talent-override-inp")?.value || "").trim();
    const tier = Math.max(0, Math.min(4, Number(state.talentDraft?.tier) || 0));
    // bonus_override is now text: store any formula string as-is.
    const bonusOverride = ovRaw || null;
    const description = descriptionRaw;

    if (itemId) {
      let talentPosition = 0;
      const next = applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        const arr = getItemTalentsArray(it);
        const ix = arr.findIndex((x) => String(x.id) === id);
        if (ix < 0) return;
        talentPosition = ix;
        const trow = arr[ix];
        trow.name = name;
        trow.description = description;
        trow.tier = tier;
        trow.bonusOverride = bonusOverride;
        if (!Array.isArray(it.talents)) {
          it.talents = [...arr];
          delete it.talent;
        }
      });
      const prevRow = getItemTalentsArray(findItemById(state.sheet, itemId) || {}).find((x) => String(x.id) === id);
      await storage.upsertItemTalent(state.roomId, itemId, {
        id,
        position: talentPosition,
        name,
        description,
        tier,
        bonus_override: bonusOverride,
        is_enabled: !!prevRow?.enabled,
      }).catch(console.error);
      void next;
      closeTalentModal();
      render();
      return;
    }

    const next = applyLocalMutation((sheet) => {
      const tl = (sheet.knowledge || []).find((x) => String(x.id) === id);
      if (!tl) return;
      tl.name = name;
      tl.description = description;
      tl.tier = tier;
      tl.bonusOverride = bonusOverride;
    });
    const pos = (next?.knowledge || []).findIndex((x) => String(x.id) === id);
    await storage.upsertTalent(state.roomId, state.activeSheetId, {
      id,
      position: Math.max(0, pos),
      name,
      description,
      tier,
      bonus_override: bonusOverride,
      is_enabled: false,
    }).catch(console.error);
    closeTalentModal();
    render();
  });

  // Talent tier menu (header-style dropdown)
  app.querySelector("#btn-talent-tier-menu")?.addEventListener("click", () => {
    state.talentTierMenuOpen = !state.talentTierMenuOpen;
    render();
  });
  app.querySelectorAll("[data-talent-tier-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = Math.max(0, Math.min(4, Number(btn.dataset.talentTierPick) || 0));
      if (!state.talentDraft) return;
      state.talentDraft.tier = n;
      state.talentTierMenuOpen = false;
      render();
    });
  });

  if (!app.dataset.talentModalEscapeBound) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!state.talentModalOpen) return;
      closeTalentModal();
      render();
    });
    app.dataset.talentModalEscapeBound = "true";
  }

  app.querySelector("#talent-delete")?.addEventListener("click", async () => {
    if (!state.talentDraft || !state.sheet || !state.roomId || !state.activeSheetId) return;
    const id = String(state.talentDraft.id);
    const itemId = state.talentDraft.__itemId ? String(state.talentDraft.__itemId) : "";
    if (!confirm(t("confirmDelete") || "Delete?")) return;
    if (itemId) {
      applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        const arr = getItemTalentsArray(it);
        const filtered = arr.filter((x) => String(x.id) !== id);
        delete it.talent;
        it.talents = filtered;
      });
      await storage.deleteItemTalent(state.roomId, id).catch(console.error);
      closeTalentModal();
      render();
      return;
    }
    const next = applyLocalMutation((sheet) => {
      sheet.knowledge = (sheet.knowledge || []).filter((x) => String(x.id) !== id);
    });
    await storage.deleteTalent(state.roomId, state.activeSheetId, id).catch(console.error);
    // Re-number positions (update-only)
    const ids = (next?.knowledge || []).map((x) => x.id);
    await Promise.all(ids.map((tid, position) => storage.updateTalentFields(state.roomId, state.activeSheetId, tid, { position }).catch(() => {})));
    closeTalentModal();
    render();
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
      const typeLabelKey = String(state.lastRollPayload?.typeLabelKey || "").trim();
      const typeLabel = String(state.lastRollPayload?.typeLabel || "").trim();
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: formatRollChatLine(result, { favorReroll: true, typeLabelKey, typeLabel }),
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
      // spell.name is NOT NULL in DB; use a safe default.
      sheet.spells.push({ id: crypto.randomUUID(), name: t("spellName"), effect: "", element: "", cost: 0, costType: "mp", isContinuous: false, useCounter: 0 });
    });
    if (state.roomId && state.activeSheetId && next) {
      const idx = next.spells.length - 1;
      const sp = next.spells[idx];
      storage.upsertSpell(state.roomId, state.activeSheetId, {
        id: sp.id,
        position: idx,
        name: sp.name || "",
        description: sp.effect || "",
        cost: sp.cost ?? 0,
        is_hp: (sp.costType || "mp") === "hp",
        is_continuous: !!sp.isContinuous,
        use_counter: sp.useCounter ?? 0,
      }).catch((err) => {
        console.error(err);
        const msg = err?.message || err?.details || String(err);
        try { OBR.notification.show(`Spell add failed: ${msg}`); } catch (_) {}
      });
    }
    render();
  });
  // Remove modal open/close
  app.querySelector("#btn-remove-spell")?.addEventListener("click", () => {
    if (!canEdit(state.activeSheetId)) return;
    finalizeSpellEditIfOpen();
    const spells = state.sheet?.spells || [];
    state.spellRemoveModalOpen = true;
    state.spellRemoveMenuOpen = false;
    state.spellRemoveSelectedId = spells.length && spells[0].id != null ? String(spells[0].id) : "";
    render();
  });
  app.querySelector("#btn-spell-remove-menu")?.addEventListener("click", () => {
    state.spellRemoveMenuOpen = !state.spellRemoveMenuOpen;
    render();
  });
  app.querySelectorAll("[data-spell-remove-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellRemovePick;
      if (!id) return;
      state.spellRemoveSelectedId = String(id);
      state.spellRemoveMenuOpen = false;
      render();
    });
  });
  app.querySelector("#spell-remove-cancel")?.addEventListener("click", () => {
    state.spellRemoveModalOpen = false;
    state.spellRemoveMenuOpen = false;
    render();
  });
  app.querySelector("#spell-remove-confirm")?.addEventListener("click", async () => {
    const id = String(state.spellRemoveSelectedId || "");
    if (!id || !state.sheet) return;
    const idx = (state.sheet.spells || []).findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return;
    const removedId = state.sheet.spells[idx]?.id;
    const next = applyLocalMutation((sheet) => {
      sheet.spells = (sheet.spells || []).filter((sp) => String(sp.id) !== String(id));
    });
    if (state.roomId && state.activeSheetId) {
      if (removedId) storage.deleteSpell(state.roomId, state.activeSheetId, removedId).catch(console.error);
      const ordered = (next?.spells || []).map((s) => s.id);
      if (ordered.length) storage.setSpellPositions(state.roomId, state.activeSheetId, ordered).catch(console.error);
    }
    state.spellRemoveModalOpen = false;
    state.spellRemoveMenuOpen = false;
    const remaining = (state.sheet?.spells || []).map((s) => String(s.id));
    state.spellRemoveSelectedId = remaining[0] || "";
    render();
  });

  // Toggle open
  app.querySelectorAll("[data-spell-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellToggle;
      if (!id) return;
      if (String(state._editingSpellId || "") === String(id)) finalizeSpellEditIfOpen();
      setSpellOpen(id, !isSpellOpen(id));
      render();
    });
  });

  // Enter edit mode
  app.querySelectorAll("[data-spell-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellEdit;
      if (!id) return;
      // Toggle edit like Notes: no DB writes until closing edit mode.
      if (String(state._editingSpellId || "") === String(id)) {
        finalizeSpellEditIfOpen();
      } else {
        finalizeSpellEditIfOpen();
        setEditingSpellId(id);
        startSpellEditDraft(id);
      }
      render();
    });
  });

  // Edit fields
  app.querySelectorAll("[data-spell-name], [data-spell-effect]").forEach((el) => {
    el.addEventListener("input", (e) => {
      const id = el.dataset.spellName ?? el.dataset.spellEffect ?? el.dataset.spellElement;
      if (!id) return;
      if (!state._spellEditDraft || String(state._spellEditDraft.id) !== String(id)) return;
      if (el.dataset.spellName !== undefined) state._spellEditDraft.name = e.target.value;
      if (el.dataset.spellEffect !== undefined) state._spellEditDraft.effect = e.target.value;
    });
  });
  app.querySelectorAll("[data-spell-name]").forEach((el) => {
    el.addEventListener("focus", () => {
      const id = el.dataset.spellName;
      if (!id) return;
      if (!state._spellEditDraft || String(state._spellEditDraft.id) !== String(id)) return;
      const cur = String(el.value ?? "");
      if (cur.trim() === t("spellName")) {
        el.value = "";
        state._spellEditDraft.name = "";
      }
    });
  });

  // Cost stepper
  app.querySelectorAll("[data-spell-cost-arrow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellCostArrow;
      const step = Number(btn.getAttribute("data-cost-delta"));
      if (!id || !Number.isFinite(step) || step === 0) return;
      if (!state._spellEditDraft || String(state._spellEditDraft.id) !== String(id)) return;
      state._spellEditDraft.cost = Math.max(0, (Number(state._spellEditDraft.cost) || 0) + step);
      render();
    });
  });

  // Cost type toggle
  app.querySelectorAll("[data-spell-cost-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellCostType;
      const nextType = btn.dataset.costType;
      if (!id || !nextType) return;
      if (!state._spellEditDraft || String(state._spellEditDraft.id) !== String(id)) return;
      state._spellEditDraft.costType = nextType === "hp" ? "hp" : "mp";
      render();
    });
  });

  // Continuous toggle
  app.querySelectorAll("[data-spell-cont]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellCont;
      if (!id) return;
      if (!state._spellEditDraft || String(state._spellEditDraft.id) !== String(id)) return;
      state._spellEditDraft.isContinuous = !state._spellEditDraft.isContinuous;
      render();
    });
  });

  // Used counter +/- (visual)
  app.querySelectorAll("[data-spell-used-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.spellUsedDelta;
      const step = Number(btn.getAttribute("data-delta"));
      if (!id || !Number.isFinite(step) || step === 0) return;
      const next = applyLocalMutation((sheet) => {
        const sp = (sheet.spells || []).find((x) => String(x.id) === String(id));
        if (!sp) return;
        sp.useCounter = Math.max(0, (Number(sp.useCounter) || 0) + step);
      });
      const sp = next?.spells?.find((x) => String(x.id) === String(id));
      if (state.roomId && state.activeSheetId && sp) {
        // Debounce DB writes so the user can spam +/- without lag.
        scheduleDebouncedSave(`spell_use_counter_${sp.id}`, 450, () => {
          storage.updateSpellFields(state.roomId, state.activeSheetId, sp.id, { use_counter: sp.useCounter ?? 0 }).catch((err) => {
            console.error(err);
            const msg = err?.message || err?.details || String(err);
            try { OBR.notification.show(`Spell counter save failed: ${msg}`); } catch (_) {}
          });
        });
      }
      render();
    });
  });

  // USE: pay resource + increment used
  app.querySelectorAll("[data-spell-use]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.spellUse;
      if (!id || !state.sheet || !state.roomId || !state.activeSheetId) return;
      const sp = (state.sheet.spells || []).find((x) => String(x.id) === String(id));
      if (!sp) return;
      const cost = Math.max(0, Number(sp.cost) || 0);
      const isMP = (sp.costType || "mp") === "mp";
      if (isMP) {
        const mp = Math.max(0, Number(state.sheet.currentMP) || 0);
        if (mp >= cost) {
          state.sheet.currentMP = mp - cost;
        } else {
          const needHP = cost - mp;
          if (needHP > 0 && !confirm(t("confirmUseHP"))) return;
          const hpAvail = Number(state.sheet.currentHP) || 0;
          if (needHP > 0 && hpAvail - needHP < 0) {
            if (!confirm(t("confirmCastBelowZeroHP"))) return;
          }
          state.sheet.currentMP = 0;
          state.sheet.currentHP = hpAvail - needHP;
        }
      } else {
        const hpAvail = Number(state.sheet.currentHP) || 0;
        if (hpAvail - cost < 0) {
          if (!confirm(t("confirmCastBelowZeroHP"))) return;
        }
        state.sheet.currentHP = hpAvail - cost;
      }
      sp.useCounter = Math.max(0, (Number(sp.useCounter) || 0) + 1);
      saveSheet();
      storage.updateSheetCore(state.roomId, state.activeSheetId, { currentHP: state.sheet.currentHP, currentMP: state.sheet.currentMP }).catch(console.error);
      storage.updateSpellFields(state.roomId, state.activeSheetId, sp.id, { use_counter: sp.useCounter ?? 0 }).catch((err) => {
        console.error(err);
        const msg = err?.message || err?.details || String(err);
        try { OBR.notification.show(`Spell counter save failed: ${msg}`); } catch (_) {}
      });
      render();
    });
  });

  // Spells reorder is handled via event delegation (bound once below).

  // Inventory: equip-slot click + tooltip via delegation (SVGs can have nested shapes).
  const equipRoot = app.querySelector(".inv-equip-wrap");
  const equipTip = document.getElementById("inv-equip-tooltip");
  if (equipRoot) {
    equipRoot.addEventListener("click", (e) => {
      const el = e.target?.closest?.("[data-equip-item]");
      if (!el || !equipRoot.contains(el)) return;
      const itemId = el.getAttribute("data-equip-item");
      if (!itemId) return;
      state._openItems[String(itemId)] = true;
      state._scrollToInventoryItemId = String(itemId);
      render();
    });
  }
  if (equipRoot && equipTip) {
    const hide = () => equipTip.classList.add("hidden");
    equipRoot.addEventListener("mouseleave", hide);
    equipRoot.addEventListener("mousemove", (e) => {
      const part = e.target?.closest?.("[data-equip-tip-slot]");
      if (!part || !equipRoot.contains(part)) {
        hide();
        return;
      }
      const slot = (part.getAttribute("data-equip-tip-slot") || "").trim();
      const item = (part.getAttribute("data-equip-tip-item") || "").trim();
      if (!slot) {
        hide();
        return;
      }
      const itemLines = item ? wrapWordsByLen(item, 20) : [];
      const itemHtml = itemLines.length
        ? `<div class="inv-equip-tip-item">${itemLines.map((ln) => `<div class="inv-equip-tip-item-line">${escapeAttr(ln)}</div>`).join("")}</div>`
        : "";
      equipTip.innerHTML = `<div class="inv-equip-tip-slot"><strong>${escapeAttr(slot)}</strong></div>${itemHtml}`;
      equipTip.classList.remove("hidden");
      const posRoot = equipTip.offsetParent || equipRoot;
      const r = posRoot.getBoundingClientRect();
      const x = (e.clientX - r.left) + 10;
      const y = (e.clientY - r.top) + 10;
      equipTip.style.left = `${Math.max(0, x)}px`;
      equipTip.style.top = `${Math.max(0, y)}px`;
      requestAnimationFrame(() => {
        if (equipTip.classList.contains("hidden")) return;
        const tr = equipTip.getBoundingClientRect();
        // Prefer staying on the side with room instead of breaking words.
        const rightSpace = r.width - x;
        const leftSpace = x;
        const need = tr.width + 8;
        const preferLeft = rightSpace < need && leftSpace >= need;
        const nextLeftRaw = preferLeft ? (x - tr.width - 8) : x;
        const maxLeft = Math.max(0, r.width - tr.width - 6);
        const maxTop = Math.max(0, r.height - tr.height - 6);
        const nextLeft = Math.max(0, Math.min(maxLeft, nextLeftRaw));
        const nextTop = Math.max(0, Math.min(maxTop, y));
        equipTip.style.left = `${nextLeft}px`;
        equipTip.style.top = `${nextTop}px`;
      });
    });
  }

  // Currency: open modals
  const snapshotCurrencyScroll = () => {
    state._currencyModalScrollSnap = getScrollSnapshot(app);
  };
  app.querySelector("#btn-currency-transfer")?.addEventListener("mousedown", snapshotCurrencyScroll);
  app.querySelector("#btn-currency-add")?.addEventListener("mousedown", snapshotCurrencyScroll);
  app.querySelector("#btn-currency-remove")?.addEventListener("mousedown", snapshotCurrencyScroll);

  const restoreCurrencyScroll = (snap) => {
    if (!snap) return;
    requestAnimationFrame(() => {
      const main = document.querySelector("#app main.tab-content");
      if (main) main.scrollTop = snap.prevMainTop;
      const se = document.scrollingElement || document.documentElement;
      if (se) se.scrollTop = snap.prevPageTop;
      try { window.scrollTo(0, snap.prevWinY); } catch (_) {}
      if (app) app.scrollTop = snap.prevAppTop;
    });
  };
  const closeCurrencyModal = () => {
    // Instead of restoring exact scroll (Owlbear can interfere), just scroll back to the
    // currency block after close.
    state.currencyModalOpen = false;
    state.currencyModalMode = "transfer";
    state.currencyRecipientMenuOpen = false;
    state.currencyRecipientSheetId = "";
    state.currencyDraft = { gold: 0, silver: 0, copper: 0 };
    state.currencyPendingAction = null;
    state._scrollToCurrencyBlock = true;
    render();
  };

  app.querySelector("#btn-currency-transfer")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const snap = state._currencyModalScrollSnap || getScrollSnapshot(app);
    state.currencyModalOpen = true;
    state.currencyModalMode = "transfer";
    state.currencyRecipientMenuOpen = false;
    state.currencyRecipientSheetId = "";
    state.currencyDraft = { gold: 0, silver: 0, copper: 0 };
    state.currencyPendingAction = null;
    state._currencyModalScrollSnap = snap;
    render();
    // Owlbear sometimes jumps to top on modal mount; force restore immediately.
    restoreCurrencyScroll(snap);
  });
  app.querySelector("#btn-currency-add")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const snap = state._currencyModalScrollSnap || getScrollSnapshot(app);
    state.currencyModalOpen = true;
    state.currencyModalMode = "add";
    state.currencyRecipientMenuOpen = false;
    state.currencyRecipientSheetId = "";
    state.currencyDraft = { gold: 0, silver: 0, copper: 0 };
    state.currencyPendingAction = null;
    state._currencyModalScrollSnap = snap;
    render();
    restoreCurrencyScroll(snap);
  });
  app.querySelector("#btn-currency-remove")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const snap = state._currencyModalScrollSnap || getScrollSnapshot(app);
    state.currencyModalOpen = true;
    state.currencyModalMode = "remove";
    state.currencyRecipientMenuOpen = false;
    state.currencyRecipientSheetId = "";
    state.currencyDraft = { gold: 0, silver: 0, copper: 0 };
    state.currencyPendingAction = null;
    state._currencyModalScrollSnap = snap;
    render();
    restoreCurrencyScroll(snap);
  });

  // Currency: modal recipient dropdown
  app.querySelector("#btn-currency-recipient-menu")?.addEventListener("click", () => {
    state.currencyRecipientMenuOpen = !state.currencyRecipientMenuOpen;
    render();
  });
  app.querySelectorAll("[data-currency-recipient-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currencyRecipientSheetId = btn.getAttribute("data-currency-recipient-pick") || "";
      state.currencyRecipientMenuOpen = false;
      render();
    });
  });

  // Currency: modal coin steppers + inputs
  app.querySelectorAll("[data-coin-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-coin-delta") || "";
      const delta = Number(btn.getAttribute("data-delta")) || 0;
      const scope = btn.getAttribute("data-coin-scope") || "draft";
      if (!kind) return;
      if (scope === "sheet") {
        if (!state.sheet || !state.roomId || !state.activeSheetId) return;
        const cur = { ...(state.sheet.currency || { gold: 0, silver: 0, copper: 0 }) };
        cur[kind] = Math.max(0, clampInt((cur[kind] ?? 0) + delta));
        applyLocalMutation((sheet) => { sheet.currency = cur; });
        scheduleDebouncedSave(`currency_${state.activeSheetId}`, 250, () => {
          storage.updateCurrency(state.roomId, state.activeSheetId, cur).catch(console.error);
        });
      } else {
        const draft = { ...(state.currencyDraft || {}) };
        draft[kind] = Math.max(0, clampInt((draft[kind] ?? 0) + delta));
        state.currencyDraft = draft;
      }
      render();
    });
  });
  app.querySelectorAll("[data-coin-input]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const kind = inp.getAttribute("data-coin-input") || "";
      const scope = inp.getAttribute("data-coin-scope") || "draft";
      if (!kind) return;
      const v = Math.max(0, clampInt(String(inp.value || "").replace(/[^\d-]/g, "")));
      if (scope === "sheet") {
        if (!state.sheet || !state.roomId || !state.activeSheetId) return;
        const cur = { ...(state.sheet.currency || { gold: 0, silver: 0, copper: 0 }) };
        cur[kind] = v;
        applyLocalMutation((sheet) => { sheet.currency = cur; });
        scheduleDebouncedSave(`currency_${state.activeSheetId}`, 250, () => {
          storage.updateCurrency(state.roomId, state.activeSheetId, cur).catch(console.error);
        });
      } else {
        const draft = { ...(state.currencyDraft || {}) };
        draft[kind] = v;
        state.currencyDraft = draft;
      }
      // Don't re-render on blur/change; it can steal the click on Save/Send.
      // The input already shows the new value; state is updated for the upcoming action.
    });
  });

  // Currency: simplify
  app.querySelector("#currency-simplify")?.addEventListener("click", () => {
    // Simplify only what you already have (wallet), then close.
    if (state.sheet && state.roomId && state.activeSheetId) {
      const cur = state.sheet.currency || { gold: 0, silver: 0, copper: 0 };
      const next = simplifyCoins(cur);
      applyLocalMutation((sheet) => { sheet.currency = next; });
      storage.updateCurrency(state.roomId, state.activeSheetId, next).catch(console.error);
    }
    closeCurrencyModal();
  });

  // Currency: cancel / esc
  app.querySelector("#currency-cancel")?.addEventListener("click", () => {
    closeCurrencyModal();
  });
  if (!app.dataset.currencyEscapeBound) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("currency-modal");
      if (!modal || modal.classList.contains("hidden") || !state.currencyModalOpen) return;
      e.preventDefault();
      closeCurrencyModal();
    });
    app.dataset.currencyEscapeBound = "1";
  }

  // Currency: save/send/confirm
  app.querySelector("#currency-save")?.addEventListener("click", async () => {
    if (!state.sheet || !state.roomId || !state.activeSheetId) return;
    const mode = String(state.currencyModalMode || "transfer");
    const readDraftInput = (kind) => {
      const el = document.getElementById(`currency-draft-${kind}`);
      if (!el) return Math.max(0, clampInt(state.currencyDraft?.[kind] ?? 0));
      return Math.max(0, clampInt(String(el.value || "").replace(/[^\d-]/g, "")));
    };
    const draft = { gold: readDraftInput("gold"), silver: readDraftInput("silver"), copper: readDraftInput("copper") };
    if (mode === "transfer") {
      const vis = getVisibleSheets().filter((id) => id !== state.activeSheetId);
      const toId = String(state.currencyRecipientSheetId || "") || (vis[0] || "");
      if (!toId) return;
      state.currencyPendingAction = { mode: "transfer", recipientSheetId: toId, draft };
      state.currencyModalMode = "confirm";
      render();
      return;
    }
    const cur = state.sheet.currency || { gold: 0, silver: 0, copper: 0 };
    if (mode === "add") {
      const next = addCoinsExact(cur, draft);
      applyLocalMutation((sheet) => { sheet.currency = next; });
      storage.updateCurrency(state.roomId, state.activeSheetId, next).catch(console.error);
        closeCurrencyModal();
      return;
    }
    if (mode === "remove") {
      const curTotal = coinsToCopper(cur);
      const deltaTotal = coinsToCopper(draft);
      if (deltaTotal > curTotal) {
        try { OBR.notification.show(t("notEnoughMoney") || "Not enough money"); } catch (_) {}
        return;
      }
      const next = subCoinsWithBorrow(cur, draft);
      if (!next) {
        try { OBR.notification.show(t("notEnoughMoney") || "Not enough money"); } catch (_) {}
        return;
      }
      applyLocalMutation((sheet) => { sheet.currency = next; });
      storage.updateCurrency(state.roomId, state.activeSheetId, next).catch(console.error);
      closeCurrencyModal();
    }
  });

  app.querySelector("#currency-confirm-send")?.addEventListener("click", async () => {
    if (!state.sheet || !state.roomId || !state.activeSheetId) return;
    const pending = state.currencyPendingAction;
    if (!pending || pending.mode !== "transfer") return;
    const toId = String(pending.recipientSheetId || "");
    const amt = pending.draft || { gold: 0, silver: 0, copper: 0 };
    const cur = state.sheet.currency || { gold: 0, silver: 0, copper: 0 };
    const curTotal = coinsToCopper(cur);
    const sendTotal = coinsToCopper(amt);
    if (!toId || sendTotal <= 0) return;
    if (sendTotal > curTotal) {
      try { OBR.notification.show(t("notEnoughMoney") || "Not enough money"); } catch (_) {}
      return;
    }
    const nextSender = subCoinsWithBorrow(cur, amt);
    if (!nextSender) {
      try { OBR.notification.show(t("notEnoughMoney") || "Not enough money"); } catch (_) {}
      return;
    }
    applyLocalMutation((sheet) => { sheet.currency = nextSender; });
    storage.updateCurrency(state.roomId, state.activeSheetId, nextSender).catch(console.error);
    // Recipient update: best-effort read from local cache if loaded.
    try {
      const recipSheet = await storage.getSheet(state.roomId, toId, { forceRefresh: true });
      const recipCur = recipSheet?.currency || { gold: 0, silver: 0, copper: 0 };
      const nextRecip = addCoinsExact(recipCur, amt);
      storage.updateCurrency(state.roomId, toId, nextRecip).catch(console.error);
    } catch (err) {
      console.error(err);
    }
    // Chat line
    try {
      const toName = resolveCharacterDisplayName(toId);
      const fromName = resolveCharacterDisplayName(state.activeSheetId);
      const line = `${fromName} ${t("gave") || "gave"} ${amt.gold} ${t("goldCoin") || "gold"} ${amt.silver} ${t("silverCoin") || "silver"} ${amt.copper} ${t("copperCoin") || "copper"} ${t("to") || "to"} ${toName}`.trim();
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: line,
      });
      appendChatMessageIfNew(row);
    } catch (err) {
      console.error(err);
    }
    state.currencyModalOpen = false;
    state.currencyModalMode = "transfer";
    state.currencyPendingAction = null;
    closeCurrencyModal();
  });

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

  // Inventory items: open/close
  app.querySelectorAll("[data-inv-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inv-toggle") || "";
      if (!id) return;
      const editingId = state._editingItemId ? String(state._editingItemId) : "";
      const isEditingThis = editingId && editingId === String(id);
      const isEditingOther = editingId && editingId !== String(id);
      const isCurrentlyOpen = !!state._openItems?.[id];
      // Rule: toggling another item exits edit mode; toggling the edited item only exits on collapse.
      if (isEditingOther || (isEditingThis && isCurrentlyOpen)) {
        const id0 = editingId;
        const draft0 = state._itemEditDraft;
        if (id0 && draft0) {
          const next0 = applyLocalMutation((sheet) => {
            const it0 = findItemById(sheet, id0);
            if (!it0) return;
            it0.name = draft0.name || "";
            it0.description = draft0.description || "";
          });
          if (state.roomId && state.activeSheetId && next0) {
            const it0 = findItemById(next0, id0);
            if (it0) storage.updateItemFields(state.roomId, state.activeSheetId, id0, { name: it0.name || "", description: it0.description || "" }).catch(console.error);
          }
          state._editingItemId = null;
          state._itemEditDraft = null;
        }
      }
      state._openItems[id] = !state._openItems[id];
      render();
    });
  });

  // Inventory items: edit toggle (enter/exit edit mode, persist on exit)
  app.querySelectorAll("[data-inv-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inv-edit") || "";
      if (!id || !state.sheet || !canEdit(state.activeSheetId)) return;
      // Switching to another edit target should save+close the previous one.
      if (state._editingItemId && state._itemEditDraft && state._editingItemId !== id) {
        const id0 = String(state._editingItemId);
        const draft0 = state._itemEditDraft;
        const next0 = applyLocalMutation((sheet) => {
          const it0 = findItemById(sheet, id0);
          if (!it0) return;
          it0.name = draft0.name || "";
          it0.description = draft0.description || "";
        });
        if (state.roomId && state.activeSheetId && next0) {
          const it0 = findItemById(next0, id0);
          if (it0) storage.updateItemFields(state.roomId, state.activeSheetId, id0, { name: it0.name || "", description: it0.description || "" }).catch(console.error);
        }
        state._editingItemId = null;
        state._itemEditDraft = null;
      }
      if (state._editingItemId === id && state._itemEditDraft) {
        const draft = state._itemEditDraft;
        const wrap = document.querySelector(`.inv-item-wrap[data-inv-item-id="${CSS.escape(id)}"]`);
        const section = wrap?.getAttribute("data-inv-section") || "";
        const next = applyLocalMutation((sheet) => {
          const it = findItemById(sheet, id);
          if (!it) return;
          it.name = draft.name || "";
          it.description = draft.description || "";
        });
        if (state.roomId && state.activeSheetId && next) {
          const it = findItemById(next, id);
          if (it) storage.updateItemFields(state.roomId, state.activeSheetId, id, { name: it.name || "", description: it.description || "" }).catch(console.error);
        }
        state._editingItemId = null;
        state._itemEditDraft = null;
        render();
        return;
      }
      const it = findItemById(state.sheet, id);
      if (!it) return;
      state._editingItemId = id;
      state._itemEditDraft = { id, name: it.name || "", description: it.description || "" };
      render();
      requestAnimationFrame(() => {
        document.querySelector(`[data-inv-item-name="${CSS.escape(id)}"]`)?.focus();
      });
    });
  });

  app.querySelectorAll("[data-inv-item-name]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const id = inp.getAttribute("data-inv-item-name") || "";
      if (!id || !state._itemEditDraft || state._itemEditDraft.id !== id) return;
      state._itemEditDraft.name = String(inp.value || "");
    });
  });
  app.querySelectorAll("[data-inv-item-desc]").forEach((ta) => {
    ta.addEventListener("input", () => {
      const id = ta.getAttribute("data-inv-item-desc") || "";
      if (!id || !state._itemEditDraft || state._itemEditDraft.id !== id) return;
      state._itemEditDraft.description = String(ta.value || "");
    });
  });

  // Inventory items: quantity counter
  app.querySelectorAll("[data-inv-qty-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const id = btn.getAttribute("data-inv-qty-delta") || "";
      const delta = Number(btn.getAttribute("data-delta")) || 0;
      if (!id) return;
      const next = applyLocalMutation((sheet) => {
        const it = findItemById(sheet, id);
        if (!it) return;
        const cur = Math.max(0, clampInt(it.count ?? 1));
        it.count = Math.max(0, cur + delta);
      });
      if (next) {
        const it = findItemById(next, id);
        if (it) storage.updateItemFields(state.roomId, state.activeSheetId, id, { quantity: Math.max(0, clampInt(it.count ?? 0)) }).catch(console.error);
      }
      render();
    });
  });

  // Inventory items: quantity input (typeable even outside edit mode)
  app.querySelectorAll("[data-inv-qty-input]").forEach((inp) => {
    inp.addEventListener("change", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const id = inp.getAttribute("data-inv-qty-input") || "";
      if (!id) return;
      const v = Math.max(0, clampInt(String(inp.value || "").replace(/[^\d-]/g, "")));
      const next = applyLocalMutation((sheet) => {
        const it = findItemById(sheet, id);
        if (!it) return;
        it.count = v;
      });
      if (next) {
        storage.updateItemFields(state.roomId, state.activeSheetId, id, { quantity: v }).catch(console.error);
      }
      render();
    });
  });

  // Inventory items: weapon/armor stat steppers (same control pattern as Stats tab)
  app.querySelectorAll("[data-inv-item-stat-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      if (btn.disabled) return;
      const key = btn.getAttribute("data-inv-item-stat-delta") || "";
      const delta = Number(btn.getAttribute("data-delta"));
      if (!key || !Number.isFinite(delta) || delta === 0) return;
      const wrap = app.querySelector(`[data-inv-item-stat-wrap="${CSS.escape(key)}"]`);
      if (!wrap) return;
      const m = key.match(/^invitem\|([^|]+)\|(.+)$/);
      if (!m) return;
      const itemId = m[1];
      const field = m[2];
      const applyClamp = (v) => clampIntForStepperWrap(v, wrap);
      const next = applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        if (field === "physical_defense") it.defense = applyClamp((it.defense ?? 0) + delta);
        else if (field === "magical_defense") it.magicalDefense = applyClamp((it.magicalDefense ?? 0) + delta);
        else it[field] = applyClamp((it[field] ?? 0) + delta);
      });
      scheduleDebouncedSave(`inv_item_${itemId}_${field}`, 450, () => {
        const it = findItemById(state.sheet, itemId);
        if (!it) return;
        const patch = {};
        if (field === "physical_defense") patch.physical_defense = clampInt(it.defense ?? 0);
        else if (field === "magical_defense") patch.magical_defense = clampInt(it.magicalDefense ?? 0);
        else patch[field] = clampInt(it[field] ?? 0);
        storage.updateItemFields(state.roomId, state.activeSheetId, itemId, patch).catch(console.error);
      });
      render();
    });
  });

  if (!app.dataset.invItemStatBlurBound) {
    app.addEventListener("focusout", (e) => {
      const inp = e.target;
      if (!inp || inp.tagName !== "INPUT" || !inp.getAttribute("data-inv-item-stat-input")) return;
      if (!app.contains(inp)) return;
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      if (inp.readOnly || inp.disabled) return;
      const key = inp.getAttribute("data-inv-item-stat-input") || "";
      const wrap = inp.closest("[data-inv-item-stat-wrap]");
      if (!key || !wrap) return;
      const m = key.match(/^invitem\|([^|]+)\|(.+)$/);
      if (!m) return;
      const itemId = m[1];
      const field = m[2];
      const parsed = parseStatsStepperRawInput(inp.value, wrap);
      if (parsed === null) {
        render();
        return;
      }
      const nxt = clampIntForStepperWrap(parsed, wrap);
      const curIt = findItemById(state.sheet, itemId);
      if (!curIt) return;
      const cur =
        field === "physical_defense"
          ? Number(curIt.defense) || 0
          : field === "magical_defense"
            ? Number(curIt.magicalDefense) || 0
            : Number(curIt[field]) || 0;
      if (nxt === cur) {
        render();
        return;
      }
      applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        if (field === "physical_defense") it.defense = nxt;
        else if (field === "magical_defense") it.magicalDefense = nxt;
        else it[field] = nxt;
      });
      scheduleDebouncedSave(`inv_item_${itemId}_${field}`, 450, () => {
        const it = findItemById(state.sheet, itemId);
        if (!it) return;
        const patch = {};
        if (field === "physical_defense") patch.physical_defense = clampInt(it.defense ?? 0);
        else if (field === "magical_defense") patch.magical_defense = clampInt(it.magicalDefense ?? 0);
        else patch[field] = clampInt(it[field] ?? 0);
        storage.updateItemFields(state.roomId, state.activeSheetId, itemId, patch).catch(console.error);
      });
      render();
    });
    app.dataset.invItemStatBlurBound = "1";
  }

  // Inventory items: slots dropdown/menu
  app.querySelectorAll("[data-inv-slot-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inv-slot-menu") || "";
      state.invSlotMenuOpenFor = state.invSlotMenuOpenFor === id ? "" : id;
      render();
    });
  });
  app.querySelectorAll("[data-inv-slot-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      if (btn.disabled) return;
      const ownerId = btn.getAttribute("data-inv-slot-pick") || "";
      const slotsJson = btn.getAttribute("data-slot-json") || "[]";
      let chosenSlots = [];
      try { chosenSlots = JSON.parse(slotsJson); } catch (_) { chosenSlots = []; }
      if (!Array.isArray(chosenSlots)) chosenSlots = [];
      const chosenCanon = new Set(
        chosenSlots.map((sl) => canonizeSlotToken(sl) || "").filter(Boolean).filter((c) => c !== "other"),
      );
      const dirtyIds = new Set();
      const next = applyLocalMutation((sheet) => {
        if (!findItemById(sheet, ownerId)) return;
        const all = [
          ...(sheet.consumables || []),
          ...(sheet.weapons || []),
          ...(sheet.armor || []),
          ...(sheet.others || []),
          ...(sheet.bags || []),
        ];
        all.forEach((oit) => {
          if (!oit || String(oit.id) === String(ownerId)) return;
          const arr = oit?.usedSlots?.equippedSlots;
          if (!Array.isArray(arr) || !arr.length) return;
          const filtered = arr.filter((raw) => {
            const c = canonizeSlotToken(raw);
            if (!c) return true;
            if (c === "other") return true;
            return !chosenCanon.has(c);
          });
          if (filtered.length === arr.length) return;
          oit.usedSlots = filtered.length ? { equippedSlots: filtered } : null;
          dirtyIds.add(oit.id);
        });
        const it = findItemById(sheet, ownerId);
        if (!it) return;
        it.usedSlots = chosenSlots.length ? { equippedSlots: chosenSlots } : null;
        dirtyIds.add(ownerId);
        rebuildSheetEquippedFromUsedSlots(sheet);
      });
      if (next) {
        dirtyIds.forEach((iid) => {
          const it = findItemById(next, iid);
          if (!it) return;
          storage.updateItemFields(state.roomId, state.activeSheetId, iid, { used_slots: packItemUsedSlotsForDb(it) }).catch(console.error);
        });
      }
      state.invSlotMenuOpenFor = "";
      render();
    });
  });
  app.querySelectorAll("[data-inv-slot-expr]").forEach((inp) => {
    inp.addEventListener("change", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const id = inp.getAttribute("data-inv-slot-expr") || "";
      const expr = String(inp.value || "").trim();
      const usable = expr ? { expr } : null;
      const next = applyLocalMutation((sheet) => {
        const it = findItemById(sheet, id);
        if (!it) return;
        it.equippableExpr = expr;
      });
      storage.updateItemFields(state.roomId, state.activeSheetId, id, { usable_slots: usable }).catch(console.error);
      render();
    });
  });

  // Item-bound talent controls (weapon/armor expanded card)
  app.querySelectorAll("[data-inv-item-talent-add]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const itemId = btn.getAttribute("data-inv-item-talent-add") || "";
      if (!itemId) return;
      const it = findItemById(state.sheet, itemId);
      if (!it) return;
      const talentId = crypto.randomUUID();
      const defaultName = t("talentDefault") || "Talent";
      const draft = { id: talentId, name: defaultName, description: "", tier: 0, bonusOverride: null, enabled: false };
      let position = 0;
      applyLocalMutation((sheet) => {
        const x = findItemById(sheet, itemId);
        if (!x) return;
        const arr = [];
        if (Array.isArray(x.talents)) arr.push(...x.talents);
        else if (x.talent) arr.push(x.talent);
        delete x.talent;
        position = arr.length;
        arr.push({ ...draft });
        x.talents = arr;
      });
      await storage.upsertItemTalent(state.roomId, itemId, {
        id: talentId,
        position,
        name: defaultName,
        description: "",
        tier: 0,
        bonus_override: null,
        is_enabled: false,
      }).catch(console.error);
      render();
    });
  });

  app.querySelectorAll("[data-inv-item-talent-name]").forEach((inp) => {
    const saveNameToDb = () => {
      if (!state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const talentId = inp.getAttribute("data-inv-talent-id") || "";
      if (!talentId) return;
      const name = String(inp.value || "").trim() || (t("talentDefault") || "Talent");
      storage.updateItemTalentFields(state.roomId, talentId, { name }).catch(console.error);
    };
    inp.addEventListener("input", () => {
      const itemId = inp.getAttribute("data-inv-item-talent-name") || "";
      const talentId = inp.getAttribute("data-inv-talent-id") || "";
      const name = String(inp.value || "").trim() || (t("talentDefault") || "Talent");
      applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        const arr = getItemTalentsArray(it);
        const trow = arr.find((x) => String(x.id) === talentId);
        if (!trow) return;
        trow.name = name;
        if (!Array.isArray(it.talents)) {
          it.talents = [...arr];
          delete it.talent;
        }
      });
      scheduleDebouncedSave(`item_talent_name_${itemId}_${talentId}`, 450, saveNameToDb);
    });
    inp.addEventListener("focusout", saveNameToDb);
  });

  app.querySelectorAll("[data-inv-item-talent-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      const itemId = btn.getAttribute("data-inv-item-talent-remove") || "";
      const talentId = btn.getAttribute("data-inv-talent-id") || "";
      if (!itemId || !talentId) return;
      if (!confirm(t("confirmDelete") || "Delete?")) return;
      applyLocalMutation((sheet) => {
        const it = findItemById(sheet, itemId);
        if (!it) return;
        const arr = getItemTalentsArray(it);
        const filtered = arr.filter((x) => String(x.id) !== talentId);
        delete it.talent;
        it.talents = filtered;
      });
      await storage.deleteItemTalent(state.roomId, talentId).catch(console.error);
      render();
    });
  });

  // Inventory: add/remove per section
  ["consumables", "weapons", "armor", "others", "bags"].forEach((sec) => {
    app.querySelector(`#btn-${sec}-add`)?.addEventListener("click", () => {
      if (!state.sheet || !state.roomId || !state.activeSheetId) return;
      if (!canEdit(state.activeSheetId)) return;
      // Save+close any active item edit before mutating lists.
      if (state._editingItemId && state._itemEditDraft) {
        const id0 = String(state._editingItemId);
        const draft0 = state._itemEditDraft;
        const next0 = applyLocalMutation((sheet) => {
          const it0 = findItemById(sheet, id0);
          if (!it0) return;
          it0.name = draft0.name || "";
          it0.description = draft0.description || "";
        });
        if (state.roomId && state.activeSheetId && next0) {
          const it0 = findItemById(next0, id0);
          if (it0) storage.updateItemFields(state.roomId, state.activeSheetId, id0, { name: it0.name || "", description: it0.description || "" }).catch(console.error);
        }
        state._editingItemId = null;
        state._itemEditDraft = null;
      }
      const id = crypto.randomUUID();
      const type = sec === "weapons" ? "weapon" : sec === "armor" ? "armor" : sec === "consumables" ? "consumable" : sec === "bags" ? "bag" : "other";
      const next = applyLocalMutation((sheet) => {
        if (!sheet[sec]) sheet[sec] = [];
        const row = { id, type, name: t("itemName") || "Item", description: "", count: 1 };
        if (sec === "weapons") row.equippableExpr = "[weapons]";
        sheet[sec].push(row);
      });
      if (next?.[sec]?.length) {
        const it = next[sec][next[sec].length - 1];
        storage.upsertItem(state.roomId, state.activeSheetId, {
          id: it.id,
          type,
          position: next[sec].length - 1,
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
    app.querySelector(`#btn-${sec}-remove`)?.addEventListener("click", () => {
      if (!canEdit(state.activeSheetId)) return;
      // Save+close any active item edit before opening modals.
      if (state._editingItemId && state._itemEditDraft) {
        const id0 = String(state._editingItemId);
        const draft0 = state._itemEditDraft;
        const next0 = applyLocalMutation((sheet) => {
          const it0 = findItemById(sheet, id0);
          if (!it0) return;
          it0.name = draft0.name || "";
          it0.description = draft0.description || "";
        });
        if (state.roomId && state.activeSheetId && next0) {
          const it0 = findItemById(next0, id0);
          if (it0) storage.updateItemFields(state.roomId, state.activeSheetId, id0, { name: it0.name || "", description: it0.description || "" }).catch(console.error);
        }
        state._editingItemId = null;
        state._itemEditDraft = null;
      }
      state.itemRemoveModalOpen = true;
      state.itemRemoveMenuOpen = false;
      state.itemRemoveSection = sec;
      state.itemRemoveSelectedId = "";
      render();
    });
  });

  // Item transfer modal open (consumables/weapons/armor/others/bags)
  ["consumables", "weapons", "armor", "others", "bags"].forEach((sec) => {
    app.querySelector(`#btn-${sec}-transfer`)?.addEventListener("click", () => {
      if (!state.sheet) return;
      // Any non-edit action should close+save current edit.
      if (state._editingItemId && state._itemEditDraft) {
        const id0 = String(state._editingItemId);
        const draft0 = state._itemEditDraft;
        const next0 = applyLocalMutation((sheet) => {
          const it0 = findItemById(sheet, id0);
          if (!it0) return;
          it0.name = draft0.name || "";
          it0.description = draft0.description || "";
        });
        if (state.roomId && state.activeSheetId && next0) {
          const it0 = findItemById(next0, id0);
          if (it0) storage.updateItemFields(state.roomId, state.activeSheetId, id0, { name: it0.name || "", description: it0.description || "" }).catch(console.error);
        }
        state._editingItemId = null;
        state._itemEditDraft = null;
      }
      state.consumableTransferOpen = true;
      state.consumableTransferMode = "draft";
      state.consumableTransferRecipientMenuOpen = false;
      state.consumableTransferItemMenuOpen = false;
      state.consumableTransferRecipientSheetId = "";
      state.consumableTransferItemId = "";
      state.consumableTransferQty = 1;
      state.consumableTransferPending = null;
      state.consumableTransferSection = sec;
      render();
    });
  });

  // Consumables transfer modal controls
  app.querySelector("#btn-cons-xfer-recipient-menu")?.addEventListener("click", () => {
    state.consumableTransferRecipientMenuOpen = !state.consumableTransferRecipientMenuOpen;
    state.consumableTransferItemMenuOpen = false;
    render();
  });
  app.querySelectorAll("[data-cons-xfer-recipient-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.consumableTransferRecipientSheetId = btn.getAttribute("data-cons-xfer-recipient-pick") || "";
      state.consumableTransferRecipientMenuOpen = false;
      render();
    });
  });
  app.querySelector("#btn-cons-xfer-item-menu")?.addEventListener("click", () => {
    state.consumableTransferItemMenuOpen = !state.consumableTransferItemMenuOpen;
    state.consumableTransferRecipientMenuOpen = false;
    render();
  });
  app.querySelectorAll("[data-cons-xfer-item-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.consumableTransferItemId = btn.getAttribute("data-cons-xfer-item-pick") || "";
      state.consumableTransferItemMenuOpen = false;
      render();
    });
  });
  app.querySelector("#cons-xfer-qty-minus")?.addEventListener("click", () => {
    state.consumableTransferQty = Math.max(1, clampInt(state.consumableTransferQty) - 1);
    render();
  });
  app.querySelector("#cons-xfer-qty-plus")?.addEventListener("click", () => {
    state.consumableTransferQty = Math.max(1, clampInt(state.consumableTransferQty) + 1);
    render();
  });
  app.querySelector("#cons-xfer-cancel")?.addEventListener("click", () => {
    const secKey = String(state.consumableTransferSection || "consumables");
    state.consumableTransferOpen = false;
    state.consumableTransferMode = "draft";
    state.consumableTransferRecipientMenuOpen = false;
    state.consumableTransferItemMenuOpen = false;
    state.consumableTransferRecipientSheetId = "";
    state.consumableTransferItemId = "";
    state.consumableTransferQty = 1;
    state.consumableTransferPending = null;
    state._scrollToInvSectionKey = secKey;
    render();
  });
  app.querySelector("#cons-xfer-send")?.addEventListener("click", () => {
    const s = state.sheet;
    if (!s) return;
    const vis = getVisibleSheets().filter((id) => id !== state.activeSheetId);
    const recipId = String(state.consumableTransferRecipientSheetId || "") || (vis[0] || "");
    const items = s.consumables || [];
    const itemId = String(state.consumableTransferItemId || "") || (items[0]?.id ? String(items[0].id) : "");
    const qty = Math.max(1, clampInt(state.consumableTransferQty || 1));
    if (!recipId || !itemId) return;
    state.consumableTransferPending = { recipientSheetId: recipId, itemId, qty };
    state.consumableTransferMode = "confirm";
    render();
  });
  app.querySelector("#cons-xfer-confirm")?.addEventListener("click", async () => {
    if (!state.sheet || !state.roomId || !state.activeSheetId) return;
    const pending = state.consumableTransferPending;
    if (!pending) return;
    const recipId = String(pending.recipientSheetId || "");
    const itemId = String(pending.itemId || "");
    const qty = Math.max(1, clampInt(pending.qty || 1));
    const sec = String(state.consumableTransferSection || "consumables");
    const senderList =
      sec === "weapons" ? (state.sheet.weapons || [])
        : sec === "armor" ? (state.sheet.armor || [])
          : sec === "bags" ? (state.sheet.bags || [])
            : sec === "others" ? (state.sheet.others || [])
              : (state.sheet.consumables || []);
    const senderItem = senderList.find((it) => String(it.id) === itemId);
    if (!senderItem) return;
    const senderCount = Math.max(0, clampInt(senderItem.count ?? 0));
    if (qty > senderCount) {
      try { OBR.notification.show(t("notEnoughToTransfer") || "Not enough to transfer"); } catch (_) {}
      return;
    }

    // Decrement sender
    const nextSender = applyLocalMutation((sheet) => {
      const arr =
        sec === "weapons" ? (sheet.weapons || [])
          : sec === "armor" ? (sheet.armor || [])
            : sec === "bags" ? (sheet.bags || [])
              : sec === "others" ? (sheet.others || [])
                : (sheet.consumables || []);
      const it = arr.find((x) => String(x.id) === itemId);
      if (!it) return;
      it.count = Math.max(0, clampInt(it.count ?? 0) - qty);
      if ((it.count ?? 0) <= 0) {
        sheet[sec] = (sheet[sec] || []).filter((x) => String(x.id) !== itemId);
      }
    });
    if (state.roomId && state.activeSheetId) {
      if (senderCount - qty <= 0) storage.deleteItem(state.roomId, state.activeSheetId, itemId).catch(console.error);
      else storage.updateItemFields(state.roomId, state.activeSheetId, itemId, { quantity: senderCount - qty }).catch(console.error);
    }

    // Increment recipient (merge-or-create)
    try {
      const recipSheet = await storage.getSheet(state.roomId, recipId, { forceRefresh: true });
      const recipItems =
        sec === "weapons" ? (recipSheet?.weapons || [])
          : sec === "armor" ? (recipSheet?.armor || [])
            : sec === "bags" ? (recipSheet?.bags || [])
              : sec === "others" ? (recipSheet?.others || [])
                : (recipSheet?.consumables || []);
      const match = recipItems.find((it) =>
        String(it.name || "") === String(senderItem.name || "") &&
        String(it.description || "") === String(senderItem.description || "") &&
        String(it.equippableExpr || "") === String(senderItem.equippableExpr || "")
      );
      if (match) {
        // Merge path: existing matching item keeps its own state (including its
        // own talent, if any). We do NOT carry the sender's talent here.
        const cur = Math.max(0, clampInt(match.count ?? 0));
        storage.updateItemFields(state.roomId, recipId, match.id, { quantity: cur + qty }).catch(console.error);
      } else {
        const newId = crypto.randomUUID();
        const type = sec === "weapons" ? "weapon" : sec === "armor" ? "armor" : sec === "bags" ? "bag" : sec === "others" ? "other" : "consumable";
        const usableForRow = senderItem.equippableExpr
          ? { expr: senderItem.equippableExpr }
          : (Array.isArray(senderItem.equippableSlots) && senderItem.equippableSlots.length
              ? { slots: senderItem.equippableSlots }
              : null);
        await storage.upsertItem(state.roomId, recipId, {
          id: newId,
          type,
          position: recipItems.length,
          name: senderItem.name || "",
          description: senderItem.description || "",
          quantity: qty,
          physical_defense: Number(senderItem.defense) || 0,
          magical_defense: Number(senderItem.magicalDefense) || 0,
          constitution: Number(senderItem.constitution) || 0,
          strength: Number(senderItem.strength) || 0,
          intelligence: Number(senderItem.intelligence) || 0,
          perception: Number(senderItem.perception) || 0,
          social: Number(senderItem.social) || 0,
          agility: Number(senderItem.agility) || 0,
          focus: Number(senderItem.focus) || 0,
          usable_slots: usableForRow,
          used_slots: null,
        }).catch(console.error);
        // Carry item-bound talents (if any) onto the recipient's new item.
        if (sec === "weapons" || sec === "armor") {
          const senderTalents = getItemTalentsArray(senderItem);
          for (let i = 0; i < senderTalents.length; i++) {
            const tal = senderTalents[i];
            const newTalentId = crypto.randomUUID();
            await storage.upsertItemTalent(state.roomId, newId, {
              id: newTalentId,
              position: i,
              name: tal.name || "",
              description: tal.description || "",
              tier: tal.tier ?? 0,
              bonus_override: tal.bonusOverride ?? null,
              is_enabled: !!tal.enabled,
            }).catch(console.error);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    // Chat line
    try {
      const fromName = resolveCharacterDisplayName(state.activeSheetId);
      const toName = resolveCharacterDisplayName(recipId);
      const line = `${fromName} ${t("gave") || "gave"} ${qty} ${senderItem.name || (t("itemName") || "Item")} ${t("to") || "to"} ${toName}`.trim();
      const row = await storage.insertChatMessage(state.roomId, {
        playerId: state.playerId || "",
        sheetId: state.activeSheetId || null,
        body: line,
      });
      appendChatMessageIfNew(row);
    } catch (err) {
      console.error(err);
    }

    const secKey = String(state.consumableTransferSection || "consumables");
    state.consumableTransferOpen = false;
    state.consumableTransferMode = "draft";
    state.consumableTransferRecipientMenuOpen = false;
    state.consumableTransferItemMenuOpen = false;
    state.consumableTransferRecipientSheetId = "";
    state.consumableTransferItemId = "";
    state.consumableTransferQty = 1;
    state.consumableTransferPending = null;
    state._scrollToInvSectionKey = secKey;
    render();
  });

  // Inventory remove modal
  app.querySelector("#btn-item-remove-menu")?.addEventListener("click", () => {
    state.itemRemoveMenuOpen = !state.itemRemoveMenuOpen;
    render();
  });
  app.querySelectorAll("[data-item-remove-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.itemRemoveSelectedId = btn.getAttribute("data-item-remove-pick") || "";
      state.itemRemoveMenuOpen = false;
      render();
    });
  });
  app.querySelector("#item-remove-cancel")?.addEventListener("click", () => {
    const secKey = String(state.itemRemoveSection || "");
    state.itemRemoveModalOpen = false;
    state.itemRemoveMenuOpen = false;
    state.itemRemoveSection = "";
    state.itemRemoveSelectedId = "";
    if (secKey) state._scrollToInvSectionKey = secKey;
    render();
  });
  app.querySelector("#item-remove-confirm")?.addEventListener("click", () => {
    if (!state.sheet || !state.roomId || !state.activeSheetId) return;
    if (!canEdit(state.activeSheetId)) return;
    const sec = String(state.itemRemoveSection || "");
    const list = sec === "consumables" ? (state.sheet.consumables || [])
      : sec === "weapons" ? (state.sheet.weapons || [])
        : sec === "armor" ? (state.sheet.armor || [])
          : sec === "bags" ? (state.sheet.bags || [])
            : (state.sheet.others || []);
    const firstId = list[0]?.id != null ? String(list[0].id) : "";
    const selId = state.itemRemoveSelectedId && list.some((it) => String(it.id) === String(state.itemRemoveSelectedId)) ? String(state.itemRemoveSelectedId) : firstId;
    if (!selId) return;
    applyLocalMutation((sheet) => {
      const arr = sheet[sec] || [];
      sheet[sec] = arr.filter((it) => String(it.id) !== String(selId));
    });
    storage.deleteItem(state.roomId, state.activeSheetId, selId).catch(console.error);
    state.itemRemoveModalOpen = false;
    state.itemRemoveMenuOpen = false;
    state.itemRemoveSection = "";
    state.itemRemoveSelectedId = "";
    state._scrollToInvSectionKey = sec;
    render();
  });

  // ESC closes item remove / item transfer modals
  if (!app.dataset.invModalEscapeBound) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const rm = document.getElementById("item-remove-modal");
      const tr = document.getElementById("consumable-transfer-modal");
      if (rm && state.itemRemoveModalOpen) {
        e.preventDefault();
        const secKey = String(state.itemRemoveSection || "");
        state.itemRemoveModalOpen = false;
        state.itemRemoveMenuOpen = false;
        state.itemRemoveSection = "";
        state.itemRemoveSelectedId = "";
        if (secKey) state._scrollToInvSectionKey = secKey;
        render();
        return;
      }
      if (tr && state.consumableTransferOpen) {
        e.preventDefault();
        const secKey = String(state.consumableTransferSection || "consumables");
        state.consumableTransferOpen = false;
        state.consumableTransferMode = "draft";
        state.consumableTransferRecipientMenuOpen = false;
        state.consumableTransferItemMenuOpen = false;
        state.consumableTransferRecipientSheetId = "";
        state.consumableTransferItemId = "";
        state.consumableTransferQty = 1;
        state.consumableTransferPending = null;
        if (secKey) state._scrollToInvSectionKey = secKey;
        render();
      }
    });
    app.dataset.invModalEscapeBound = "1";
  }

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
        const row = { id: crypto.randomUUID(), type: section === "weapons" ? "weapon" : section === "armor" ? "armor" : section === "consumables" ? "consumable" : section === "bags" ? "bag" : "other", name: "", count: 1, description: "" };
        if (section === "weapons") row.equippableExpr = "[weapons]";
        sheet[section].push(row);
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
    const nextMode = !state.notesEditMode;
    if (nextMode) {
      // Entering edit mode: snapshot current notes into a local draft.
      state.notesDraft = String(state.sheet?.notes ?? "");
      state.notesEditMode = true;
      render();
      requestAnimationFrame(() => {
        syncNotesEditorHeight();
        document.getElementById("notes-area")?.focus();
        setupNotesScrollbar();
      });
      return;
    }

    // Leaving edit mode: persist draft once.
    const draft = String(state.notesDraft ?? "");
    state.notesEditMode = false;
    state.notesDraft = "";
    if (state.sheet) {
      applyLocalMutation((sheet) => {
        sheet.notes = draft;
      });
      if (state.roomId && state.activeSheetId) {
        storage.updateSheetCore(state.roomId, state.activeSheetId, { notes: draft }).catch(console.error);
      }
    }
    render();
  });

  const notesArea = app.querySelector("#notes-area");
  notesArea?.addEventListener("input", (e) => {
    const val = e.target.value;
    // Only update local draft while editing; persist on exit.
    state.notesDraft = val;
    syncNotesEditorHeight();
    setupNotesScrollbar();
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
