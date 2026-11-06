import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@hanzo/ui", () => {
  const part = ({ children, "data-slot": slot, "data-kind": kind, "aria-label": label }: { children?: ReactNode; "data-slot"?: string; "data-kind"?: string; "aria-label"?: string }) =>
    createElement("div", { "data-slot": slot, "data-kind": kind, "aria-label": label }, children);
  return {
    Box: part,
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? createElement("div", { role: "dialog" }, children) : null),
    DialogContent: part,
    DialogTitle: part,
    Text: part,
    XStack: part,
    YStack: part,
  };
});

import { formatResetParts, NeedMoreUsageBanner, NeedMoreUsageModal } from "./NeedMoreUsage";

describe("NeedMoreUsage", () => {
  const NOW = Date.parse("2026-11-01T12:00:00Z");

  it("formats a future RFC 3339 timestamp with month, day, time, and timezone", () => {
    const parts = formatResetParts("2026-11-06T01:00:00Z", NOW, "America/Los_Angeles");
    expect(parts).not.toBeNull();
    expect(parts?.monthDay).toBe("Nov 5");
    expect(parts?.time).toBe("5:00 PM");
    expect(parts?.tz).toMatch(/PST|GMT-8/);
  });

  it("returns null for past or invalid timestamps", () => {
    expect(formatResetParts("2026-10-01T00:00:00Z", NOW)).toBeNull();
    expect(formatResetParts(null, NOW)).toBeNull();
    expect(formatResetParts("not-a-date", NOW)).toBeNull();
  });

  it("renders NeedMoreUsageBanner with limits shared with Hanzo Dev and Get more usage button", () => {
    const html = renderToStaticMarkup(
      createElement(NeedMoreUsageBanner, {
        resetsAt: "2099-11-06T01:00:00Z",
        onGetMoreUsage: () => {},
        onSeeUsage: () => {},
      }),
    );
    expect(html).toContain("Usage limit reached");
    expect(html).toContain("limits shared with Hanzo Dev");
    expect(html).toContain("Wait for the reset, or keep working now with usage credits, billed on top of your plan.");
    expect(html).toContain("Get more usage");
  });

  it("renders NeedMoreUsageModal with Keep working now and Bring your team along cards", () => {
    const html = renderToStaticMarkup(
      createElement(NeedMoreUsageModal, {
        open: true,
        onClose: () => {},
        resetsAt: "2099-11-06T01:00:00Z",
        onBuyCredits: () => {},
        onSetupTeam: () => {},
      }),
    );
    expect(html).toContain("Need more usage?");
    expect(html).toContain("Keep working now");
    expect(html).toContain("Buy usage credits");
    expect(html).toContain("Buying turns on usage credits");
    expect(html).toContain("Bring your team along");
    expect(html).toContain("Recommended");
    expect(html).toContain("Set up a Team plan");
  });
});
