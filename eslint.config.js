// eslint.config.js — Market Monitor (v13.4.0 で導入)
//
// 設計方針:
//   - ESLint v9 の flat config 形式
//   - React + React Hooks + React Refresh の最低限を有効化
//   - Prettier との衝突は eslint-config-prettier で無効化 (formatter は Prettier 専任)
//   - 既存コードに大量の修正が要らない範囲で開始、段階的に強化
//   - v13.4.1 以降で必要に応じてルール追加

import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  // 除外パス
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "data/**",
      "coverage/**",
      "*.config.js",
    ],
  },

  // 全 JS/JSX ファイル
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "18.3" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // React 17+ の新 JSX transform 環境では import React 不要
      "react/react-in-jsx-scope": "off",
      // props 型チェックは TypeScript 移行 (v17.0) で別途対応
      "react/prop-types": "off",

      // Vite + React Refresh: 1 ファイル 1 コンポーネント原則の緩和
      // (sections/ では HEADER 等の補助コンポーネントを export しているので warn)
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // 未使用変数: アンダースコア始まりは許可 (意図的な無視)
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // vite.config.js は Node 環境
  {
    files: ["vite.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 最後に Prettier 衝突ルールを無効化 (formatter は Prettier に一任)
  prettierConfig,
];
