import OBR from "@owlbear-rodeo/sdk";

export async function isGM(): Promise<boolean> {
  const role = await OBR.player.getRole();
  return role === "GM";
}
