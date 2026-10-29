export type DeploymentState = 'queued' | 'running' | 'succeeded' | 'failed';

export interface DeploymentRun {
  requestId: string;
  runId: string | null;
  state: DeploymentState;
  conclusion: string | null;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TriggerDeploymentInput {
  targetId: string;
  version: string;
  requestId: string;
}

export interface IDeploymentGateway {
  trigger(input: TriggerDeploymentInput): Promise<void>;
  findByRequestId(
    targetId: string,
    requestId: string,
  ): Promise<DeploymentRun | null>;
}

export const DEPLOYMENT_GATEWAY = Symbol('DEPLOYMENT_GATEWAY');

// Only use after an explicit remote rejection that proves this UUID did not start.
// Transport failures leave the durable deployment intent unresolved.
export class DeploymentRejectedError extends Error {
  constructor() {
    super('서버가 환경 적용 요청을 거절했습니다.');
  }
}
