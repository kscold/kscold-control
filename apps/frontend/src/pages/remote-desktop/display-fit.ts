// 원격 화면 맞춤·좌표·키 변환 계산. 라이브러리 없이 시험할 수 있게 분리함.

export interface Size {
  width: number;
  height: number;
}

// 원격 화면 전체가 잘리지 않고 비율을 지키며 들어가는 배율
export function fitScale(box: Size, remote: Size) {
  if (!box.width || !box.height || !remote.width || !remote.height) return 1;
  return Math.min(box.width / remote.width, box.height / remote.height);
}

// 브라우저 영역에 맞춰 RDP 에 요청할 해상도. 화소 밀도는 2배까지만 반영하고 상한 안으로 줄임.
export function remoteSizeFor(
  box: Size,
  devicePixelRatio = 1,
  max: Size = { width: 2560, height: 1600 },
): Size | null {
  if (box.width < 1 || box.height < 1) return null;
  const density = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  let width = box.width * density;
  let height = box.height * density;
  const shrink = Math.min(max.width / width, max.height / height, 1);
  width *= shrink;
  height *= shrink;
  // 일부 RDP 서버는 홀수 폭을 거절하므로 짝수로 맞춤
  return {
    width: Math.max(2, Math.floor(width / 2) * 2),
    height: Math.max(2, Math.floor(height / 2) * 2),
  };
}

// 축소된 화면 위의 위치를 원격 화면 좌표로 바꾸고 화면 밖으로 나가지 않게 막음
export function toRemotePoint(
  x: number,
  y: number,
  scale: number,
  remote: Size,
) {
  const factor = scale > 0 ? scale : 1;
  const clamp = (value: number, limit: number) =>
    Math.min(Math.max(Math.floor(value / factor), 0), Math.max(limit - 1, 0));
  return { x: clamp(x, remote.width), y: clamp(y, remote.height) };
}

// 마지막 호출 뒤 wait 밀리초가 지나면 한 번만 실행
export function debounce<A extends unknown[]>(
  run: (...args: A) => void,
  wait: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => run(...args), wait);
  };
  call.cancel = () => clearTimeout(timer);
  return call;
}

// 모바일 입력칸의 이름 있는 키 → X11 keysym (VNC·RDP 공통)
const NAMED_KEYS: Record<string, number> = {
  Backspace: 0xff08,
  Tab: 0xff09,
  Enter: 0xff0d,
  Escape: 0xff1b,
  Delete: 0xffff,
  Home: 0xff50,
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  PageUp: 0xff55,
  PageDown: 0xff56,
  End: 0xff57,
};

export function keysymForKey(key: string) {
  return NAMED_KEYS[key];
}

// 글자 → keysym. 라틴-1 은 그대로, 나머지는 유니코드 keysym
export function keysymForChar(char: string) {
  const code = char.codePointAt(0);
  if (code === undefined) return undefined;
  if (char === '\n') return NAMED_KEYS.Enter;
  if (code >= 0x20 && code <= 0xff) return code;
  if (code > 0xff) return 0x01000000 | code;
  return undefined;
}
