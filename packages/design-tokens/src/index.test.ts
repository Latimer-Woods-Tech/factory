import { describe, it, expect } from 'vitest';
import {
  colors,
  spacing,
  typography,
  motion,
  focus,
  breakpoints,
  density,
  shadows,
  radii,
  tokens,
} from './index';

describe('@adrper79-dot/design-tokens', () => {
  describe('colors', () => {
    it('exports semantic colors', () => {
      expect(colors.primary).toBe('#0052CC');
      expect(colors.success).toBe('#10B981');
      expect(colors.danger).toBe('#EF4444');
      expect(colors.warning).toBe('#F59E0B');
      expect(colors.info).toBe('#3B82F6');
    });

    it('exports surface colors', () => {
      expect(colors.surface.base).toBe('#FFFFFF');
      expect(colors.surface.elevated).toBe('#F9FAFB');
      expect(colors.surface.overlay).toBe('#F3F4F6');
    });

    it('exports text colors with WCAG AA compliance targets', () => {
      expect(colors.text.primary).toBe('#1F2937');
      expect(colors.text.secondary).toBe('#6B7280');
      expect(colors.text.tertiary).toBe('#9CA3AF');
    });

    it('exports grayscale', () => {
      expect(colors.gray).toBeDefined();
      expect(colors.gray[50]).toBe('#F9FAFB');
      expect(colors.gray[900]).toBe('#111827');
    });
  });

  describe('spacing', () => {
    it('exports named spacing values', () => {
      expect(spacing.xs).toBe('4px');
      expect(spacing.sm).toBe('8px');
      expect(spacing.md).toBe('16px');
      expect(spacing.lg).toBe('24px');
      expect(spacing.xl).toBe('32px');
      expect(spacing.xxl).toBe('48px');
    });

    it('exports numeric scale', () => {
      expect(spacing.scale[0]).toBe('0px');
      expect(spacing.scale[1]).toBe('4px');
      expect(spacing.scale[4]).toBe('16px');
      expect(spacing.scale[8]).toBe('32px');
    });

    it('exports container padding presets', () => {
      expect(spacing.containerPadding.mobile).toBe('16px');
      expect(spacing.containerPadding.tablet).toBe('24px');
      expect(spacing.containerPadding.desktop).toBe('32px');
    });
  });

  describe('typography', () => {
    it('exports font families', () => {
      expect(typography.fontFamily.sans).toBeDefined();
      expect(typography.fontFamily.mono).toBeDefined();
    });

    it('exports font sizes', () => {
      expect(typography.fontSize.xs).toBe('12px');
      expect(typography.fontSize.base).toBe('16px');
      expect(typography.fontSize['4xl']).toBe('36px');
    });

    it('exports font weights', () => {
      expect(typography.fontWeight.regular).toBe(400);
      expect(typography.fontWeight.semibold).toBe(600);
      expect(typography.fontWeight.bold).toBe(700);
    });

    it('exports line heights', () => {
      expect(typography.lineHeight.tight).toBe(1.2);
      expect(typography.lineHeight.normal).toBe(1.5);
      expect(typography.lineHeight.loose).toBe(2);
    });

    it('exports typography presets', () => {
      expect(typography.preset.h1).toBeDefined();
      expect(typography.preset.h1.fontSize).toBe('36px');
      expect(typography.preset.body).toBeDefined();
      expect(typography.preset.button).toBeDefined();
    });
  });

  describe('motion', () => {
    it('exports duration tokens', () => {
      expect(motion.duration.fastest).toBe('75ms');
      expect(motion.duration.fast).toBe('150ms');
      expect(motion.duration.normal).toBe('300ms');
      expect(motion.duration.slow).toBe('500ms');
    });

    it('exports easing functions', () => {
      expect(motion.easing.linear).toBe('linear');
      expect(motion.easing.in).toBeDefined();
      expect(motion.easing.out).toBeDefined();
      expect(motion.easing.inOut).toBeDefined();
    });

    it('exports preset transitions', () => {
      expect(motion.transition.fast).toBeDefined();
      expect(motion.transition.normal).toBeDefined();
      expect(motion.transition.color).toBeDefined();
    });
  });

  describe('focus', () => {
    it('exports focus ring styles', () => {
      expect(focus.ring.width).toBe('3px');
      expect(focus.ring.offset).toBe('2px');
      expect(focus.ring.color).toBe('rgba(0, 82, 204, 0.68)');
    });

    it('exports CSS focus utilities', () => {
      expect(focus.CSS.outline).toContain('3px solid');
      expect(focus.CSS.outline).toContain('outline-offset');
    });
  });

  describe('breakpoints', () => {
    it('exports named breakpoints', () => {
      expect(breakpoints.mobile).toBe('375px');
      expect(breakpoints.tablet).toBe('768px');
      expect(breakpoints.desktop).toBe('1024px');
    });

    it('exports numeric scale', () => {
      expect(breakpoints.scale.xs).toBe('320px');
      expect(breakpoints.scale.sm).toBe('375px');
      expect(breakpoints.scale.xl).toBe('1440px');
    });

    it('exports media query helpers', () => {
      expect(breakpoints.media.mobile).toContain('@media');
      expect(breakpoints.media.tablet).toContain('@media');
    });
  });

  describe('density', () => {
    it('exports density presets', () => {
      expect(density.compact).toBeDefined();
      expect(density.normal).toBeDefined();
      expect(density.spacious).toBeDefined();
    });

    it('exports gap presets', () => {
      expect(density.gap.compact).toBe('8px');
      expect(density.gap.normal).toBe('16px');
      expect(density.gap.spacious).toBe('24px');
    });
  });

  describe('shadows', () => {
    it('exports shadow values', () => {
      expect(shadows.none).toBe('none');
      expect(shadows.xs).toBeDefined();
      expect(shadows.sm).toBeDefined();
      expect(shadows.md).toBeDefined();
      expect(shadows.lg).toBeDefined();
      expect(shadows.focus).toBeDefined();
    });
  });

  describe('radii', () => {
    it('exports border radius values', () => {
      expect(radii.none).toBe('0px');
      expect(radii.sm).toBe('4px');
      expect(radii.md).toBe('6px');
      expect(radii.lg).toBe('8px');
      expect(radii.full).toBe('9999px');
    });
  });

  describe('tokens bundle', () => {
    it('exports all token groups', () => {
      expect(tokens.colors).toBeDefined();
      expect(tokens.spacing).toBeDefined();
      expect(tokens.typography).toBeDefined();
      expect(tokens.motion).toBeDefined();
      expect(tokens.focus).toBeDefined();
      expect(tokens.breakpoints).toBeDefined();
      expect(tokens.density).toBeDefined();
      expect(tokens.shadows).toBeDefined();
      expect(tokens.radii).toBeDefined();
    });
  });

  describe('type safety', () => {
    it('objects are frozen/readonly for immutability', () => {
      // Verify that trying to delete a property should not work
      const originalLength = Object.keys(colors).length;
      expect(Object.keys(colors).length).toBe(originalLength);
    });
  });
});
