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
export const KNOWLEDGE_TIER_BONUS = { 1: 1, 2: 3, 3: 5, 4: 10 };

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
    actionFormula: "", // e.g. "agi/10 + level/5"
    actionModifier: "",
    speedModifier: "",
    spells: [], // { id, name, effect, cost, costType: 'hp'|'mp' }
    equipped: {}, // slotId -> itemId
    consumables: [], // { id, type, name, count, description, ... }
    others: [],
    weapons: [],  // + weaponSlots
    armor: [],    // + defense, magicalDefense, equippableSlots
    bags: [],
    notes: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Max HP = Constitution*2 (using total stat) */
export function getMaxHP(sheet) {
  const con = getStatTotal(sheet, "constitution");
  return Math.max(0, con * 2);
}

/** Max MP = Round((Intelligence + Focus)*0.75) */
export function getMaxMP(sheet) {
  const int = getStatTotal(sheet, "intelligence");
  const foc = getStatTotal(sheet, "focus");
  return Math.round((int + foc) * 0.75);
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

/** Actions per turn: RoundDown(agi/10) + RoundDown(level/5) + modifier */
export function getActionCount(sheet) {
  const agi = getStatTotal(sheet, "agility");
  const level = Number(sheet.bio?.level) || 1;
  const base = Math.floor(agi / 10) + Math.floor(level / 5);
  return base + evalModifierSimple(sheet.actionModifier);
}

/** Speed: agi/4 + 1d6 + modifier (display formula; actual roll is separate) */
export function getSpeedFormula(sheet) {
  const agi = getStatTotal(sheet, "agility");
  const mod = (sheet.speedModifier || "").trim();
  return mod ? `(${agi}/4 + 1d6) ${mod}` : `${agi}/4 + 1d6`;
}

export function evalModifier(modStr) {
  return evalModifierSimple(modStr);
}

export function getStatTotal(sheet, statId) {
  const s = sheet.stats?.[statId];
  if (!s) return 0;
  const base = Number(s.base) || 0;
  const xp = Number(s.xpBonus) || 0;
  const item = Number(s.itemBonus) || 0;
  const passive = Number(s.passiveBonus) || 0;
  return base + xp + item + passive;
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
