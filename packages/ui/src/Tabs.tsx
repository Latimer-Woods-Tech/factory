/**
 * Tabs Component
 *
 * Tab navigation with keyboard support and accessibility.
 */

import React, { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { colors, spacing, typography, motion, focus } from '@adrper79-dot/design-tokens';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  /** Tab items */
  tabs: TabItem[];
  /** Default active tab id */
  defaultTabId?: string;
  /** Callback when tab changes */
  onTabChange?: (tabId: string) => void;
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, defaultTabId, onTabChange, ...props }, ref) => {
    const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id);

    const handleTabClick = (tabId: string) => {
      setActiveTab(tabId);
      onTabChange?.(tabId);
    };

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    };

    const tabListStyle: React.CSSProperties = {
      display: 'flex',
      borderBottom: `1px solid ${colors.border.light}`,
      gap: spacing.md,
    };

    const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
      border: 'none',
      background: 'transparent',
      padding: `${spacing.md} ${spacing.lg}`,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: isActive ? colors.primary : colors.text.secondary,
      cursor: 'pointer',
      borderBottom: isActive ? `3px solid ${colors.primary}` : 'transparent',
      transition: motion.transition.fast,
      outline: 'none',
    });

    const tabContentStyle: React.CSSProperties = {
      padding: spacing.lg,
    };

    return (
      <div ref={ref} style={containerStyle} {...props}>
        <div role="tablist" style={tabListStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              style={tabButtonStyle(activeTab === tab.id)}
              onClick={() => handleTabClick(tab.id)}
              onFocus={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.outline = `${focus.ring.width} solid ${focus.ring.color}`;
                el.style.outlineOffset = focus.ring.offset;
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`tabpanel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={tab.id}
            hidden={activeTab !== tab.id}
            style={tabContentStyle}
          >
            {tab.content}
          </div>
        ))}
      </div>
    );
  },
);

Tabs.displayName = 'Tabs';
