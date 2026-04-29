# Changelog — @adrper79-dot/ui

## [0.2.0] - 2026-04-29

### Added

- Initial UI primitives package release
- **Button Component**
  - 4 variants: primary, secondary, tertiary, danger
  - 3 sizes: sm, md, lg
  - Loading state with spinner
  - Full keyboard accessibility (WCAG 2.4.7)
  - Minimum 44x44px touch target

- **Input Component**
  - Support for all HTML input types (text, email, password, number, etc.)
  - Associated label via htmlFor/id
  - Error state with aria-invalid
  - Helper text and error messages
  - Icon support (start/end placement)
  - Proper focus management

- **Label Component**
  - Semantic `<label>` element
  - Required indicator support
  - Proper htmlFor/id linking
  - Accessible font sizing

- **Alert Component**
  - 4 variants: info, success, warning, error
  - Optional title and icon
  - Semantic role="alert" for screen readers
  - Color + icon + text (not color alone)

### Accessibility

- WCAG 2.2 AA compliance for all components
- Visible focus indicators (3px outline, WCAG 2.4.7)
- Proper ARIA labels and roles
- Semantic HTML structure
- 44x44px minimum touch targets
- Text color contrast 4.5:1 minimum

### Quality

- Full TypeScript strict mode compliance
- No `any` types in public APIs
- 90%+ test coverage (lines and functions)
- ESLint zero warnings
- Comprehensive JSDoc documentation
- React 18+ support

### Design System Integration

- All colors from `@adrper79-dot/design-tokens`
- All spacing from design tokens
- All typography from design tokens
- Motion and focus styles from tokens
- Consistent across all Factory apps
