import { appendUniqueToolUse, completeToolUses } from './useClaudeChatMessages';

describe('useClaudeChatMessages helpers', () => {
  it('중복된 tool 이벤트를 한 번만 유지하고 완료 상태로 바꾼다', () => {
    const tools = appendUniqueToolUse([], {
      tool: 'Read',
      input: 'apps/frontend/src/App.tsx',
      status: 'start',
    });
    const dedupedTools = appendUniqueToolUse(tools, {
      tool: 'Read',
      input: 'apps/frontend/src/App.tsx',
      status: 'start',
    });
    const completedTools = completeToolUses(dedupedTools);

    expect(dedupedTools).toHaveLength(1);
    expect(completedTools[0].status).toBe('end');
  });
});
