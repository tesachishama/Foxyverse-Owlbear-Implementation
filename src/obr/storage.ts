import OBR from "@owlbear-rodeo/sdk";
import { STORAGE_KEYS } from "./constants";
import type { Character } from "../model/character";

export async function loadCharacters(): Promise<Record<string, Character>> {
  const data = await OBR.storage.getItem("global", STORAGE_KEYS.CHARACTERS);
  return (data ?? {}) as Record<string, Character>;
}

export async function saveCharacters(chars: Record<string, Character>) {
  await OBR.storage.setItem("global", STORAGE_KEYS.CHARACTERS, chars);
}
