import Guacamole from 'guacamole-common-js';

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
  const fit = () => {
    const width = display.getWidth();
    const height = display.getHeight();
    if (width && height)
      display.scale(
        Math.min(
          container.clientWidth / width,
          container.clientHeight / height,
          1,
        ),
      );
  };
  display.onresize = fit;

  const mouse = new Guacamole.Mouse(element);
  mouse.onEach(['mousedown', 'mouseup', 'mousemove'], (event) => {
    if (viewOnly) return;
    element.focus();
    client.sendMouseState((event as Guacamole.Mouse.Event).state, true);
  });
  // 키보드는 원격 화면에 초점이 있을 때만 가로챔.
  const keyboard = new Guacamole.Keyboard(element);
  keyboard.onkeydown = (keysym) => {
    if (!viewOnly) client.sendKeyEvent(1, keysym);
    return false;
  };
  keyboard.onkeyup = (keysym) => {
    if (!viewOnly) client.sendKeyEvent(0, keysym);
  };

  const observer = new ResizeObserver(() => {
    const width = Math.round(container.clientWidth);
    const height = Math.round(container.clientHeight);
    if (width && height) client.sendSize(width, height);
    fit();
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
    get viewOnly() {
      return viewOnly;
    },
    set viewOnly(value: boolean) {
      viewOnly = value;
    },
  };
}

export type RdpClient = ReturnType<typeof openRdp>;
