export type StatBlock = {
  base: number;
  xp: number;
  passive: number;
};

export type Stats = Record<
  | "constitution"
  | "force"
  | "intelligence"
  | "perception"
  | "social"
  | "agility"
  | "focus",
  StatBlock
>;

export type Character = {
  id: string;
  schemaVersion: number;

  name: string;
  surname: string;
  element: string;
  classe: string;

  level: number;

  stats: Stats;

  currentHP: number;
  currentMP: number;
  currentFaveur: number;

  notes: string;
};
