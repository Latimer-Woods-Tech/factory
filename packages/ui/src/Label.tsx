/**
 * Label Component
 *
 * Semantic label component for form inputs.
 * Ensures proper form structure and accessibility.
 */

import React, { forwardRef, type LabelHTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography } from '@latimer-woods-tech/design-tokens';

/**
 * Props for the Label component
 */
export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Label text content */
  children: ReactNode;
  /** Is associated field required */
  required?: boolean;
  /** CSS class name for additional styling */
  className?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * Label Component
 *
 * Usage:
 * ```tsx
 * <Label htmlFor="email">Email Address</Label>
 * <Input id="email" type="email" />
 *
 * <Label htmlFor="password" required>Password</Label>
 * <Input id="password" type="password" />
 * ```
 *
 * Accessibility:
 * - Semantic <label> element with proper htmlFor attribute
 * - Links label to associated input for screen readers
 * - Shows required indicator when needed
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, required = false, className = '', ...props }, ref) => {
    const labelStyle: React.CSSProperties = {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      display: 'flex',
      gap: spacing.xs,
      alignItems: 'baseline',
      marginBottom: spacing.xs,
    };

    const requiredIndicatorStyle: React.CSSProperties = {
      color: colors.danger,
      fontWeight: typography.fontWeight.semibold,
    };

    return (
      <label ref={ref} style={labelStyle} className={className} {...props}>
        {children}
        {required && <span style={requiredIndicatorStyle}>*</span>}
      </label>
    );
  },
);

Label.displayName = 'Label';
