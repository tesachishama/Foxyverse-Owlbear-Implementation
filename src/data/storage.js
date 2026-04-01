import OBR from "@owlbear-rodeo/sdk";
import { supabase } from "./supabase.js";

const ROOM_META_KEY = "foxyverse";
const STORAGE_PREFIX = "foxyverse_sheet_";

function storageKey(roomId, sheetId) {
  return `${STORAGE_PREFIX}${roomId}_${sheetId}`;
}

function normalizePermissions(rows) {
  const permissions = {};
  (rows || []).forEach((row) => {
    if (!permissions[row.player_id]) permissions[row.player_id] = { view: [], edit: [] };
    if (row.can_view) permissions[row.player_id].view.push(row.sheet_id);
    if (row.can_edit) permissions[row.player_id].edit.push(row.sheet_id);
  });
  return permissions;
}

function getSheetName(sheet) {
  return [sheet?.bio?.name || "", sheet?.bio?.surname || ""].join(" ").trim() || "Name Surname";
}

async function ensureRoom(roomId) {
  const { error } = await supabase.from("rooms").upsert({ id: roomId });
  if (error) throw error;
}

async function listSheets(roomId) {
  const { data, error } = await supabase
    .from("sheets")
    .select("id,name,updated_at")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function listPermissionsForRoom(roomId) {
  const sheets = await listSheets(roomId);
  const sheetIds = sheets.map((sheet) => sheet.id);
  if (sheetIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sheet_permissions")
    .select("sheet_id,player_id,can_view,can_edit")
    .in("sheet_id", sheetIds);
  if (error) throw error;
  return data || [];
}

export async function getRoomData() {
  const roomId = await getRoomId();
  const [meta, sheets, permissionRows] = await Promise.all([
    OBR.room.getMetadata(),
    listSheets(roomId),
    listPermissionsForRoom(roomId),
  ]);
  return {
    ...(meta[ROOM_META_KEY] || {}),
    sheetIds: sheets.map((sheet) => sheet.id),
    sheetNames: Object.fromEntries(sheets.map((sheet) => [sheet.id, sheet.name || "Name Surname"])),
    permissions: normalizePermissions(permissionRows),
  };
}

export async function setRoomData(update) {
  const meta = await OBR.room.getMetadata();
  await OBR.room.setMetadata({
    ...meta,
    [ROOM_META_KEY]: { ...(meta[ROOM_META_KEY] || {}), ...update },
  });
}

export async function getSheetList() {
  const roomId = await getRoomId();
  const sheets = await listSheets(roomId);
  return sheets.map((sheet) => sheet.id);
}

export async function addSheetToRoom(sheetId, name) {
  const roomId = await getRoomId();
  await ensureRoom(roomId);
  const sheet = getSheetFromStorage(roomId, sheetId);
  const payload = {
    id: sheetId,
    room_id: roomId,
    name: name || getSheetName(sheet),
    sheet_data: sheet || {},
  };
  const { error } = await supabase.from("sheets").upsert(payload);
  if (error) throw error;
}

export async function getSheetNameInRoom(sheetId) {
  const { data, error } = await supabase.from("sheets").select("name").eq("id", sheetId).single();
  if (error) throw error;
  return data?.name ?? "Name Surname";
}

export async function setSheetNameInRoom(sheetId, name) {
  const { error } = await supabase.from("sheets").update({ name: name || "Name Surname" }).eq("id", sheetId);
  if (error) throw error;
}

export async function removeSheetFromRoom(sheetId) {
  const roomId = await getRoomId();
  const roomData = await getRoomData();
  const tokenToSheet = { ...(roomData.tokenToSheet || {}) };
  Object.keys(tokenToSheet).forEach((tid) => {
    if (tokenToSheet[tid] === sheetId) delete tokenToSheet[tid];
  });
  await setRoomData({ tokenToSheet });
  const { error } = await supabase.from("sheets").delete().eq("room_id", roomId).eq("id", sheetId);
  if (error) throw error;
}

export async function getPermissions() {
  const roomId = await getRoomId();
  return normalizePermissions(await listPermissionsForRoom(roomId));
}

export async function setPermissions(permissions) {
  const roomId = await getRoomId();
  const sheets = await listSheets(roomId);
  const sheetIds = new Set(sheets.map((sheet) => sheet.id));
  const rows = [];
  Object.entries(permissions || {}).forEach(([playerId, perms]) => {
    const viewSet = new Set(perms?.view || []);
    const editSet = new Set(perms?.edit || []);
    [...new Set([...viewSet, ...editSet])].forEach((sheetId) => {
      if (!sheetIds.has(sheetId)) return;
      rows.push({
        sheet_id: sheetId,
        player_id: playerId,
        can_view: viewSet.has(sheetId) || editSet.has(sheetId),
        can_edit: editSet.has(sheetId),
      });
    });
  });
  const { error: deleteError } = await supabase
    .from("sheet_permissions")
    .delete()
    .in("sheet_id", [...sheetIds]);
  if (deleteError) throw deleteError;
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("sheet_permissions").insert(rows);
    if (insertError) throw insertError;
  }
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

export function getSheetFromStorage(roomId, sheetId) {
  try {
    const raw = localStorage.getItem(storageKey(roomId, sheetId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getSheet(roomId, sheetId) {
  const cached = getSheetFromStorage(roomId, sheetId);
  if (cached) return cached;
  const { data, error } = await supabase
    .from("sheets")
    .select("sheet_data")
    .eq("room_id", roomId)
    .eq("id", sheetId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  const sheet = data?.sheet_data || null;
  if (sheet) saveSheetToStorage(roomId, sheet, { persistRemote: false });
  return sheet;
}

export function saveSheetToStorage(roomId, sheet, options = {}) {
  const { persistRemote = true } = options;
  const nextSheet = { ...sheet, updatedAt: Date.now() };
  localStorage.setItem(storageKey(roomId, sheet.id), JSON.stringify(nextSheet));
  if (!persistRemote) return;
  ensureRoom(roomId)
    .then(() =>
      supabase.from("sheets").upsert({
        id: nextSheet.id,
        room_id: roomId,
        name: getSheetName(nextSheet),
        sheet_data: nextSheet,
      })
    )
    .catch((error) => {
      console.error("Failed to persist sheet", error);
    });
}

export function removeSheetFromStorage(roomId, sheetId) {
  localStorage.removeItem(storageKey(roomId, sheetId));
}

export async function getAllSheets(roomId) {
  const { data, error } = await supabase
    .from("sheets")
    .select("sheet_data")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => row.sheet_data).filter(Boolean);
}

export function onBroadcast() {
  return () => {};
}

export async function requestSheet() {}

export async function broadcastSheet() {}

export async function broadcastPermissionsUpdated() {}

export function subscribeToRoom(roomId, callback) {
  const channel = supabase
    .channel(`foxyverse-room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sheets", filter: `room_id=eq.${roomId}` },
      callback
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sheet_permissions" },
      async (payload) => {
        const sheetId = payload?.new?.sheet_id || payload?.old?.sheet_id;
        if (!sheetId) {
          callback(payload);
          return;
        }
        const { data, error } = await supabase
          .from("sheets")
          .select("room_id")
          .eq("id", sheetId)
          .single();
        if (!error && data?.room_id === roomId) {
          callback(payload);
        }
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
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
