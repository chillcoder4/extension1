// services/ai.js
// Keys are now stored securely in the .env file and managed by the backend proxy.
const BACKEND_URL = "http://localhost:3000";

export async function analyzeContent(text) {
  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  // The backend already parses and returns the final JSON format
  return response.json();
}
