export async function analyzeItem(content, settings) {
  const response = await fetch(`${settings.backendUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || "AI review failed.");
  }

  const payload = await response.json();
  return payload.review;
}

export async function syncRemoteItems(items, settings) {
  const response = await fetch(`${settings.backendUrl}/api/items/${encodeURIComponent(settings.cloud.userId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ items })
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload.error || "Cloud sync failed.");
  }

  return true;
}

export async function fetchRemoteItems(settings) {
  const response = await fetch(`${settings.backendUrl}/api/items/${encodeURIComponent(settings.cloud.userId)}`);
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}
