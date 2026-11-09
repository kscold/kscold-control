export const SSH_KEY_INSPECTOR = Symbol('SSH_KEY_INSPECTOR');

export interface InspectedSshKey {
  publicKey: string;
  fingerprint: string;
}

export interface ISshKeyInspector {
  /** 암호 없는 OpenSSH 개인 키에서 공개 키와 지문을 얻는다. 읽을 수 없으면 null 이다. */
  inspect(privateKey: string): Promise<InspectedSshKey | null>;
}
