import type { Character } from "../model/character";

/**
 * Floor-safe division helper
 */
function divFloor(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

/**
 * Recalculate ALL derived stats that must be stored
 * This function is authoritative.
 */
export function recalculateDerivedStats(character: Character): Character {
  const agi = character.stats.agi.total;
  const level = character.level;

  // --- ACTIONS ---
  const actionBase =
    divFloor(agi, 10) +
    divFloor(level, 5);

  const actionMax =
    actionBase +
    character.derived.actionBonus;

  // Mutate explicitly (intentional)
  character.derived.actionMax = Math.max(0, actionMax);

  return character;
}
