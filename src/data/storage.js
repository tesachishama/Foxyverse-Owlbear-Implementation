import OBR from "@owlbear-rodeo/sdk";
import { supabase } from "./supabase.js";
import { createEmptySheet, STAT_IDS } from "./schema.js";

// DB column reference: see `docs/DB_SCHEMA.sql` (project-provided, reference only).
const ROOM_META_KEY = "foxyverse";
const STORAGE_PREFIX = "foxyverse_sheet_";

/** Allow only simple identifiers for dynamic chat column names (env overrides). */
function sanitizeSqlIdent(name, fallback) {
  const s = String(name || "").trim();
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) ? s : fallback;
}

const CHAT_BODY_COL = sanitizeSqlIdent(import.meta.env.VITE_CHAT_MESSAGE_COLUMN, "content");
const CHAT_TIME_COL = sanitizeSqlIdent(import.meta.env.VITE_CHAT_TIME_COLUMN, "time_sent");

/** Resolve message body from a Supabase row (handles env column name + common fallbacks). */
export function getChatMessageText(row) {
  if (!row) return "";
  return row[CHAT_BODY_COL] ?? row.content ?? row.message ?? row.body ?? "";
}

function storageKey(roomId, sheetId) {
  return `${STORAGE_PREFIX}${roomId}_${sheetId}`;
}

function normalizePermissions(rows) {
  const permissions = {};
  (rows || []).forEach((row) => {
    if (!permissions[row.player_id]) permissions[row.player_id] = { view: [], edit: [] };
    if (row.can_view) permissions[row.player_id].view.push(row.sheet_id);
    if (row.can_edit) permissions[row.player_id].edit.push(row.sheet_id);
  });
  return permissions;
}

function getDisplayNameFromBio(bio) {
  return [bio?.name || "", bio?.surname || ""].join(" ").trim() || "Name Surname";
}

function parseSignedModifier(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return num > 0 ? `+${num}` : `${num}`;
}

function modifierToInt(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSectionKey(type) {
  if (type === "weapon") return "weapons";
  if (type === "armor") return "armor";
  if (type === "consumable") return "consumables";
  if (type === "bag") return "bags";
  return "others";
}

function computeUsableSlotsFromItem(item) {
  const expr = String(item?.equippableExpr || "").trim();
  if (expr) return { expr };
  const slots = item?.equippableSlots;
  return Array.isArray(slots) && slots.length ? { slots } : null;
}

function serializeUsedSlots(sheet, item) {
  const equippedSlots = Array.isArray(item?.usedSlots?.equippedSlots)
    ? item.usedSlots.equippedSlots
    : Object.keys(sheet.equipped || {}).filter((slotId) => sheet.equipped?.[slotId] === item.id);
  const out = {};
  if (equippedSlots.length) out.equippedSlots = equippedSlots;
  if (item.weaponSlots != null) out.weaponSlots = item.weaponSlots;
  return Object.keys(out).length ? out : null;
}

function deserializeUsedSlots(raw) {
  if (!raw) return { equippedSlots: [], weaponSlots: undefined };
  if (Array.isArray(raw)) return { equippedSlots: raw, weaponSlots: undefined };
  return {
    equippedSlots: Array.isArray(raw.equippedSlots) ? raw.equippedSlots : [],
    weaponSlots: raw.weaponSlots == null ? undefined : Number(raw.weaponSlots) || 1,
  };
}

async function ensureRoom(roomId) {
  const { error } = await supabase.from("room").upsert({ id: roomId });
  if (error) throw error;
}

async function listSheets(roomId) {
  const { data, error } = await supabase
    .from("sheet")
    .select("id, created_at, bio(name, surname)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function listPermissionsForRoom(roomId) {
  const sheets = await listSheets(roomId);
  const sheetIds = sheets.map((sheet) => sheet.id);
  if (sheetIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sheet_permissions")
    .select("sheet_id, player_id, can_view, can_edit")
    .in("sheet_id", sheetIds);
  if (error) throw error;
  return data || [];
}

async function fetchSheetRows(roomId, sheetId) {
  const [
    sheetRes,
    bioRes,
    statRes,
    talentRes,
    spellRes,
    currencyRes,
    itemRes,
  ] = await Promise.all([
    supabase.from("sheet").select("*").eq("room_id", roomId).eq("id", sheetId).single(),
    supabase.from("bio").select("*").eq("sheet_id", sheetId).maybeSingle(),
    supabase.from("stat").select("*").eq("sheet_id", sheetId),
    supabase.from("talent").select("*").eq("sheet_id", sheetId).order("position", { ascending: true }),
    supabase.from("spell").select("*").eq("sheet_id", sheetId).order("position", { ascending: true }),
    supabase.from("currency").select("*").eq("sheet_id", sheetId).maybeSingle(),
    supabase.from("item").select("*").eq("sheet_id", sheetId).order("position", { ascending: true }),
  ]);

  const singleErrors = [sheetRes.error, bioRes.error, currencyRes.error].filter(Boolean);
  const listErrors = [statRes.error, talentRes.error, spellRes.error, itemRes.error].filter(Boolean);
  const fatalSingleErrors = singleErrors.filter((error) => error.code !== "PGRST116");
  if (fatalSingleErrors.length) throw fatalSingleErrors[0];
  if (listErrors.length) throw listErrors[0];

  const items = itemRes.data || [];
  // Item-bound talents (sheet_id IS NULL, item_id IN sheet's items). Fetched after
  // items are known because the FK chain is item -> sheet, not talent -> sheet.
  let itemTalents = [];
  if (items.length) {
    const itemIds = items.map((it) => it.id);
    const itemTalentRes = await supabase
      .from("talent")
      .select("*")
      .in("item_id", itemIds);
    if (itemTalentRes.error) throw itemTalentRes.error;
    itemTalents = itemTalentRes.data || [];
  }

  return {
    sheet: sheetRes.data,
    bio: bioRes.data,
    stats: statRes.data || [],
    talents: talentRes.data || [],
    itemTalents,
    spells: spellRes.data || [],
    currency: currencyRes.data,
    items,
  };
}

function assembleSheet(sheetId, rows) {
  if (!rows.sheet) return null;
  const base = createEmptySheet(sheetId);
  base.createdAt = rows.sheet.created_at ? Date.parse(rows.sheet.created_at) || Date.now() : Date.now();
  base.updatedAt = rows.sheet.updated_at ? Date.parse(rows.sheet.updated_at) || Date.now() : Date.now();
  base.notes = rows.sheet.notes || "";
  base.tempHP = rows.sheet.temporary_health ?? 0;
  base.currentHP = rows.sheet.current_health ?? 0;
  base.currentMP = rows.sheet.current_mana ?? 0;
  base.currentFavor = rows.sheet.current_favor ?? 0;
  base.bonusAction = Number(rows.sheet.bonus_action) || 0;
  base.bonusSpeed = Number(rows.sheet.bonus_speed) || 0;
  base.actionModifier = parseSignedModifier(rows.sheet.bonus_action);
  base.speedModifier = parseSignedModifier(rows.sheet.bonus_speed);
  base.theme = {
    bg: rows.sheet.color_bg || base.theme.bg,
    ui: rows.sheet.color_ui || base.theme.ui,
    text: rows.sheet.color_text || base.theme.text,
  };
  base.isElemental = !!rows.sheet.is_elemental;
  base.autoQuickRoll = !!rows.sheet.auto_quick_roll;

  base.bio = {
    name: rows.bio?.name || "",
    surname: rows.bio?.surname || "",
    element: rows.bio?.element || "",
    class: rows.bio?.class || "",
    level: rows.bio?.level ?? 1,
  };

  rows.stats.forEach((row) => {
    if (!base.stats[row.stat_id]) return;
    base.stats[row.stat_id].base = row.base ?? 5;
    base.stats[row.stat_id].passiveBonus = row.passive ?? 0;
    base.stats[row.stat_id].xpBonus = 0;
    base.stats[row.stat_id].itemBonus = 0;
  });

  base.knowledge = rows.talents.map((row) => ({
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    tier: row.tier ?? 1,
    bonusOverride: row.bonus_override,
    enabled: !!row.is_enabled,
  }));

  base.spells = rows.spells.map((row) => ({
    id: row.id,
    name: row.name || "",
    effect: row.description || "",
    cost: row.cost ?? 0,
    costType: row.is_hp ? "hp" : "mp",
    isContinuous: !!row.is_continuous,
    isArmed: !!row.is_armed,
    useCounter: row.use_counter ?? 0,
  }));

  base.currency = {
    gold: rows.currency?.gold ?? 0,
    silver: rows.currency?.silver ?? 0,
    copper: rows.currency?.copper ?? 0,
  };

  const itemTalentsByItemId = new Map();
  (rows.itemTalents || []).forEach((row) => {
    if (!row?.item_id) return;
    const key = String(row.item_id);
    if (!itemTalentsByItemId.has(key)) itemTalentsByItemId.set(key, []);
    itemTalentsByItemId.get(key).push(row);
  });
  itemTalentsByItemId.forEach((arr) => {
    arr.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  });

  rows.items.forEach((row) => {
    const section = toSectionKey(row.type);
    const usedSlots = deserializeUsedSlots(row.used_slots);
    const item = {
      id: row.id,
      type: row.type,
      name: row.name || "",
      description: row.description || "",
      count: row.quantity ?? 1,
      defense: row.physical_defense ?? 0,
      magicalDefense: row.magical_defense ?? 0,
      equippableSlots: Array.isArray(row.usable_slots?.slots)
        ? row.usable_slots.slots
        : Array.isArray(row.usable_slots)
          ? row.usable_slots
          : [],
      equippableExpr: typeof row.usable_slots?.expr === "string" ? row.usable_slots.expr : "",
      usedSlots: usedSlots.equippedSlots.length ? { equippedSlots: usedSlots.equippedSlots } : null,
      weaponSlots: usedSlots.weaponSlots,
      constitution: row.constitution ?? 0,
      strength: row.strength ?? 0,
      intelligence: row.intelligence ?? 0,
      perception: row.perception ?? 0,
      social: row.social ?? 0,
      agility: row.agility ?? 0,
      focus: row.focus ?? 0,
      talents: (itemTalentsByItemId.get(String(row.id)) || []).map((r) => ({
        id: r.id,
        name: r.name || "",
        description: r.description || "",
        tier: r.tier ?? 1,
        bonusOverride: r.bonus_override,
        enabled: !!r.is_enabled,
      })),
    };
    base[section].push(item);
    usedSlots.equippedSlots.forEach((slotId) => {
      base.equipped[slotId] = row.id;
    });
  });

  return base;
}

function finiteNumOrUndefined(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function patchToSheetUpdate(patch = {}) {
  const update = {};
  if ("isElemental" in patch) update.is_elemental = !!patch.isElemental;
  if ("currentHP" in patch) {
    const n = finiteNumOrUndefined(patch.currentHP);
    if (n !== undefined) update.current_health = n;
  }
  if ("tempHP" in patch) {
    const n = finiteNumOrUndefined(patch.tempHP);
    if (n !== undefined) update.temporary_health = n;
  }
  if ("currentMP" in patch) {
    const n = finiteNumOrUndefined(patch.currentMP);
    if (n !== undefined) update.current_mana = n;
  }
  if ("currentFavor" in patch) {
    const n = finiteNumOrUndefined(patch.currentFavor);
    if (n !== undefined) update.current_favor = n;
  }
  if ("bonusAction" in patch) {
    const n = finiteNumOrUndefined(patch.bonusAction);
    if (n !== undefined) update.bonus_action = Math.trunc(n);
  }
  if ("bonusSpeed" in patch) {
    const n = finiteNumOrUndefined(patch.bonusSpeed);
    if (n !== undefined) update.bonus_speed = Math.trunc(n);
  }
  if ("actionModifier" in patch) update.bonus_action = modifierToInt(patch.actionModifier);
  if ("speedModifier" in patch) update.bonus_speed = modifierToInt(patch.speedModifier);
  if ("notes" in patch) update.notes = String(patch.notes || "");
  if ("theme" in patch && patch.theme && typeof patch.theme === "object") {
    if ("bg" in patch.theme) update.color_bg = patch.theme.bg || "#4b002c";
    if ("ui" in patch.theme) update.color_ui = patch.theme.ui || "#ffdbff";
    if ("text" in patch.theme) update.color_text = patch.theme.text || "#eba5ff";
  }
  if ("autoQuickRoll" in patch) update.auto_quick_roll = !!patch.autoQuickRoll;
  return update;
}

function patchToBioUpdate(patch = {}) {
  const update = {};
  if ("name" in patch) update.name = String(patch.name || "");
  if ("surname" in patch) update.surname = String(patch.surname || "");
  if ("element" in patch) update.element = String(patch.element || "");
  if ("class" in patch) update.class = String(patch.class || "");
  if ("level" in patch) update.level = Number(patch.level) || 1;
  return update;
}

export async function updateSheetCore(roomId, sheetId, patch) {
  await ensureRoom(roomId);
  const update = patchToSheetUpdate(patch);
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("sheet").update(update).eq("room_id", roomId).eq("id", sheetId);
  if (error) throw error;
}

export async function updateBio(roomId, sheetId, patch) {
  await ensureRoom(roomId);
  const update = patchToBioUpdate(patch);
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("bio").upsert({ sheet_id: sheetId, ...update });
  if (error) throw error;
}

export async function updateCurrency(roomId, sheetId, patch) {
  await ensureRoom(roomId);
  const update = {};
  if ("gold" in patch) update.gold = Number(patch.gold) || 0;
  if ("silver" in patch) update.silver = Number(patch.silver) || 0;
  if ("copper" in patch) update.copper = Number(patch.copper) || 0;
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("currency").upsert({ sheet_id: sheetId, ...update });
  if (error) throw error;
}

export async function updateStat(roomId, sheetId, statId, patch) {
  await ensureRoom(roomId);
  const update = { sheet_id: sheetId, stat_id: statId };
  if ("base" in patch) update.base = Number(patch.base) || 5;
  if ("passiveBonus" in patch) update.passive = Number(patch.passiveBonus) || 0;
  const { error } = await supabase.from("stat").upsert(update);
  if (error) throw error;
}

export async function upsertTalent(roomId, sheetId, row) {
  await ensureRoom(roomId);
  const payload = {
    id: row.id,
    sheet_id: sheetId,
    position: Number(row.position) || 0,
    name: row.name || "",
    description: row.description || "",
    tier: row.tier ?? 1,
    bonus_override: row.bonus_override == null ? null : String(row.bonus_override),
    is_enabled: !!row.is_enabled,
  };
  const { error } = await supabase.from("talent").upsert(payload);
  if (error) throw error;
}

export async function updateTalentFields(roomId, _sheetId, talentId, patch) {
  // sheetId kept in signature for backward compatibility; we look up by talent.id
  // alone so this works for both sheet-bound and item-bound talents.
  await ensureRoom(roomId);
  const update = {};
  if ("position" in patch) update.position = Number(patch.position) || 0;
  if ("name" in patch) update.name = String(patch.name || "");
  if ("description" in patch) update.description = String(patch.description || "");
  if ("tier" in patch) update.tier = patch.tier ?? 1;
  if ("bonus_override" in patch) update.bonus_override = patch.bonus_override == null ? null : String(patch.bonus_override);
  if ("is_enabled" in patch) update.is_enabled = !!patch.is_enabled;
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("talent").update(update).eq("id", talentId);
  if (error) throw error;
}

export async function deleteTalent(roomId, _sheetId, talentId) {
  await ensureRoom(roomId);
  const { error } = await supabase.from("talent").delete().eq("id", talentId);
  if (error) throw error;
}

export async function setTalentPositions(roomId, sheetId, orderedIds) {
  await ensureRoom(roomId);
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;
  // Position-only updates by id. We do NOT upsert with sheet_id here because that
  // would violate the talent_owner_xor check for item-bound talents that may be
  // included in the order.
  const updates = orderedIds.map((id, position) =>
    supabase.from("talent").update({ position }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r?.error)?.error;
  if (firstErr) throw firstErr;
}

/** Insert/upsert a talent bound to a specific item (sheet_id NULL, item_id set). */
export async function upsertItemTalent(roomId, itemId, row) {
  await ensureRoom(roomId);
  const payload = {
    id: row.id,
    sheet_id: null,
    item_id: itemId,
    position: Number(row.position) || 0,
    name: row.name || "",
    description: row.description || "",
    tier: row.tier ?? 1,
    bonus_override: row.bonus_override == null ? null : String(row.bonus_override),
    is_enabled: !!row.is_enabled,
  };
  const { error } = await supabase.from("talent").upsert(payload);
  if (error) throw error;
}

/** Patch an item-bound talent. Same as updateTalentFields but kept named for clarity. */
export async function updateItemTalentFields(roomId, talentId, patch) {
  return updateTalentFields(roomId, null, talentId, patch);
}

/** Delete an item-bound talent by id. */
export async function deleteItemTalent(roomId, talentId) {
  return deleteTalent(roomId, null, talentId);
}

export async function upsertSpell(roomId, sheetId, row) {
  await ensureRoom(roomId);
  const payload = {
    id: row.id,
    sheet_id: sheetId,
    position: Number(row.position) || 0,
    name: row.name || "",
    description: row.description || "",
    cost: Number(row.cost) || 0,
    is_hp: !!row.is_hp,
    is_continuous: !!row.is_continuous,
    is_armed: !!row.is_armed,
    use_counter: Number(row.use_counter) || 0,
  };
  const { error } = await supabase.from("spell").upsert(payload);
  if (error) throw error;
}

export async function updateSpellFields(roomId, sheetId, spellId, patch) {
  await ensureRoom(roomId);
  const update = {};
  if ("position" in patch) update.position = Number(patch.position) || 0;
  if ("name" in patch) update.name = String(patch.name || "");
  if ("description" in patch) update.description = String(patch.description || "");
  if ("cost" in patch) update.cost = Number(patch.cost) || 0;
  if ("is_hp" in patch) update.is_hp = !!patch.is_hp;
  if ("is_continuous" in patch) update.is_continuous = !!patch.is_continuous;
  if ("is_armed" in patch) update.is_armed = !!patch.is_armed;
  if ("use_counter" in patch) update.use_counter = Number(patch.use_counter) || 0;
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("spell").update(update).eq("sheet_id", sheetId).eq("id", spellId);
  if (error) throw error;
}

export async function deleteSpell(roomId, sheetId, spellId) {
  await ensureRoom(roomId);
  const { error } = await supabase.from("spell").delete().eq("sheet_id", sheetId).eq("id", spellId);
  if (error) throw error;
}

export async function setSpellPositions(roomId, sheetId, orderedIds) {
  await ensureRoom(roomId);
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;
  // IMPORTANT: spell.name is NOT NULL. Using upsert here can attempt inserts with
  // partial rows (only id/sheet_id/position) and violate NOT NULL constraints.
  // Reordering should only ever update positions of existing spells.
  const updates = orderedIds.map((id, position) =>
    supabase.from("spell").update({ position }).eq("sheet_id", sheetId).eq("id", id)
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r?.error)?.error;
  if (firstErr) throw firstErr;
}

export async function upsertItem(roomId, sheetId, row) {
  await ensureRoom(roomId);
  const payload = {
    id: row.id,
    sheet_id: sheetId,
    type: row.type || "other",
    position: Number(row.position) || 0,
    name: row.name || "",
    description: row.description || "",
    quantity: Number(row.quantity) || 1,
    physical_defense: Number(row.physical_defense) || 0,
    magical_defense: Number(row.magical_defense) || 0,
    constitution: Number(row.constitution) || 0,
    strength: Number(row.strength) || 0,
    intelligence: Number(row.intelligence) || 0,
    perception: Number(row.perception) || 0,
    social: Number(row.social) || 0,
    agility: Number(row.agility) || 0,
    focus: Number(row.focus) || 0,
    usable_slots: row.usable_slots ?? null,
    used_slots: row.used_slots ?? null,
  };
  const { error } = await supabase.from("item").upsert(payload);
  if (error) throw error;
}

export async function updateItemFields(roomId, sheetId, itemId, patch) {
  await ensureRoom(roomId);
  const update = {};
  if ("type" in patch) update.type = patch.type || "other";
  if ("position" in patch) update.position = Number(patch.position) || 0;
  if ("name" in patch) update.name = String(patch.name || "");
  if ("description" in patch) update.description = String(patch.description || "");
  if ("quantity" in patch) update.quantity = Number(patch.quantity) || 1;
  if ("physical_defense" in patch) update.physical_defense = patch.physical_defense == null ? 0 : Number(patch.physical_defense) || 0;
  if ("magical_defense" in patch) update.magical_defense = patch.magical_defense == null ? 0 : Number(patch.magical_defense) || 0;
  if ("constitution" in patch) update.constitution = Number(patch.constitution) || 0;
  if ("strength" in patch) update.strength = Number(patch.strength) || 0;
  if ("intelligence" in patch) update.intelligence = Number(patch.intelligence) || 0;
  if ("perception" in patch) update.perception = Number(patch.perception) || 0;
  if ("social" in patch) update.social = Number(patch.social) || 0;
  if ("agility" in patch) update.agility = Number(patch.agility) || 0;
  if ("focus" in patch) update.focus = Number(patch.focus) || 0;
  if ("usable_slots" in patch) update.usable_slots = patch.usable_slots ?? null;
  if ("used_slots" in patch) update.used_slots = patch.used_slots ?? null;
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("item").update(update).eq("sheet_id", sheetId).eq("id", itemId);
  if (error) throw error;
}

export async function deleteItem(roomId, sheetId, itemId) {
  await ensureRoom(roomId);
  const { error } = await supabase.from("item").delete().eq("sheet_id", sheetId).eq("id", itemId);
  if (error) throw error;
}

export async function setItemPositions(roomId, sheetId, orderedIds) {
  await ensureRoom(roomId);
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;
  // IMPORTANT: item.type (and other columns) are NOT NULL. Upserting partial rows
  // (only id/sheet_id/position) violates constraints. Reordering must only update position.
  const updates = orderedIds.map((id, position) =>
    supabase.from("item").update({ position }).eq("sheet_id", sheetId).eq("id", id)
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r?.error)?.error;
  if (firstErr) throw firstErr;
}

async function persistRows(roomId, sheet) {
  await ensureRoom(roomId);

  const sheetRow = {
    id: sheet.id,
    room_id: roomId,
    is_elemental: !!sheet.isElemental,
    auto_quick_roll: !!sheet.autoQuickRoll,
    current_health: sheet.currentHP ?? 0,
    temporary_health: sheet.tempHP ?? 0,
    current_mana: sheet.currentMP ?? 0,
    current_favor: sheet.currentFavor ?? 0,
    bonus_action: Number(sheet.bonusAction ?? modifierToInt(sheet.actionModifier)) || 0,
    bonus_speed: Number(sheet.bonusSpeed ?? modifierToInt(sheet.speedModifier)) || 0,
    notes: sheet.notes || "",
    color_bg: sheet.theme?.bg || "#4b002c",
    color_ui: sheet.theme?.ui || "#ffdbff",
    color_text: sheet.theme?.text || "#eba5ff",
  };
  const { error: sheetError } = await supabase.from("sheet").upsert(sheetRow);
  if (sheetError) throw sheetError;

  const bioRow = {
    sheet_id: sheet.id,
    name: sheet.bio?.name || "",
    surname: sheet.bio?.surname || "",
    element: sheet.bio?.element || "",
    class: sheet.bio?.class || "",
    level: Number(sheet.bio?.level) || 1,
  };
  const { error: bioError } = await supabase.from("bio").upsert(bioRow);
  if (bioError) throw bioError;

  const statRows = STAT_IDS.map((statId) => ({
    sheet_id: sheet.id,
    stat_id: statId,
    base: Number(sheet.stats?.[statId]?.base) || 5,
    passive: Number(sheet.stats?.[statId]?.passiveBonus) || 0,
  }));
  const { error: deleteStatError } = await supabase.from("stat").delete().eq("sheet_id", sheet.id);
  if (deleteStatError) throw deleteStatError;
  const { error: statError } = await supabase.from("stat").insert(statRows);
  if (statError) throw statError;

  const talentRows = (sheet.knowledge || []).map((talent, position) => ({
    id: talent.id,
    sheet_id: sheet.id,
    position,
    name: talent.name || "",
    description: talent.description || "",
    tier: talent.tier ?? 1,
    bonus_override: talent.bonusOverride ?? null,
    is_enabled: !!talent.enabled,
  }));
  const { error: deleteTalentError } = await supabase.from("talent").delete().eq("sheet_id", sheet.id);
  if (deleteTalentError) throw deleteTalentError;
  if (talentRows.length) {
    const { error: talentError } = await supabase.from("talent").insert(talentRows);
    if (talentError) throw talentError;
  }

  const spellRows = (sheet.spells || []).map((spell, position) => ({
    id: spell.id,
    sheet_id: sheet.id,
    position,
    name: spell.name || "",
    description: spell.effect || "",
    cost: Number(spell.cost) || 0,
    is_hp: (spell.costType || "mp") === "hp",
    is_continuous: !!spell.isContinuous,
    is_armed: !!spell.isArmed,
    use_counter: Number(spell.useCounter) || 0,
  }));
  const { error: deleteSpellError } = await supabase.from("spell").delete().eq("sheet_id", sheet.id);
  if (deleteSpellError) throw deleteSpellError;
  if (spellRows.length) {
    const { error: spellError } = await supabase.from("spell").insert(spellRows);
    if (spellError) throw spellError;
  }

  const currencyRow = {
    sheet_id: sheet.id,
    gold: Number(sheet.currency?.gold) || 0,
    silver: Number(sheet.currency?.silver) || 0,
    copper: Number(sheet.currency?.copper) || 0,
  };
  const { error: currencyError } = await supabase.from("currency").upsert(currencyRow);
  if (currencyError) throw currencyError;

  const allItems = [
    ...(sheet.consumables || []).map((item) => ({ ...item, type: "consumable" })),
    ...(sheet.others || []).map((item) => ({ ...item, type: "other" })),
    ...(sheet.weapons || []).map((item) => ({ ...item, type: "weapon" })),
    ...(sheet.armor || []).map((item) => ({ ...item, type: "armor" })),
    ...(sheet.bags || []).map((item) => ({ ...item, type: "bag" })),
  ];
  const itemRows = allItems.map((item, position) => ({
    id: item.id,
    sheet_id: sheet.id,
    type: item.type || "other",
    position,
    name: item.name || "",
    description: item.description || "",
    quantity: Number(item.count) || 1,
    physical_defense: Number(item.defense) || 0,
    magical_defense: Number(item.magicalDefense) || 0,
    constitution: Number(item.constitution) || 0,
    strength: Number(item.strength) || 0,
    intelligence: Number(item.intelligence) || 0,
    perception: Number(item.perception) || 0,
    social: Number(item.social) || 0,
    agility: Number(item.agility) || 0,
    focus: Number(item.focus) || 0,
    usable_slots: computeUsableSlotsFromItem(item),
    used_slots: serializeUsedSlots(sheet, item),
  }));
  const { error: deleteItemError } = await supabase.from("item").delete().eq("sheet_id", sheet.id);
  if (deleteItemError) throw deleteItemError;
  if (itemRows.length) {
    const { error: itemError } = await supabase.from("item").insert(itemRows);
    if (itemError) throw itemError;
  }

  // Re-insert item-bound talents. The DELETE on item cascades to talent rows
  // referencing those items, so we have a clean slate. Walk weapons/armor and
  // emit a row per attached talent.
  const itemTalentRows = [];
  ["weapons", "armor"].forEach((sectionKey) => {
    (sheet[sectionKey] || []).forEach((item) => {
      if (!item?.id) return;
      const list = Array.isArray(item.talents) && item.talents.length
        ? item.talents
        : item.talent
          ? [item.talent]
          : [];
      list.forEach((tal, position) => {
        if (!tal?.id) return;
        itemTalentRows.push({
          id: tal.id,
          sheet_id: null,
          item_id: item.id,
          position,
          name: tal.name || "",
          description: tal.description || "",
          tier: tal.tier ?? 1,
          bonus_override: tal.bonusOverride ?? null,
          is_enabled: !!tal.enabled,
        });
      });
    });
  });
  if (itemTalentRows.length) {
    const { error: itemTalentError } = await supabase.from("talent").insert(itemTalentRows);
    if (itemTalentError) throw itemTalentError;
  }
}

export async function getRoomData() {
  const roomId = await getRoomId();
  const [meta, sheets, permissionRows] = await Promise.all([
    OBR.room.getMetadata(),
    listSheets(roomId),
    listPermissionsForRoom(roomId),
  ]);
  return {
    ...(meta[ROOM_META_KEY] || {}),
    sheetIds: sheets.map((sheet) => sheet.id),
    sheetNames: Object.fromEntries(
      sheets.map((sheet) => [sheet.id, getDisplayNameFromBio(Array.isArray(sheet.bio) ? sheet.bio[0] : sheet.bio)])
    ),
    permissions: normalizePermissions(permissionRows),
  };
}

export async function setRoomData(update) {
  const meta = await OBR.room.getMetadata();
  await OBR.room.setMetadata({
    ...meta,
    [ROOM_META_KEY]: { ...(meta[ROOM_META_KEY] || {}), ...update },
  });
}

export async function setFieldLock(lockId, value) {
  const roomData = await getRoomData();
  const fieldLocks = { ...(roomData.fieldLocks || {}) };
  if (value) fieldLocks[lockId] = value;
  else delete fieldLocks[lockId];
  await setRoomData({ fieldLocks });
}

export async function getSheetList() {
  const roomId = await getRoomId();
  const sheets = await listSheets(roomId);
  return sheets.map((sheet) => sheet.id);
}

export async function addSheetToRoom(sheetId) {
  const roomId = await getRoomId();
  const sheet = getSheetFromStorage(roomId, sheetId) || createEmptySheet(sheetId);
  await persistRows(roomId, sheet);
}

export async function getSheetNameInRoom(sheetId) {
  const { data, error } = await supabase.from("bio").select("name, surname").eq("sheet_id", sheetId).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return getDisplayNameFromBio(data);
}

export async function setSheetNameInRoom() {
  return;
}

export async function removeSheetFromRoom(sheetId) {
  const roomId = await getRoomId();
  const roomData = await getRoomData();
  const tokenToSheet = { ...(roomData.tokenToSheet || {}) };
  Object.keys(tokenToSheet).forEach((tid) => {
    if (tokenToSheet[tid] === sheetId) delete tokenToSheet[tid];
  });
  await setRoomData({ tokenToSheet });
  const { error } = await supabase.from("sheet").delete().eq("room_id", roomId).eq("id", sheetId);
  if (error) throw error;
}

export async function getPermissions() {
  const roomId = await getRoomId();
  return normalizePermissions(await listPermissionsForRoom(roomId));
}

export async function setPermissions(permissions) {
  const roomId = await getRoomId();
  const sheets = await listSheets(roomId);
  const sheetIds = new Set(sheets.map((sheet) => sheet.id));
  const rows = [];
  Object.entries(permissions || {}).forEach(([playerId, perms]) => {
    const viewSet = new Set(perms?.view || []);
    const editSet = new Set(perms?.edit || []);
    [...new Set([...viewSet, ...editSet])].forEach((sheetId) => {
      if (!sheetIds.has(sheetId)) return;
      rows.push({
        sheet_id: sheetId,
        player_id: playerId,
        can_view: viewSet.has(sheetId) || editSet.has(sheetId),
        can_edit: editSet.has(sheetId),
      });
    });
  });
  const { error: deleteError } = await supabase.from("sheet_permissions").delete().in("sheet_id", [...sheetIds]);
  if (deleteError) throw deleteError;
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("sheet_permissions").insert(rows);
    if (insertError) throw insertError;
  }
}

export async function getTokenToSheet() {
  const d = await getRoomData();
  return d.tokenToSheet || {};
}

export async function linkTokenToSheet(tokenId, sheetId) {
  const d = await getRoomData();
  const tokenToSheet = { ...(d.tokenToSheet || {}) };
  if (sheetId) tokenToSheet[tokenId] = sheetId;
  else delete tokenToSheet[tokenId];
  await setRoomData({ tokenToSheet });
}

export async function getRoomId() {
  return OBR.room.id;
}

export function getSheetFromStorage(roomId, sheetId) {
  try {
    const raw = localStorage.getItem(storageKey(roomId, sheetId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getSheet(roomId, sheetId, options = {}) {
  const { forceRefresh = false } = options;
  const cached = forceRefresh ? null : getSheetFromStorage(roomId, sheetId);
  if (cached) return cached;
  const rows = await fetchSheetRows(roomId, sheetId);
  const sheet = assembleSheet(sheetId, rows);
  if (sheet) saveSheetToStorage(roomId, sheet, { persistRemote: false });
  return sheet;
}

export function saveSheetToStorage(roomId, sheet, options = {}) {
  const { persistRemote = true } = options;
  const nextSheet = { ...sheet, updatedAt: Date.now() };
  localStorage.setItem(storageKey(roomId, sheet.id), JSON.stringify(nextSheet));
  if (!persistRemote) return;
  persistSheet(roomId, nextSheet).catch((error) => {
    console.error("Failed to persist sheet", error);
  });
}

export async function persistSheet(roomId, sheet) {
  const nextSheet = { ...sheet, updatedAt: Date.now() };
  localStorage.setItem(storageKey(roomId, nextSheet.id), JSON.stringify(nextSheet));
  await persistRows(roomId, nextSheet);
}

export function removeSheetFromStorage(roomId, sheetId) {
  localStorage.removeItem(storageKey(roomId, sheetId));
}

export async function getAllSheets(roomId) {
  const sheets = await listSheets(roomId);
  return Promise.all(sheets.map((sheet) => getSheet(roomId, sheet.id, { forceRefresh: true })));
}

async function eventBelongsToRoom(roomId, payload) {
  const table = payload?.table;
  if (table === "sheet") {
    const row = payload.new || payload.old;
    return row?.room_id === roomId;
  }
  let sheetId = payload?.new?.sheet_id || payload?.old?.sheet_id;
  if (!sheetId && table === "talent") {
    // Item-bound talents have sheet_id NULL but reference an item. Resolve the
    // item's owning sheet so this change still triggers a reload in the room.
    const itemId = payload?.new?.item_id || payload?.old?.item_id;
    if (itemId) {
      const { data: itemRow, error: itemErr } = await supabase
        .from("item")
        .select("sheet_id")
        .eq("id", itemId)
        .maybeSingle();
      if (!itemErr && itemRow?.sheet_id) sheetId = itemRow.sheet_id;
    }
  }
  if (!sheetId) return false;
  const { data, error } = await supabase.from("sheet").select("room_id").eq("id", sheetId).single();
  return !error && data?.room_id === roomId;
}

/**
 * Room chat: body column defaults to `content`; time column defaults to `time_sent`.
 * Override with VITE_CHAT_MESSAGE_COLUMN / VITE_CHAT_TIME_COLUMN if your table differs (e.g. message, created_at).
 */
export async function listRecentChat(roomId, limit = 200) {
  const selectCols = `id, ${CHAT_TIME_COL}, player_id, sheet_id, ${CHAT_BODY_COL}`;
  const { data, error } = await supabase
    .from("chat")
    .select(selectCols)
    .eq("room_id", roomId)
    .order(CHAT_TIME_COL, { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data || [];
  return rows.slice().reverse();
}

export async function insertChatMessage(roomId, { playerId, sheetId, body }) {
  await ensureRoom(roomId);
  const insertPayload = {
    room_id: roomId,
    player_id: playerId || "",
    sheet_id: sheetId || null,
  };
  insertPayload[CHAT_BODY_COL] = body || "";
  const selectCols = `id, ${CHAT_TIME_COL}, player_id, sheet_id, ${CHAT_BODY_COL}`;
  const { data, error } = await supabase.from("chat").insert(insertPayload).select(selectCols);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error(
      'Chat insert returned no row. Check RLS policies for "chat" (INSERT must return the new row to the client).'
    );
  }
  return row;
}

export async function updateChatMessageBody(roomId, messageId, body) {
  await ensureRoom(roomId);
  const patch = { [CHAT_BODY_COL]: body || "" };
  const selectCols = `id, ${CHAT_TIME_COL}, player_id, sheet_id, ${CHAT_BODY_COL}`;
  const { data, error } = await supabase
    .from("chat")
    .update(patch)
    .eq("id", messageId)
    .eq("room_id", roomId)
    .select(selectCols);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error(
      'Chat update returned no row. Check RLS policies for "chat" (UPDATE must allow the client to update this row).'
    );
  }
  return row;
}

export async function deleteChatMessage(roomId, messageId) {
  const { error } = await supabase.from("chat").delete().eq("id", messageId).eq("room_id", roomId);
  if (error) throw error;
}

/** Active chat channel (same instance used for broadcast after subscribe). */
let chatRealtimeChannel = null;
let chatRealtimeRoomId = null;

/**
 * Notify all subscribers that a message was removed (Realtime Broadcast).
 * Use after a successful delete so every client updates even if postgres DELETE events are missing.
 */
export async function broadcastChatMessageDeleted(roomId, messageId) {
  const sendOn = async (channel) => {
    const { error } = await channel.send({
      type: "broadcast",
      event: "chat_deleted",
      payload: { id: messageId },
    });
    if (error) console.warn("chat_deleted broadcast failed", error);
  };

  // Preferred: reuse the subscribed channel.
  if (chatRealtimeChannel && chatRealtimeRoomId === roomId) {
    await sendOn(chatRealtimeChannel);
    return;
  }

  // Fallback: create a channel and join, then broadcast.
  const temp = supabase.channel(`foxyverse-chat-${roomId}`);
  try {
    await temp.subscribe();
    await sendOn(temp);
  } finally {
    try {
      supabase.removeChannel(temp);
    } catch (_) {}
  }
}

/**
 * Notify subscribers that a message body changed (Realtime Broadcast).
 * Use after a successful UPDATE when postgres UPDATE events may not reach every client.
 */
export async function broadcastChatMessageUpdated(roomId, { id, body }) {
  const sendOn = async (ch) => {
    const { error } = await ch.send({
      type: "broadcast",
      event: "chat_updated",
      payload: { id, body },
    });
    if (error) console.warn("chat_updated broadcast failed", error);
  };

  if (chatRealtimeChannel && chatRealtimeRoomId === roomId) {
    await sendOn(chatRealtimeChannel);
    return;
  }

  const temp = supabase.channel(`foxyverse-chat-${roomId}`);
  try {
    await temp.subscribe();
    await sendOn(temp);
  } finally {
    try {
      supabase.removeChannel(temp);
    } catch (_) {}
  }
}

/** Subscribe to chat lines for a room (INSERT; postgres DELETE/UPDATE; broadcast delete/update). */
export function subscribeToChat(roomId, onInsert, onDelete, onBroadcastDelete, onChatBodyUpdate) {
  const channel = supabase.channel(`foxyverse-chat-${roomId}`);
  chatRealtimeChannel = channel;
  chatRealtimeRoomId = roomId;
  channel
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat", filter: `room_id=eq.${roomId}` },
      (payload) => {
        onInsert(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "chat" },
      (payload) => {
        if (typeof onDelete === "function") onDelete(payload.old);
      }
    )
    .on("broadcast", { event: "chat_deleted" }, (payload) => {
      const id = payload?.payload?.id;
      if (id != null && typeof onBroadcastDelete === "function") onBroadcastDelete(id);
    });
  if (typeof onChatBodyUpdate === "function") {
    channel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new;
          if (!row?.id) return;
          onChatBodyUpdate({ id: row.id, body: getChatMessageText(row) });
        }
      )
      .on("broadcast", { event: "chat_updated" }, (payload) => {
        const p = payload?.payload;
        if (p?.id != null && typeof p.body === "string") onChatBodyUpdate({ id: p.id, body: p.body });
      });
  }
  channel.subscribe();
  return () => {
    if (chatRealtimeChannel === channel) {
      chatRealtimeChannel = null;
      chatRealtimeRoomId = null;
    }
    supabase.removeChannel(channel);
  };
}

export function subscribeToRoom(roomId, callback) {
  const channel = supabase
    .channel(`foxyverse-room-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "sheet" }, async (payload) => {
      // DELETE payloads may not always include enough data to reliably filter by room.
      // We always notify and let the app reconcile by reloading room state.
      if (payload?.eventType === "DELETE") {
        callback(payload);
        return;
      }
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "sheet_permissions" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "bio" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "stat" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "talent" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "spell" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "currency" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "item" }, async (payload) => {
      if (await eventBelongsToRoom(roomId, payload)) callback(payload);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getPlayerId() {
  return OBR.player.id;
}

export async function getPlayerRole() {
  return OBR.player.getRole();
}

export async function getPlayerName() {
  return OBR.player.getName();
}
