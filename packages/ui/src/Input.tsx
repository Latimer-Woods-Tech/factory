/**
 * Input Component
 *
 * Accessible text input component with support for various input types.
 * Fully keyboard-accessible with proper focus indicators and error handling.
 */

import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, motion, focus, radii } from '@adrper79-dot/design-tokens';

/**
 * Props for the Input component
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text (required for accessibility) */
  label?: string;
  /** Helper text displayed below input */
  hint?: string;
  /** Error message (if present, shows error state) */
  error?: string;
  /** Is input required */
  required?: boolean;
  /** Icon element at start of input */
  startIcon?: ReactNode;
  /** Icon element at end of input */
  endIcon?: ReactNode;
  /** CSS class name for additional styling */
  className?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Input Component
 *
 * Usage:
 * ```tsx
 * <Input label="Email" type="email" placeholder="you@example.com" />
 * <Input label="Password" type="password" error="Password too weak" />
 * <Input label="Name" hint="Full name" />
 * ```
 *
 * Accessibility:
 * - Associated label via htmlFor/id for screen readers
 * - Error messages linked to input via aria-describedby
 * - Visible focus indicator (3px outline) for keyboard navigation
 * - Semantic form structure
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      required = false,
      startIcon,
      endIcon,
      className = '',
      type = 'text',
      id: providedId,
      ...props
    },
    ref,
  ) => {
    // Generate ID if not provided
    const id = providedId || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hintId = `hint-${id}`;
    const errorId = `error-${id}`;

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.sm,
      width: '100%',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      display: 'flex',
      gap: spacing.xs,
      alignItems: 'center',
    };

    const inputWrapperStyle: React.CSSProperties = {
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.sm} ${spacing.md}`,
      backgroundColor: colors.surface.base,
      border: `1px solid ${error ? colors.danger : colors.border.default}`,
      borderRadius: radii.md,
      transition: motion.transition.fast,
      cursor: 'text',
    };

    const inputStyle: React.CSSProperties = {
      flex: 1,
      border: 'none',
      background: 'transparent',
      fontSize: typography.fontSize.base,
      fontFamily: typography.fontFamily.sans,
      color: colors.text.primary,
      outline: 'none',
      caretColor: colors.primary,
      padding: '0',
      // Remove default input styling
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none' as const,
    };

    const hintStyle: React.CSSProperties = {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      margin: '0',
    };

    const errorStyle: React.CSSProperties = {
      fontSize: typography.fontSize.xs,
      color: colors.danger,
      margin: '0',
      fontWeight: typography.fontWeight.medium,
    };

    const iconStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.text.secondary,
      pointerEvents: 'none',
      lineHeight: 1,
    };

    return (
      <div style={containerStyle} className={className}>
        {label && (
          <label htmlFor={id} style={labelStyle}>
            {label}
            {required && <span style={{ color: colors.danger }}>*</span>}
          </label>
        )}

        <div
          style={inputWrapperStyle}
          onFocus={(e) => {
            if (e.target === e.currentTarget) return;
            e.currentTarget.style.borderColor = colors.primary;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryLight}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? colors.danger : colors.border.default;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {startIcon && <div style={iconStyle}>{startIcon}</div>}

          <input
            ref={ref}
            id={id}
            type={type}
            required={required}
            style={inputStyle}
            aria-describedby={hint ? hintId : error ? errorId : undefined}
            aria-invalid={!!error}
            onFocus={(e) => {
              const wrapper = e.currentTarget.parentElement as HTMLElement;
              if (wrapper) {
                wrapper.style.borderColor = colors.primary;
                wrapper.style.boxShadow = `0 0 0 3px ${colors.primaryLight}`;
              }
            }}
            onBlur={(e) => {
              const wrapper = e.currentTarget.parentElement as HTMLElement;
              if (wrapper) {
                wrapper.style.borderColor = error ? colors.danger : colors.border.default;
                wrapper.style.boxShadow = 'none';
              }
            }}
            {...props}
          />

          {endIcon && <div style={iconStyle}>{endIcon}</div>}
        </div>

        {hint && !error && (
          <p id={hintId} style={hintStyle}>
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} style={errorStyle}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
