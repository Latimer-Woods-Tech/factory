/**
 * FormField Component
 *
 * Wrapper combining Label, Input, and validation/error handling.
 */

import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from './Input';
import { Label } from './Label';
import { spacing } from '@adrper79-dot/design-tokens';

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label */
  label?: string;
  /** Helper/hint text */
  hint?: string;
  /** Validation error message */
  error?: string;
  /** Is field required */
  required?: boolean;
  /** Start icon */
  startIcon?: ReactNode;
  /** End icon */
  endIcon?: ReactNode;
  /** CSS class name */
  className?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * FormField Component
 *
 * Combines Label + Input with validation in one package.
 *
 * Usage:
 * ```tsx
 * <FormField
 *   label="Email"
 *   type="email"
 *   error={errors.email}
 *   hint="We'll never share your email"
 * />
 * ```
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, hint, error, required, startIcon, endIcon, className = '', ...props }, ref) => {
    const fieldId = props.id || `field-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }} className={className}>
        {label && (
          <Label htmlFor={fieldId} required={required}>
            {label}
          </Label>
        )}

        <Input
          ref={ref}
          id={fieldId}
          hint={hint}
          error={error}
          required={required}
          startIcon={startIcon}
          endIcon={endIcon}
          {...props}
        />
      </div>
    );
  },
);

FormField.displayName = 'FormField';
