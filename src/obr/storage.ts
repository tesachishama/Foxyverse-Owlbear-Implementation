import OBR from "@owlbear-rodeo/sdk";
import { STORAGE_KEYS } from "./constants";
import { CharacterSheet } from "../model/character";

export async function loadCharacters(): Promise<CharacterSheet[]> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[STORAGE_KEYS.CHARACTERS] as CharacterSheet[]) ?? [];
}

export async function saveCharacters(characters: CharacterSheet[]) {
  await OBR.room.setMetadata({
    [STORAGE_KEYS.CHARACTERS]: characters,
  });
}
