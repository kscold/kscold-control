import { ClaudeTerminal } from '../components/ClaudeTerminal';

export function ClaudePage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white">Claude Code Terminal</h2>
        <p className="text-sm text-gray-500">
          Mac Mini에서 Claude Code를 실시간으로 제어합니다
        </p>
      </div>
      <div className="flex-1">
        <ClaudeTerminal />
      </div>
    </div>
  );
}
