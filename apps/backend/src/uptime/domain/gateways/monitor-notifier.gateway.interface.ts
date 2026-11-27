export interface MonitorAlert {
  name: string;
  url: string;
  state: 'up' | 'down';
  detail: string | null;
}

export interface IMonitorNotifierGateway {
  /** 알림 곳이 설정되지 않았으면 아무것도 하지 않는다 */
  notify(alert: MonitorAlert): Promise<void>;
}

export const MONITOR_NOTIFIER_GATEWAY = Symbol('MONITOR_NOTIFIER_GATEWAY');
