import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { performance } from "perf_hooks";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7049;

app.use(express.json({ limit: "1mb" }));

// For local dev (React dev server). In production (same-origin), this won’t matter much.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Fetch available models from Groq
app.get("/api/models", async (req, res) => {
  try {
    const models = await groq.models.list(); // Groq docs example :contentReference[oaicite:6]{index=6}
    const ids = (models?.data || []).map((m) => m.id).sort();
    res.json({ models: ids });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch models",
      details: err?.message || String(err),
    });
  }
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { model, message } = req.body || {};

    if (!model || typeof model !== "string") {
      return res.status(400).json({ error: "model is required" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const t0 = performance.now();

    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: message.trim() }],
      temperature: 0.7,
    });

    const t1 = performance.now();

    const text = completion?.choices?.[0]?.message?.content ?? "";
    const usage = completion?.usage ?? null; // may include total_time :contentReference[oaicite:7]{index=7}
    const requestId = completion?.x_groq?.id ?? null;

    res.json({
      model: completion?.model || model,
      text,
      wallTimeMs: Math.round(t1 - t0),
      usage,
      requestId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Groq request failed",
      details: err?.message || String(err),
    });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const distPath = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(distPath));

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
