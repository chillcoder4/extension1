// services/firebase.js
// Firebase credentials are now managed securely by the backend via Firebase Admin SDK.
const BACKEND_URL = "http://localhost:3000";

export async function syncToFirebase(items) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    
    if (!response.ok) throw new Error("Backend sync failed");
    return true;
  } catch(e) {
    console.warn("Backend sync warning (offline or server disconnected):", e.message);
    return false;
  }
}
