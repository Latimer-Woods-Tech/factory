/**
 * LoadingState Component
 *
 * Loading spinners and skeleton loaders.
 */

import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, radii } from '@adrper79-dot/design-tokens';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Type of loading indicator */
  type?: 'spinner' | 'skeleton' | 'pulse';
  /** Size in pixels */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label */
  label?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ type = 'spinner', size = 'md', label, ...props }, ref) => {
    const sizeMap = {
      sm: '24px',
      md: '40px',
      lg: '64px',
    };

    const spinnerStyle: React.CSSProperties = {
      width: sizeMap[size],
      height: sizeMap[size],
      border: `3px solid ${colors.border.light}`,
      borderTop: `3px solid ${colors.primary}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    };

    const skeletonStyle: React.CSSProperties = {
      width: '100%',
      height: sizeMap[size],
      backgroundColor: colors.surface.overlay,
      borderRadius: radii.md,
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    };

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
    };

    const getContent = () => {
      switch (type) {
        case 'skeleton':
          return <div style={skeletonStyle} />;
        case 'pulse':
          return <div style={{ ...skeletonStyle, animation: 'pulse 2s ease-in-out infinite' }} />;
        case 'spinner':
        default:
          return <div style={spinnerStyle} />;
      }
    };

    return (
      <div ref={ref} style={containerStyle} {...props}>
        {getContent()}
        {label && (
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: colors.text.secondary,
            }}
          >
            {label}
          </p>
        )}
      </div>
    );
  },
);

LoadingState.displayName = 'LoadingState';
