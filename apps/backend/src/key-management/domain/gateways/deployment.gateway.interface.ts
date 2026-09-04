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
  findByRequestId(requestId: string): Promise<DeploymentRun | null>;
}

export const DEPLOYMENT_GATEWAY = Symbol('DEPLOYMENT_GATEWAY');
