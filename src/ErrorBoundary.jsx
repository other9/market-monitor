// src/ErrorBoundary.jsx — vanilla React ErrorBoundary (v13.5.1 で導入)
//
// v13.5 で Sentry を導入したが、Sentry の signup フローが 14 日 Business trial に
// 強制 enroll する UX で、kk の「月コスト 0 円維持」方針 (DECISION v13.4-plan-06) と
// 相性が悪かったため、Sentry を取り下げて vanilla React ErrorBoundary に置き換え。
//
// 設計:
//   - 子コンポーネントの render エラーをキャッチして fallback を表示する
//   - fallback は関数 ({ error }) => JSX または JSX を受け取る
//   - エラーは console.error にも出力 (ブラウザ DevTools で見えるように)
//
// 経緯: DECISION v13.5.1-01 参照

import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // ブラウザ DevTools の console.error に詳細を出す
    // (本格的な remote 監視は v13.5.1 で取り下げ — DECISION v13.5.1-01)
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback({ error });
      }
      return fallback || null;
    }
    return this.props.children;
  }
}
