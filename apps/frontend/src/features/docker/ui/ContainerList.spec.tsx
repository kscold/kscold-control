import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Container } from '@/entities/container';
import { ContainerList } from './ContainerList';

const make = (name: string, project: string | null, live = 'running') =>
  ({
    id: name,
    dockerId: name,
    name,
    image: 'img',
    status: live,
    liveStatus: live,
    ports: {},
    resources: { cpus: 0, memory: '0' },
    createdAt: '',
    isManaged: false,
    isComposeManaged: false,
    composeProject: project,
  }) as unknown as Container;

describe('ContainerList', () => {
  it('스택별로 묶고 실행 중 개수를 보여 주며 단독 컨테이너는 뒤에 둔다', () => {
    render(
      <MemoryRouter>
        <ContainerList
          containers={[
            make('solo', null),
            make('blog-api', 'blog'),
            make('blog-web', 'blog', 'exited'),
          ]}
          onStart={() => {}}
          onStop={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    const stack = screen.getByRole('heading', { name: 'blog' });
    const standalone = screen.getByRole('heading', { name: '단독 컨테이너' });
    // 스택이 단독 컨테이너보다 앞에 온다
    expect(
      stack.compareDocumentPosition(standalone) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('1/2 실행 중')).toBeInTheDocument();
  });
});
