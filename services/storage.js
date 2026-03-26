const SETTINGS_KEY = "settings";
const ITEMS_KEY = "savedItems";
const BACKUP_KEY = "smartsaver-local-backup";

const DEFAULT_SETTINGS = {
  theme: "dark",
  backendUrl: "http://localhost:3000",
  cloud: {
    enabled: false,
    userId: "jaswant-yadav"
  }
};

export async function seedDefaults() {
  const current = await chrome.storage.local.get([SETTINGS_KEY, ITEMS_KEY]);
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
  if (!current[ITEMS_KEY]) {
    await chrome.storage.local.set({ [ITEMS_KEY]: [] });
  }
}

export function createSavedItem(rawItem) {
  const now = Date.now();
  const type = rawItem.type === "link" ? "link" : "text";
  const content = String(rawItem.content || "").trim();
  const pageUrl = String(rawItem.pageUrl || "").trim();

  return {
    id: rawItem.id || `ss_${now}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    content,
    pageUrl,
    pageTitle: String(rawItem.pageTitle || "").trim(),
    linkText: String(rawItem.linkText || "").trim(),
    createdAt: rawItem.createdAt || now,
    updatedAt: now,
    duplicateKey: `${type}:${normalize(content)}:${normalize(pageUrl)}`
  };
}

export async function getSavedItems() {
  const result = await chrome.storage.local.get(ITEMS_KEY);
  return Array.isArray(result[ITEMS_KEY]) ? result[ITEMS_KEY] : [];
}

export async function saveSavedItem(item) {
  const items = await getSavedItems();
  const duplicate = items.find((existing) => existing.duplicateKey === item.duplicateKey);
  if (duplicate) {
    return { added: false, items, duplicate };
  }

  const nextItems = [item, ...items].sort((a, b) => b.updatedAt - a.updatedAt);
  await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
  return { added: true, items: nextItems, item };
}

export async function deleteSavedItem(itemId) {
  const items = await getSavedItems();
  const nextItems = items.filter((item) => item.id !== itemId);
  await chrome.storage.local.set({ [ITEMS_KEY]: nextItems });
  return nextItems;
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] || {}),
    cloud: {
      ...DEFAULT_SETTINGS.cloud,
      ...(result[SETTINGS_KEY]?.cloud || {})
    }
  };
}

export async function updateSettings(nextSettings) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...nextSettings,
    cloud: {
      ...current.cloud,
      ...(nextSettings.cloud || {})
    }
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export async function saveLocalBackup(items) {
  await chrome.storage.local.set({ [ITEMS_KEY]: items });

  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
  } catch (error) {
    return false;
  }

  return true;
}

export function readLocalBackup() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
