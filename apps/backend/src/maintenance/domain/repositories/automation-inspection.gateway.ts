import type {
  LaunchdJobInfo,
  ReleaseDirConfig,
  ReleaseDirInfo,
} from '../types/automation.type';

/** 맥 launchd 작업과 컨테이너 안 릴리스 폴더를 읽는 포트. 아무것도 바꾸지 않는다 */
export interface IAutomationInspectionGateway {
  /** 등록 이름이 prefixes 중 하나로 시작하는 사용자·시스템 launchd 작업 */
  listLaunchdJobs(prefixes: string[]): Promise<LaunchdJobInfo[]>;
  inspectReleaseDir(config: ReleaseDirConfig): Promise<ReleaseDirInfo>;
}

export const AUTOMATION_INSPECTION_GATEWAY = Symbol(
  'AUTOMATION_INSPECTION_GATEWAY',
);
