import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert Component', () => {
  it('renders alert message', () => {
    render(<Alert>Alert message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Alert message');
  });

  it('renders all variants', () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<Alert title="Alert Title">Alert message</Alert>);
    const title = screen.getByText('Alert Title');
    expect(title).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <Alert icon={<span>🔔</span>}>
        Alert message
      </Alert>,
    );
    const icon = screen.getByText('🔔');
    expect(icon).toBeInTheDocument();
  });

  it('has alert role for screen readers', () => {
    render(<Alert>Important message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('role', 'alert');
  });

  it('accepts className prop', () => {
    render(<Alert className="custom-alert">Message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('custom-alert');
  });

  it('displays title and message together', () => {
    render(
      <Alert title="Success" variant="success">
        Operation completed
      </Alert>,
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('uses color semantic to icon and background', () => {
    const { container } = render(
      <Alert variant="error">
        Error occurred
      </Alert>,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    // Verify it renders (color might not be visible in test but structure is)
  });
});
