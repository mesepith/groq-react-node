import { useEffect, useMemo, useState } from "react";
import "./App.css";

export default function App() {
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [answer, setAnswer] = useState("");
  const [wallTimeMs, setWallTimeMs] = useState(null);
  const [groqTotalTime, setGroqTotalTime] = useState(null);
  const [error, setError] = useState("");

  const canSend = useMemo(() => model && prompt.trim() && !loading, [model, prompt, loading]);

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const res = await fetch("/api/models");
        const data = await res.json();
        const list = data?.models || [];
        setModels(list);
        setModel(list[0] || "");
      } catch (e) {
        setError("Failed to load models from backend.");
      }
    })();
  }, []);

  async function send() {
    if (!canSend) return;

    setLoading(true);
    setError("");
    setAnswer("");
    setWallTimeMs(null);
    setGroqTotalTime(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, message: prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.details || data?.error || "Request failed");
      }

      setAnswer(data?.text || "");
      setWallTimeMs(data?.wallTimeMs ?? null);

      // Groq SDK often returns usage.total_time in seconds (when available)
      const totalTime = data?.usage?.total_time;
      setGroqTotalTime(typeof totalTime === "number" ? totalTime : null);
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2>Groq LLM Playground (React + Node)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Model:&nbsp;
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <button onClick={send} disabled={!canSend}>
          {loading ? "Running..." : "Submit"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea
          rows={6}
          style={{ width: "100%", padding: 12, fontSize: 14 }}
          placeholder="Type your prompt... (Enter to send, Shift+Enter for newline)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, background: "#ffecec", border: "1px solid #ffb3b3" }}>
          <b>Error:</b> {error}
        </div>
      )}

      {(wallTimeMs != null || groqTotalTime != null) && (
        <div style={{ marginTop: 12, padding: 12, background: "#f6f6f6", border: "1px solid #ddd" }}>
          <div><b>Wall time:</b> {wallTimeMs} ms</div>
          {groqTotalTime != null && <div><b>Groq model time:</b> {groqTotalTime} s</div>}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: 12 }}>
          <h3>Response</h3>
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, background: "#0b0b0b", color: "#f1f1f1" }}>
            {answer}
          </pre>
        </div>
      )}
    </div>
  );
}
