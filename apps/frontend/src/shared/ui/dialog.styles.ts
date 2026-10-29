// 대화상자 버튼·입력칸 모양. 컴포넌트 파일과 나눠 두어 빠른 새로고침(HMR)이 깨지지 않게 한다

const TONE_CLASS = {
  neutral:
    'border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white',
  blue: 'bg-blue-600 text-white hover:bg-blue-500',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-500',
  green: 'bg-green-600 text-white hover:bg-green-500',
  purple: 'bg-purple-600 text-white hover:bg-purple-500',
  red: 'bg-red-600 text-white hover:bg-red-500',
} as const;

export type DialogButtonTone = keyof typeof TONE_CLASS;

/**
 * 대화상자 아래 버튼 줄의 버튼 모양.
 * 휴대폰에서는 버튼들이 줄을 나눠 꽉 채우고, 넓은 화면에서는 오른쪽에 제 크기로 붙는다.
 */
export function dialogButtonClass(tone: DialogButtonTone = 'neutral') {
  return `inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${TONE_CLASS[tone]}`;
}

const FOCUS_CLASS = {
  blue: 'focus:border-blue-500 focus:ring-blue-500/30',
  emerald: 'focus:border-emerald-500 focus:ring-emerald-500/30',
  green: 'focus:border-green-500 focus:ring-green-500/30',
  purple: 'focus:border-purple-500 focus:ring-purple-500/30',
} as const;

/** 대화상자 입력칸 공통 모양. 포커스 색만 기능별 강조색으로 바꾼다 */
export function dialogInputClass(accent: keyof typeof FOCUS_CLASS = 'blue') {
  return `w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:text-gray-500 ${FOCUS_CLASS[accent]}`;
}

export const DIALOG_INPUT_CLASS = dialogInputClass();

export const DIALOG_LABEL_CLASS =
  'mb-1 block text-xs font-medium text-gray-300';
