import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load environment variables from .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Setup securely using .env private keys
try {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Convert escaped newlines into actual newlines for the PEM format
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log("Firebase Admin Initialized successfully.");
} catch (e) {
  console.error("Firebase Admin Initialization Error:", e.message);
}

const db = admin.database();

// Load all Groq keys into array
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_PRIMARY,
  process.env.GROQ_SECONDARY,
  process.env.GROQ_3,
  process.env.GROQ_4,
  process.env.GROQ_5
].filter(Boolean);

let currentKeyIndex = 0;

app.post('/api/analyze', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "No content provided" });

  const prompt = `Analyze the following content and generate a highly structured JSON response with exactly these keys: summary (string), keyPoints (array of strings), insights (array of strings), suggestions (array of strings). Return ONLY the raw JSON object.\nContent:\n${content}`;

  let attempts = 0;
  while (attempts < GROQ_KEYS.length) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_KEYS[currentKeyIndex]}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      const contentStr = data.choices[0].message.content;
      return res.json(JSON.parse(contentStr));
    } catch (err) {
      console.warn(`[Backend] API key at index ${currentKeyIndex} failed:`, err.message);
      currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
      attempts++;
    }
  }
  
  res.status(500).json({ error: "All AI API keys failed or rate limits exhausted." });
});

app.post('/api/sync', async (req, res) => {
  try {
    const items = req.body.items;
    if (!items) return res.status(400).json({ error: "No items array provided in body" });

    // Using Firebase Admin to bypass any client-side configuration, ensuring DB write
    const ref = db.ref('extension_sync_data');
    await ref.set(items);
    
    res.json({ success: true, count: items.length });
  } catch (error) {
    console.error("[Backend] Sync Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SmartSaver Secure Backend running on http://localhost:${PORT}`);
});
