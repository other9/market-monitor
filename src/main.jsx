import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";

// v13.5.1: Sentry を取り下げ、vanilla ErrorBoundary に置き換え (DECISION v13.5.1-01)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ error }) => (
        <div
          role="alert"
          style={{
            padding: 32,
            fontFamily: "IBM Plex Sans, system-ui, sans-serif",
            color: "#1A1F2E",
            background: "#F5F1E8",
            minHeight: "100vh",
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>
            ⚠ Market Monitor — UI エラー
          </h1>
          <p style={{ marginBottom: 16, fontSize: 14 }}>
            ページのレンダリング中に問題が発生しました。
            データ自体は <code>data/*.json</code> に保存されているはずです。
          </p>
          <details style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
            <summary style={{ cursor: "pointer", marginBottom: 8 }}>
              エラー詳細
            </summary>
            <pre style={{ whiteSpace: "pre-wrap", color: "#C0392B" }}>
              {String(error?.message || error)}
            </pre>
          </details>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
