import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServiceCard from '@/components/service-card';

/**
 * ServiceCard component tests
 *
 * Requirements: services-section (docs/requirements.yaml)
 */

const defaultProps = {
  icon: <svg data-testid="service-icon" />,
  title: 'AI Consultancy',
  description: 'Expert guidance on implementing AI solutions.',
};

describe('ServiceCard', () => {
  it('renders the title, description and icon', () => {
    render(<ServiceCard {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'AI Consultancy' })).toBeInTheDocument();
    expect(screen.getByText('Expert guidance on implementing AI solutions.')).toBeInTheDocument();
    expect(screen.getByTestId('service-icon')).toBeInTheDocument();
  });

  it('shows the Learn more button by default', () => {
    render(<ServiceCard {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Learn more/ })).toBeInTheDocument();
  });

  it('hides the Learn more button when showLearnMore is false', () => {
    render(<ServiceCard {...defaultProps} showLearnMore={false} />);

    expect(screen.queryByRole('button', { name: /Learn more/ })).not.toBeInTheDocument();
  });

  it('uses light styling by default', () => {
    render(<ServiceCard {...defaultProps} />);

    expect(screen.getByText('Expert guidance on implementing AI solutions.')).toHaveClass(
      'text-gray-600'
    );
  });

  it('uses dark styling when darkMode is enabled', () => {
    render(<ServiceCard {...defaultProps} darkMode />);

    expect(screen.getByRole('heading', { name: 'AI Consultancy' })).toHaveClass('text-white');
    expect(screen.getByText('Expert guidance on implementing AI solutions.')).toHaveClass(
      'text-gray-300'
    );
  });
});
