/**
 * Alert Component
 *
 * Displays informational, success, warning, or error messages.
 * Respects user preferences for motion.
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, radii } from '@latimer-woods-tech/design-tokens';

/**
 * Alert severity levels
 */
export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

/**
 * Props for the Alert component
 */
export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** Alert severity/intent */
  variant?: AlertVariant;
  /** Alert message/content */
  children: ReactNode;
  /** Optional title */
  title?: string;
  /** Optional icon element */
  icon?: ReactNode;
  /** CSS class name for additional styling */
  className?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Get colors based on alert variant
 */
function getColorsByVariant(variant: AlertVariant): {
  bg: string;
  border: string;
  icon: string;
  text: string;
} {
  switch (variant) {
    case 'success':
      return {
        bg: '#D1FAE5',
        border: colors.success,
        icon: colors.success,
        text: '#065F46',
      };
    case 'warning':
      return {
        bg: '#FEF3C7',
        border: colors.warning,
        icon: colors.warning,
        text: '#664D03',
      };
    case 'error':
      return {
        bg: '#FEE2E2',
        border: colors.danger,
        icon: colors.danger,
        text: '#7F1D1D',
      };
    case 'info':
    default:
      return {
        bg: '#DBEAFE',
        border: colors.info,
        icon: colors.info,
        text: '#0C2E51',
      };
  }
}

/**
 * Alert Component
 *
 * Usage:
 * ```tsx
 * <Alert variant="success">Action completed successfully!</Alert>
 * <Alert variant="error" title="Error">Something went wrong</Alert>
 * <Alert variant="info" icon={<InfoIcon />}>Information message</Alert>
 * ```
 *
 * Accessibility:
 * - Semantic role="alert" for screen readers
 * - Color + icon + text conveys meaning (not color alone)
 * - High contrast text for readability
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, icon, children, className = '', role = 'alert', ...props }, ref) => {
    const { bg, border, icon: iconColor, text } = getColorsByVariant(variant);

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: radii.md,
      color: text,
      fontFamily: typography.fontFamily.sans,
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.normal,
    };

    const iconContainerStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      minWidth: '20px',
      width: '20px',
      height: '20px',
      color: iconColor,
      flexShrink: 0,
    };

    const contentStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs,
      flex: 1,
    };

    const titleStyle: React.CSSProperties = {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      margin: 0,
    };

    const messageStyle: React.CSSProperties = {
      margin: 0,
      lineHeight: typography.lineHeight.normal,
    };

    return (
      <div ref={ref} style={containerStyle} role={role} className={className} {...props}>
        {icon && <div style={iconContainerStyle}>{icon}</div>}

        <div style={contentStyle}>
          {title && <p style={titleStyle}>{title}</p>}
          <p style={messageStyle}>{children}</p>
        </div>
      </div>
    );
  },
);

Alert.displayName = 'Alert';
