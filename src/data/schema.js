/**
 * In-memory character sheet shape: stat math, defaults, slot id lists, and pure helpers (no I/O).
 * @see docs/CODEBASE.md#supporting-modules
 */

/** Stat IDs used in formulas and UI */
export const STAT_IDS = [
  "constitution",
  "strength",
  "intelligence",
  "perception",
  "social",
  "agility",
  "focus",
];

/** All equipment slot IDs. Weapons first, then by group. */
export const SLOT_IDS = [
  "Weapon1",
  "Weapon2",
  "Weapon3",
  "Hat",
  "Face",
  "Necklace",
  "Pendant1",
  "Pendant2",
  "Pendant3",
  "Torso",
  "RightShoulder",
  "LeftShoulder",
  "LeftArm",
  "RightArm",
  "LeftWrist",
  "RightWrist",
  "LeftThumb",
  "LeftIndex",
  "LeftMiddle",
  "LeftRing",
  "LeftPinky",
  "RightThumb",
  "RightIndex",
  "RightMiddle",
  "RightRing",
  "RightPinky",
  "Belt",
  "LeftLeg",
  "RightLeg",
  "LeftAnkle",
  "RightAnkle",
  "LeftFoot",
  "RightFoot",
  "Other",
];

export const ITEM_TYPES = ["weapon", "armor", "consumable", "bag", "other"];

export const KNOWLEDGE_TIERS = [1, 2, 3, 4];
/** Numeric modifier per tier (tiers apply maluses: negative = bonus in roll terms). */
export const KNOWLEDGE_TIER_BONUS = { 1: -1, 2: -3, 3: -5, 4: -10 };

/** Default modifier string for rolls/UI (tier 0 → "+0"). */
export function formatKnowledgeTierModifier(tier) {
  const t = Math.max(0, Math.min(4, Number(tier) || 0));
  if (t === 0) return "+0";
  const n = KNOWLEDGE_TIER_BONUS[t];
  if (n == null || n === 0) return "+0";
  return n > 0 ? `+${n}` : String(n);
}

function zeroStat() {
  return { base: 0, xpBonus: 0, itemBonus: 0, passiveBonus: 0 };
}

function defaultStats() {
  const o = {};
  STAT_IDS.forEach((id) => { o[id] = zeroStat(); });
  return o;
}

export function createEmptySheet(id = crypto.randomUUID()) {
  return {
    id,
    theme: {
      bg: "#4b002c",
      ui: "#ffdbff",
      text: "#eba5ff",
    },
    bio: {
      name: "",
      surname: "",
      element: "",
      class: "",
      level: 1,
    },
    stats: defaultStats(),
    knowledge: [], // { id, name, tier: 1|2|3|4, enabled: boolean }
    tempHP: 0,
    currentHP: 0,
    currentMP: 0,
    currentFavor: 0,
    bonusAction: 0,
    bonusSpeed: 0,
    // Back-compat (older fields); avoid using in new UI.
    actionModifier: "",
    speedModifier: "",
    spells: [], // { id, name, effect, cost, costType: 'hp'|'mp', isContinuous, isArmed, useCounter }
    equipped: {}, // slotId -> itemId
    consumables: [], // { id, type, name, count, description, ... }
    others: [],
    weapons: [],  // + weaponSlots
    armor: [],    // + defense, magicalDefense, equippableSlots
    bags: [],
    notes: "",
    /** When true, normal click rolls immediately; Shift+click opens the talent roll prep modal. */
    autoQuickRoll: false,
    /** Elemental characters: max HP 1, damage to MP, special defenses and max MP formula. */
    isElemental: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function isElementalSheet(sheet) {
  return !!sheet?.isElemental;
}

/** Rounded baseline max HP (matches Sheets ROUND(Con*(level+1))) for elemental MP formula. */
export function getRoundedBaseMaxHP(sheet) {
  const con = getStatTotal(sheet, "constitution");
  const level = Number(sheet.bio?.level) || 1;
  return Math.round(con * (level + 1));
}

/** Max HP = totalConstitution * (level + 1); elementals always 1 */
export function getMaxHP(sheet) {
  if (isElementalSheet(sheet)) return 1;
  const con = getStatTotal(sheet, "constitution");
  const level = Number(sheet.bio?.level) || 1;
  return Math.max(0, con * (level + 1));
}

/** Max MP = ROUND((totalIntelligence + totalFocus)*0.75 + (level^2)/4); elementals add 0.75*(rounded max HP − 1) */
export function getMaxMP(sheet) {
  const int = getStatTotal(sheet, "intelligence");
  const foc = getStatTotal(sheet, "focus");
  const level = Number(sheet.bio?.level) || 1;
  const baseMp = Math.round((int + foc) * 0.75 + (level * level) / 4);
  if (!isElementalSheet(sheet)) return baseMp;
  const roundedHp = getRoundedBaseMaxHP(sheet);
  return Math.round(baseMp + (roundedHp - 1) * 0.75);
}

/** Max Favor = RoundUp((Level+1)/3) */
export function getMaxFavor(sheet) {
  const level = Number(sheet.bio?.level) || 1;
  return Math.ceil((level + 1) / 3);
}

/** Simple +/- modifier parsing for action/speed */
function evalModifierSimple(modStr) {
  const s = (modStr || "").trim();
  if (!s) return 0;
  const match = s.match(/^([+\-])\s*(\d+)$/);
  if (!match) return 0;
  return match[1] === "-" ? -parseInt(match[2], 10) : parseInt(match[2], 10);
}

/**
 * Actions per turn:
 * base = floor(level/5) + floor(agi/10), clamped to minimum 1
 * total = base + bonusAction
 */
export function getActionCount(sheet) {
  const agi = getStatTotal(sheet, "agility");
  const level = Number(sheet.bio?.level) || 1;
  const base = Math.floor(level / 5) + Math.floor(agi / 10);
  const clamped = Math.max(1, base);
  const bonus = Number(sheet.bonusAction ?? sheet.actionModifier) || 0;
  return clamped + bonus;
}

/** Speed display formula for the speed roll button (actual roll handled elsewhere) */
export function getSpeedFormula(sheet) {
  const agi = getStatTotal(sheet, "agility");
  const bonspe = Number(sheet.bonusSpeed ?? sheet.speedModifier) || 0;
  const sign = bonspe >= 0 ? `+${bonspe}` : String(bonspe);
  return `1d6 + ${agi}%5 ${sign !== "+0" ? sign : ""}`.trim();
}

export function evalModifier(modStr) {
  return evalModifierSimple(modStr);
}

export function getStatTotal(sheet, statId) {
  const sid = String(statId || "").toLowerCase();
  const s = sheet.stats?.[sid] || {};
  const base = Number(s.base) || 0;
  // XP is no longer part of totals in the new system.
  const xp = 0;
  const rowItem = Number(s.itemBonus) || 0;
  const passive = Number(s.passiveBonus) || 0;
  const equippedItems = getEquippedItemStatBonus(sheet, sid);
  return base + xp + passive + rowItem + equippedItems;
}

/** Knowledge bonus for a stat (sum of enabled knowledge bonuses by tier) */
export function getKnowledgeBonusForStat(sheet, _statId) {
  const list = sheet.knowledge || [];
  let sum = 0;
  list.forEach((k) => {
    if (k.enabled) sum += KNOWLEDGE_TIER_BONUS[k.tier] || 0;
  });
  return sum;
}

export function getDisplayName(sheet) {
  const n = sheet.bio?.name ?? "";
  const s = sheet.bio?.surname ?? "";
  if (n && s) return `${n} ${s}`;
  return n || s || "Unnamed";
}

export function findItemById(sheet, itemId) {
  const lists = [sheet.weapons, sheet.armor, sheet.consumables, sheet.others, sheet.bags].filter(Boolean);
  for (const list of lists) {
    const item = list.find((i) => i.id === itemId);
    if (item) return item;
  }
  return null;
}

/** Sum one stat's bonuses from all equipped items (each item at most once). Matches stats tab "Item" column. */
export function getEquippedItemStatBonus(sheet, statId) {
  const sid = String(statId || "").toLowerCase();
  if (!STAT_IDS.includes(sid)) return 0;
  const equipped = sheet.equipped || {};
  const seen = new Set();
  let sum = 0;
  for (const itemId of Object.values(equipped)) {
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    const it = findItemById(sheet, itemId);
    if (!it) continue;
    sum += Number(it[sid]) || 0;
  }
  return sum;
}

/** Sum Defense from all equipped armor (each item counted once). */
export function getSheetDefense(sheet) {
  let sum = 0;
  const equipped = sheet.equipped || {};
  const seen = new Set();
  for (const itemId of Object.values(equipped)) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const item = findItemById(sheet, itemId);
    if (item && item.defense != null) sum += Number(item.defense) || 0;
  }
  return sum;
}

/** Sum Magical Defense from all equipped armor (each item counted once). */
export function getSheetMagicalDefense(sheet) {
  let sum = 0;
  const equipped = sheet.equipped || {};
  const seen = new Set();
  for (const itemId of Object.values(equipped)) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const item = findItemById(sheet, itemId);
    if (item && item.magicalDefense != null) sum += Number(item.magicalDefense) || 0;
  }
  return sum;
}
