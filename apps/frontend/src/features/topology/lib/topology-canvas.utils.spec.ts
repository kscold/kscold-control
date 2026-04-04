import type { TopologySnapshot } from './topology.types';
import { getTopologyCanvasElements } from './topology-canvas.utils';

describe('getTopologyCanvasElements', () => {
  it('스냅샷이 없으면 빈 배열을 반환한다', () => {
    const result = getTopologyCanvasElements(null);

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('스냅샷의 노드와 엣지를 그대로 전달한다', () => {
    const snapshot: TopologySnapshot = {
      nodes: [
        {
          id: 'host',
          type: 'host',
          position: { x: 0, y: 0 },
          data: { label: 'Host' },
        },
      ],
      edges: [{ id: 'host-app', source: 'host', target: 'app' }],
      summary: {
        generatedAt: Date.now(),
        containerCount: 1,
        siteCount: 1,
        serviceNodeCount: 0,
      },
    };

    const result = getTopologyCanvasElements(snapshot);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].id).toBe('host');
    expect(result.edges[0].id).toBe('host-app');
  });

  it('보조 service 노드와 연결선은 화면 렌더링에서 제외한다', () => {
    const snapshot: TopologySnapshot = {
      nodes: [
        {
          id: 'host',
          type: 'host',
          position: { x: 0, y: 0 },
          data: { label: 'Host' },
        },
        {
          id: 'service-mongo',
          type: 'service',
          position: { x: 100, y: 100 },
          data: { label: 'MongoDB' },
        },
      ],
      edges: [
        { id: 'host-app', source: 'host', target: 'app' },
        { id: 'app-service', source: 'app', target: 'service-mongo' },
      ],
      summary: {
        generatedAt: Date.now(),
        containerCount: 1,
        siteCount: 1,
        serviceNodeCount: 1,
      },
    };

    const result = getTopologyCanvasElements(snapshot);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('host');
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].id).toBe('host-app');
  });
});
