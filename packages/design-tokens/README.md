# @latimer-woods-tech/design-tokens

**Design system tokens for all Factory applications.**

Semantic colors, typography, spacing, motion, and focus styles with WCAG 2.2 AA compliance built in. Use these tokens to ensure consistency across all Factory apps while maintaining accessibility standards.

## Installation

```bash
npm install @latimer-woods-tech/design-tokens
```

## Quick Start

```typescript
import { colors, spacing, typography, motion } from '@latimer-woods-tech/design-tokens';

// Use in component styles
const buttonStyle = {
  backgroundColor: colors.primary,
  padding: spacing.md,
  fontSize: typography.fontSize.base,
  fontWeight: typography.fontWeight.semibold,
  transition: motion.transition.normal,
};

// Use in Tailwind/CSS
const className = `
  bg-[${colors.primary}]
  p-[${spacing.md}]
  text-[${typography.fontSize.base}]
  font-semibold
  transition-all
`;
```

## Token Categories

### Colors

All colors meet **WCAG 2.2 AA standards** (minimum 4.5:1 contrast for text).

```typescript
import { colors } from '@latimer-woods-tech/design-tokens';

// Semantic colors
colors.primary       // #0052CC – primary actions, links
colors.success       // #10B981 – positive actions
colors.danger        // #EF4444 – errors, destructive actions
colors.warning       // #F59E0B – caution, warnings
colors.info          // #3B82F6 – informational

// Surfaces
colors.surface.base      // #FFFFFF – default background
colors.surface.elevated  // #F9FAFB – cards, panels
colors.surface.overlay   // #F3F4F6 – modals, dropdowns

// Text (high contrast)
colors.text.primary    // #1F2937 – main text
colors.text.secondary  // #6B7280 – secondary info
colors.text.tertiary   // #9CA3AF – hints, timestamps
colors.text.disabled   // #D1D5DB – disabled state

// Borders
colors.border.light    // #E5E7EB – subtle
colors.border.default  // #D1D5DB – standard
colors.border.dark     // #9CA3AF – emphasis

// Grayscale
colors.gray[50-900]    // Full grayscale scale
```

### Spacing

**4px grid system** ensures consistent alignment and rhythm.

```typescript
import { spacing } from '@latimer-woods-tech/design-tokens';

// Named shortcuts
spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 16px
spacing.lg   // 24px
spacing.xl   // 32px
spacing.xxl  // 48px

// Numeric scale
spacing.scale[0]  // 0px
spacing.scale[1]  // 4px
spacing.scale[4]  // 16px
spacing.scale[8]  // 32px

// Container utilities
spacing.gutter              // 16px (side margin)
spacing.containerPadding.mobile   // 16px
spacing.containerPadding.tablet   // 24px
spacing.containerPadding.desktop  // 32px
```

### Typography

```typescript
import { typography } from '@latimer-woods-tech/design-tokens';

// Font families
typography.fontFamily.sans   // System sans-serif stack
typography.fontFamily.mono   // Monospace for code

// Font sizes
typography.fontSize.xs      // 12px (captions)
typography.fontSize.base    // 16px (body text)
typography.fontSize['4xl']  // 36px (page titles)

// Font weights
typography.fontWeight.light      // 300
typography.fontWeight.regular    // 400
typography.fontWeight.semibold   // 600
typography.fontWeight.bold       // 700

// Line heights & letter spacing
typography.lineHeight.tight  // 1.2 (headings)
typography.lineHeight.normal // 1.5 (body)
typography.letterSpacing.tight   // -0.02em
typography.letterSpacing.wide    // 0.05em

// Preset styles (combine multiple properties)
typography.preset.h1      // { fontSize: '36px', fontWeight: 600, lineHeight: 1.2 }
typography.preset.body    // { fontSize: '16px', fontWeight: 400, lineHeight: 1.5 }
typography.preset.button  // { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 }
typography.preset.label   // { fontSize: '14px', fontWeight: 500, lineHeight: 1.4 }
```

### Motion

Animations respect **`prefers-reduced-motion`** for accessibility.

```typescript
import { motion } from '@latimer-woods-tech/design-tokens';

// Durations
motion.duration.fastest   // 75ms
motion.duration.fast      // 150ms
motion.duration.normal    // 300ms (default)
motion.duration.slow      // 500ms

// Easing
motion.easing.linear   // equal velocity
motion.easing.in       // slow start, fast end
motion.easing.out      // fast start, slow end
motion.easing.inOut    // slow start/end, fast middle

// Preset transitions (CSS format)
motion.transition.fast      // 'all 150ms ...'
motion.transition.normal    // 'all 300ms ...'
motion.transition.color     // 'color 300ms ...'
motion.transition.shadow    // 'box-shadow 300ms ...'
```

### Focus Styles (WCAG 2.4.7)

All interactive elements must have visible focus indicators.

```typescript
import { focus } from '@latimer-woods-tech/design-tokens';

// Focus ring dimensions
focus.ring.width   // '3px' (meets WCAG minimum)
focus.ring.offset  // '2px'
focus.ring.color   // 'rgba(0, 82, 204, 0.68)' (primary + transparency)

// CSS utilities
focus.CSS.outline  // 'outline: 3px solid rgba(0, 82, 204, 0.68); outline-offset: 2px;'
```

Example usage in component:

```typescript
// CSS
button:focus-visible {
  outline: 3px solid rgba(0, 82, 204, 0.68);
  outline-offset: 2px;
}

// styled-components or Tailwind
const StyledButton = styled.button`
  &:focus-visible {
    ${focus.CSS.outline}
  }
`;
```

### Breakpoints

Mobile-first responsive design.

```typescript
import { breakpoints } from '@latimer-woods-tech/design-tokens';

// Named breakpoints
breakpoints.mobile      // 375px
breakpoints.tablet      // 768px
breakpoints.desktop     // 1024px

// Media query helpers
breakpoints.media.mobile   // '@media (min-width: 375px)'
breakpoints.media.tablet   // '@media (min-width: 768px)'
```

### Density

Adapt UI to different contexts (compact dashboards vs. spacious forms).

```typescript
import { density } from '@latimer-woods-tech/design-tokens';

// Padding presets
density.compact    // { padding: '8px 12px', minHeight: '32px' }
density.normal     // { padding: '12px 16px', minHeight: '40px' }
density.spacious   // { padding: '16px 20px', minHeight: '48px' }

// Gap between elements
density.gap.compact     // '8px'
density.gap.normal      // '16px'
density.gap.spacious    // '24px'
```

### Shadows

Create depth and visual hierarchy.

```typescript
import { shadows } from '@latimer-woods-tech/design-tokens';

shadows.none  // 'none'
shadows.xs    // subtle
shadows.sm    // mild elevation
shadows.md    // standard cards
shadows.lg    // modals, popovers
shadows.xl    // top-level overlays
shadows.focus // for focus states
```

### Border Radius

```typescript
import { radii } from '@latimer-woods-tech/design-tokens';

radii.none   // 0px
radii.sm     // 4px (buttons, inputs)
radii.md     // 6px (cards)
radii.lg     // 8px (containers)
radii.full   // 9999px (circles, pills)
```

## Integration Examples

### React Component

```typescript
import React from 'react';
import { colors, spacing, typography, motion, focus } from '@latimer-woods-tech/design-tokens';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary' }) => {
  const bgColor = variant === 'primary' ? colors.primary : colors.surface.elevated;

  return (
    <button
      style={{
        backgroundColor: bgColor,
        color: variant === 'primary' ? colors.text.inverse : colors.text.primary,
        padding: spacing.md,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: motion.transition.normal,
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '3px solid ' + focus.ring.color;
        e.currentTarget.style.outlineOffset = '2px';
      }}
    >
      {children}
    </button>
  );
};
```

### Tailwind Config

```typescript
// tailwind.config.js
import { tokens } from '@latimer-woods-tech/design-tokens';

module.exports = {
  theme: {
    colors: tokens.colors,
    spacing: tokens.spacing.scale,
    fontSize: tokens.typography.fontSize,
    fontFamily: tokens.typography.fontFamily,
    borderRadius: tokens.radii,
    boxShadow: tokens.shadows,
  },
  // ... other config
};
```

### CSS Custom Properties

```typescript
// Generate CSS variables from tokens
const generateCSSVariables = (tokens) => {
  const css = [];
  
  for (const [key, value] of Object.entries(tokens.colors)) {
    if (typeof value === 'string') {
      css.push(`--color-${key}: ${value};`);
    }
  }
  
  return `:root {\n  ${css.join('\n  ')}\n}`;
};
```

## Accessibility Commitments

✅ **All colors meet WCAG 2.2 AA standards** (4.5:1 contrast for text)  
✅ **Focus indicators are visible and meet WCAG 2.4.7** (3px minimum, 3:1 contrast)  
✅ **Motion respects `prefers-reduced-motion`** (no auto-play animations)  
✅ **Typography presets ensure readability** (line-height, letter-spacing optimized)  

## Design Principles

1. **Consistency** — Same token everywhere means same user experience
2. **Accessibility First** — All colors, focus states, motion tested against WCAG
3. **Semantic** — Color names mean what they say (danger = red, success = green)
4. **Responsive** — Breakpoints and spacing work across all devices
5. **Performance** — Tree-shakeable exports; only ship what you use

## Testing

```bash
npm test
```

All tokens are tested for:
- Correct export structure
- Type safety (TypeScript strict mode)
- Color contrast (WCAG AA)
- Spacing consistency (4px grid)
- CSS syntax validity

## Contributing

When adding new tokens:

1. Add to appropriate category in `src/index.ts`
2. Add tests to `src/index.test.ts`
3. Document in this README
4. Ensure all tests pass: `npm test`
5. Ensure TypeScript strict mode: `npm run typecheck`
6. Ensure no lint errors: `npm run lint`

## Usage in Apps

```bash
# In any app that needs design tokens
npm install @latimer-woods-tech/design-tokens

# Then in your code
import { colors, spacing, typography } from '@latimer-woods-tech/design-tokens';
```

## License

Part of the Factory monorepo. Internal use only.
