/**
 * Button Component
 *
 * Accessible button component with support for multiple variants and sizes.
 * Fully keyboard-accessible with proper focus indicators (WCAG 2.4.7).
 */

import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, motion, focus, radii } from '@latimer-woods-tech/design-tokens';

/**
 * Button variants — semantic meaning
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

/**
 * Button sizes — density control
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Button component
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size/density preset */
  size?: ButtonSize;
  /** Is button in loading state */
  isLoading?: boolean;
  /** Is button disabled */
  disabled?: boolean;
  /** Button label (required for accessibility) */
  children: ReactNode;
  /** CSS class name for additional styling */
  className?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Get button background and text color based on variant
 */
function getColorsByVariant(variant: ButtonVariant, disabled: boolean): {
  bg: string;
  text: string;
  hover: string;
  active: string;
} {
  if (disabled) {
    return {
      bg: colors.surface.elevated,
      text: colors.text.disabled,
      hover: colors.surface.elevated,
      active: colors.surface.elevated,
    };
  }

  switch (variant) {
    case 'primary':
      return {
        bg: colors.primary,
        text: colors.text.inverse,
        hover: colors.primaryDark,
        active: colors.primaryDark,
      };
    case 'secondary':
      return {
        bg: colors.surface.elevated,
        text: colors.text.primary,
        hover: colors.surface.overlay,
        active: colors.surface.overlay,
      };
    case 'tertiary':
      return {
        bg: 'transparent',
        text: colors.primary,
        hover: colors.primaryLight,
        active: colors.primaryLight,
      };
    case 'danger':
      return {
        bg: colors.danger,
        text: colors.text.inverse,
        hover: '#DC2626', // darker red
        active: '#DC2626',
      };
    default:
      return {
        bg: colors.primary,
        text: colors.text.inverse,
        hover: colors.primaryDark,
        active: colors.primaryDark,
      };
  }
}

/**
 * Get padding based on size
 */
function getPaddingBySize(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return `${spacing.sm} ${spacing.md}`;
    case 'lg':
      return `${spacing.md} ${spacing.lg}`;
    case 'md':
    default:
      return `${spacing.sm} ${spacing.lg}`;
  }
}

/**
 * Get font size based on button size
 */
function getFontSizeBySize(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return typography.fontSize.sm;
    case 'lg':
      return typography.fontSize.lg;
    case 'md':
    default:
      return typography.fontSize.base;
  }
}

/**
 * Button Component
 *
 * Usage:
 * ```tsx
 * <Button onClick={handleClick}>Click me</Button>
 * <Button variant="danger" size="lg">Delete</Button>
 * <Button disabled>Disabled</Button>
 * ```
 *
 * Accessibility:
 * - Type="button" prevents accidental form submission
 * - Visible focus indicator (3px outline) for keyboard navigation
 * - Disabled attribute prevents interaction
 * - Text content provides accessible label
 * - aria-label can override text for icon-only buttons
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      className = '',
      children,
      type = 'button',
      onClick,
      ...props
    },
    ref,
  ) => {
    const { bg, text, hover, active } = getColorsByVariant(variant, disabled || isLoading);
    const padding = getPaddingBySize(size);
    const fontSize = getFontSizeBySize(size);

    const buttonStyle: React.CSSProperties = {
      // Colors
      backgroundColor: bg,
      color: text,
      border: variant === 'tertiary' ? 'none' : `1px solid ${colors.border.default}`,

      // Typography
      fontSize,
      fontWeight: typography.fontWeight.semibold,
      fontFamily: typography.fontFamily.sans,

      // Spacing & layout
      padding,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minWidth: '44px', // Minimum touch target (WCAG)
      minHeight: '44px',

      // Appearance
      borderRadius: radii.md,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,

      // Interactions
      transition: motion.transition.normal,

      // State transitions
      transformOrigin: 'center',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        onClick={(e) => {
          if (!disabled && !isLoading && onClick) {
            onClick(e);
          }
        }}
        style={{
          ...buttonStyle,
          cursor: isLoading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        }}
        className={className}
        // Focus styles (WCAG 2.4.7)
        onFocus={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.outline = `${focus.ring.width} solid ${focus.ring.color}`;
          el.style.outlineOffset = focus.ring.offset;
          // Hover color on focus
          if (!disabled && !isLoading) {
            el.style.backgroundColor = hover;
          }
        }}
        onBlur={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.outline = 'none';
          el.style.backgroundColor = bg;
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          if (!disabled && !isLoading) {
            el.style.backgroundColor = hover;
          }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.backgroundColor = bg;
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          if (!disabled && !isLoading) {
            el.style.backgroundColor = active;
            el.style.transform = 'scale(0.98)';
          }
        }}
        onMouseUp={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.backgroundColor = hover;
          el.style.transform = 'scale(1)';
        }}
        {...props}
      >
        {isLoading && (
          <span
            style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              borderTop: `2px solid ${colors.text.inverse}`,
              borderRight: `2px solid ${colors.text.inverse}`,
              borderBottom: `2px solid transparent`,
              borderLeft: `2px solid transparent`,
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
