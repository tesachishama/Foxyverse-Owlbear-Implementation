/**
 * Foxyverse dice language (new spec only).
 *
 * Supports:
 * - Operators: + - * / (round), \\ (floor), % (ceil), ^ (power)
 * - Parentheses: ( ... )
 * - Comparators: < (<=) and > (>=) which produce a comparison result
 * - Clamp suffixes (stripped before parse; evaluated after the main roll): `!<expr` (floor), `!>expr` (ceiling)
 * - Dice: XdY where X and Y are expressions; without parentheses, operands are the nearest atom
 * - Variables (case-insensitive): resolved from a provided context map
 *
 * Evaluator returns:
 * - value: final numeric value (integer)
 * - diceResults: flat list of each vanilla die face rolled (in order)
 * - translatedFormula: normalized formula with variables replaced by numbers
 * - diceEvents: [{ count, faces, rolls[] }] (for nat 1 / nat 20 detection in stat checks)
 * - comparison?: { kind: \"<\"|\">\", leftValue, rightValue, success }
 */

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function isAlpha(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || ch === "_" || ch === "é" || ch === "è" || ch === "ê" || ch === "à" || ch === "ù" || ch === "ç";
}

function sanitizeFormulaText(expr) {
  return String(expr || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdent(id) {
  return String(id || "").trim().toLowerCase();
}

function tokenize(expr) {
  const s = String(expr || "").replace(/\s+/g, "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // Operators / punctuation first (so `d` is treated as dice operator, not an identifier)
    if (
      ch === "(" ||
      ch === ")" ||
      ch === "+" ||
      ch === "-" ||
      ch === "*" ||
      ch === "/" ||
      ch === "\\" ||
      ch === "%" ||
      ch === "^" ||
      ch === "<" ||
      ch === ">" ||
      ch === "d" ||
      ch === "D"
    ) {
      tokens.push({ type: ch.toLowerCase() });
      i++;
      continue;
    }
    if (isDigit(ch)) {
      let n = "";
      while (i < s.length && isDigit(s[i])) n += s[i++];
      tokens.push({ type: "num", value: Number(n) });
      continue;
    }
    if (isAlpha(ch)) {
      let id = "";
      while (i < s.length && isAlpha(s[i])) id += s[i++];
      tokens.push({ type: "ident", value: normalizeIdent(id) });
      continue;
    }
    // Unknown character: skip it
    i++;
  }
  return tokens;
}

function clampInt(n) {
  if (!Number.isFinite(n)) return 0;
  // Keep integers; allow negatives during eval, clamp to int at the end
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}

function divRound(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return Math.round(a / b);
}

function divFloor(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return Math.floor(a / b);
}

function divCeil(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return Math.ceil(a / b);
}

function powInt(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  // Spec is integer-ish; clamp exponent to an int to avoid surprises.
  const exp = clampInt(b);
  // Avoid huge explosions
  if (exp > 12) return Math.pow(a, 12);
  if (exp < -12) return Math.pow(a, -12);
  return Math.pow(a, exp);
}

function rollDie(faces, rng) {
  const f = Math.max(1, clampInt(faces));
  const r = rng ? rng(f) : Math.floor(Math.random() * f) + 1;
  return Math.max(1, Math.min(f, clampInt(r)));
}

function resolveVarValue(ident, context) {
  const key = normalizeIdent(ident);
  if (context && Object.prototype.hasOwnProperty.call(context, key)) {
    const v = Number(context[key]);
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

/**
 * Evaluate the new formula language.
 *
 * @param {string} formula
 * @param {object} context lowercased variable map: { con: 12, pvmax: 20, ... }
 * @param {function|null} rng optional rng(faces)->int for tests
 */
export function evaluateFormula(formula, context = {}, rng = null) {
  const expr = sanitizeFormulaText(formula);
  const tokens = tokenize(expr);
  let idx = 0;

  const diceResults = [];
  const diceEvents = [];
  const translatedParts = [];

  function peek() {
    return tokens[idx] || null;
  }

  function consume(type) {
    const t = peek();
    if (t && t.type === type) {
      idx++;
      return t;
    }
    return null;
  }

  function expect(type) {
    const t = consume(type);
    if (!t) throw new Error(`Expected '${type}'`);
    return t;
  }

  function writeTranslated(text) {
    translatedParts.push(String(text));
  }

  // Grammar (precedence):
  // comparison := addSub ( ( '<' | '>' ) addSub )?
  // addSub     := mulDiv ( ( '+' | '-' ) mulDiv )*
  // mulDiv     := pow ( ( '*' | '/' | '\\' | '%' ) pow )*
  // pow        := dice ( '^' pow )?
  // dice       := unary ( 'd' unary )*
  // unary      := ( '+' | '-' ) unary | primary
  // primary    := num | ident | '(' comparison ')'
  //
  // Note: dice chains like a d b d c are evaluated left-associative.

  function parsePrimary() {
    const t = peek();
    if (!t) {
      writeTranslated("0");
      return 0;
    }
    if (t.type === "num") {
      idx++;
      writeTranslated(String(t.value));
      return Number(t.value);
    }
    if (t.type === "ident") {
      idx++;
      const val = resolveVarValue(t.value, context);
      writeTranslated(String(val));
      return val;
    }
    if (consume("(")) {
      writeTranslated("(");
      const v = parseComparison();
      expect(")");
      writeTranslated(")");
      return v;
    }
    // Unknown token: skip and treat as 0
    idx++;
    writeTranslated("0");
    return 0;
  }

  function parseUnary() {
    const t = peek();
    if (t && (t.type === "+" || t.type === "-")) {
      idx++;
      writeTranslated(t.type);
      const v = parseUnary();
      return t.type === "-" ? -v : v;
    }
    return parsePrimary();
  }

  function parseDice() {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (!t || t.type !== "d") break;
      idx++;
      writeTranslated("d");
      const right = parseUnary();
      const count = Math.max(0, clampInt(left));
      const faces = Math.max(1, clampInt(right));
      let sum = 0;
      const rolls = [];
      for (let i = 0; i < count; i++) {
        const r = rollDie(faces, rng);
        diceResults.push(r);
        rolls.push(r);
        sum += r;
      }
      diceEvents.push({ count, faces, rolls });
      left = sum;
    }
    return left;
  }

  function parsePow() {
    const base = parseDice();
    const t = peek();
    if (t && t.type === "^") {
      idx++;
      writeTranslated("^");
      const exp = parsePow(); // right associative
      return powInt(base, exp);
    }
    return base;
  }

  function parseMulDiv() {
    let left = parsePow();
    while (true) {
      const t = peek();
      if (!t || !["*", "/", "\\", "%"].includes(t.type)) break;
      idx++;
      writeTranslated(t.type);
      const right = parsePow();
      if (t.type === "*") left = left * right;
      else if (t.type === "/") left = divRound(left, right);
      else if (t.type === "\\") left = divFloor(left, right);
      else if (t.type === "%") left = divCeil(left, right);
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (true) {
      const t = peek();
      if (!t || !["+", "-"].includes(t.type)) break;
      idx++;
      writeTranslated(t.type);
      const right = parseMulDiv();
      if (t.type === "+") left = left + right;
      else left = left - right;
    }
    return left;
  }

  let comparison = null;
  function parseComparison() {
    const left = parseAddSub();
    const t = peek();
    if (t && (t.type === "<" || t.type === ">")) {
      idx++;
      writeTranslated(t.type);
      const right = parseAddSub();
      const kind = t.type;
      const success = kind === "<" ? left <= right : left >= right;
      comparison = { kind, leftValue: clampInt(left), rightValue: clampInt(right), success: !!success };
      // Value of the expression remains the left side result (useful for showing the rolled number)
      return left;
    }
    return left;
  }

  let value = 0;
  try {
    value = parseComparison();
  } catch (e) {
    value = 0;
  }

  // Ignore trailing junk tokens; translatedParts already contains a normalized view.
  const translatedFormula = translatedParts.join("");

  return {
    value: clampInt(value),
    diceResults,
    diceEvents,
    translatedFormula,
    comparison,
  };
}

/** Utility: case-insensitive check for presence of dice operator `d` in a formula string. */
export function formulaHasDice(formula) {
  return /d/i.test(String(formula || ""));
}
