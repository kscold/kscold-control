import type { CreateKeyManagementTargetInput } from '../api/key-management.service';

export type TargetKind = 'ssh-command' | 'ssh-file' | 'gcp';

export const TARGET_KINDS: {
  value: TargetKind;
  label: string;
  hint: string;
}[] = [
  {
    value: 'ssh-command',
    label: 'SSH 명령',
    hint: '서버의 env 명령(env-v1)으로 값을 읽고 바꿉니다. 가장 간단합니다.',
  },
  {
    value: 'ssh-file',
    label: 'SSH .env 파일',
    hint: '서버의 .env 파일을 바꾸고 배포 스크립트로 블루그린 배포합니다.',
  },
  {
    value: 'gcp',
    label: 'GCP + GitHub Actions',
    hint: 'GCP Secret Manager 에 저장하고 GitHub Actions 로 배포합니다.',
  },
];

export const EMPTY_TARGET_FORM = {
  id: '',
  displayName: '',
  description: '',
  environment: 'production',
  envFileName: '.env',
  instanceName: '',
  location: '',
  requiredKeys: '',
  host: '',
  port: '22',
  username: '',
  credentialRef: '',
  allowedKeys: '*',
  envPath: '',
  workingDirectory: '',
  script: 'deploy.sh',
  statusDirectory: '',
  projectId: '',
  secretName: '',
  serviceAccount: '',
  repository: '',
  workflow: 'secret-sync.yml',
  ref: 'main',
};

export type TargetForm = typeof EMPTY_TARGET_FORM;

function splitKeys(value: string) {
  return value
    .split(/[\s,]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

/** 입력값을 서버가 받는 대상 모양으로 바꾼다. 세부 규칙은 서버가 검사한다. */
export function toTargetInput(
  kind: TargetKind,
  form: TargetForm,
): CreateKeyManagementTargetInput {
  const common = {
    id: form.id.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim() || form.displayName.trim(),
    environment: form.environment,
    envFileName: form.envFileName.trim(),
    instanceName: form.instanceName.trim() || form.id.trim(),
    location: form.location.trim() || form.host.trim() || form.projectId.trim(),
    requiredKeys: splitKeys(form.requiredKeys),
    sortOrder: 0,
  };
  const ssh = {
    host: form.host.trim(),
    port: Number(form.port),
    username: form.username.trim(),
    credentialRef: form.credentialRef.trim(),
  };
  if (kind === 'ssh-command') {
    return {
      ...common,
      provider: 'ssh-env-command',
      deploymentProvider: 'ssh-env-command',
      secretConfig: {
        ...ssh,
        protocol: 'env-v1',
        allowedKeys: splitKeys(form.allowedKeys),
      },
      deploymentConfig: { protocol: 'env-v1' },
    };
  }
  if (kind === 'ssh-file') {
    return {
      ...common,
      provider: 'ssh-env-file',
      deploymentProvider: 'ssh-blue-green',
      secretConfig: { ...ssh, envPath: form.envPath.trim() },
      deploymentConfig: {
        workingDirectory: form.workingDirectory.trim(),
        script: form.script.trim(),
        statusDirectory: form.statusDirectory.trim(),
      },
    };
  }
  return {
    ...common,
    provider: 'gcp-secret-manager',
    deploymentProvider: 'github-actions',
    secretConfig: {
      projectId: form.projectId.trim(),
      secretName: form.secretName.trim(),
      serviceAccount: form.serviceAccount.trim(),
    },
    deploymentConfig: {
      repository: form.repository.trim(),
      workflow: form.workflow.trim(),
      ref: form.ref.trim(),
    },
  };
}
