export interface SshKeySummary {
  id: string;
  name: string;
  description: string;
  publicKey: string;
  fingerprint: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SshKeyDownload {
  name: string;
  fileName: string;
  privateKey: string;
}
