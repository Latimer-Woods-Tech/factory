import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './Label';

describe('Label Component', () => {
  it('renders label text', () => {
    render(<Label htmlFor="input-id">Email</Label>);
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
  });

  it('has htmlFor attribute', () => {
    render(<Label htmlFor="email-input">Email</Label>);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('shows required indicator', () => {
    render(<Label required>Name</Label>);
    const label = screen.getByText('Name');
    expect(label.textContent).toContain('*');
  });

  it('does not show required indicator by default', () => {
    const { container } = render(<Label>Name</Label>);
    // Should only have label text, no asterisk
    expect(container.textContent).toBe('Name');
  });

  it('accepts className prop', () => {
    render(<Label className="custom-label">Text</Label>);
    const label = screen.getByText('Text');
    expect(label).toHaveClass('custom-label');
  });

  it('is semantic label element', () => {
    render(<Label htmlFor="test-input">Test Label</Label>);
    const label = screen.getByText('Test Label');
    expect(label.tagName).toBe('LABEL');
  });
});
