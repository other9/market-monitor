// src/sentry.js — Sentry 初期化 (v13.5 で導入)
//
// 設計方針:
//   - VITE_SENTRY_DSN 環境変数が設定されている時のみ Sentry を有効化
//   - 未設定 (= local dev) では完全 no-op、依存も増やさない
//   - フロントの未捕捉例外 + Promise rejection を自動キャプチャ
//   - URL や stack trace に含まれうる sensitive info は最小限 (sendDefaultPii: false)
//
// DSN は GitHub Secrets の VITE_SENTRY_DSN に格納し、daily-update.yml の build ステップで
// env として渡す。Vite が build 時に import.meta.env.VITE_SENTRY_DSN として埋め込む。
//
// セットアップ手順は docs/RUNBOOK.md の「Sentry セットアップ」を参照。

import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // local dev / DSN 未設定環境: 完全 no-op
    return;
  }

  Sentry.init({
    dsn,
    // 配信環境を識別 (Cloudflare Pages preview と本番を区別する目的)
    environment: import.meta.env.MODE,
    // パフォーマンス計測は有効化しない (free tier の events 数を温存)
    tracesSampleRate: 0,
    // Session replay も無効化
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // PII (IP/user-agent 等) は送らない方針
    sendDefaultPii: false,
    // breadcrumbs は console.error/warn 等を捕捉
    integrations: [
      Sentry.browserTracingIntegration({ enabled: false }),
    ],
  });
}

// Error boundary 用に Sentry.ErrorBoundary を再 export
export const ErrorBoundary = Sentry.ErrorBoundary;
