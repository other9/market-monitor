// src/__tests__/sections.test.jsx — v13.4.1 で導入
//
// 主要セクションのレンダリング結果を固定するスナップショットテスト。
// v13.4.1 で導入した共通 component への移行で挙動が変わらないことの保証用。

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { NewsSection } from "@/components/sections/NewsSection";
import { MarketMuseSection } from "@/components/sections/MarketMuseSection";
import { DeepDiveSection } from "@/components/sections/DeepDiveSection";
import { FooterSection } from "@/components/sections/FooterSection";

import { newsFixture } from "./fixtures";

describe("NewsSection", () => {
  it("renders headlines list with external links", () => {
    const { container } = render(<NewsSection news={newsFixture} />);
    expect(container).toMatchSnapshot();
  });

  it("returns null when no news items", () => {
    const { container } = render(<NewsSection news={{ news: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("MarketMuseSection", () => {
  it("renders funny stories with source links", () => {
    const { container } = render(<MarketMuseSection news={newsFixture} />);
    expect(container).toMatchSnapshot();
  });
});

describe("DeepDiveSection", () => {
  it("renders article with source link", () => {
    const { container } = render(
      <DeepDiveSection article={newsFixture.deep_dive} chartUniverse={[]} cadence={{}} />
    );
    expect(container).toMatchSnapshot();
  });

  it("returns null without article title", () => {
    const { container } = render(<DeepDiveSection article={{}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("FooterSection", () => {
  it("renders default footer", () => {
    const { container } = render(<FooterSection />);
    expect(container).toMatchSnapshot();
  });
});
