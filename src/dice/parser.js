/**
 * Dice expression parser: left-to-right precedence, parentheses allowed.
 * Supports: NdX, +, -, *, /, ( ), and stat refs: str, con, int, per, soc, agi, foc (case insensitive).
 * Stat refs can be used as numbers in expressions, e.g. 2dper+(str/2) -> 2d10 + 5 if per=10, str=14.
 */

const STAT_SHORT = { str: "strength", con: "constitution", int: "intelligence", per: "perception", soc: "social", agi: "agility", foc: "focus" };

function tokenize(expr) {
  const s = (expr || "").replace(/\s/g, "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (/[0-9]/.test(s[i])) {
      let n = "";
      while (i < s.length && /[0-9]/.test(s[i])) n += s[i++];
      tokens.push({ type: "num", value: parseInt(n, 10) });
      continue;
    }
    if (s[i] === "d" && i + 1 < s.length) {
      i++;
      const rest = s.slice(i);
      const statMatch = rest.match(/^(str|con|int|per|soc|agi|foc)/i);
      if (statMatch) {
        const stat = statMatch[1].toLowerCase();
        i += stat.length;
        tokens.push({ type: "diceStat", stat });
        continue;
      }
      let num = "";
      while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
      tokens.push({ type: "dice", faces: num ? parseInt(num, 10) : 20 });
      continue;
    }
    if (/[a-zA-Z]/.test(s[i])) {
      const rest = s.slice(i);
      const statMatch = rest.match(/^(str|con|int|per|soc|agi|foc)/i);
      if (statMatch) {
        const stat = statMatch[1].toLowerCase();
        i += stat.length;
        tokens.push({ type: "stat", value: stat });
        continue;
      }
      i++;
      continue;
    }
    if (s[i] === "(") { tokens.push({ type: "(" }); i++; continue; }
    if (s[i] === ")") { tokens.push({ type: ")" }); i++; continue; }
    if (s[i] === "+") { tokens.push({ type: "+" }); i++; continue; }
    if (s[i] === "-") { tokens.push({ type: "-" }); i++; continue; }
    if (s[i] === "*") { tokens.push({ type: "*" }); i++; continue; }
    if (s[i] === "/") { tokens.push({ type: "/" }); i++; continue; }
    i++;
  }
  return tokens;
}

/** Resolve stat short name to numeric value from sheet */
function getStatValue(statShort, statValues) {
  const key = STAT_SHORT[statShort];
  return statValues[key] != null ? Number(statValues[key]) : 0;
}

/** Evaluate tokens with left-to-right precedence; statValues = { strength: 14, ... } */
function evaluate(tokens, statValues, rng) {
  const rollDice = (count, faces) => {
    let sum = 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const r = rng ? rng(faces) : Math.floor(Math.random() * faces) + 1;
      rolls.push(r);
      sum += r;
    }
    return { sum, rolls };
  };

  function readValue(idx) {
    if (idx >= tokens.length) return { value: 0, next: idx, rolls: [] };
    const t = tokens[idx];
    if (t.type === "num") {
      const next = tokens[idx + 1];
      if (next?.type === "dice") {
        const { sum, rolls } = rollDice(t.value, next.faces);
        return { value: sum, next: idx + 2, rolls };
      }
      if (next?.type === "diceStat") {
        const faces = Math.max(1, getStatValue(next.stat, statValues));
        const { sum, rolls } = rollDice(t.value, faces);
        return { value: sum, next: idx + 2, rolls };
      }
      return { value: t.value, next: idx + 1, rolls: [] };
    }
    if (t.type === "stat") return { value: getStatValue(t.value, statValues), next: idx + 1, rolls: [] };
    if (t.type === "dice") {
      const { sum, rolls } = rollDice(1, t.faces);
      return { value: sum, next: idx + 1, rolls };
    }
    if (t.type === "diceStat") {
      const faces = Math.max(1, getStatValue(t.stat, statValues));
      const { sum, rolls } = rollDice(1, faces);
      return { value: sum, next: idx + 1, rolls };
    }
    if (t.type === "(") {
      const sub = parseExpr(idx + 1);
      const next = tokens[sub.next]?.type === ")" ? sub.next + 1 : sub.next;
      return { value: sub.value, next, rolls: sub.rolls || [] };
    }
    return { value: 0, next: idx + 1, rolls: [] };
  }

  function parseExpr(start) {
    let idx = start;
    let left = readValue(idx);
    idx = left.next;
    const allRolls = left.rolls || [];

    while (idx < tokens.length) {
      const op = tokens[idx];
      if (op.type === ")" || !["+", "-", "*", "/"].includes(op.type)) break;
      idx++;
      const right = readValue(idx);
      idx = right.next;
      if (right.rolls) allRolls.push(...right.rolls);

      const a = left.value;
      const b = right.value;
      if (op.type === "+") left = { value: a + b, next: idx };
      else if (op.type === "-") left = { value: a - b, next: idx };
      else if (op.type === "*") left = { value: a * b, next: idx };
      else if (op.type === "/") left = { value: b === 0 ? 0 : Math.floor(a / b), next: idx };
    }

    return { value: left.value, next: idx, rolls: allRolls };
  }

  const result = parseExpr(0);
  return { value: Math.max(0, Math.floor(result.value)), rolls: result.rolls || [] };
}

/** Parse "1d20+5" or "2d8+str" etc. Returns { tokens, statRefs } so we can resolve and then evaluate. */
export function parse(expr) {
  return tokenize(expr);
}

/** Get stat refs used in expression (short names) */
export function getStatRefs(expr) {
  const tokens = tokenize(expr);
  const refs = new Set();
  tokens.forEach((t) => {
    if (t.type === "stat") refs.add(t.value);
    if (t.type === "diceStat") refs.add(t.stat);
  });
  return [...refs];
}

/** Build statValues map from sheet (total of each stat) */
export function statValuesFromSheet(sheet, getStatTotal) {
  const m = {};
  const ids = ["constitution", "strength", "intelligence", "perception", "social", "agility", "focus"];
  ids.forEach((id) => { m[id] = getStatTotal(sheet, id); });
  return m;
}

/** Evaluate expression with optional stat values and custom rng. Returns { value, rolls } */
export function evaluateExpression(expr, statValues = {}, rng = null) {
  const tokens = tokenize(expr);
  return evaluate(tokens, statValues, rng);
}

/** Roll 1d20 for stat check. DC = stat total. modifier can be "+5", "-3", "*2", "/2" etc. */
export function evalModifier(modStr) {
  const s = (modStr || "").trim();
  if (!s) return 0;
  const match = s.match(/^([+\-*/])\s*(\d+)$/);
  if (!match) return 0;
  const op = match[1];
  const num = parseInt(match[2], 10);
  if (op === "+") return num;
  if (op === "-") return -num;
  return 0; // * and / need a base; for simple modifier we only do +/-
}

export function rollStatCheck(dc, modifierStr, rng = null) {
  const roll = rng ? rng(20) : Math.floor(Math.random() * 20) + 1;
  const mod = evalModifier(modifierStr);
  const total = roll + mod;
  const success = roll === 20 ? true : roll === 1 ? false : total <= dc;
  return { roll, mod, total, dc, success, nat1: roll === 1, nat20: roll === 20 };
}
