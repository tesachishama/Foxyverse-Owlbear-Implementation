/**
 * Foxyverse Owlbear plugin — main app.
 * State-driven UI with tab navigation and translation.
 */
import OBR from "@owlbear-rodeo/sdk";
import { t, setLocale } from "./i18n/translations.js";
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
import { executeRoll, getInlineButtons, parseChatCommand, applyPhysicalDamage, applyMagicDamage, applyTrueDamage, applyHeal, applyOverHeal, canReroll } from "./dice/roller.js";
import { evaluateExpression, statValuesFromSheet, rollStatCheck } from "./dice/parser.js";

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
  chatHistoryKey: "foxyverse_chat_",
  lastRoll: null,
  lastRollPayload: null,
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
  state.sheetIds = await storage.getSheetList();
  const roomData = await storage.getRoomData();
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
  const locale = roomData.locale || localStorage.getItem("foxyverse_locale") || "en";
  state.locale = locale;
  setLocale(locale);
}

async function loadSheet(sheetId, options = {}) {
  const { forceRefresh = false } = options;
  if (!sheetId || !state.roomId) {
    state.sheet = null;
    state.activeSheetId = sheetId;
    state.pendingSheetId = null;
    clearPendingSheetTimeout();
    return;
  }
  let sheet = await storage.getSheet(state.roomId, sheetId, { forceRefresh });
  if (!sheet) {
    if (state.isGM) {
      sheet = createEmptySheet(sheetId);
      storage.saveSheetToStorage(state.roomId, sheet);
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
    storage.saveSheetToStorage(state.roomId, sheet);
  }
  state.sheet = sheet;
  state.activeSheetId = sheetId;
  state.pendingSheetId = null;
  clearPendingSheetTimeout();
}

function saveSheet() {
  if (!state.sheet || !state.roomId) return;
  storage.saveSheetToStorage(state.roomId, state.sheet);
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
  return `
    <div class="card">
      <h2>${t("tabBio")}</h2>
      <div class="form-group">
        <label class="label">${t("name")}</label>
        <input type="text" value="${escapeAttr(b.name)}" data-field="bio.name" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("surname")}</label>
        <input type="text" value="${escapeAttr(b.surname)}" data-field="bio.surname" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("element")}</label>
        <input type="text" value="${escapeAttr(b.element)}" data-field="bio.element" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("class")}</label>
        <input type="text" value="${escapeAttr(b.class)}" data-field="bio.class" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("level")}</label>
        <input type="number" min="1" value="${Number(b.level) || 1}" data-field="bio.level" ${canEdit(s.id) ? "" : "readonly"} />
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
      <input type="number" min="0" value="${s.tempHP ?? 0}" data-field="tempHP" ${editable ? "" : "readonly"} />
    </div>
    <div class="stat-row">
      <span class="label">${t("currentHP")}</span>
      <input type="number" min="0" max="${maxHP}" value="${s.currentHP ?? 0}" data-field="currentHP" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxHP}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("currentMP")}</span>
      <input type="number" min="0" max="${maxMP}" value="${s.currentMP ?? 0}" data-field="currentMP" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxMP}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("currentFavor")}</span>
      <input type="number" min="0" max="${maxFavor}" value="${s.currentFavor ?? 0}" data-field="currentFavor" ${editable ? "" : "readonly"} />
      <span class="muted">/ ${maxFavor}</span>
    </div>
    <div class="stat-row">
      <span class="label">${t("action")}</span>
      <span>${actions}</span>
      ${editable ? `<input type="text" placeholder="${t("actionModifier")}" value="${escapeAttr(s.actionModifier)}" data-field="actionModifier" class="short-input" />` : ""}
    </div>
    <div class="stat-row">
      <span class="label">${t("speed")}</span>
      <span class="formula">${speedFormula}</span>
      ${editable ? `<input type="text" placeholder="${t("speedModifier")}" value="${escapeAttr(s.speedModifier)}" data-field="speedModifier" class="short-input" />` : ""}
      <button type="button" id="btn-roll-speed" class="btn-sm">${t("rollSpeed")}</button>
    </div>
  `;

  const knowledgeList = (s.knowledge || []).map(
    (k, i) => `
    <div class="knowledge-item" data-idx="${i}">
      <input type="text" value="${escapeAttr(k.name)}" data-knowledge-name="${i}" ${editable ? "" : "readonly"} />
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
        <td><input type="number" data-stat="${statId}.base" value="${st.base ?? 0}" ${editable ? "" : "readonly"} /></td>
        <td><input type="number" data-stat="${statId}.xpBonus" value="${st.xpBonus ?? 0}" ${editable ? "" : "readonly"} /></td>
        <td><input type="number" data-stat="${statId}.itemBonus" value="${st.itemBonus ?? 0}" readonly /></td>
        <td><input type="number" data-stat="${statId}.passiveBonus" value="${st.passiveBonus ?? 0}" ${editable ? "" : "readonly"} /></td>
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
    <div class="card">
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
    <div id="roll-modal" class="modal hidden">
      <div class="modal-content">
        <h3 id="roll-result-title">${t("result")}</h3>
        <p id="roll-result-text"></p>
        <div id="roll-apply-buttons" class="roll-apply-buttons hidden"></div>
        <button type="button" id="roll-reroll-btn" class="hidden">${t("reroll")} (${t("rerollCost")})</button>
        <button type="button" id="roll-close-btn">${t("close")}</button>
      </div>
    </div>
    <div id="stat-roll-modal" class="modal hidden">
      <div class="modal-content">
        <label>${t("modifier")}</label>
        <input type="text" id="stat-roll-modifier" placeholder="+5 or -3" />
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
      <input type="text" class="spell-name" value="${escapeAttr(sp.name)}" data-spell-name="${i}" placeholder="${t("spellName")}" ${editable ? "" : "readonly"} />
      <textarea class="spell-effect" data-spell-effect="${i}" placeholder="${t("spellEffect")}" ${editable ? "" : "readonly"} rows="2">${escapeAttr(sp.effect)}</textarea>
      <div class="spell-cost">
        <input type="number" min="0" value="${sp.cost ?? 0}" data-spell-cost="${i}" ${editable ? "" : "readonly"} />
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
    <div class="card"><h2>${t("tabInventory")}</h2>
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
            <input type="text" class="item-name-inp" value="${escapeAttr(it.name || "")}" data-item-name="${key}-${i}" placeholder="${t("itemName")}" ${editable ? "" : "readonly"} />
            <input type="number" min="0" class="item-count-inp" value="${it.count != null ? it.count : 1}" data-item-count="${key}-${i}" ${editable ? "" : "readonly"} />
            <span class="item-toggle" data-toggle-item="${key}-${i}" title="${t("itemDescription")}">▼</span>
            <div class="item-detail hidden" id="item-detail-${key}-${i}">
              <textarea data-item-desc="${key}-${i}" ${editable ? "" : "readonly"} placeholder="${t("itemDescription")}">${escapeAttr(it.description)}</textarea>
              ${key === "weapons" ? `<label>${t("weaponSlots")}: <input type="number" min="1" data-item-weapon-slots="${key}-${i}" value="${it.weaponSlots ?? 1}" ${editable ? "" : "readonly"} /></label>` : ""}
              ${key === "armor" ? `<label>${t("defense")}: <input type="number" data-item-defense="${key}-${i}" value="${it.defense ?? ""}" ${editable ? "" : "readonly"} /></label><label>${t("magicalDefense")}: <input type="number" data-item-magdef="${key}-${i}" value="${it.magicalDefense ?? ""}" ${editable ? "" : "readonly"} /></label><label>${t("equippableSlots")}: <input type="text" data-item-equip-slots="${key}-${i}" value="${Array.isArray(it.equippableSlots) ? it.equippableSlots.join(", ") : (it.equippableSlots || "")}" placeholder="Hat, Face" ${editable ? "" : "readonly"} /></label>` : ""}
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
      (m) =>
        `<div class="chat-msg"><strong>${escapeAttr(m.from)}:</strong> <span class="chat-body">${renderChatBody(m.body)}</span></div>`
    )
    .join("");
  return `
    <div class="card chat-card">
      <h2>${t("tabChat")}</h2>
      <div class="chat-messages" id="chat-messages">${list}</div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" placeholder="${t("chatPlaceholder")}" />
        <button type="button" id="chat-send">${t("send")}</button>
      </div>
    </div>
  `;
}

function renderChatBody(body) {
  if (!body) return "";
  const buttons = getInlineButtons(body);
  let text = escapeAttr(body);
  buttons.forEach((btn) => {
    const stat = (btn.stat || "").toString();
    text = text.replace(btn.raw, `<button type="button" class="inline-roll-btn" data-type="${btn.type}" data-expr="${escapeAttr(btn.expr)}" data-stat="${escapeAttr(stat)}">${escapeAttr(btn.raw)}</button>`);
  });
  return text;
}

function renderNotesTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${state.pendingSheetId ? "Loading sheet..." : t("noSheet")}</p></div>`;
  const notes = s?.notes ?? "";
  const editable = canEdit(state.activeSheetId);
  return `
    <div class="card">
      <h2>${t("tabNotes")}</h2>
      <textarea id="notes-area" rows="12" placeholder="${t("notesPlaceholder")}" ${editable ? "" : "readonly"}>${escapeAttr(notes)}</textarea>
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
  app.innerHTML = `
    ${renderHeader()}
    ${renderTabs()}
    <main class="tab-content">${renderTabContent()}</main>
  `;
  applyColors();
  bindEvents();
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

  app.querySelector("#btn-sheet-menu")?.addEventListener("click", () => {
    state.sheetMenuOpen = !state.sheetMenuOpen;
    render();
  });

  app.querySelectorAll("[data-sheet-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.sheetMenuOpen = false;
      await loadSheet(btn.dataset.sheetId || null);
      render();
    });
  });

  app.querySelector("#btn-new-sheet")?.addEventListener("click", async () => {
    const sheet = createEmptySheet();
    state.roomId = state.roomId || await storage.getRoomId();
    storage.saveSheetToStorage(state.roomId, sheet);
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
      await storage.setRoomData({ locale: lang });
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
      const next = await applySheetMutation((sheet) => {
        if (field.startsWith("bio.")) {
          setByPath(sheet, field, val);
        } else {
          sheet[field] = isNaN(Number(val)) ? val : Number(val);
        }
      });
      if (field.startsWith("bio.") && state.activeSheetId && next) {
        const displayName = [next.bio?.name || "", next.bio?.surname || ""].join(" ").trim() || "Name Surname";
        state.sheetNames[state.activeSheetId] = displayName;
        await storage.setSheetNameInRoom(state.activeSheetId, displayName);
      }
      if (field === "bio.name" || field === "bio.surname") render();
    });
  });

  // Stats inputs
  app.querySelectorAll("[data-stat]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      if (!state.sheet) return;
      const [statId, key] = e.target.dataset.stat.split(".");
      await applySheetMutation((sheet) => {
        if (!sheet.stats[statId]) sheet.stats[statId] = {};
        sheet.stats[statId][key] = parseInt(e.target.value, 10) || 0;
      });
      if (state.activeTab === "stats") render();
    });
  });

  // Knowledge
  app.querySelector("#btn-add-knowledge")?.addEventListener("click", async () => {
    if (!state.sheet) return;
    await applySheetMutation((sheet) => {
      if (!sheet.knowledge) sheet.knowledge = [];
      sheet.knowledge.push({ id: crypto.randomUUID(), name: "", tier: 1, enabled: true });
    });
    render();
  });
  app.querySelectorAll("[data-remove-knowledge]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.removeKnowledge, 10);
      await applySheetMutation((sheet) => {
        sheet.knowledge.splice(idx, 1);
      });
      render();
    });
  });
  app.querySelectorAll("[data-knowledge-name], [data-knowledge-tier], [data-knowledge-enabled]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const d = e.target.dataset;
      const idx = parseInt(d.knowledgeName ?? d.knowledgeTier ?? d.knowledgeEnabled, 10);
      await applySheetMutation((sheet) => {
        if (isNaN(idx) || !sheet.knowledge[idx]) return;
        const k = sheet.knowledge[idx];
        if (d.knowledgeName !== undefined) k.name = e.target.value;
        if (d.knowledgeTier !== undefined) k.tier = parseInt(e.target.value, 10);
        if (d.knowledgeEnabled !== undefined) k.enabled = e.target.checked;
      });
    });
  });

  // Stat roll buttons
  app.querySelectorAll(".btn-roll-stat").forEach((btn) => {
    btn.addEventListener("click", () => {
      state._rollStat = btn.dataset.stat;
      state._rollDc = parseInt(btn.dataset.dc, 10);
      document.getElementById("stat-roll-modal")?.classList.remove("hidden");
    });
  });
  app.querySelector("#stat-roll-do")?.addEventListener("click", () => {
    const mod = document.getElementById("stat-roll-modifier")?.value || "";
    const result = rollStatCheck(state._rollDc, mod);
    state.lastRoll = { kind: "stat", stat: state._rollStat, ...result };
    state.lastRollPayload = { type: "stat", stat: state._rollStat?.replace("strength", "str").replace("constitution", "con").replace("intelligence", "int").replace("perception", "per").replace("social", "soc").replace("agility", "agi").replace("focus", "foc"), expr: mod };
    document.getElementById("stat-roll-modal")?.classList.add("hidden");
    showRollResult(state.lastRoll);
    OBR.notification.show(result.nat20 ? t("nat20") : result.nat1 ? t("nat1") : result.success ? t("success") : t("failure"));
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
    state.lastRoll = { kind: "roll", value, rolls: [d6] };
    state.lastRollPayload = null;
    showRollResult(state.lastRoll);
  });

  app.querySelectorAll(".quick-mods button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const stat = e.target.closest(".quick-mods").dataset.stat;
      const mod = e.target.dataset.mod;
      const payload = { type: "stat", stat: stat.replace("strength", "str").replace("constitution", "con").replace("intelligence", "int").replace("perception", "per").replace("social", "soc").replace("agility", "agi").replace("focus", "foc"), expr: mod };
      const result = executeRoll(payload, state.sheet);
      state.lastRoll = result;
      state.lastRollPayload = payload;
      showRollResult(result);
    });
  });

  function showRollResult(result) {
    const modal = document.getElementById("roll-modal");
    const text = document.getElementById("roll-result-text");
    const rerollBtn = document.getElementById("roll-reroll-btn");
    const applyBox = document.getElementById("roll-apply-buttons");
    if (!modal || !text) return;
    modal.classList.remove("hidden");
    if (result.kind === "stat") {
      text.textContent = `${t("dc")} ${result.dc}, ${t("result")}: ${result.roll}${result.mod ? (result.mod >= 0 ? "+" : "") + result.mod : ""} = ${result.total}. ${result.nat1 ? t("nat1") : result.nat20 ? t("nat20") : result.success ? t("success") : t("failure")}`;
    } else {
      text.textContent = `${t("result")}: ${result.value}${result.rolls?.length ? " (" + result.rolls.join(", ") + ")" : ""}`;
    }
    rerollBtn.classList.toggle("hidden", !state.sheet || state.sheet.currentFavor < 1 || !canReroll(result));
    if (applyBox) {
      applyBox.innerHTML = "";
      applyBox.classList.add("hidden");
      if (state.sheet && result.value != null) {
        if (result.kind === "pdmg") {
          applyBox.innerHTML = `<button type="button" id="roll-apply-pdmg">${t("applyDamage")} (${t("physicalDamage")})</button>`;
          applyBox.classList.remove("hidden");
        } else if (result.kind === "mdmg") {
          applyBox.innerHTML = `<button type="button" id="roll-apply-mdmg">${t("applyDamage")} (${t("magicDamage")})</button>`;
          applyBox.classList.remove("hidden");
        } else if (result.kind === "tdmg") {
          applyBox.innerHTML = `<button type="button" id="roll-apply-tdmg">${t("applyDamage")} (${t("trueDamage")})</button>`;
          applyBox.classList.remove("hidden");
        } else if (result.kind === "heal") {
          applyBox.innerHTML = `<button type="button" id="roll-apply-heal">${t("applyHeal")}</button>`;
          applyBox.classList.remove("hidden");
        } else if (result.kind === "theal") {
          applyBox.innerHTML = `<button type="button" id="roll-apply-theal">${t("applyOverHeal")}</button>`;
          applyBox.classList.remove("hidden");
        }
      }
      applyBox.querySelector("#roll-apply-pdmg")?.addEventListener("click", () => {
        const next = applyPhysicalDamage(state.sheet, state.lastRoll.value);
        Object.assign(state.sheet, next);
        saveSheet();
        render();
        modal.classList.add("hidden");
      });
      applyBox.querySelector("#roll-apply-mdmg")?.addEventListener("click", () => {
        const next = applyMagicDamage(state.sheet, state.lastRoll.value);
        Object.assign(state.sheet, next);
        saveSheet();
        render();
        modal.classList.add("hidden");
      });
      applyBox.querySelector("#roll-apply-tdmg")?.addEventListener("click", () => {
        const next = applyTrueDamage(state.sheet, state.lastRoll.value);
        Object.assign(state.sheet, next);
        saveSheet();
        render();
        modal.classList.add("hidden");
      });
      applyBox.querySelector("#roll-apply-heal")?.addEventListener("click", () => {
        const maxHP = getMaxHP(state.sheet);
        const next = applyHeal(state.sheet, state.lastRoll.value, maxHP);
        Object.assign(state.sheet, next);
        saveSheet();
        render();
        modal.classList.add("hidden");
      });
      applyBox.querySelector("#roll-apply-theal")?.addEventListener("click", () => {
        const next = applyOverHeal(state.sheet, state.lastRoll.value);
        Object.assign(state.sheet, next);
        saveSheet();
        render();
        modal.classList.add("hidden");
      });
    }
  }
  app.querySelector("#roll-close-btn")?.addEventListener("click", () => document.getElementById("roll-modal")?.classList.add("hidden"));
  app.querySelector("#roll-reroll-btn")?.addEventListener("click", () => {
    if (!state.sheet || state.sheet.currentFavor < 1) return;
    state.sheet.currentFavor--;
    saveSheet();
    const result = executeRoll(state.lastRollPayload, state.sheet);
    state.lastRoll = result;
    showRollResult(result);
    render();
  });

  // Spells
  app.querySelector("#btn-add-spell")?.addEventListener("click", async () => {
    if (!state.sheet) return;
    await applySheetMutation((sheet) => {
      if (!sheet.spells) sheet.spells = [];
      sheet.spells.push({ id: crypto.randomUUID(), name: "", effect: "", cost: 0, costType: "mp" });
    });
    render();
  });
  app.querySelectorAll("[data-remove-spell]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.removeSpell, 10);
      await applySheetMutation((sheet) => {
        sheet.spells.splice(idx, 1);
      });
      render();
    });
  });
  app.querySelectorAll("[data-spell-name], [data-spell-effect], [data-spell-cost]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const idx = parseInt(el.dataset.spellName ?? el.dataset.spellEffect ?? el.dataset.spellCost, 10);
      await applySheetMutation((sheet) => {
        const sp = sheet.spells[idx];
        if (!sp) return;
        if (el.dataset.spellName !== undefined) sp.name = e.target.value;
        if (el.dataset.spellEffect !== undefined) sp.effect = e.target.value;
        if (el.dataset.spellCost !== undefined) sp.cost = parseInt(e.target.value, 10) || 0;
      });
    });
  });
  app.querySelectorAll("[name^='costType-']").forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      const idx = parseInt(e.target.name.replace("costType-", ""), 10);
      await applySheetMutation((sheet) => {
        if (sheet.spells[idx]) sheet.spells[idx].costType = e.target.value;
      });
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
      render();
    });
  });

  // Inventory
  app.querySelectorAll(".equip-select").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const slotId = el.dataset.slot;
      const itemId = e.target.value || null;
      if (!state.sheet) return;
      await applySheetMutation((sheet) => {
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
      await applySheetMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        const it = sheet[section][idx];
        if (el.dataset.itemName !== undefined) it.name = e.target.value;
        if (el.dataset.itemCount !== undefined) it.count = parseInt(e.target.value, 10) || 0;
      });
    });
  });
  app.querySelectorAll("[data-item-desc]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = el.dataset.itemDesc;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      await applySheetMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        sheet[section][idx].description = e.target.value;
      });
    });
  });
  app.querySelectorAll("[data-item-weapon-slots], [data-item-defense], [data-item-magdef]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = (el.dataset.itemWeaponSlots || el.dataset.itemDefense || el.dataset.itemMagdef || "");
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      await applySheetMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        const it = sheet[section][idx];
        if (el.dataset.itemWeaponSlots !== undefined) it.weaponSlots = parseInt(e.target.value, 10) || 1;
        if (el.dataset.itemDefense !== undefined) it.defense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
        if (el.dataset.itemMagdef !== undefined) it.magicalDefense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
      });
    });
  });
  app.querySelectorAll("[data-item-equip-slots]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const key = el.dataset.itemEquipSlots;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      const raw = (e.target.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      await applySheetMutation((sheet) => {
        if (!sheet?.[section]?.[idx]) return;
        sheet[section][idx].equippableSlots = raw;
      });
    });
  });
  app.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const raw = btn.dataset.removeItem;
      const lastHyphen = raw.lastIndexOf("-");
      const section = raw.slice(0, lastHyphen);
      const idx = parseInt(raw.slice(lastHyphen + 1), 10);
      await applySheetMutation((sheet) => {
        if (sheet[section]) sheet[section].splice(idx, 1);
      });
      render();
    });
  });
  app.querySelectorAll(".btn-add-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const section = btn.dataset.section;
      await applySheetMutation((sheet) => {
        if (!sheet[section]) sheet[section] = [];
        sheet[section].push({ id: crypto.randomUUID(), type: section === "weapons" ? "weapon" : section === "armor" ? "armor" : section === "consumables" ? "consumable" : section === "bags" ? "bag" : "other", name: "", count: 1, description: "" });
      });
      render();
    });
  });

  // Notes
  app.querySelector("#notes-area")?.addEventListener("change", async (e) => {
    if (state.sheet) {
      await applySheetMutation((sheet) => {
        sheet.notes = e.target.value;
      });
    }
  });

  // Chat
  const chatInput = app.querySelector("#chat-input");
  app.querySelector("#chat-send")?.addEventListener("click", sendChat);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });
  function sendChat() {
    const line = chatInput?.value?.trim();
    if (!line) return;
    const cmd = parseChatCommand(line);
    if (cmd && state.sheet) {
      const result = executeRoll(cmd, state.sheet);
      state.lastRoll = result;
      state.lastRollPayload = cmd;
      OBR.notification.show(String(result.value ?? result.roll ?? result.total ?? ""));
      OBR.broadcast.sendMessage("foxyverse", { type: "chat", from: state.playerName || "Player", body: line, result }).catch(() => {});
    } else {
      OBR.broadcast.sendMessage("foxyverse", { type: "chat", from: state.playerName || "Player", body: line }).catch(() => {});
    }
    chatInput.value = "";
    state.chatMessages.push({ from: state.playerName || "Player", body: line });
    const key = state.chatHistoryKey + state.roomId;
    try {
      localStorage.setItem(key, JSON.stringify(state.chatMessages.slice(-200)));
    } catch (_) {}
    const msgsEl = document.getElementById("chat-messages");
    if (msgsEl) {
      msgsEl.innerHTML += `<div class="chat-msg"><strong>${escapeAttr(state.playerName || "You")}:</strong> <span class="chat-body">${renderChatBody(line)}</span></div>`;
    }
  }

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
  app.addEventListener("click", (e) => {
    const btn = e.target.closest(".inline-roll-btn");
    if (!btn || !state.sheet) return;
    const payload = { type: btn.dataset.type, expr: btn.dataset.expr || "", stat: btn.dataset.stat || undefined };
    const result = executeRoll(payload, state.sheet);
    state.lastRoll = result;
    state.lastRollPayload = payload;
    OBR.notification.show(result.value != null ? String(result.value) : result.roll != null ? `${result.roll} (${result.success ? t("success") : t("failure")})` : "");
  });

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
        const sheetIdConflict = !!sheet?.id && state.sheetIds.includes(sheet.id);
        const nextSheet = normalizeImportedSheet(structuredClone(sheet), {
          targetSheetId: sheetIdConflict || !sheet?.id ? crypto.randomUUID() : null,
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
    const chatKey = state.chatHistoryKey + state.roomId;
    try {
      const saved = localStorage.getItem(chatKey);
      if (saved) state.chatMessages = JSON.parse(saved);
    } catch (_) {}
    if (state.sheetIds.length && !state.activeSheetId) {
      await loadSheet(getVisibleSheets()[0] || null);
    } else if (state.activeSheetId) {
      await loadSheet(state.activeSheetId);
    }
    render();

    storage.subscribeToRoom(state.roomId, async () => {
      if (hasOwnedFieldLock()) return;
      await loadRoomData();
      const visible = getVisibleSheets();
      const selectedSheetId = state.pendingSheetId || state.activeSheetId;
      if (!selectedSheetId || !canView(selectedSheetId)) {
        state.pendingSheetId = null;
        await loadSheet(visible[0] || null);
      } else {
        await loadSheet(selectedSheetId, { forceRefresh: true });
      }
      render();
    });

    OBR.room.onMetadataChange(async () => {
      const meta = await OBR.room.getMetadata();
      const roomMeta = meta?.foxyverse || {};

      const nextLocale = roomMeta.locale || localStorage.getItem("foxyverse_locale") || state.locale;
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
        return;
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
