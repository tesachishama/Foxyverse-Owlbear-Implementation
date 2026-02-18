export type StatName =
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

export interface CharacterIdentity {
  name: string;
  surname: string;
  element: string;
  classe: string;
  level: number;
}

export interface CharacterResources {
  hpCurrent: number;
  mpCurrent: number;
  faveurCurrent: number;
}

export interface CharacterSheet {
  id: string;

  ownerIds: string[];
  linkedTokenIds: string[];

  identity: CharacterIdentity;
  stats: Record<StatName, StatBlock>;
  resources: CharacterResources;
}
