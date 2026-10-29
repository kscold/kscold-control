-- Provider capability only. Installation-specific targets and permissions stay local.
ALTER TABLE key_management_targets
  DROP CONSTRAINT key_management_targets_provider_check;
ALTER TABLE key_management_targets
  ADD CONSTRAINT key_management_targets_provider_check
  CHECK (provider IN ('gcp-secret-manager', 'ssh-env-file', 'ssh-env-command'));

ALTER TABLE key_management_targets
  DROP CONSTRAINT key_management_targets_deployment_provider_check;
ALTER TABLE key_management_targets
  ADD CONSTRAINT key_management_targets_deployment_provider_check
  CHECK (deployment_provider IN ('github-actions', 'ssh-blue-green', 'ssh-env-command'));
