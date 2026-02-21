import OBR from "@owlbear-rodeo/sdk";

const ROOM_META_KEY = "foxyverse";
const STORAGE_PREFIX = "foxyverse_sheet_";
const CHUNK_SIZE = 14000; // under 16KB for broadcast

/**
 * Room metadata (≤16KB): sheet list, permissions, locale, token links.
 * Full sheet data is in localStorage keyed by roomId + sheetId; we sync via broadcast.
 */
export async function getRoomData() {
  const meta = await OBR.room.getMetadata();
  return meta[ROOM_META_KEY] || {};
}

export async function setRoomData(update) {
  const meta = await OBR.room.getMetadata();
  await OBR.room.setMetadata({
    ...meta,
    [ROOM_META_KEY]: { ...(meta[ROOM_META_KEY] || {}), ...update },
  });
}

/** Room data shape: { sheetIds: string[], permissions: { [playerId]: { view: string[], edit: string[] } }, tokenToSheet: { [tokenId]: sheetId }, locale?: string } */
export async function getSheetList() {
  const d = await getRoomData();
  return d.sheetIds || [];
}

export async function addSheetToRoom(sheetId, name) {
  const d = await getRoomData();
  const ids = d.sheetIds || [];
  if (ids.includes(sheetId)) return;
  await setRoomData({ sheetIds: [...ids, sheetId], sheetNames: { ...(d.sheetNames || {}), [sheetId]: name || "Unnamed" } });
}

export async function getSheetNameInRoom(sheetId) {
  const d = await getRoomData();
  return (d.sheetNames || {})[sheetId] ?? "Unnamed";
}

export async function setSheetNameInRoom(sheetId, name) {
  const d = await getRoomData();
  await setRoomData({ sheetNames: { ...(d.sheetNames || {}), [sheetId]: name } });
}

export async function removeSheetFromRoom(sheetId) {
  const d = await getRoomData();
  const ids = (d.sheetIds || []).filter((id) => id !== sheetId);
  const names = { ...(d.sheetNames || {}) };
  delete names[sheetId];
  const tokenToSheet = { ...(d.tokenToSheet || {}) };
  Object.keys(tokenToSheet).forEach((tid) => { if (tokenToSheet[tid] === sheetId) delete tokenToSheet[tid]; });
  await setRoomData({ sheetIds: ids, sheetNames: names, tokenToSheet });
}

export async function getPermissions() {
  const d = await getRoomData();
  return d.permissions || {};
}

export async function setPermissions(permissions) {
  await setRoomData({ permissions: permissions });
}

export async function getTokenToSheet() {
  const d = await getRoomData();
  return d.tokenToSheet || {};
}

export async function linkTokenToSheet(tokenId, sheetId) {
  const d = await getRoomData();
  const tokenToSheet = { ...(d.tokenToSheet || {}) };
  if (sheetId) tokenToSheet[tokenId] = sheetId;
  else delete tokenToSheet[tokenId];
  await setRoomData({ tokenToSheet });
}

export async function getRoomId() {
  return OBR.room.id;
}

function storageKey(roomId, sheetId) {
  return `${STORAGE_PREFIX}${roomId}_${sheetId}`;
}

export function getSheetFromStorage(roomId, sheetId) {
  try {
    const raw = localStorage.getItem(storageKey(roomId, sheetId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSheetToStorage(roomId, sheet) {
  const key = storageKey(roomId, sheet.id);
  sheet.updatedAt = Date.now();
  localStorage.setItem(key, JSON.stringify(sheet));
}

export function removeSheetFromStorage(roomId, sheetId) {
  localStorage.removeItem(storageKey(roomId, sheetId));
}

const BROADCAST_CHANNEL = "foxyverse";
export const BroadcastType = {
  SHEET_FULL: "sheet_full",
  SHEET_PART: "sheet_part",
  CHAT: "chat",
  ROLL: "roll",
  REQUEST_SHEET: "request_sheet",
};

export async function broadcastSheet(roomId, sheet) {
  const str = JSON.stringify(sheet);
  if (str.length <= CHUNK_SIZE) {
    await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, { type: BroadcastType.SHEET_FULL, roomId, sheet });
    return;
  }
  const parts = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) {
    parts.push(str.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < parts.length; i++) {
    await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, { type: BroadcastType.SHEET_PART, roomId, sheetId: sheet.id, partIndex: i, totalParts: parts.length, data: parts[i] });
  }
}

export function onBroadcast(callback) {
  return OBR.broadcast.onMessage(BROADCAST_CHANNEL, callback);
}

export async function getPlayerId() {
  return OBR.player.id;
}

export async function getPlayerRole() {
  return OBR.player.getRole();
}

export async function getPlayerName() {
  return OBR.player.getName();
}
