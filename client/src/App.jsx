import { useEffect, useMemo, useState } from "react";
import "./App.css";

export default function App() {
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [answer, setAnswer] = useState("");
  const [wallTimeMs, setWallTimeMs] = useState(null);

  // Extra metrics from backend response
  const [usage, setUsage] = useState(null);
  const [requestId, setRequestId] = useState(null);

  const [error, setError] = useState("");

  const canSend = useMemo(() => model && prompt.trim() && !loading, [model, prompt, loading]);

  // Helpers
  const fmtSec = (s) => (typeof s === "number" ? `${s.toFixed(3)} s` : "—");
  const fmtTok = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
  const tokPerSec = (tok, sec) =>
    typeof tok === "number" && typeof sec === "number" && sec > 0 ? tok / sec : null;

  const overheadMs =
    wallTimeMs != null && typeof usage?.total_time === "number"
      ? Math.max(0, wallTimeMs - usage.total_time * 1000)
      : null;

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
    setUsage(null);
    setRequestId(null);

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
      setUsage(data?.usage ?? null);
      setRequestId(data?.requestId ?? null);
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

      {answer && (
        <div style={{ marginTop: 12 }}>
          <h3>Response</h3>
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, background: "#0b0b0b", color: "#f1f1f1" }}>
            {answer}
          </pre>
        </div>
      )}

      {(wallTimeMs != null || usage != null) && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#000",
            border: "1px solid #333",
            color: "#fff",
            borderRadius: 8,
            lineHeight: 1.6,
          }}
        >
          <div>
            <b>Wall time:</b> {wallTimeMs ?? "—"} ms
          </div>

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            <b>Groq timings:</b>
          </div>
          <div>
            <b>total_time:</b> {fmtSec(usage?.total_time)}
          </div>
          <div>
            <b>queue_time:</b> {fmtSec(usage?.queue_time)}
          </div>
          <div>
            <b>prompt_time:</b> {fmtSec(usage?.prompt_time)}
          </div>
          <div>
            <b>completion_time:</b> {fmtSec(usage?.completion_time)}
          </div>

          {overheadMs != null && (
            <div>
              <b>Overhead (wall - Groq):</b> {Math.round(overheadMs)} ms
            </div>
          )}

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            <b>Tokens:</b>
          </div>
          <div>
            <b>prompt_tokens:</b> {fmtTok(usage?.prompt_tokens)}
          </div>
          <div>
            <b>completion_tokens:</b> {fmtTok(usage?.completion_tokens)}
          </div>
          <div>
            <b>total_tokens:</b> {fmtTok(usage?.total_tokens)}
          </div>

          {usage?.completion_tokens_details?.reasoning_tokens != null && (
            <div>
              <b>reasoning_tokens:</b> {fmtTok(usage.completion_tokens_details.reasoning_tokens)}
            </div>
          )}

          {tokPerSec(usage?.completion_tokens, usage?.completion_time) != null && (
            <div>
              <b>Output speed:</b>{" "}
              {tokPerSec(usage.completion_tokens, usage.completion_time).toFixed(1)} tok/s
            </div>
          )}

          {tokPerSec(usage?.total_tokens, usage?.total_time) != null && (
            <div>
              <b>Total speed:</b> {tokPerSec(usage.total_tokens, usage.total_time).toFixed(1)} tok/s
            </div>
          )}

          {requestId && (
            <div style={{ marginTop: 10 }}>
              <b>Request ID:</b>{" "}
              <code style={{ color: "#fff", background: "#111", padding: "2px 6px", borderRadius: 6 }}>
                {requestId}
              </code>
            </div>
          )}
        </div>
      )}

      
    </div>
  );
}
