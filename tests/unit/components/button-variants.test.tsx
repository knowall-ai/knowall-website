import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from '@/components/ui/button';

describe('Button brand variants', () => {
  it('applies the brand fill and the glow when asked', () => {
    render(
      <Button variant="brand" glow>
        Go
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveClass('bg-brand', 'text-brand-foreground', 'shadow-brand/30');
    expect(button).not.toHaveAttribute('glow');
  });

  it('forwards the glow to an asChild link without leaking the prop', () => {
    render(
      <Button asChild variant="brand" glow>
        <a href="#x">Link</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveClass('shadow-brand/30');
    expect(link).not.toHaveAttribute('glow');
  });
});
