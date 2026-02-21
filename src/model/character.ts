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
  hpTemp: number;
  hpCurrent: number;
  hpMax: number;
  mpCurrent: number;
  mpMax: number;
  favorCurrent: number;
  favorMax: number;
}

export interface CharacterDerived {
  /** Manual speed modifier */
  speedModifier: number;

  /** Manual action bonus */
  actionBonus: number;

  /** Calculated maximum number of actions */
  actionMax: number;
}

export interface CharacterSheet {
  id: string;

  ownerIds: string[];
  linkedTokenIds: string[];

  identity: CharacterIdentity;
  stats: Record<StatName, StatBlock>;
  resources: CharacterResources;
  
  /** Derived & computed stats */
  derived: CharacterDerived;
}
