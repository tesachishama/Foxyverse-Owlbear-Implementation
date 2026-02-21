/**
 * Foxyverse Owlbear plugin — main app.
 * State-driven UI with tab navigation and translation.
 */
import OBR from "@owlbear-rodeo/sdk";
import { t, setLocale } from "./i18n/translations.js";
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
  colors: {
    bg: "#1a1b1e",
    surface: "#25262b",
    border: "#373a40",
    text: "#e8e9ed",
    accent: "#7950f2",
  },
};

function canView(sheetId) {
  if (state.isGM) return true;
  const per = state.permissions[state.playerId];
  if (!per || !per.view || per.view.length === 0) return true;
  return per.view.includes(sheetId);
}

function canEdit(sheetId) {
  if (state.isGM) return true;
  const per = state.permissions[state.playerId];
  if (!per || !per.edit || per.edit.length === 0) return true;
  return per.edit.includes(sheetId);
}

function getVisibleSheets() {
  return state.sheetIds.filter(canView);
}

async function loadRoomData() {
  state.roomId = await storage.getRoomId();
  state.sheetIds = await storage.getSheetList();
  const roomData = await storage.getRoomData();
  state.sheetNames = roomData.sheetNames || {};
  state.permissions = roomData.permissions || {};
  state.tokenToSheet = roomData.tokenToSheet || {};
  state.isGM = (await storage.getPlayerRole()) === "GM";
  state.playerId = await storage.getPlayerId();
  const locale = roomData.locale || localStorage.getItem("foxyverse_locale") || "en";
  state.locale = locale;
  setLocale(locale);
  await storage.setRoomData({ locale: state.locale });
}

async function loadSheet(sheetId) {
  if (!sheetId || !state.roomId) {
    state.sheet = null;
    state.activeSheetId = sheetId;
    return;
  }
  let sheet = storage.getSheetFromStorage(state.roomId, sheetId);
  if (!sheet) {
    sheet = createEmptySheet(sheetId);
    storage.saveSheetToStorage(state.roomId, sheet);
    await storage.addSheetToRoom(sheetId, getDisplayName(sheet));
  }
  state.sheet = sheet;
  state.activeSheetId = sheetId;
}

function saveSheet() {
  if (!state.sheet || !state.roomId) return;
  storage.saveSheetToStorage(state.roomId, state.sheet);
  storage.broadcastSheet(state.roomId, state.sheet).catch(() => {});
}

function pickRandom(max) {
  return Math.floor(Math.random() * max) + 1;
}

function renderHeader() {
  const visible = getVisibleSheets();
  const options = visible
    .map(
      (id) =>
        `<option value="${id}" ${id === state.activeSheetId ? "selected" : ""}>${state.sheetNames[id] || id.slice(0, 8)}</option>`
    )
    .join("");
  const canAdd = state.isGM || visible.length === 0;
  const linkedToThis = state.activeSheetId
    ? Object.entries(state.tokenToSheet || {}).filter(([, sid]) => sid === state.activeSheetId)
    : [];
  return `
    <header class="app-header">
      <div class="header-row">
        <select id="sheet-select" class="sheet-select" aria-label="${t("selectSheet")}">
          <option value="">${t("noSheet")}</option>
          ${options}
        </select>
        ${canAdd ? `<button type="button" id="btn-new-sheet" class="btn-icon" title="${t("newSheet")}">+</button>` : ""}
        ${state.activeSheetId ? `<button type="button" id="btn-link-token" class="btn-sm" title="${t("linkTokenToSheet")}">${t("linkToken")}</button>` : ""}
        <div class="lang-flags">
          <button type="button" class="flag ${state.locale === "en" ? "active" : ""}" data-lang="en" title="English" aria-label="English">EN</button>
          <button type="button" class="flag ${state.locale === "fr" ? "active" : ""}" data-lang="fr" title="Français" aria-label="Français">FR</button>
        </div>
      </div>
      ${linkedToThis.length > 0 ? `
        <div class="linked-tokens">
          <span class="label">${t("linkedTokens")}:</span>
          ${linkedToThis.map(([tid]) => `<span class="linked-token-id">${tid.slice(0, 8)}</span> <button type="button" class="btn-sm btn-unlink" data-token-id="${tid}">${t("unlink")}</button>`).join(" ")}
        </div>
      ` : ""}
    </header>
  `;
}

function renderTabs() {
  const tabsHtml = TABS.map(
    (tab) =>
      `<button type="button" class="tab ${state.activeTab === tab ? "active" : ""}" data-tab="${tab}">${t("tab" + tab.charAt(0).toUpperCase() + tab.slice(1))}</button>`
  ).join("");
  return `<nav class="tabs">${tabsHtml}</nav>`;
}

function renderBioTab() {
  const s = state.sheet;
  if (!s) return `<div class="card"><p>${t("noSheet")}</p></div>`;
  const b = s.bio || {};
  return `
    <div class="card">
      <h2>${t("tabBio")}</h2>
      <div class="form-group">
        <label class="label">${t("name")}</label>
        <input type="text" id="bio-name" value="${escapeAttr(b.name)}" data-field="bio.name" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("surname")}</label>
        <input type="text" id="bio-surname" value="${escapeAttr(b.surname)}" data-field="bio.surname" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("element")}</label>
        <input type="text" id="bio-element" value="${escapeAttr(b.element)}" data-field="bio.element" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("class")}</label>
        <input type="text" id="bio-class" value="${escapeAttr(b.class)}" data-field="bio.class" ${canEdit(s.id) ? "" : "readonly"} />
      </div>
      <div class="form-group">
        <label class="label">${t("level")}</label>
        <input type="number" min="1" id="bio-level" value="${Number(b.level) || 1}" data-field="bio.level" ${canEdit(s.id) ? "" : "readonly"} />
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
  if (!s) return `<div class="card"><p>${t("noSheet")}</p></div>`;
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
  const c = state.colors;
  const editable = canEdit(state.activeSheetId);
  const permsSection = state.isGM && state.partyPlayers?.length
    ? `
      <h3>${t("permissions")}</h3>
      <p class="muted small">${t("gmOnly")}</p>
      <div class="permissions-grid" id="permissions-grid">
        ${state.sheetIds.map((sheetId) => `
          <div class="perm-sheet">
            <strong>${escapeAttr(state.sheetNames[sheetId] || sheetId.slice(0, 8))}</strong>
            ${state.partyPlayers.map((p) => `
              <label><input type="checkbox" data-perm-view="${sheetId}" data-player="${p.id}" ${(state.permissions[p.id]?.view || []).includes(sheetId) ? "checked" : ""} /> ${escapeAttr(p.name || p.id)} ${t("view")}</label>
              <label><input type="checkbox" data-perm-edit="${sheetId}" data-player="${p.id}" ${(state.permissions[p.id]?.edit || []).includes(sheetId) ? "checked" : ""} /> ${t("edit")}</label>
            `).join("")}
          </div>
        `).join("")}
      </div>
    `
    : "";
  return `
    <div class="card">
      <h2>${t("tabSettings")}</h2>
      <h3>${t("uiColors")}</h3>
      <div class="color-grid">
        <label>${t("color1")}<input type="color" value="${c.bg}" data-color="bg" ${editable ? "" : "disabled"} /></label>
        <label>${t("color2")}<input type="color" value="${c.surface}" data-color="surface" ${editable ? "" : "disabled"} /></label>
        <label>${t("color3")}<input type="color" value="${c.border}" data-color="border" ${editable ? "" : "disabled"} /></label>
        <label>${t("color4")}<input type="color" value="${c.text}" data-color="text" ${editable ? "" : "disabled"} /></label>
        <label>${t("color5")}<input type="color" value="${c.accent}" data-color="accent" ${editable ? "" : "disabled"} /></label>
      </div>
      ${permsSection}
      <div class="settings-actions">
        <button type="button" id="btn-export-sheet">${t("exportSheet")}</button>
        <button type="button" id="btn-import-sheet">${t("importSheet")}</button>
        <input type="file" id="import-file-input" accept=".json" class="hidden" />
      </div>
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
  const root = document.documentElement;
  root.style.setProperty("--bg", state.colors.bg);
  root.style.setProperty("--surface", state.colors.surface);
  root.style.setProperty("--border", state.colors.border);
  root.style.setProperty("--text", state.colors.text);
  root.style.setProperty("--accent", state.colors.accent);
}

function render() {
  const app = document.getElementById(ROOT_ID);
  if (!app) return;
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

  app.querySelector("#sheet-select")?.addEventListener("change", async (e) => {
    const id = e.target.value || null;
    await loadSheet(id);
    saveSheet();
    render();
  });

  app.querySelector("#btn-new-sheet")?.addEventListener("click", async () => {
    const sheet = createEmptySheet();
    state.roomId = state.roomId || await storage.getRoomId();
    storage.saveSheetToStorage(state.roomId, sheet);
    await storage.addSheetToRoom(sheet.id, getDisplayName(sheet));
    state.sheetIds = await storage.getSheetList();
    state.sheetNames = { ...state.sheetNames, [sheet.id]: getDisplayName(sheet) };
    await loadSheet(sheet.id);
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

  app.querySelectorAll(".flag[data-lang]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lang = btn.dataset.lang;
      setLocale(lang);
      state.locale = lang;
      localStorage.setItem("foxyverse_locale", lang);
      await storage.setRoomData({ locale: lang });
      render();
    });
  });

  app.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      render();
    });
  });

  // Bio inputs
  app.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("change", (e) => {
      if (!state.sheet) return;
      const field = e.target.dataset.field;
      let val = e.target.value;
      if (field === "bio.level") val = parseInt(val, 10) || 1;
      if (field.startsWith("bio.")) {
        const key = field.split(".")[1];
        if (!state.sheet.bio) state.sheet.bio = {};
        state.sheet.bio[key] = val;
      } else {
        state.sheet[field] = isNaN(Number(val)) ? val : Number(val);
      }
      saveSheet();
    });
  });

  // Stats inputs
  app.querySelectorAll("[data-stat]").forEach((el) => {
    el.addEventListener("change", (e) => {
      if (!state.sheet) return;
      const [statId, key] = e.target.dataset.stat.split(".");
      if (!state.sheet.stats[statId]) state.sheet.stats[statId] = {};
      state.sheet.stats[statId][key] = parseInt(e.target.value, 10) || 0;
      saveSheet();
      if (state.activeTab === "stats") render();
    });
  });

  // Knowledge
  app.querySelector("#btn-add-knowledge")?.addEventListener("click", () => {
    if (!state.sheet) return;
    if (!state.sheet.knowledge) state.sheet.knowledge = [];
    state.sheet.knowledge.push({ id: crypto.randomUUID(), name: "", tier: 1, enabled: true });
    saveSheet();
    render();
  });
  app.querySelectorAll("[data-remove-knowledge]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.removeKnowledge, 10);
      state.sheet.knowledge.splice(idx, 1);
      saveSheet();
      render();
    });
  });
  app.querySelectorAll("[data-knowledge-name], [data-knowledge-tier], [data-knowledge-enabled]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const d = e.target.dataset;
      const idx = parseInt(d.knowledgeName ?? d.knowledgeTier ?? d.knowledgeEnabled, 10);
      if (isNaN(idx) || !state.sheet.knowledge[idx]) return;
      const k = state.sheet.knowledge[idx];
      if (d.knowledgeName !== undefined) k.name = e.target.value;
      if (d.knowledgeTier !== undefined) k.tier = parseInt(e.target.value, 10);
      if (d.knowledgeEnabled !== undefined) k.enabled = e.target.checked;
      saveSheet();
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
  app.querySelector("#btn-add-spell")?.addEventListener("click", () => {
    if (!state.sheet) return;
    if (!state.sheet.spells) state.sheet.spells = [];
    state.sheet.spells.push({ id: crypto.randomUUID(), name: "", effect: "", cost: 0, costType: "mp" });
    saveSheet();
    render();
  });
  app.querySelectorAll("[data-remove-spell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.removeSpell, 10);
      state.sheet.spells.splice(idx, 1);
      saveSheet();
      render();
    });
  });
  app.querySelectorAll("[data-spell-name], [data-spell-effect], [data-spell-cost]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = parseInt(el.dataset.spellName ?? el.dataset.spellEffect ?? el.dataset.spellCost, 10);
      const sp = state.sheet.spells[idx];
      if (el.dataset.spellName !== undefined) sp.name = e.target.value;
      if (el.dataset.spellEffect !== undefined) sp.effect = e.target.value;
      if (el.dataset.spellCost !== undefined) sp.cost = parseInt(e.target.value, 10) || 0;
      saveSheet();
    });
  });
  app.querySelectorAll("[name^='costType-']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const idx = parseInt(e.target.name.replace("costType-", ""), 10);
      state.sheet.spells[idx].costType = e.target.value;
      saveSheet();
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
    el.addEventListener("change", (e) => {
      const slotId = el.dataset.slot;
      const itemId = e.target.value || null;
      if (!state.sheet) return;
      const eq = { ...(state.sheet.equipped || {}) };
      if (itemId) {
        Object.keys(eq).forEach((s) => { if (eq[s] === itemId) delete eq[s]; });
        eq[slotId] = itemId;
        const item = findItemById(state.sheet, itemId);
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
      state.sheet.equipped = eq;
      saveSheet();
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
    el.addEventListener("change", (e) => {
      const key = el.dataset.itemName ?? el.dataset.itemCount;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      if (!state.sheet?.[section]?.[idx]) return;
      const it = state.sheet[section][idx];
      if (el.dataset.itemName !== undefined) it.name = e.target.value;
      if (el.dataset.itemCount !== undefined) it.count = parseInt(e.target.value, 10) || 0;
      saveSheet();
    });
  });
  app.querySelectorAll("[data-item-desc]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const key = el.dataset.itemDesc;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      if (!state.sheet?.[section]?.[idx]) return;
      state.sheet[section][idx].description = e.target.value;
      saveSheet();
    });
  });
  app.querySelectorAll("[data-item-weapon-slots], [data-item-defense], [data-item-magdef]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const key = (el.dataset.itemWeaponSlots || el.dataset.itemDefense || el.dataset.itemMagdef || "");
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      if (!state.sheet?.[section]?.[idx]) return;
      const it = state.sheet[section][idx];
      if (el.dataset.itemWeaponSlots !== undefined) it.weaponSlots = parseInt(e.target.value, 10) || 1;
      if (el.dataset.itemDefense !== undefined) it.defense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
      if (el.dataset.itemMagdef !== undefined) it.magicalDefense = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
      saveSheet();
    });
  });
  app.querySelectorAll("[data-item-equip-slots]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const key = el.dataset.itemEquipSlots;
      const lastHyphen = key.lastIndexOf("-");
      const section = key.slice(0, lastHyphen);
      const idx = parseInt(key.slice(lastHyphen + 1), 10);
      if (!state.sheet?.[section]?.[idx]) return;
      const raw = (e.target.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      state.sheet[section][idx].equippableSlots = raw;
      saveSheet();
    });
  });
  app.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.dataset.removeItem;
      const lastHyphen = raw.lastIndexOf("-");
      const section = raw.slice(0, lastHyphen);
      const idx = parseInt(raw.slice(lastHyphen + 1), 10);
      if (state.sheet[section]) state.sheet[section].splice(idx, 1);
      saveSheet();
      render();
    });
  });
  app.querySelectorAll(".btn-add-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (!state.sheet[section]) state.sheet[section] = [];
      state.sheet[section].push({ id: crypto.randomUUID(), type: section === "weapons" ? "weapon" : section === "armor" ? "armor" : section === "consumables" ? "consumable" : section === "bags" ? "bag" : "other", name: "", count: 1, description: "" });
      saveSheet();
      render();
    });
  });

  // Notes
  app.querySelector("#notes-area")?.addEventListener("change", (e) => {
    if (state.sheet) {
      state.sheet.notes = e.target.value;
      saveSheet();
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
      state.colors[e.target.dataset.color] = e.target.value;
      applyColors();
      localStorage.setItem("foxyverse_colors", JSON.stringify(state.colors));
    });
  });
  app.querySelectorAll("[data-perm-view], [data-perm-edit]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      if (!state.isGM) return;
      const playerId = el.dataset.player;
      const sheetId = el.dataset.permView ?? el.dataset.permEdit;
      const kind = el.dataset.permView !== undefined ? "view" : "edit";
      const perms = JSON.parse(JSON.stringify(state.permissions));
      if (!perms[playerId]) perms[playerId] = { view: [], edit: [] };
      const arr = perms[playerId][kind] || [];
      if (e.target.checked) {
        if (!arr.includes(sheetId)) perms[playerId][kind] = [...arr, sheetId];
      } else {
        perms[playerId][kind] = arr.filter((id) => id !== sheetId);
      }
      await storage.setPermissions(perms);
      state.permissions = perms;
    });
  });

  app.querySelector("#btn-export-sheet")?.addEventListener("click", () => {
    if (!state.sheet) return;
    const blob = new Blob([JSON.stringify(state.sheet, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `foxyverse-${state.sheet.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  app.querySelector("#btn-import-sheet")?.addEventListener("click", () => document.getElementById("import-file-input")?.click());
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
      const sheet = JSON.parse(text);
      if (!sheet.id) sheet.id = crypto.randomUUID();
      storage.saveSheetToStorage(state.roomId, sheet);
      await storage.addSheetToRoom(sheet.id, getDisplayName(sheet));
      state.sheetIds = await storage.getSheetList();
      const names = await storage.getRoomData();
      state.sheetNames = names.sheetNames || {};
      await loadSheet(sheet.id);
      render();
    } catch (err) {
      OBR.notification.show("Invalid file");
    }
    e.target.value = "";
  });
}

export async function initApp() {
  await loadRoomData();
  const storedColors = localStorage.getItem("foxyverse_colors");
  if (storedColors) {
    try {
      state.colors = { ...state.colors, ...JSON.parse(storedColors) };
    } catch (_) {}
  }
  state.playerName = await storage.getPlayerName();
  try {
    state.partyPlayers = await OBR.party.getPlayers();
  } catch (_) {
    state.partyPlayers = [];
  }
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

  storage.onBroadcast((msg) => {
    if (msg.data?.type === "sheet_full" && msg.data.roomId === state.roomId && msg.data.sheet) {
      storage.saveSheetToStorage(state.roomId, msg.data.sheet);
      if (msg.data.sheet.id === state.activeSheetId) {
        state.sheet = msg.data.sheet;
        render();
      }
    }
    if (msg.data?.type === "chat") {
      state.chatMessages.push({ from: msg.data.from, body: msg.data.body });
      const msgsEl = document.getElementById("chat-messages");
      if (msgsEl && state.activeTab === "chat") {
        msgsEl.innerHTML += `<div class="chat-msg"><strong>${escapeAttr(msg.data.from)}:</strong> ${escapeAttr(msg.data.body)}</div>`;
      }
    }
  });

  OBR.room.onMetadataChange(async () => {
    await loadRoomData();
    render();
  });
}
