import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormError } from './FormError';

describe('FormError', () => {
  it('오류 문장이 생기면 보이는 곳으로 스크롤한다', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<FormError message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<FormError message="접속 URI 를 입력하세요." />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '접속 URI 를 입력하세요.',
    );
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
