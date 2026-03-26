import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { getFirebaseAdmin } from "./firebase-admin.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const groqKeys = [
  process.env.GROQ_PRIMARY,
  process.env.GROQ_SECONDARY,
  process.env.GROQ_3,
  process.env.GROQ_4,
  process.env.GROQ_5
].filter(Boolean);
const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SmartSaver Backend</title>
        <style>
          body {
            margin: 0;
            font-family: "Segoe UI", sans-serif;
            background: linear-gradient(135deg, #081120, #10213b);
            color: #e5eefc;
          }
          .wrap {
            max-width: 760px;
            margin: 48px auto;
            padding: 24px;
          }
          .card {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 20px;
            padding: 24px;
            backdrop-filter: blur(12px);
          }
          h1, h2, p { margin-top: 0; }
          code {
            background: rgba(0, 0, 0, 0.28);
            padding: 2px 8px;
            border-radius: 8px;
          }
          ul { line-height: 1.7; }
          a { color: #5ea2ff; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1>SmartSaver Backend is running</h1>
            <p>This server is for the browser extension. Open the extension in Chrome/Edge and point the backend URL to <code>http://localhost:${port}</code>.</p>
            <h2>Available routes</h2>
            <ul>
              <li><code>GET /</code> - this page</li>
              <li><code>GET /health</code> - backend health status</li>
              <li><code>POST /api/analyze</code> - AI review endpoint</li>
              <li><code>GET /api/items/:userId</code> - fetch synced items</li>
              <li><code>PUT /api/items/:userId</code> - save synced items</li>
            </ul>
            <p>Quick check: <a href="/health">open /health</a></p>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    groqConfigured: groqKeys.length > 0,
    firebaseConfigured: Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    )
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Content is required." });
    }

    if (!groqKeys.length) {
      return res.status(400).json({ error: "Groq keys are not configured." });
    }

    const review = await analyzeWithFailover(content);
    return res.json({ review });
  } catch (error) {
    return res.status(500).json({ error: error.message || "AI analysis failed." });
  }
});

app.get("/api/items/:userId", async (req, res) => {
  try {
    const snapshot = await getUserSnapshot(req.params.userId);
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load items." });
  }
});

app.put("/api/items/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const db = getFirebaseAdmin().firestore();
    await db.collection("smartsaver").doc(userId).set(
      {
        userId,
        updatedAt: Date.now(),
        items
      },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to sync items." });
  }
});

app.listen(port, () => {
  console.log(`SmartSaver backend running on http://localhost:${port}`);
});

async function analyzeWithFailover(content) {
  const prompt = [
    "Analyze the following content and return strict JSON only.",
    'Return keys exactly as: "summary", "keyPoints", "insights", "suggestions".',
    "Use concise strings for array entries.",
    "",
    content
  ].join("\n");

  for (let index = 0; index < groqKeys.length; index += 1) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKeys[index]}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: groqModel,
          temperature: 0.25,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a structured content review engine."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Groq returned ${response.status}`);
      }

      const payload = await response.json();
      const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
      return {
        summary: parsed.summary || "",
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      };
    } catch (error) {
      if (index === groqKeys.length - 1) {
        throw error;
      }
    }
  }

  throw new Error("All Groq keys failed.");
}

async function getUserSnapshot(userId) {
  const db = getFirebaseAdmin().firestore();
  const doc = await db.collection("smartsaver").doc(userId).get();
  if (!doc.exists) {
    return { items: [] };
  }
  return doc.data();
}
