import { describe, it, expect } from 'vitest';

/**
 * Calculate relative luminance of a color
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @param rgb1 First color [r, g, b]
 * @param rgb2 Second color [r, g, b]
 */
function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number],
): number {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('UI Color Contrast Tests', () => {
  // Define our color palette
  const colors = {
    black: [0, 0, 0] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    gray300: [147, 142, 142] as [number, number, number], // text-gray-300
    gray400: [102, 99, 99] as [number, number, number], // text-gray-400
    gray500: [60, 58, 58] as [number, number, number], // text-gray-500 (disabled text)
    gray600: [46, 45, 45] as [number, number, number], // border-gray-600
    gray700: [33, 32, 32] as [number, number, number], // old disabled bg
    gray800: [38, 37, 37] as [number, number, number], // disabled bg
    gray900: [30, 30, 30] as [number, number, number], // hover bg
  };

  describe('Button Contrast Ratios', () => {
    it('default button (white bg, black text) should have WCAG AAA contrast', () => {
      const ratio = getContrastRatio(colors.white, colors.black);
      expect(ratio).toBeGreaterThanOrEqual(7); // WCAG AAA for normal text
      expect(ratio).toBeGreaterThanOrEqual(21); // Maximum contrast
    });

    it('outline button (transparent bg, white text on black bg) should have WCAG AAA contrast', () => {
      const ratio = getContrastRatio(colors.white, colors.black);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it('tertiary button (gray text on black bg) should have WCAG AA contrast', () => {
      const ratio = getContrastRatio(colors.gray300, colors.black);
      expect(ratio).toBeGreaterThanOrEqual(4.5); // WCAG AA for normal text
    });

    it('disabled button should be visually distinct', () => {
      // Disabled states are exempt from WCAG contrast requirements
      // but should still be somewhat visible
      const ratio = getContrastRatio(colors.gray400, colors.gray800);
      expect(ratio).toBeGreaterThan(1); // Just ensure it's visible
      // Note: WCAG explicitly exempts disabled elements from contrast requirements
    });

    it('hover states should maintain good contrast', () => {
      // White text on dark gray hover background
      const ratio = getContrastRatio(colors.white, colors.gray900);
      expect(ratio).toBeGreaterThanOrEqual(7); // WCAG AAA
    });
  });

  describe('General Text Contrast', () => {
    it('primary text (white on black) should have maximum contrast', () => {
      const ratio = getContrastRatio(colors.white, colors.black);
      expect(ratio).toBeCloseTo(21, 0); // Maximum possible contrast
    });

    it('secondary text (gray on black) should have WCAG AA contrast', () => {
      const ratio = getContrastRatio(colors.gray300, colors.black);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('border colors should be visible against black background', () => {
      const ratio = getContrastRatio(colors.gray600, colors.black);
      expect(ratio).toBeGreaterThanOrEqual(1.5); // Minimum for decorative elements
    });
  });

  describe('Critical UI Elements', () => {
    it('all interactive elements should meet WCAG AA standards', () => {
      const interactiveTests = [
        { bg: colors.white, fg: colors.black, name: 'Primary button' },
        { bg: colors.black, fg: colors.white, name: 'Inverted button' },
        { bg: colors.black, fg: colors.gray300, name: 'Secondary text' },
      ];

      interactiveTests.forEach((test) => {
        const ratio = getContrastRatio(test.bg, test.fg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        console.log(`${test.name}: ${ratio.toFixed(2)}:1`);
      });
    });
  });
});
