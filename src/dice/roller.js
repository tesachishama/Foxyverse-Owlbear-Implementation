/**
 * Roll types and execution (new spec only).
 *
 * Chat command syntax: /<type> <formula>
 * Inline button syntax: [<type> <formula>]
 * Case insensitive. Old [type:expr] is intentionally not supported.
 *
 * Clamp suffixes (after the main formula, can be combined; rightmost is stripped first):
 * - `!<expr` — result cannot be below `expr` (evaluated with the same variable context as the roll).
 * - `!>expr` — result cannot be above `expr`.
 * Example: `[r 1d20+2!<con]` or `/roll 1d8+1!>6`.
 *
 * Code map: `docs/CODEBASE.md#dice-and-rolls`. Formula details: `docs/rolls-and-inline.md`.
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
  isElementalSheet,
} from "../data/schema.js";
import { normalizeKey } from "../utils/textNormalize.js";

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
  pdmg: "pdmg",
  dgtp: "pdmg",

  mdmg: "mdmg",
  dgtm: "mdmg",

  tdmg: "tdmg",
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

function parseLeadingRepeatCount(formulaText) {
  const parts = String(formulaText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    const n = Math.max(1, Math.min(100, parseInt(parts[0], 10) || 1));
    return { count: n, formula: parts.slice(1).join(" ") };
  }
  return { count: 1, formula: String(formulaText || "").trim() };
}

/**
 * Parse a chat line as `/<type> <formula>` (repeat count optional as first integer token).
 * @param {string} line raw user input including leading `/`
 * @returns {{ kind: string, formula: string, count: number, stat?: string } | null}
 */
export function parseChatCommand(line) {
  const s = String(line || "").trim();
  if (!s.startsWith("/")) return null;
  const rest = s.slice(1).trim();
  const parsed = parseTypeAndFormula(rest);
  if (!parsed) return null;
  const typeKey = normalizeKey(parsed.rawType);
  const rep = parseLeadingRepeatCount(parsed.formula);

  // Stat check?
  if (STAT_TYPE_ALIASES[typeKey]) {
    return { kind: "stat", stat: STAT_TYPE_ALIASES[typeKey], formula: rep.formula, count: rep.count };
  }

  // Other roll types
  const mapped = ROLL_TYPE_ALIASES[typeKey];
  if (mapped) return { kind: mapped, formula: rep.formula, count: rep.count };

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

/**
 * Find inline roll buttons `[type formula]` (optional `|label`) in rich text.
 * @param {string} text
 * @returns {Array<object>} button descriptors consumed by the UI
 */
export function getInlineButtons(text) {
  const s = String(text || "");
  const re = /\[([^\]]+)\]/g;
  const out = [];
  let match;
  while ((match = re.exec(s)) !== null) {
    const inside = String(match[1] || "").trim();
    if (!inside) continue;
    const pipeIdx = inside.indexOf("|");
    const left = pipeIdx >= 0 ? inside.slice(0, pipeIdx).trim() : inside;
    const hasCustomLabel = pipeIdx >= 0;
    const customLabel = hasCustomLabel ? inside.slice(pipeIdx + 1) : null;

    const parsed = parseTypeAndFormula(left);
    if (!parsed) continue;
    const rep = parseLeadingRepeatCount(parsed.formula);
    const typeKey = normalizeKey(parsed.rawType);
    if (STAT_TYPE_ALIASES[typeKey]) {
      out.push({
        raw: match[0],
        kind: "stat",
        stat: STAT_TYPE_ALIASES[typeKey],
        formula: rep.formula,
        count: rep.count,
        label: inside,
        customLabel,
        hasCustomLabel,
      });
      continue;
    }
    const mapped = ROLL_TYPE_ALIASES[typeKey];
    if (mapped) {
      out.push({ raw: match[0], kind: mapped, formula: rep.formula, count: rep.count, label: inside, customLabel, hasCustomLabel });
    }
  }
  return out;
}

function clampRollInt(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}

/**
 * Strip one trailing clamp suffix using the rightmost `!<` or `!>` in the string.
 * - `!<expr` — floor: final total cannot be below `expr` (evaluated with the same context as the roll).
 * - `!>expr` — cap: final total cannot be above `expr`.
 * Repeat until none remain (supports both min and max on the same roll).
 */
function stripOneTrailingClamp(formula) {
  const f = String(formula || "");
  const idxLt = f.lastIndexOf("!<");
  const idxGt = f.lastIndexOf("!>");
  if (idxLt < 0 && idxGt < 0) return null;
  const useMax = idxGt >= idxLt && idxGt >= 0;
  const idx = useMax ? idxGt : idxLt;
  const expr = f.slice(idx + 2).trim();
  if (!expr) return null;
  return { next: f.slice(0, idx).trim(), kind: useMax ? "max" : "min", expr };
}

function stripAllTrailingClampModifiers(formula) {
  let f = String(formula || "").trim();
  let minExpr = null;
  let maxExpr = null;
  while (true) {
    const one = stripOneTrailingClamp(f);
    if (!one) break;
    f = one.next;
    if (one.kind === "min") minExpr = one.expr;
    else maxExpr = one.expr;
  }
  return { core: f, minExpr, maxExpr };
}

function applyNumericClamps(rawValue, minExpr, maxExpr, ctx, rng) {
  let v = clampRollInt(rawValue);
  const rawBeforeClamp = v;
  let clampFloor = false;
  let clampCeil = false;

  let minBound = null;
  let maxBound = null;
  if (minExpr) {
    minBound = clampRollInt(evaluateFormula(minExpr, ctx, rng).value);
  }
  if (maxExpr) {
    maxBound = clampRollInt(evaluateFormula(maxExpr, ctx, rng).value);
  }
  if (minBound != null && maxBound != null && minBound > maxBound) {
    const t = minBound;
    minBound = maxBound;
    maxBound = t;
  }
  if (minBound != null && v < minBound) {
    v = minBound;
    clampFloor = true;
  }
  if (maxBound != null && v > maxBound) {
    v = maxBound;
    clampCeil = true;
  }
  return { value: v, rawBeforeClamp, clampFloor, clampCeil };
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

  const bonact = Number(sheet.bonusAction ?? sheet.actionModifier) || 0;
  const bonspe = Number(sheet.bonusSpeed ?? sheet.speedModifier) || 0;

  // Aliases documented in README (formula variables).
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
    hpmax: maxhp,
    pvmax: maxhp,
    maxpv: maxhp,

    curhp,
    hpcur: curhp,
    pvact: curhp,
    actpv: curhp,

    temhp,
    hptem: temhp,
    pvtem: temhp,
    tempv: temhp,
    temphp: temhp,
    hptemp: temhp,
    temppv: temhp,
    pvtemp: temhp,

    maxmp,
    mpmax: maxmp,
    pmmax: maxmp,
    maxpm: maxmp,

    curmp,
    mpcur: curmp,
    pmact: curmp,
    actpm: curmp,

    maxfav,
    favmax: maxfav,

    curfav,
    favcur: curfav,
    favact: curfav,
    actfav: curfav,

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
    spebon: bonspe,
    vitbon: bonspe,
    bonvit: bonspe,
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

export function normalizeStatFormula(formula) {
  const f = String(formula || "").trim();
  if (!f) return "1d20";
  if (formulaHasDice(f)) return f;
  const startsWithOp = /^[+\-*/\\%^<>]/.test(f);
  return startsWithOp ? `1d20${f}` : `1d20+${f}`;
}

/**
 * Run a full roll (dice + clamps + comparison) against `sheet` for variable context.
 * @param {{ kind: string, formula?: string, count?: number, stat?: string }} payload from `parseChatCommand` / inline parsing
 * @param {object|null} sheet active character sheet or null
 * @returns {object|null} structured result for the modal / chat renderer
 */
export function executeRoll(payload, sheet) {
  if (!sheet) return null;
  if (!payload || !payload.kind) return null;

  const ctx = buildFormulaContext(sheet);
  const repeat = Math.max(1, Math.min(100, Number(payload.count) || 1));

  if (payload.kind === "stat") {
    const statId = String(payload.stat || "").toLowerCase();
    const statTotal = getStatTotal(sheet, statId);
    const normalizedFull = normalizeStatFormula(payload.formula || "");
    const { core, minExpr, maxExpr } = stripAllTrailingClampModifiers(normalizedFull);
    if (!core) return null;
    const displayFormula = String(payload.formula || "").trim() || normalizedFull;
    if (repeat > 1) {
      const multi = [];
      const allDice = [];
      for (let i = 0; i < repeat; i++) {
        const evalRes = evaluateFormula(core, ctx);
        const clamped = applyNumericClamps(evalRes.value, minExpr, maxExpr, ctx);
        const first = findFirstDie(evalRes.diceEvents);
        const outcome = statOutcomeFromFirstDie(clamped.value, statTotal, first);
        multi.push({
          value: clamped.value,
          diceResults: evalRes.diceResults,
          translatedFormula: evalRes.translatedFormula,
          outcome,
          nat: first?.roll ?? null,
          clampFloor: clamped.clampFloor,
          clampCeil: clamped.clampCeil,
        });
        allDice.push(...(evalRes.diceResults || []));
      }
      return {
        kind: "stat",
        stat: statId,
        statTotal,
        formula: displayFormula,
        translatedFormula: multi[0]?.translatedFormula || "",
        diceResults: allDice,
        value: multi[multi.length - 1]?.value ?? 0,
        outcome: null,
        comparison: null,
        canApply: false,
        nat: null,
        count: repeat,
        multi,
        clampFloor: multi.some((r) => r.clampFloor),
        clampCeil: multi.some((r) => r.clampCeil),
      };
    }
    const evalRes = evaluateFormula(core, ctx);
    const clamped = applyNumericClamps(evalRes.value, minExpr, maxExpr, ctx);
    const first = findFirstDie(evalRes.diceEvents);
    const outcome = statOutcomeFromFirstDie(clamped.value, statTotal, first);
    return {
      kind: "stat",
      stat: statId,
      statTotal,
      formula: displayFormula,
      translatedFormula: evalRes.translatedFormula,
      diceResults: evalRes.diceResults,
      value: clamped.value,
      outcome,
      comparison: null,
      canApply: false,
      nat: first?.roll ?? null,
      count: 1,
      multi: null,
      clampFloor: clamped.clampFloor,
      clampCeil: clamped.clampCeil,
    };
  }

  const formulaFull = String(payload.formula || "").trim();
  const { core, minExpr, maxExpr } = stripAllTrailingClampModifiers(formulaFull);
  if (!core) return null;
  if (repeat > 1) {
    const multi = [];
    const allDice = [];
    for (let i = 0; i < repeat; i++) {
      const evalRes = evaluateFormula(core, ctx);
      const comparison = evalRes.comparison || null;
      const clamped = applyNumericClamps(evalRes.value, minExpr, maxExpr, ctx);
      let outcome = null;
      if (comparison && typeof comparison.success === "boolean") {
        const first = findFirstDie(evalRes.diceEvents);
        outcome = outcomeFromNatAdjustment(!!comparison.success, first?.roll ?? null, first?.faces ?? null, comparison.kind);
      }
      multi.push({
        value: clamped.value,
        diceResults: evalRes.diceResults,
        translatedFormula: evalRes.translatedFormula,
        comparison,
        outcome,
        clampFloor: clamped.clampFloor,
        clampCeil: clamped.clampCeil,
      });
      allDice.push(...(evalRes.diceResults || []));
    }
    const base = {
      kind: payload.kind,
      formula: formulaFull,
      translatedFormula: multi[0]?.translatedFormula || "",
      diceResults: allDice,
      value: multi.reduce((a, r) => a + (Number(r.value) || 0), 0),
      comparison: null,
      outcome: null,
      count: repeat,
      multi,
      clampFloor: multi.some((r) => r.clampFloor),
      clampCeil: multi.some((r) => r.clampCeil),
    };
    if (payload.kind === "pdmg" || payload.kind === "mdmg" || payload.kind === "tdmg" || payload.kind === "heal" || payload.kind === "theal" || payload.kind === "mana") {
      return { ...base, canApply: true };
    }
    return { ...base, canApply: false };
  }

  const evalRes = evaluateFormula(core, ctx);
  const comparison = evalRes.comparison || null;
  const clamped = applyNumericClamps(evalRes.value, minExpr, maxExpr, ctx);
  let outcome = null;
  if (comparison && typeof comparison.success === "boolean") {
    const first = findFirstDie(evalRes.diceEvents);
    outcome = outcomeFromNatAdjustment(!!comparison.success, first?.roll ?? null, first?.faces ?? null, comparison.kind);
  }

  const base = {
    kind: payload.kind,
    formula: formulaFull,
    translatedFormula: evalRes.translatedFormula,
    diceResults: evalRes.diceResults,
    value: clamped.value,
    comparison,
    outcome,
    count: 1,
    multi: null,
    clampFloor: clamped.clampFloor,
    clampCeil: clamped.clampCeil,
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
  if (isElementalSheet(sheet)) {
    return {};
  }
  const defense = getSheetDefense(sheet);
  const actual = Math.max(0, (value || 0) - defense);
  return applyDamageToHP(sheet, actual);
}

/**
 * Elemental: only temp HP absorbs damage; overflow reduces MP. Current HP is unchanged.
 */
function applyElementalDamageToBufferThenMana(sheet, amount) {
  let temp = Math.max(0, Number(sheet.tempHP) || 0);
  let mp = Math.max(0, Number(sheet.currentMP) || 0);
  let remaining = Math.max(0, Math.floor(Number(amount) || 0));
  if (remaining > 0 && temp > 0) {
    const fromTemp = Math.min(temp, remaining);
    temp -= fromTemp;
    remaining -= fromTemp;
  }
  if (remaining > 0) {
    mp = Math.max(0, mp - remaining);
  }
  return { tempHP: temp, currentMP: mp };
}

/** Apply magic damage: value - Magical Defense. */
export function applyMagicDamage(sheet, value) {
  const magDef = Math.floor(Math.max(0, Number(getSheetMagicalDefense(sheet)) || 0));
  if (isElementalSheet(sheet)) {
    const raw = Math.max(0, Math.floor(Number(value) || 0));
    const actual = Math.max(0, 2 * raw - magDef);
    return applyElementalDamageToBufferThenMana(sheet, actual);
  }
  const actual = Math.max(0, (value || 0) - magDef);
  return applyDamageToHP(sheet, actual);
}

/** Apply true damage: no reduction. */
export function applyTrueDamage(sheet, value) {
  if (isElementalSheet(sheet)) {
    const raw = Math.max(0, Math.floor(Number(value) || 0));
    return applyElementalDamageToBufferThenMana(sheet, raw);
  }
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

/** Reduce current MP (elemental damage pool). */
export function applyDamageToMP(sheet, amount) {
  const current = Math.max(0, Number(sheet.currentMP) || 0);
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return { currentMP: Math.max(0, current - n) };
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
