import { readLocalBackup } from "../services/storage.js";

const state = {
  items: [],
  selectedId: null,
  settings: null
};

const elements = {
  totalCount: document.getElementById("totalCount"),
  linkCount: document.getElementById("linkCount"),
  themeLabel: document.getElementById("themeLabel"),
  searchInput: document.getElementById("searchInput"),
  filterInput: document.getElementById("filterInput"),
  exportButton: document.getElementById("exportButton"),
  syncButton: document.getElementById("syncButton"),
  closeButton: document.getElementById("closeButton"),
  themeToggle: document.getElementById("themeToggle"),
  itemsList: document.getElementById("itemsList"),
  resultCount: document.getElementById("resultCount"),
  emptyState: document.getElementById("emptyState"),
  detailPlaceholder: document.getElementById("detailPlaceholder"),
  detailView: document.getElementById("detailView"),
  detailType: document.getElementById("detailType"),
  detailTime: document.getElementById("detailTime"),
  detailTitle: document.getElementById("detailTitle"),
  detailUrl: document.getElementById("detailUrl"),
  detailContent: document.getElementById("detailContent"),
  copyButton: document.getElementById("copyButton"),
  reviewButton: document.getElementById("reviewButton"),
  deleteButton: document.getElementById("deleteButton"),
  reviewOutput: document.getElementById("reviewOutput"),
  backendUrlInput: document.getElementById("backendUrlInput"),
  cloudUserIdInput: document.getElementById("cloudUserIdInput"),
  cloudEnabledInput: document.getElementById("cloudEnabledInput"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  template: document.getElementById("itemCardTemplate")
};

document.addEventListener("DOMContentLoaded", init);

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.savedItems) {
    state.items = changes.savedItems.newValue || [];
    persistLocalBackup(state.items);
    render();
  }

  if (changes.settings) {
    state.settings = changes.settings.newValue;
    applyTheme();
    renderSettings();
  }
});

async function init() {
  bindEvents();
  const response = await chrome.runtime.sendMessage({ type: "SMARTSAVER_GET_STATE" });
  state.items = response?.items?.length ? response.items : readLocalBackup();
  state.settings = response?.settings || {
    theme: "dark",
    backendUrl: "http://localhost:3000",
    cloud: { enabled: false, userId: "jaswant-yadav" }
  };
  state.selectedId = state.items[0]?.id || null;
  persistLocalBackup(state.items);
  applyTheme();
  renderSettings();
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", render);
  elements.filterInput.addEventListener("change", render);
  elements.exportButton.addEventListener("click", exportItems);
  elements.syncButton.addEventListener("click", syncItems);
  elements.closeButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "SMARTSAVER_CLOSE_SIDEBAR" });
  });
  elements.themeToggle.addEventListener("click", async () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    state.settings.theme = nextTheme;
    applyTheme();
    await saveSettings();
  });
  elements.copyButton.addEventListener("click", copySelectedItem);
  elements.reviewButton.addEventListener("click", reviewSelectedItem);
  elements.deleteButton.addEventListener("click", deleteSelectedItem);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
}

function render() {
  const items = getFilteredItems();
  elements.totalCount.textContent = String(state.items.length);
  elements.linkCount.textContent = String(state.items.filter((item) => item.type === "link").length);
  elements.themeLabel.textContent = capitalize(document.body.dataset.theme);
  elements.resultCount.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;
  elements.emptyState.classList.toggle("hidden", items.length > 0);
  elements.itemsList.innerHTML = "";

  if (!items.some((item) => item.id === state.selectedId)) {
    state.selectedId = items[0]?.id || null;
  }

  items.forEach((item) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.classList.toggle("active", item.id === state.selectedId);
    card.querySelector(".badge").textContent = item.type;
    card.querySelector("time").textContent = formatDate(item.createdAt);
    card.querySelector(".item-title").textContent = item.pageTitle || item.linkText || fallbackTitle(item);
    card.querySelector(".item-preview").textContent = item.content;
    card.querySelector(".item-source").textContent = item.pageUrl || "Saved from current tab";

    card.addEventListener("click", () => {
      state.selectedId = item.id;
      render();
    });

    card.querySelector('[data-action="copy"]').addEventListener("click", (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(item.content);
    });

    card.querySelector('[data-action="review"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      state.selectedId = item.id;
      renderDetail();
      await reviewSelectedItem();
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      state.selectedId = item.id;
      await deleteSelectedItem();
    });

    elements.itemsList.appendChild(card);
  });

  renderDetail();
}

function renderDetail() {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  const exists = Boolean(item);
  elements.detailPlaceholder.classList.toggle("hidden", exists);
  elements.detailView.classList.toggle("hidden", !exists);
  elements.reviewOutput.classList.add("hidden");
  elements.reviewOutput.innerHTML = "";

  if (!item) {
    return;
  }

  elements.detailType.textContent = item.type;
  elements.detailTime.textContent = formatDate(item.createdAt, true);
  elements.detailTitle.textContent = item.pageTitle || item.linkText || fallbackTitle(item);
  elements.detailUrl.href = item.pageUrl || "#";
  elements.detailUrl.textContent = item.pageUrl || "No source URL";
  elements.detailContent.textContent = item.content;
}

function renderSettings() {
  elements.backendUrlInput.value = state.settings.backendUrl || "http://localhost:3000";
  elements.cloudUserIdInput.value = state.settings.cloud?.userId || "jaswant-yadav";
  elements.cloudEnabledInput.checked = Boolean(state.settings.cloud?.enabled);
}

async function saveSettings() {
  const payload = {
    theme: document.body.dataset.theme,
    backendUrl: elements.backendUrlInput.value.trim() || "http://localhost:3000",
    cloud: {
      enabled: elements.cloudEnabledInput.checked,
      userId: elements.cloudUserIdInput.value.trim() || "jaswant-yadav"
    }
  };
  const response = await chrome.runtime.sendMessage({
    type: "SMARTSAVER_SAVE_SETTINGS",
    payload
  });
  if (response?.settings) {
    state.settings = response.settings;
    renderSettings();
  }
}

async function syncItems() {
  elements.syncButton.textContent = "Syncing";
  elements.syncButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "SMARTSAVER_SYNC_NOW" });
    state.items = response?.items || state.items;
    persistLocalBackup(state.items);
    render();
  } finally {
    elements.syncButton.textContent = "Sync";
    elements.syncButton.disabled = false;
  }
}

function exportItems() {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `smartsaver-export-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function copySelectedItem() {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!item) {
    return;
  }
  navigator.clipboard.writeText(item.content);
}

async function reviewSelectedItem() {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!item) {
    return;
  }

  elements.reviewButton.textContent = "Reviewing";
  elements.reviewButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SMARTSAVER_ANALYZE",
      payload: { content: item.content }
    });
    if (!response?.review) {
      throw new Error(response?.error || "AI review failed.");
    }
    elements.reviewOutput.innerHTML = renderReview(response.review);
    elements.reviewOutput.classList.remove("hidden");
  } catch (error) {
    elements.reviewOutput.innerHTML = `<h4>Error</h4><p>${escapeHtml(error.message || "Review failed.")}</p>`;
    elements.reviewOutput.classList.remove("hidden");
  } finally {
    elements.reviewButton.textContent = "AI Review";
    elements.reviewButton.disabled = false;
  }
}

async function deleteSelectedItem() {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!item) {
    return;
  }
  const response = await chrome.runtime.sendMessage({
    type: "SMARTSAVER_DELETE_ITEM",
    payload: { id: item.id }
  });
  state.items = response?.items || state.items.filter((entry) => entry.id !== item.id);
  state.selectedId = state.items[0]?.id || null;
  persistLocalBackup(state.items);
  render();
}

function renderReview(review) {
  return [
    section("Summary", `<p>${escapeHtml(review.summary || "No summary generated.")}</p>`),
    section("Key Points", list(review.keyPoints)),
    section("Insights", list(review.insights)),
    section("Suggestions", list(review.suggestions))
  ]
    .filter(Boolean)
    .join("");
}

function section(title, content) {
  if (!content) {
    return "";
  }
  return `<section><h4>${title}</h4>${content}</section>`;
}

function list(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }
  return `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function getFilteredItems() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filter = elements.filterInput.value;
  return state.items.filter((item) => {
    const haystack = [item.content, item.pageTitle, item.pageUrl, item.linkText].join(" ").toLowerCase();
    const queryMatch = !query || haystack.includes(query);
    const filterMatch = filter === "all" || item.type === filter;
    return queryMatch && filterMatch;
  });
}

function applyTheme() {
  document.body.dataset.theme = state.settings.theme || "dark";
}

function formatDate(value, detailed = false) {
  return new Date(value).toLocaleString(
    undefined,
    detailed ? { dateStyle: "medium", timeStyle: "short" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );
}

function fallbackTitle(item) {
  return item.type === "link" ? "Saved link" : "Saved text";
}

function persistLocalBackup(items) {
  try {
    localStorage.setItem("smartsaver-local-backup", JSON.stringify(items));
  } catch (error) {
    return;
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
