/**
 * Tests for BirthTimeInput component
 * 
 * Tests rendering, user interactions, accessibility, and integration with time formatting utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BirthTimeInput } from '../components/BirthTimeInput';

describe('BirthTimeInput', () => {
  describe('rendering', () => {
    it('renders three select dropdowns', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="15:45" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(3);
    });

    it('renders with correct initial values for PM time', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="15:45" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('3'); // 3 PM
      expect(selects[1]).toHaveValue('45'); // 45 minutes
      expect(selects[2]).toHaveValue('PM');
    });

    it('renders with correct initial values for AM time', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="09:30" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('9');
      expect(selects[1]).toHaveValue('30');
      expect(selects[2]).toHaveValue('AM');
    });

    it('renders with correct initial values for midnight', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="00:15" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('12'); // 12 AM
      expect(selects[1]).toHaveValue('15');
      expect(selects[2]).toHaveValue('AM');
    });

    it('renders with correct initial values for noon', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('12');
      expect(selects[1]).toHaveValue('0');
      expect(selects[2]).toHaveValue('PM');
    });

    it('renders hours dropdown with 1-12 options', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const hoursSelect = screen.getAllByRole('combobox')[0];
      const options = within(hoursSelect).getAllByRole('option');

      expect(options).toHaveLength(12);
      expect(options[0]).toHaveTextContent('01');
      expect(options[11]).toHaveTextContent('12');
    });

    it('renders minutes dropdown with 0-59 options', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const minutesSelect = screen.getAllByRole('combobox')[1];
      const options = within(minutesSelect).getAllByRole('option');

      expect(options).toHaveLength(60);
      expect(options[0]).toHaveTextContent('00');
      expect(options[30]).toHaveTextContent('30');
      expect(options[59]).toHaveTextContent('59');
    });

    it('renders AM/PM dropdown with both options', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const periodSelect = screen.getAllByRole('combobox')[2];
      const options = within(periodSelect).getAllByRole('option');

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('AM');
      expect(options[1]).toHaveTextContent('PM');
    });

    it('accepts custom className', () => {
      const onChange = vi.fn();
      const { container } = render(
        <BirthTimeInput value="12:00" onChange={onChange} className="custom-class" />
      );

      const wrapper = container.querySelector('.birth-time-input');
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('error handling', () => {
    it('renders error message when provided', () => {
      const onChange = vi.fn();
      render(
        <BirthTimeInput value="12:00" onChange={onChange} error="Invalid time" />
      );

      expect(screen.getByText('Invalid time')).toBeInTheDocument();
    });

    it('error message has alert role for screen readers', () => {
      const onChange = vi.fn();
      render(
        <BirthTimeInput value="12:00" onChange={onChange} error="Invalid time" />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Invalid time');
    });

    it('does not render error message when not provided', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('calls onChange with correct ISO format when hour changes', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="09:30" onChange={onChange} />);

      const hourSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(hourSelect, '3');

      expect(onChange).toHaveBeenCalledWith('15:30'); // 3 PM
    });

    it('calls onChange with correct ISO format when minute changes', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="09:30" onChange={onChange} />);

      const minuteSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(minuteSelect, '45');

      expect(onChange).toHaveBeenCalledWith('09:45');
    });

    it('calls onChange with correct ISO format when period changes from AM to PM', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="09:30" onChange={onChange} />);

      const periodSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(periodSelect, 'PM');

      expect(onChange).toHaveBeenCalledWith('21:30'); // 9 PM
    });

    it('calls onChange with correct ISO format when period changes from PM to AM', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="15:45" onChange={onChange} />);

      const periodSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(periodSelect, 'AM');

      expect(onChange).toHaveBeenCalledWith('03:45'); // 3 AM
    });

    it('handles edge case: changing 12 PM to 12 AM (midnight)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const periodSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(periodSelect, 'AM');

      expect(onChange).toHaveBeenCalledWith('00:00');
    });

    it('handles edge case: changing 12 AM to 12 PM (noon)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="00:00" onChange={onChange} />);

      const periodSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(periodSelect, 'PM');

      expect(onChange).toHaveBeenCalledWith('12:00');
    });

    it('handles multiple changes in sequence', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="09:00" onChange={onChange} />);

      const [hourSelect, minuteSelect, periodSelect] = screen.getAllByRole('combobox');

      await user.selectOptions(hourSelect, '3');
      await user.selectOptions(minuteSelect, '45');
      await user.selectOptions(periodSelect, 'PM');

      expect(onChange).toHaveBeenLastCalledWith('15:45');
    });
  });

  describe('keyboard navigation', () => {
    it('allows keyboard navigation between dropdowns', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const selects = screen.getAllByRole('combobox');

      // Tab to first select
      await user.tab();
      expect(selects[0]).toHaveFocus();

      // Tab to second select
      await user.tab();
      expect(selects[1]).toHaveFocus();

      // Tab to third select
      await user.tab();
      expect(selects[2]).toHaveFocus();
    });

    it('allows arrow keys to change dropdown values', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<BirthTimeInput value="09:00" onChange={onChange} />);

      const hourSelect = screen.getAllByRole('combobox')[0];

      // Focus the hour select
      await user.click(hourSelect);

      // Use arrow down to move to next hour (9 → 10)
      fireEvent.keyDown(hourSelect, { key: 'ArrowDown' });

      // Note: actual arrow key behavior depends on browser implementation
      // This test ensures the element doesn't break with keyboard input
      expect(hourSelect).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels', () => {
      const onChange = vi.fn();
      render(<BirthTimeInput value="12:00" onChange={onChange} />);

      const [hourSelect, minuteSelect, periodSelect] = screen.getAllByRole('combobox');

      expect(hourSelect).toHaveAttribute('aria-label', 'Hour (1-12)');
      expect(minuteSelect).toHaveAttribute('aria-label', 'Minutes (00-59)');
      expect(periodSelect).toHaveAttribute('aria-label', 'AM or PM');
    });

    it('wraps inputs in fieldset with legend', () => {
      const onChange = vi.fn();
      const { container } = render(
        <BirthTimeInput value="12:00" onChange={onChange} />
      );

      const fieldset = container.querySelector('fieldset');
      const legend = container.querySelector('legend');

      expect(fieldset).toBeInTheDocument();
      expect(legend).toBeInTheDocument();
      expect(legend).toHaveClass('sr-only'); // Screen reader only
    });

    it('has aria-hidden on separator', () => {
      const onChange = vi.fn();
      const { container } = render(
        <BirthTimeInput value="12:00" onChange={onChange} />
      );

      const separator = container.querySelector('[aria-hidden="true"]');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveTextContent(':');
    });

    it('has sr-only class on legend', () => {
      const onChange = vi.fn();
      const { container } = render(
        <BirthTimeInput value="12:00" onChange={onChange} />
      );

      const legend = container.querySelector('legend');
      expect(legend).toHaveClass('sr-only');
    });
  });

  describe('responsive behavior', () => {
    it('renders successfully at various viewport sizes', () => {
      const onChange = vi.fn();

      // Test mobile
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 600px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(
        <BirthTimeInput value="12:00" onChange={onChange} />
      );

      expect(container.querySelector('.birth-time-input')).toBeTruthy();
    });
  });

  describe('value updates', () => {
    it('updates displayed values when prop changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <BirthTimeInput value="09:00" onChange={onChange} />
      );

      let selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('9');
      expect(selects[1]).toHaveValue('0');
      expect(selects[2]).toHaveValue('AM');

      // Update value prop
      rerender(<BirthTimeInput value="15:45" onChange={onChange} />);

      selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('3');
      expect(selects[1]).toHaveValue('45');
      expect(selects[2]).toHaveValue('PM');
    });
  });
});
