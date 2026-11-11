export type DesktopProtocol = 'vnc' | 'rdp';

// 목록 API 응답. 암호와 계정 이름은 서버가 내려주지 않음
export interface Target {
  id: string;
  name: string;
  port: number;
  hasCredentials: boolean;
  host: string | null;
  wakeMac: string | null;
  wakeBroadcast?: string | null;
  protocol?: DesktopProtocol;
}

export const LOCAL_TARGET: Target = {
  id: 'local',
  name: '맥미니',
  port: 5900,
  hasCredentials: false,
  host: null,
  wakeMac: null,
  protocol: 'vnc',
};

export const DEFAULT_PORT: Record<DesktopProtocol, number> = {
  vnc: 5900,
  rdp: 3389,
};

export interface TargetForm {
  name: string;
  protocol: DesktopProtocol;
  host: string;
  port: string;
  wakeMac: string;
  username: string;
  password: string;
  saveCredentials: boolean;
  // 사용자가 포트를 직접 고쳤으면 연결 방식을 바꿔도 포트를 그대로 둠
  portEdited: boolean;
}

export type TargetFormErrors = Partial<
  Record<'name' | 'host' | 'port' | 'wakeMac' | 'password', string>
>;

export function protocolOf(target: Target): DesktopProtocol {
  return target.protocol ?? 'vnc';
}

export function needsCredentials(target: Target) {
  return protocolOf(target) === 'rdp' && !target.hasCredentials;
}

export function formFor(target?: Target): TargetForm {
  const protocol = target ? protocolOf(target) : 'vnc';
  return {
    name: target?.name ?? '',
    protocol,
    host: target?.host ?? '',
    port: String(target?.port ?? DEFAULT_PORT[protocol]),
    wakeMac: target?.wakeMac ?? '',
    username: '',
    password: '',
    saveCredentials: true,
    portEdited: Boolean(target && target.port !== DEFAULT_PORT[protocol]),
  };
}

export function withProtocol(
  form: TargetForm,
  protocol: DesktopProtocol,
): TargetForm {
  return {
    ...form,
    protocol,
    port: form.portEdited ? form.port : String(DEFAULT_PORT[protocol]),
  };
}

// 서버(remote-desktop-network.ts)와 같은 규칙. 최종 판단은 서버가 다시 함
const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const MAC = /^[0-9a-f]{2}([:-])[0-9a-f]{2}(\1[0-9a-f]{2}){4}$/i;

export function isPrivateIPv4(value: string) {
  if (!IPV4.test(value)) return false;
  const [a, b] = value.split('.').map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

export function validate(form: TargetForm, target: Target | undefined) {
  const isLocal = target?.id === 'local';
  const errors: TargetFormErrors = {};
  const host = form.host.trim();
  const mac = form.wakeMac.trim();
  const port = Number(form.port);
  if (!form.name.trim()) errors.name = '이름을 입력하세요.';
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    errors.port = '1~65535 사이 숫자를 입력하세요.';
  if (!isLocal) {
    if (host && !isPrivateIPv4(host))
      errors.host =
        '같은 망의 사설 IPv4(10.x, 172.16~31.x, 192.168.x)만 쓸 수 있습니다.';
    else if (form.protocol === 'rdp' && !host)
      errors.host = 'RDP 대상은 주소가 필요합니다.';
    if (mac && !MAC.test(mac))
      errors.wakeMac = '00:00:5E:00:53:01 같은 형식으로 입력하세요.';
    else if (mac && !host && !errors.host)
      errors.host = '깨우려면 주소도 입력하세요.';
  }
  // 이미 저장된 암호가 있으면 비워 둘 때 서버가 기존 암호를 유지함
  if (form.saveCredentials && !form.password && !target?.hasCredentials)
    errors.password = '저장하려면 암호를 입력하세요.';
  return errors;
}

export function toPayload(form: TargetForm, target: Target | undefined) {
  const isLocal = target?.id === 'local';
  return {
    name: form.name.trim(),
    port: Number(form.port),
    username: form.saveCredentials ? form.username : '',
    password: form.saveCredentials ? form.password : '',
    saveCredentials: form.saveCredentials,
    ...(isLocal
      ? {}
      : {
          protocol: form.protocol,
          host: form.host.trim(),
          wakeMac: form.wakeMac.trim(),
          // 화면에는 없는 값이라 기존 값을 그대로 돌려보내 지워지지 않게 함
          ...(target?.wakeBroadcast
            ? { wakeBroadcast: target.wakeBroadcast }
            : {}),
        }),
  };
}

export function addressOf(target: Target) {
  return target.host
    ? `${target.host}:${target.port}`
    : `이 서버 · 포트 ${target.port}`;
}
