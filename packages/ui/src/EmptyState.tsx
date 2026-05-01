/**
 * EmptyState Component
 *
 * Placeholder for empty/no content states with icon and CTA.
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, radii } from '@latimer-woods-tech/design-tokens';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon element */
  icon: ReactNode;
  /** Title text */
  title: string;
  /** Description/subtitle */
  description?: string;
  /** CTA button or element */
  action?: ReactNode;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, ...props }, ref) => {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      textAlign: 'center',
      gap: spacing.lg,
      minHeight: '300px',
      borderRadius: radii.lg,
      backgroundColor: colors.surface.elevated,
      border: `1px dashed ${colors.border.light}`,
    };

    const iconStyle: React.CSSProperties = {
      fontSize: '64px',
      lineHeight: 1,
      opacity: 0.5,
    };

    const titleStyle: React.CSSProperties = {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      margin: 0,
    };

    const descriptionStyle: React.CSSProperties = {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      margin: 0,
      maxWidth: '400px',
    };

    const actionStyle: React.CSSProperties = {
      display: 'flex',
      gap: spacing.sm,
      justifyContent: 'center',
      flexWrap: 'wrap',
    };

    return (
      <div ref={ref} style={containerStyle} {...props}>
        <div style={iconStyle}>{icon}</div>
        <h3 style={titleStyle}>{title}</h3>
        {description && <p style={descriptionStyle}>{description}</p>}
        {action && <div style={actionStyle}>{action}</div>}
      </div>
    );
  },
);

EmptyState.displayName = 'EmptyState';
