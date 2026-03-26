// utils/export.js
export function exportToJson(items) {
  if (!items || items.length === 0) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
  const downloadAnchorElement = document.createElement('a');
  downloadAnchorElement.setAttribute("href", dataStr);
  downloadAnchorElement.setAttribute("download", "SmartSaver_Export_" + new Date().toISOString().split('T')[0] + ".json");
  document.body.appendChild(downloadAnchorElement);
  downloadAnchorElement.click();
  downloadAnchorElement.remove();
}
