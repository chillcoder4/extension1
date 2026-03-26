const FRAME_ID = "smartsaver-sidebar-frame";
const TOAST_ID = "smartsaver-toast";

let sidebarFrame;
let lastHoveredLink = null;

document.addEventListener(
  "mouseover",
  (event) => {
    lastHoveredLink = event.target instanceof Element ? event.target.closest("a[href]") : null;
  },
  true
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case "SMARTSAVER_TOGGLE_SIDEBAR":
      toggleSidebar();
      sendResponse({ open: Boolean(sidebarFrame?.classList.contains("open")) });
      break;
    case "SMARTSAVER_CLOSE_SIDEBAR":
      closeSidebar();
      sendResponse({ open: false });
      break;
    case "SMARTSAVER_GET_SELECTION":
      sendResponse(readSelection());
      break;
    case "SMARTSAVER_TOAST":
      showToast(message.payload?.message || "", message.payload?.kind || "info");
      sendResponse({ shown: true });
      break;
    default:
      break;
  }

  return true;
});

function toggleSidebar() {
  if (!sidebarFrame) {
    sidebarFrame = document.createElement("iframe");
    sidebarFrame.id = FRAME_ID;
    sidebarFrame.src = chrome.runtime.getURL("sidebar/sidebar.html");
    sidebarFrame.allow = "clipboard-write";
    sidebarFrame.title = "SmartSaver Sidebar";
    document.documentElement.appendChild(sidebarFrame);
  }

  requestAnimationFrame(() => {
    sidebarFrame.classList.toggle("open");
  });
}

function closeSidebar() {
  if (sidebarFrame) {
    sidebarFrame.classList.remove("open");
  }
}

function readSelection() {
  const selectedText = window.getSelection()?.toString().trim() || "";
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const anchor = activeElement?.closest?.("a[href]") || lastHoveredLink || null;

  return {
    selectedText,
    linkUrl: anchor?.href || "",
    linkText: anchor?.textContent?.trim() || ""
  };
}

function showToast(message, kind) {
  if (!message) {
    return;
  }

  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    document.documentElement.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add("visible");

  clearTimeout(showToast.timerId);
  showToast.timerId = setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}
