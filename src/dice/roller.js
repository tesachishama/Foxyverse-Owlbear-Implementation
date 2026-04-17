/**
 * Roll types and execution (new spec only).
 *
 * Chat command syntax: /<type> <formula>
 * Inline button syntax: [<type> <formula>]
 * Not case sensitive. Old [type:expr] is intentionally not supported.
 */
import { evaluateFormula, formulaHasDice } from "./parser.js";
import {
  getActionCount,
  getMaxFavor,
  getMaxHP,
  getMaxMP,
  getSheetDefense as getDef,
  getSheetMagicalDefense as getMagDef,
  getStatTotal,
} from "../data/schema.js";

function stripDiacritics(text) {
  const s = String(text || "");
  // Best-effort; fallback keeps the string unchanged.
  try {
    return s.normalize("NFD").replace(/\p{Diacritic}+/gu, "");
  } catch (_) {
    return s
      .replace(/[éèêë]/gi, "e")
      .replace(/[àâä]/gi, "a")
      .replace(/[îï]/gi, "i")
      .replace(/[ôö]/gi, "o")
      .replace(/[ùûü]/gi, "u")
      .replace(/[ç]/gi, "c");
  }
}

function normalizeKey(text) {
  return stripDiacritics(text).trim().toLowerCase();
}

const STAT_TYPE_ALIASES = {
  constitution: "constitution",
  con: "constitution",
  strength: "strength",
  str: "strength",
  force: "strength",
  for: "strength",
  intelligence: "intelligence",
  int: "intelligence",
  perception: "perception",
  per: "perception",
  social: "social",
  soc: "social",
  agility: "agility",
  agi: "agility",
  agilite: "agility",
  focus: "focus",
  foc: "focus",
};

const ROLL_TYPE_ALIASES = {
  // damage
  physicaldamage: "pdmg",
  pdmg: "pdmg",
  degatphysique: "pdmg",
  dgttphysique: "pdmg", // tolerate typos
  dgtp: "pdmg",

  magicaldamage: "mdmg",
  mdmg: "mdmg",
  degatmagique: "mdmg",
  dgtm: "mdmg",

  truedamage: "tdmg",
  tdmg: "tdmg",
  degatbrut: "tdmg",
  dgtb: "tdmg",

  // heal / temp heal / mana
  heal: "heal",
  soin: "heal",
  theal: "theal",
  soint: "theal",
  mana: "mana",

  // generic
  roll: "roll",
  r: "roll",
};

export const ROLL_KINDS = {
  stat: "stat",
  pdmg: "pdmg",
  mdmg: "mdmg",
  tdmg: "tdmg",
  heal: "heal",
  theal: "theal",
  mana: "mana",
  roll: "roll",
};

function parseTypeAndFormula(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const parts = s.split(/\s+/);
  const rawType = parts.shift() || "";
  const formula = parts.join(" ").trim();
  return { rawType, formula };
}

/** Parse chat command: /<type> <formula> (new spec). */
export function parseChatCommand(line) {
  const s = String(line || "").trim();
  if (!s.startsWith("/")) return null;
  const rest = s.slice(1).trim();
  const parsed = parseTypeAndFormula(rest);
  if (!parsed) return null;
  const typeKey = normalizeKey(parsed.rawType);

  // Stat check?
  if (STAT_TYPE_ALIASES[typeKey]) {
    return { kind: "stat", stat: STAT_TYPE_ALIASES[typeKey], formula: parsed.formula };
  }

  // Other roll types
  const mapped = ROLL_TYPE_ALIASES[typeKey];
  if (mapped) return { kind: mapped, formula: parsed.formula };

  return null;
}

const POLYHEDRAL_ICONS = [4, 6, 8, 10, 12, 20];

/**
 * Pick which dice SVG to show (d4…d20) from the first NdM in the formula.
 * If there is no die (e.g. stat rolls like [str +4]), default to d20.
 */
export function pickInlineDiceIconKey(formula) {
  const f = String(formula || "");
  const re = /(\d+)\s*d\s*(\d+)/gi;
  let m = re.exec(f);
  if (!m) {
    return "d20";
  }
  const faces = parseInt(m[2], 10);
  if (!Number.isFinite(faces) || faces < 1) {
    return "d20";
  }
  let best = POLYHEDRAL_ICONS[0];
  let bestDist = Math.abs(faces - best);
  for (const p of POLYHEDRAL_ICONS) {
    const d = Math.abs(faces - p);
    if (d < bestDist || (d === bestDist && p < best)) {
      best = p;
      bestDist = d;
    }
  }
  return `d${best}`;
}

/** Find all inline roll buttons in text: [type formula] (new spec only). */
export function getInlineButtons(text) {
  const s = String(text || "");
  const re = /\[([^\]]+)\]/g;
  const out = [];
  let match;
  while ((match = re.exec(s)) !== null) {
    const inside = String(match[1] || "").trim();
    if (!inside) continue;
    const parsed = parseTypeAndFormula(inside);
    if (!parsed) continue;
    const typeKey = normalizeKey(parsed.rawType);
    if (STAT_TYPE_ALIASES[typeKey]) {
      out.push({ raw: match[0], kind: "stat", stat: STAT_TYPE_ALIASES[typeKey], formula: parsed.formula, label: inside });
      continue;
    }
    const mapped = ROLL_TYPE_ALIASES[typeKey];
    if (mapped) {
      out.push({ raw: match[0], kind: mapped, formula: parsed.formula, label: inside });
    }
  }
  return out;
}

function buildFormulaContext(sheet) {
  const con = getStatTotal(sheet, "constitution");
  const str = getStatTotal(sheet, "strength");
  const int = getStatTotal(sheet, "intelligence");
  const per = getStatTotal(sheet, "perception");
  const soc = getStatTotal(sheet, "social");
  const agi = getStatTotal(sheet, "agility");
  const foc = getStatTotal(sheet, "focus");

  const maxhp = getMaxHP(sheet);
  const maxmp = getMaxMP(sheet);
  const maxfav = getMaxFavor(sheet);
  const act = getActionCount(sheet);
  const lvl = Number(sheet.bio?.level) || 1;
  const pdef = getDef(sheet);
  const mdef = getMagDef(sheet);

  const curhp = Math.max(0, Number(sheet.currentHP) || 0);
  const temhp = Math.max(0, Number(sheet.tempHP) || 0);
  const curmp = Math.max(0, Number(sheet.currentMP) || 0);
  const curfav = Math.max(0, Number(sheet.currentFavor) || 0);

  const bonact = Number(sheet.actionModifier) || 0;
  const bonspe = Number(sheet.speedModifier) || 0;

  // Provide all aliases as lowercased keys.
  return {
    con,
    str,
    for: str,
    int,
    per,
    soc,
    agi,
    foc,
    maxhp,
    pvmax: maxhp,
    curhp,
    pvact: curhp,
    temhp,
    pvtem: temhp,
    maxmp,
    pmmax: maxmp,
    curmp,
    pmact: curmp,
    maxfav,
    favmax: maxfav,
    curfav,
    favact: curfav,
    act,
    lvl,
    niv: lvl,
    pdef,
    defp: pdef,
    mdef,
    defm: mdef,
    bonact,
    actbon: bonact,
    bonspe,
    vitbon: bonspe,
  };
}

function statOutcomeFrom(resultValue, statTotal, firstD20) {
  const baseSuccess = resultValue <= statTotal;
  let level = baseSuccess ? 1 : 0; // 1=success, 0=failure
  if (firstD20 === 1) level += 1;
  if (firstD20 === 20) level -= 1;
  if (level >= 2) return "critical_success";
  if (level === 1) return "success";
  if (level === 0) return "failure";
  return "critical_failure";
}

function findFirstD20(diceEvents) {
  for (const e of diceEvents || []) {
    if (e?.faces === 20 && Array.isArray(e.rolls) && e.rolls.length) return e.rolls[0];
  }
  return null;
}

function statOutcomeFromFirstDie(resultValue, statTotal, firstDie) {
  const baseSuccess = resultValue <= statTotal;
  let level = baseSuccess ? 1 : 0; // 1=success, 0=failure
  const roll = firstDie?.roll;
  const faces = firstDie?.faces;
  if (roll === 1) level += 1;
  if (faces != null && roll === faces) level -= 1;
  if (level >= 2) return "critical_success";
  if (level === 1) return "success";
  if (level === 0) return "failure";
  return "critical_failure";
}

function findFirstDie(diceEvents) {
  for (const e of diceEvents || []) {
    if (e?.faces && Array.isArray(e.rolls) && e.rolls.length) return { roll: e.rolls[0], faces: e.faces };
  }
  return null;
}

function outcomeFromNatAdjustment(baseSuccess, natRoll, natFaces, kind) {
  let level = baseSuccess ? 1 : 0; // 1=success, 0=failure
  if (natRoll == null || natFaces == null) return level >= 2 ? "critical_success" : level === 1 ? "success" : level === 0 ? "failure" : "critical_failure";
  const isMin = natRoll === 1;
  const isMax = natRoll === natFaces;
  if (!isMin && !isMax) return level >= 2 ? "critical_success" : level === 1 ? "success" : level === 0 ? "failure" : "critical_failure";

  // Spec:
  // - For "<": min increases success grade, max decreases.
  // - For ">": min decreases success grade, max increases.
  if (kind === "<") {
    if (isMin) level += 1;
    if (isMax) level -= 1;
  } else if (kind === ">") {
    if (isMin) level -= 1;
    if (isMax) level += 1;
  }
  if (level >= 2) return "critical_success";
  if (level === 1) return "success";
  if (level === 0) return "failure";
  return "critical_failure";
}

function normalizeStatFormula(formula) {
  const f = String(formula || "").trim();
  if (!f) return "1d20";
  if (formulaHasDice(f)) return f;
  const startsWithOp = /^[+\-*/\\%^<>]/.test(f);
  return startsWithOp ? `1d20${f}` : `1d20+${f}`;
}

/** Execute a roll with the new dice language. */
export function executeRoll(payload, sheet, _unused = null) {
  if (!sheet) return null;
  if (!payload || !payload.kind) return null;

  const ctx = buildFormulaContext(sheet);

  if (payload.kind === "stat") {
    const statId = String(payload.stat || "").toLowerCase();
    const statTotal = getStatTotal(sheet, statId);
    const effectiveFormula = normalizeStatFormula(payload.formula || "");
    const evalRes = evaluateFormula(effectiveFormula, ctx);
    const first = findFirstDie(evalRes.diceEvents);
    const outcome = statOutcomeFromFirstDie(evalRes.value, statTotal, first);
    return {
      kind: "stat",
      stat: statId,
      statTotal,
      formula: effectiveFormula,
      translatedFormula: evalRes.translatedFormula,
      diceResults: evalRes.diceResults,
      value: evalRes.value,
      outcome,
      comparison: null,
      canApply: false,
      nat: first?.roll ?? null,
    };
  }

  const formula = String(payload.formula || "").trim();
  const evalRes = evaluateFormula(formula, ctx);
  const comparison = evalRes.comparison || null;
  let outcome = null;
  if (comparison && typeof comparison.success === "boolean") {
    const first = findFirstDie(evalRes.diceEvents);
    outcome = outcomeFromNatAdjustment(!!comparison.success, first?.roll ?? null, first?.faces ?? null, comparison.kind);
  }

  const base = {
    kind: payload.kind,
    formula,
    translatedFormula: evalRes.translatedFormula,
    diceResults: evalRes.diceResults,
    value: evalRes.value,
    comparison,
    outcome,
  };

  if (payload.kind === "pdmg" || payload.kind === "mdmg" || payload.kind === "tdmg" || payload.kind === "heal" || payload.kind === "theal" || payload.kind === "mana") {
    return { ...base, canApply: true };
  }
  return { ...base, canApply: false };
}


export function applyMana(sheet, amount, maxMP) {
  const current = Math.max(0, Number(sheet.currentMP) || 0);
  const max = Math.max(0, Number(maxMP) || 0);
  return { currentMP: Math.min(max, current + (amount || 0)) };
}

/** Apply physical damage to sheet: value - Defense, then reduce HP (temp first). */
export function applyPhysicalDamage(sheet, value) {
  const defense = getSheetDefense(sheet);
  const actual = Math.max(0, (value || 0) - defense);
  return applyDamageToHP(sheet, actual);
}

/** Apply magic damage: value - Magical Defense. */
export function applyMagicDamage(sheet, value) {
  const magDef = getSheetMagicalDefense(sheet);
  const actual = Math.max(0, (value || 0) - magDef);
  return applyDamageToHP(sheet, actual);
}

/** Apply true damage: no reduction. */
export function applyTrueDamage(sheet, value) {
  return applyDamageToHP(sheet, value || 0);
}

function getSheetDefense(sheet) {
  return getDef(sheet);
}

function getSheetMagicalDefense(sheet) {
  return getMagDef(sheet);
}

/** Reduce HP: temp first, then current. Returns updated sheet fields. */
function applyDamageToHP(sheet, amount) {
  let temp = Math.max(0, Number(sheet.tempHP) || 0);
  let current = Math.max(0, Number(sheet.currentHP) || 0);
  let remaining = amount;
  if (remaining > 0 && temp > 0) {
    const fromTemp = Math.min(temp, remaining);
    temp -= fromTemp;
    remaining -= fromTemp;
  }
  if (remaining > 0) {
    current = Math.max(0, current - remaining);
  }
  return { tempHP: temp, currentHP: current };
}

/** Add heal to current HP, cap at max. */
export function applyHeal(sheet, amount, maxHP) {
  const current = Math.max(0, Number(sheet.currentHP) || 0);
  const max = Math.max(0, Number(maxHP) || 0);
  return { currentHP: Math.min(max, current + (amount || 0)) };
}

/** Add over-heal as temp HP. */
export function applyOverHeal(sheet, amount) {
  const temp = Math.max(0, Number(sheet.tempHP) || 0);
  return { tempHP: temp + (amount || 0) };
}

/** Reroll: same payload again; caller should deduct 1 Favor. */
export function canReroll(result) {
  return result && ["stat", "pdmg", "mdmg", "tdmg", "heal", "theal", "mana", "roll"].includes(result.kind);
}
