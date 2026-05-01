# @latimer-woods-tech/ui

**Accessible, reusable UI components for all Factory applications.**

A comprehensive component library built with React, TypeScript, and WCAG 2.2 accessibility standards. All components use design tokens from `@latimer-woods-tech/design-tokens` for consistency across all Factory apps.

## Installation

```bash
npm install @latimer-woods-tech/ui @latimer-woods-tech/design-tokens react react-dom
```

## Quick Start

```typescript
import { Button, Input, Label, Alert } from '@latimer-woods-tech/ui';

export function LoginForm() {
  return (
    <form>
      <Label htmlFor="email" required>
        Email
      </Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        required
        hint="We'll never share your email"
      />

      <Button type="submit" variant="primary" size="md">
        Sign In
      </Button>
    </form>
  );
}
```

## Components

### Button

Accessible button component with multiple variants and sizes.

```typescript
import { Button } from '@latimer-woods-tech/ui';

// Variants: primary, secondary, tertiary, danger
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>

// Sizes: sm, md, lg
<Button size="lg">Large Button</Button>

// States
<Button disabled>Disabled</Button>
<Button isLoading>Loading...</Button>

// Events
<Button onClick={handleClick}>Click me</Button>
```

**Features:**
- Type-safe variant and size props
- Keyboard accessible with visible focus indicators (WCAG 2.4.7)
- Loading state with spinner
- Disabled state with visual feedback
- Minimum 44x44px touch target (WCAG)
- Smooth transitions and hover effects

### Input

Fully accessible text input component.

```typescript
import { Input } from '@latimer-woods-tech/ui';

// Basic usage
<Input
  label="Name"
  placeholder="Enter your name"
  required
/>

// Different input types
<Input label="Email" type="email" />
<Input label="Password" type="password" />

// With hints
<Input
  label="Password"
  type="password"
  hint="Minimum 8 characters"
/>

// With error messaging
<Input
  label="Email"
  type="email"
  error="Invalid email address"
/>

// With icons
<Input
  label="Username"
  startIcon={<UserIcon />}
/>
```

**Features:**
- Associated label via htmlFor/id
- Error state with aria-invalid
- Helper text and error messages
- Icon support (start/end)
- Proper focus management
- Error messages linked via aria-describedby
- Input types: text, email, password, number, etc.

### Label

Semantic label component for form fields.

```typescript
import { Label } from '@latimer-woods-tech/ui';

<Label htmlFor="username">Username</Label>
<Input id="username" />

// With required indicator
<Label htmlFor="email" required>
  Email
</Label>
```

**Features:**
- Semantic `<label>` element
- Proper htmlFor/id linking
- Required indicator (*) when needed
- Accessible font sizing

### Alert

Alert component for messages, warnings, and errors.

```typescript
import { Alert } from '@latimer-woods-tech/ui';

// Variants: info, success, warning, error
<Alert variant="info">Information message</Alert>
<Alert variant="success">Operation completed!</Alert>
<Alert variant="warning">Please review this change</Alert>
<Alert variant="error">An error occurred</Alert>

// With title
<Alert title="Error" variant="error">
  Something went wrong
</Alert>

// With icon
<Alert icon={<AlertIcon />} variant="warning">
  Be careful with this action
</Alert>
```

**Features:**
- Semantic role="alert" for screen readers
- Color + icon + text (not color alone)
- 4 severity levels: info, success, warning, error
- Optional title and icon
- High contrast text for readability

## Coming Soon

The following components are in development and will be added soon:

- **Dialog** — Modal dialogs with focus management
- **Toast** — Notification toasts with auto-dismiss
- **Card** — Container component for grouped content
- **EmptyState** — Empty state placeholder with icon and CTA
- **LoadingState** — Skeleton loaders and spinners
- **Tabs** — Tab navigation with keyboard support
- **FormField** — Wrapper combining Label, Input, and validation

## Accessibility

All components meet **WCAG 2.2 AA standards**:

✅ **Color Contrast** — 4.5:1 minimum for text  
✅ **Focus Indicators** — 3px visible outline (WCAG 2.4.7)  
✅ **Keyboard Navigation** — All interactive elements keyboard accessible  
✅ **Screen Reader Support** — Proper ARIA labels, roles, and descriptions  
✅ **Motion** — Respects `prefers-reduced-motion` setting  
✅ **Touch Targets** — Minimum 44x44px for interactive elements  

### Testing for Accessibility

```typescript
// Use your test framework + axe-core for automated testing
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

it('Button is accessible', async () => {
  const { container } = render(<Button>Click</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Integration with Design Tokens

All components use design tokens from `@latimer-woods-tech/design-tokens`:

```typescript
// Components automatically use these tokens:
// - colors.primary, colors.success, colors.danger, etc.
// - spacing.*, typography.*, motion.*, focus.*, radii.*

// To customize colors for your app, update tokens at theme level
import { tokens } from '@latimer-woods-tech/design-tokens';

const customTheme = {
  ...tokens,
  colors: {
    ...tokens.colors,
    primary: '#FF6600', // Override primary color for your app
  },
};
```

## TypeScript Support

All components are fully typed with TypeScript strict mode:

```typescript
import { ButtonProps, InputProps, AlertProps } from '@latimer-woods-tech/ui';

const buttonProps: ButtonProps = {
  variant: 'primary', // ✅ Type-safe
  size: 'md',
  children: 'Click me',
};

// This would error:
// variant: 'invalid', // ❌ Type error
```

## Styling & Customization

Components use inline styles (React.CSSProperties) for portability:

- No CSS-in-JS dependencies
- No global CSS requirements
- Components are fully self-contained
- Custom styling via `className` prop

```typescript
<Button className="my-custom-class">Click</Button>
```

## Testing

```bash
npm test
```

All components include:
- Unit tests for rendering and interactions
- Accessibility tests (a11y)
- Focus management tests
- Event handler tests
- Type safety verification

## Contributing

When adding new components:

1. Create component file (`src/ComponentName.tsx`)
2. Add tests (`src/ComponentName.test.tsx`)
3. Add to exports (`src/index.ts`)
4. Update README with usage examples
5. Ensure all tests pass: `npm test`
6. Ensure TypeScript strict mode: `npm run typecheck`
7. Ensure no lint errors: `npm run lint`

### Component Template

```typescript
import React, { forwardRef } from 'react';
import { colors, spacing, focus, radii } from '@latimer-woods-tech/design-tokens';

export interface ComponentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

export const Component = forwardRef<HTMLDivElement, ComponentProps>(
  ({ children, ...props }, ref) => {
    return <div ref={ref} {...props}>{children}</div>;
  },
);

Component.displayName = 'Component';
```

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Part of the Factory monorepo. Internal use only.

## Examples

### Form with Validation

```typescript
import { useState } from 'react';
import { Button, Input, Label, Alert } from '@latimer-woods-tech/ui';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    // Call API...
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert variant="error">{error}</Alert>}

      <Label htmlFor="email" required>
        Email
      </Label>
      <Input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Label htmlFor="password" required>
        Password
      </Label>
      <Input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        hint="Minimum 8 characters"
      />

      <Button type="submit" variant="primary">
        Create Account
      </Button>
    </form>
  );
}
```
