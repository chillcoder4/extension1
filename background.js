import {
  createSavedItem,
  deleteSavedItem,
  getSavedItems,
  getSettings,
  saveLocalBackup,
  saveSavedItem,
  seedDefaults,
  updateSettings
} from "./services/storage.js";
import { analyzeItem, fetchRemoteItems, syncRemoteItems } from "./services/api-client.js";

const MENUS = {
  saveSelection: "smartsaver-save-selection",
  saveLink: "smartsaver-save-link"
};

chrome.runtime.onInstalled.addListener(async () => {
  await seedDefaults();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENUS.saveSelection,
      title: "Save Selected Text",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: MENUS.saveLink,
      title: "Save Link",
      contexts: ["link"]
    });
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    await sendTabMessage(tab.id, { type: "SMARTSAVER_TOGGLE_SIDEBAR" });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-selected-content") {
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  const selection = await sendTabMessage(tab.id, { type: "SMARTSAVER_GET_SELECTION" });
  const payload = selection?.selectedText
    ? {
        type: "text",
        content: selection.selectedText,
        pageUrl: tab.url || "",
        pageTitle: tab.title || ""
      }
    : selection?.linkUrl
      ? {
          type: "link",
          content: selection.linkUrl,
          pageUrl: tab.url || "",
          pageTitle: tab.title || "",
          linkText: selection.linkText || ""
        }
      : null;

  if (!payload) {
    await sendTabMessage(tab.id, {
      type: "SMARTSAVER_TOAST",
      payload: { kind: "warning", message: "Select text or focus a link before saving." }
    });
    return;
  }

  const result = await persistItem(payload);
  await sendTabMessage(tab.id, {
    type: "SMARTSAVER_TOAST",
    payload: result.added
      ? { kind: "success", message: "Saved to SmartSaver." }
      : { kind: "info", message: "Duplicate skipped." }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    return;
  }

  if (info.menuItemId === MENUS.saveSelection && info.selectionText) {
    const result = await persistItem({
      type: "text",
      content: info.selectionText,
      pageUrl: tab.url || "",
      pageTitle: tab.title || ""
    });
    await sendTabMessage(tab.id, {
      type: "SMARTSAVER_TOAST",
      payload: result.added
        ? { kind: "success", message: "Selected text saved." }
        : { kind: "info", message: "That text is already saved." }
    });
  }

  if (info.menuItemId === MENUS.saveLink && info.linkUrl) {
    const result = await persistItem({
      type: "link",
      content: info.linkUrl,
      pageUrl: tab.url || "",
      pageTitle: tab.title || "",
      linkText: info.linkText || ""
    });
    await sendTabMessage(tab.id, {
      type: "SMARTSAVER_TOAST",
      payload: result.added
        ? { kind: "success", message: "Link saved." }
        : { kind: "info", message: "That link is already saved." }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unexpected error" }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "SMARTSAVER_GET_STATE": {
      const [items, settings] = await Promise.all([getSavedItems(), getSettings()]);
      return { items, settings };
    }
    case "SMARTSAVER_CLOSE_SIDEBAR": {
      const tab = sender?.tab || (await getActiveTab());
      if (tab?.id) {
        await sendTabMessage(tab.id, { type: "SMARTSAVER_CLOSE_SIDEBAR" });
      }
      return {};
    }
    case "SMARTSAVER_DELETE_ITEM": {
      const items = await deleteSavedItem(message.payload?.id);
      await maybeSync(items);
      return { items };
    }
    case "SMARTSAVER_ANALYZE": {
      const settings = await getSettings();
      const review = await analyzeItem(message.payload?.content || "", settings);
      return { review };
    }
    case "SMARTSAVER_EXPORT_BACKUP": {
      const items = await getSavedItems();
      await saveLocalBackup(items);
      return { items };
    }
    case "SMARTSAVER_SAVE_SETTINGS": {
      const settings = await updateSettings(message.payload || {});
      return { settings };
    }
    case "SMARTSAVER_SYNC_NOW": {
      const settings = await getSettings();
      const localItems = await getSavedItems();
      const remoteItems = settings.cloud.enabled ? await fetchRemoteItems(settings) : [];
      const merged = mergeItems(localItems, remoteItems);
      await chrome.storage.local.set({ savedItems: merged });
      await saveLocalBackup(merged);
      await maybeSync(merged, settings);
      return { items: merged };
    }
    default:
      return {};
  }
}

async function persistItem(rawItem) {
  const item = createSavedItem(rawItem);
  const result = await saveSavedItem(item);
  await saveLocalBackup(result.items);
  await maybeSync(result.items);
  return result;
}

async function maybeSync(items, providedSettings) {
  const settings = providedSettings || (await getSettings());
  if (!settings.cloud.enabled) {
    return false;
  }
  try {
    return await syncRemoteItems(items, settings);
  } catch (error) {
    return false;
  }
}

async function sendTabMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    return null;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function mergeItems(localItems, remoteItems) {
  const map = new Map();
  [...remoteItems, ...localItems].forEach((item) => {
    if (!item?.duplicateKey) {
      return;
    }
    if (!map.has(item.duplicateKey)) {
      map.set(item.duplicateKey, item);
    }
  });
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
