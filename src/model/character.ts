export type StatKey =
  | "constitution"
  | "force"
  | "intelligence"
  | "perception"
  | "social"
  | "agility"
  | "focus";

export interface StatBlock {
  base: number;
  xp: number;
  item: number;
  passive: number;
}

export interface Character {
  id: string; // uuid
  name: string;
  surname: string;
  element: string;
  classe: string;

  level: number;

  currentHP: number;
  currentMP: number;
  faveur: number;

  stats: Record<StatKey, StatBlock>;
}
