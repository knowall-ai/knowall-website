import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Logo from '@/components/logo';

/**
 * Logo component tests
 *
 * Requirements: primary-navigation (docs/requirements.yaml)
 */

describe('Logo', () => {
  it('renders the KnowAll.ai logo image', () => {
    render(<Logo />);

    const logo = screen.getByAltText('KnowAll.ai');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', expect.stringContaining('logo.png'));
  });

  it('applies additional class names', () => {
    render(<Logo className="h-12" />);

    expect(screen.getByAltText('KnowAll.ai')).toHaveClass('h-12');
  });

  it('inverts the logo on dark backgrounds', () => {
    render(<Logo darkBackground />);

    const logo = screen.getByAltText('KnowAll.ai');
    expect(logo).toHaveClass('brightness-0');
    expect(logo).toHaveClass('invert');
  });

  it('does not invert the logo on light backgrounds', () => {
    render(<Logo />);

    expect(screen.getByAltText('KnowAll.ai')).not.toHaveClass('invert');
  });
});
