import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input Component', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    const label = screen.getByText('Email');
    expect(label).toBeInTheDocument();
  });

  it('associates label and input via id', () => {
    render(<Input label="Password" />);
    const label = screen.getByText('Password');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for');
  });

  it('renders input with correct type', () => {
    render(<Input type="email" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('shows hint text', () => {
    render(<Input hint="Required field" />);
    const hint = screen.getByText('Required field');
    expect(hint).toBeInTheDocument();
  });

  it('shows error message and aria-invalid', () => {
    render(<Input error="Email is invalid" />);
    const error = screen.getByText('Email is invalid');
    expect(error).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows required indicator', () => {
    render(<Input label="Required Field" required />);
    const label = screen.getByText('Required Field');
    const parent = label.parentElement;
    expect(parent?.textContent).toContain('*');
  });

  it('has proper aria-describedby for hint', () => {
    render(<Input hint="Help text" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('has proper aria-describedby for error', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('accepts placeholder', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
  });

  it('accepts disabled prop', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('accepts required prop', () => {
    render(<Input required />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  it('accepts className prop', () => {
    render(<Input className="custom-class" />);
    const container = screen.getByRole('textbox').parentElement?.parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('renders different input types', () => {
    const { rerender } = render(<Input type="text" />);
    let input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('text');

    rerender(<Input type="email" />);
    input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');

    rerender(<Input type="password" />);
    input = document.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('prefers hint over error when both present', () => {
    render(<Input hint="This is a hint" error="This is an error" />);
    const hint = screen.queryByText('This is a hint');
    const error = screen.queryByText('This is an error');
    
    // Error should be shown, not hint
    expect(error).toBeInTheDocument();
    expect(hint).not.toBeInTheDocument();
  });
});
