/**
 * Roll types and execution. Inline syntax [type:expr] and chat /type expr.
 * Types: str, int, con, per, soc, agi, foc (stat roll), pdmg, mdmg, tdmg, heal, theal, roll.
 */
import {
  evaluateExpression,
  statValuesFromSheet,
  rollStatCheck,
  getStatRefs,
} from "./parser.js";
import { getStatTotal, getSheetDefense as getDef, getSheetMagicalDefense as getMagDef } from "../data/schema.js";

const STAT_ALIAS = {
  str: "strength",
  int: "intelligence",
  con: "constitution",
  per: "perception",
  soc: "social",
  agi: "agility",
  foc: "focus",
};

export const ROLL_TYPES = {
  stat: "stat",
  pdmg: "pdmg",
  mdmg: "mdmg",
  tdmg: "tdmg",
  heal: "heal",
  theal: "theal",
  roll: "roll",
};

function parseInlineButton(text) {
  const re = /\[([^\]:]+):([^\]]*)\]/gi;
  const out = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const type = (match[1] || "").trim().toLowerCase();
    const expr = (match[2] || "").trim();
    if (STAT_ALIAS[type] || type === "statroll") {
      out.push({ type: "stat", stat: type === "statroll" ? null : type, expr, raw: match[0] });
    } else if (type === "pdmg") {
      out.push({ type: "pdmg", expr, raw: match[0] });
    } else if (type === "mdmg") {
      out.push({ type: "mdmg", expr, raw: match[0] });
    } else if (type === "tdmg" || type === "tdmg") {
      out.push({ type: "tdmg", expr, raw: match[0] });
    } else if (type === "heal") {
      out.push({ type: "heal", expr, raw: match[0] });
    } else if (type === "theal" || type === "theal") {
      out.push({ type: "theal", expr, raw: match[0] });
    } else if (type === "roll") {
      out.push({ type: "roll", expr, raw: match[0] });
    }
  }
  return out;
}

/** Parse chat command: /str +5, /pdmg 2d6+3, etc. */
export function parseChatCommand(line) {
  const s = (line || "").trim();
  if (!s.startsWith("/")) return null;
  const rest = s.slice(1).trim();
  const space = rest.indexOf(" ");
  const type = space >= 0 ? rest.slice(0, space).toLowerCase() : rest;
  const expr = space >= 0 ? rest.slice(space + 1).trim() : "";
  if (STAT_ALIAS[type]) {
    return { type: "stat", stat: type, expr: expr || "" };
  }
  if (["pdmg", "mdmg", "tdmg", "heal", "theal", "roll"].includes(type)) {
    return { type, expr };
  }
  return null;
}

/** Find all inline buttons in text */
export function getInlineButtons(text) {
  return parseInlineButton(text || "");
}

/** Execute a single roll. sheet = current sheet, statValues can be precomputed. */
export function executeRoll(payload, sheet, statValues) {
  const sv = statValues || statValuesFromSheet(sheet, getStatTotal);
  const { type, stat, expr } = payload;

  if (type === "stat") {
    const statId = stat ? STAT_ALIAS[stat] : null;
    const dc = statId ? getStatTotal(sheet, statId) : 0;
    const result = rollStatCheck(dc, expr);
    return {
      kind: "stat",
      stat: statId,
      dc: result.dc,
      roll: result.roll,
      mod: result.mod,
      total: result.total,
      success: result.success,
      nat1: result.nat1,
      nat20: result.nat20,
      result,
    };
  }

  const evaluated = evaluateExpression(expr, sv);
  const value = evaluated.value;
  const rolls = evaluated.rolls || [];

  if (type === "pdmg") {
    return { kind: "pdmg", value, rolls, canApply: true };
  }
  if (type === "mdmg") {
    return { kind: "mdmg", value, rolls, canApply: true };
  }
  if (type === "tdmg") {
    return { kind: "tdmg", value, rolls, canApply: true };
  }
  if (type === "heal") {
    return { kind: "heal", value, rolls, canApply: true };
  }
  if (type === "theal") {
    return { kind: "theal", value, rolls, canApply: true };
  }
  if (type === "roll") {
    return { kind: "roll", value, rolls, canApply: false };
  }
  return null;
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
  return result && ["stat", "pdmg", "mdmg", "tdmg", "heal", "theal", "roll"].includes(result.kind);
}
