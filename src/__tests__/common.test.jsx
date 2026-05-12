// src/__tests__/common.test.jsx — v13.4.1 で導入
//
// 共通コンポーネントの最小スナップショットテスト。
// v13.4.1 で抽出した SectionHeader / GroupHeader / ExternalLink の挙動を固定する。

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionHeader, GroupHeader, ExternalLink, Pct, Signed } from "@/components/common";

describe("SectionHeader", () => {
  it("renders a numbered section header", () => {
    const { container } = render(<SectionHeader>1. 本日の注目チャート</SectionHeader>);
    expect(container).toMatchSnapshot();
  });

  it("renders with a marker prop (Market Muse style)", () => {
    const { container } = render(<SectionHeader marker="▨">Market Muse</SectionHeader>);
    expect(container).toMatchSnapshot();
  });
});

describe("GroupHeader", () => {
  it("renders title and marker", () => {
    const { container } = render(<GroupHeader title="株式" marker="▽ Section" />);
    expect(container).toMatchSnapshot();
  });

  it("accepts an inline style override", () => {
    const { container } = render(
      <GroupHeader title="ボラティリティ・ファンディング" marker="▽ stress detectors" style={{ marginTop: 0 }} />
    );
    expect(container).toMatchSnapshot();
  });
});

describe("ExternalLink", () => {
  it("always sets target=_blank and rel noopener noreferrer", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" className="mm-news-link">
        記事タイトル
      </ExternalLink>
    );
    // Regression guard: target and rel must remain set on every external link.
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container).toMatchSnapshot();
  });
});

describe("Pct (existing common)", () => {
  it("formats positive percent with up color", () => {
    const { container } = render(<Pct n={1.25} />);
    expect(container).toMatchSnapshot();
  });

  it("formats negative percent with down color", () => {
    const { container } = render(<Pct n={-0.8} />);
    expect(container).toMatchSnapshot();
  });

  it("shows em-dash for null", () => {
    const { container } = render(<Pct n={null} />);
    expect(container).toMatchSnapshot();
  });
});

describe("Signed (existing common)", () => {
  it("prefixes + for positive values", () => {
    const { container } = render(<Signed n={0.123} />);
    expect(container).toMatchSnapshot();
  });
});
