/**
 * Card Component
 *
 * Container component for grouped content with optional header and footer.
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, radii, shadows } from '@adrper79-dot/design-tokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: ReactNode;
  /** Optional header */
  header?: ReactNode;
  /** Optional footer */
  footer?: ReactNode;
  /** Show border */
  bordered?: boolean;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, header, footer, bordered = false, ...props }, ref) => {
    const cardStyle: React.CSSProperties = {
      backgroundColor: colors.surface.base,
      borderRadius: radii.lg,
      boxShadow: bordered ? 'none' : shadows.sm,
      border: bordered ? `1px solid ${colors.border.light}` : 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    };

    const sectionStyle: React.CSSProperties = {
      padding: spacing.lg,
    };

    const headerStyle: React.CSSProperties = {
      ...sectionStyle,
      borderBottom: `1px solid ${colors.border.light}`,
    };

    const footerStyle: React.CSSProperties = {
      ...sectionStyle,
      borderTop: `1px solid ${colors.border.light}`,
      marginTop: 'auto',
    };

    return (
      <div ref={ref} style={cardStyle} {...props}>
        {header && <div style={headerStyle}>{header}</div>}
        <div style={sectionStyle}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    );
  },
);

Card.displayName = 'Card';
