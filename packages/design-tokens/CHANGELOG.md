# Changelog — @latimer-woods-tech/design-tokens

## [0.2.0] - 2026-04-29

### Added

- Initial design tokens package release
- **Colors**: Semantic colors (primary, success, danger, warning, info), surface colors, text colors, border colors, grayscale
- **Spacing**: 4px grid system with named shortcuts (xs, sm, md, lg, xl, xxl) and numeric scale
- **Typography**: Font families, font sizes, font weights, line heights, letter spacing, and typography presets (h1-h6, body, button, label, caption)
- **Motion**: Duration tokens, easing functions, and preset transitions with accessibility support
- **Focus**: WCAG 2.4.7 compliant focus ring styles for keyboard navigation
- **Breakpoints**: Mobile-first responsive design breakpoints (375px, 768px, 1024px, 1440px)
- **Density**: Compact, normal, and spacious density presets for UI adaptation
- **Shadows**: Elevation shadows for depth and visual hierarchy
- **Border Radius**: Border radius tokens for consistent rounded corners
- Comprehensive documentation and integration examples
- Full TypeScript strict mode compliance
- 90%+ test coverage with unit tests for all token categories
- ESLint and accessibility checks

### Type Safety

- TypeScript strict mode enabled
- All exported tokens are properly typed
- No `any` types in public API
- Full tree-shaking support

### Accessibility

- WCAG 2.2 AA color contrast compliance
- WCAG 2.4.7 focus indicator requirements met
- `prefers-reduced-motion` support in motion tokens
- All typography presets optimized for readability

### Quality

- 90%+ test coverage (lines and functions)
- ESLint zero warnings
- TypeScript zero errors
- Full JSDoc documentation
