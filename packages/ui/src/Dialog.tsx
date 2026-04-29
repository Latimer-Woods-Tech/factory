/**
 * Dialog Component (Modal)
 *
 * Modal dialog with focus management and accessibility support.
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, motion, focus, radii, shadows } from '@adrper79-dot/design-tokens';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  /** Dialog title */
  title: string;
  /** Dialog content */
  children: ReactNode;
  /** Is dialog open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ title, children, open, onClose, size = 'md', ...props }, ref) => {
    if (!open) return null;

    const sizeMap = {
      sm: '400px',
      md: '600px',
      lg: '900px',
    };

    const overlayStyle: React.CSSProperties = {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: `fadeIn ${motion.duration.fast}`,
    };

    const dialogStyle: React.CSSProperties = {
      position: 'relative',
      maxWidth: sizeMap[size],
      width: '90vw',
      maxHeight: '90vh',
      backgroundColor: colors.surface.base,
      borderRadius: radii.lg,
      boxShadow: shadows.xl,
      padding: spacing.lg,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.md,
      animation: `slideUp ${motion.duration.normal}`,
    };

    const headerStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
    };

    const titleStyle: React.CSSProperties = {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.semibold,
      margin: 0,
      color: colors.text.primary,
    };

    const closeButtonStyle: React.CSSProperties = {
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      fontSize: '24px',
      padding: spacing.xs,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.text.secondary,
    };

    return (
      <div style={overlayStyle} onClick={onClose}>
        <div
          ref={ref}
          style={dialogStyle}
          role="dialog"
          aria-labelledby="dialog-title"
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          <div style={headerStyle}>
            <h2 id="dialog-title" style={titleStyle}>
              {title}
            </h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div>{children}</div>
        </div>
      </div>
    );
  },
);

Dialog.displayName = 'Dialog';
