/**
 * Toast Component
 *
 * Toast notifications with auto-dismiss support.
 */

import React, { forwardRef, useEffect, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, motion, radii, shadows } from '@adrper79-dot/design-tokens';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** Toast variant */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Toast message */
  children: ReactNode;
  /** Auto dismiss after milliseconds (null = no auto dismiss) */
  autoclose?: number | null;
  /** Callback when toast closes */
  onClose?: () => void;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ variant = 'info', children, autoclose = 5000, onClose, ...props }, ref) => {
    useEffect(() => {
      if (autoclose) {
        const timer = setTimeout(() => onClose?.(), autoclose);
        return () => clearTimeout(timer);
      }
    }, [autoclose, onClose]);

    const colorMap = {
      success: { bg: '#D1FAE5', text: '#065F46', border: colors.success },
      error: { bg: '#FEE2E2', text: '#7F1D1D', border: colors.danger },
      warning: { bg: '#FEF3C7', text: '#664D03', border: colors.warning },
      info: { bg: '#DBEAFE', text: '#0C2E51', border: colors.info },
    };

    const { bg, text, border } = colorMap[variant];

    const toastStyle: React.CSSProperties = {
      backgroundColor: bg,
      color: text,
      padding: spacing.md,
      borderRadius: radii.md,
      border: `1px solid ${border}`,
      boxShadow: shadows.lg,
      display: 'flex',
      gap: spacing.md,
      alignItems: 'center',
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamily.sans,
      animation: `slideInUp ${motion.duration.normal}`,
      maxWidth: '400px',
    };

    return (
      <div ref={ref} role="status" style={toastStyle} {...props}>
        {children}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '20px',
              color: text,
              padding: 0,
              marginLeft: 'auto',
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    );
  },
);

Toast.displayName = 'Toast';
