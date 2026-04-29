import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('renders all variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: /secondary/i })).toBeInTheDocument();

    rerender(<Button variant="tertiary">Tertiary</Button>);
    expect(screen.getByRole('button', { name: /tertiary/i })).toBeInTheDocument();

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button', { name: /danger/i })).toBeInTheDocument();
  });

  it('renders all sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Click
      </Button>,
    );
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} isLoading>
        Click
      </Button>,
    );
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is disabled when prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('has correct button type', () => {
    render(<Button>Submit</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
  });

  it('accepts custom type', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.type).toBe('submit');
  });

  it('accepts className prop', () => {
    render(<Button className="custom-class">Click</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('is referenceable via ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Click</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has minimum touch target size', () => {
    const { container } = render(<Button>Click</Button>);
    const button = container.querySelector('button') as HTMLButtonElement;
    const styles = window.getComputedStyle(button);
    expect(styles.minWidth).toBeTruthy();
    expect(styles.minHeight).toBeTruthy();
  });

  it('shows loading state', () => {
    const { container } = render(<Button isLoading>Loading</Button>);
    const spinner = container.querySelector('span');
    expect(spinner).toBeInTheDocument();
  });
});
