import Guacamole from 'guacamole-common-js';
import {
  debounce,
  fitScale,
  remoteSizeFor,
  toRemotePoint,
} from './display-fit';

// 손가락 입력 방식: 노트북 터치패드처럼 상대 이동 / 누른 자리를 바로 클릭
export type TouchMode = 'touchpad' | 'touchscreen';

export interface RdpEvents {
  onConnect: () => void;
  onDisconnect: () => void;
  onClipboard: (text: string) => void;
}

// guacamole-common-js 는 RDP 대상을 열 때만 불러옴. 맥(VNC)만 쓰는 화면 묶음에는 들어가지 않음.
export function openRdp(
  container: HTMLElement,
  url: string,
  ticket: string,
  events: RdpEvents,
) {
  const tunnel = new Guacamole.WebSocketTunnel(url);
  const client = new Guacamole.Client(tunnel);
  const display = client.getDisplay();
  const element = display.getElement();
  element.tabIndex = 0;
  element.style.outline = 'none';
  container.appendChild(element);

  let viewOnly = false;
  let closed = false;
  let touchMode: TouchMode = 'touchpad';
  const remoteSize = () => ({
    width: display.getWidth(),
    height: display.getHeight(),
  });
  // 비율을 지키며 영역 안에 꽉 차게 맞춤 (작은 원격 화면은 키워서 보여 줌)
  const fit = () => {
    const size = remoteSize();
    if (!size.width || !size.height) return;
    display.scale(
      fitScale(
        { width: container.clientWidth, height: container.clientHeight },
        size,
      ),
    );
  };
  display.onresize = fit;

  // 축소 배율을 되돌린 원격 좌표로 보냄
  const send = (state: Guacamole.Mouse.State) => {
    if (viewOnly) return;
    const point = toRemotePoint(
      state.x,
      state.y,
      display.getScale(),
      remoteSize(),
    );
    client.sendMouseState(
      new Guacamole.Mouse.State(
        point.x,
        point.y,
        state.left,
        state.middle,
        state.right,
        state.up,
        state.down,
      ),
    );
  };

  const mouse = new Guacamole.Mouse(element);
  let localCursor = false;
  let touching = false;
  // 원격 커서 모양을 브라우저 커서로 써서 지연 없이 움직이고, 화면 속 커서는 숨김.
  // 브라우저가 거절하면 화면 속 커서를 그대로 보여 줌
  display.oncursor = (canvas, x, y) => {
    localCursor = mouse.setCursor(canvas, x, y);
    display.showCursor(!localCursor || touching);
  };
  mouse.onEach(['mousedown', 'mouseup', 'mousemove'], (event) => {
    if (touching) {
      touching = false;
      display.showCursor(!localCursor);
    }
    element.focus();
    send((event as Guacamole.Mouse.Event).state);
  });

  // 휴대폰: 터치패드(두 손가락 탭 = 오른쪽 클릭, 두 손가락 끌기 = 스크롤) 또는 직접 누르기
  const touchpad = new Guacamole.Mouse.Touchpad(element);
  const touchscreen = new Guacamole.Mouse.Touchscreen(element);
  const onTouch = (mode: TouchMode) => (event: unknown) => {
    if (touchMode !== mode) return;
    if (!touching) {
      touching = true;
      // 손가락으로는 브라우저 커서가 없으니 화면 속 커서로 위치를 보여 줌
      display.showCursor(true);
    }
    send((event as Guacamole.Mouse.Event).state);
  };
  touchpad.onEach(['mousedown', 'mouseup', 'mousemove'], onTouch('touchpad'));
  touchscreen.onEach(
    ['mousedown', 'mouseup', 'mousemove'],
    onTouch('touchscreen'),
  );

  // 키보드는 원격 화면에 초점이 있을 때만 가로챔.
  const keyboard = new Guacamole.Keyboard(element);
  keyboard.onkeydown = (keysym) => {
    if (!viewOnly) client.sendKeyEvent(1, keysym);
    return false;
  };
  keyboard.onkeyup = (keysym) => {
    if (!viewOnly) client.sendKeyEvent(0, keysym);
  };

  // 영역 크기가 바뀌면 바로 맞추고, 원격 해상도 요청은 끌기가 끝난 뒤 한 번만 보냄
  let lastSize = '';
  const requestSize = debounce(() => {
    const size = remoteSizeFor(
      { width: container.clientWidth, height: container.clientHeight },
      window.devicePixelRatio,
    );
    if (!size || closed) return;
    const key = `${size.width}x${size.height}`;
    if (key === lastSize) return;
    lastSize = key;
    client.sendSize(size.width, size.height);
  }, 300);
  const observer = new ResizeObserver(() => {
    fit();
    requestSize();
  });
  observer.observe(container);

  client.onclipboard = (stream, mimetype) => {
    if (!mimetype.startsWith('text/')) return;
    const reader = new Guacamole.StringReader(stream);
    let text = '';
    reader.ontext = (chunk) => {
      text = (text + chunk).slice(0, 65536);
    };
    reader.onend = () => events.onClipboard(text);
  };
  const finish = () => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    requestSize.cancel();
    display.oncursor = null;
    keyboard.reset();
    element.remove();
    events.onDisconnect();
  };
  client.onstatechange = (state) => {
    if (state === 3) events.onConnect();
    if (state === 5) finish();
  };
  client.onerror = () => client.disconnect();
  tunnel.onerror = () => finish();

  client.connect(`ticket=${ticket}`);

  return {
    disconnect() {
      client.disconnect();
      finish();
    },
    clipboardPasteFrom(text: string) {
      const writer = new Guacamole.StringWriter(
        client.createClipboardStream('text/plain'),
      );
      writer.sendText(text);
      writer.sendEnd();
    },
    // 화면 키보드 입력칸에서 받은 키를 그대로 누르고 뗌
    sendKeysym(keysym: number) {
      if (viewOnly) return;
      client.sendKeyEvent(1, keysym);
      client.sendKeyEvent(0, keysym);
    },
    get touchMode() {
      return touchMode;
    },
    set touchMode(value: TouchMode) {
      touchMode = value;
    },
    get viewOnly() {
      return viewOnly;
    },
    set viewOnly(value: boolean) {
      viewOnly = value;
    },
  };
}

export type RdpClient = ReturnType<typeof openRdp>;
