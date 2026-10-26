import { fileURLToPath } from 'node:url';
import { checkReleaseVersion } from './lib/release-version.mjs';

console.log(
  `Release version verified: ${checkReleaseVersion(fileURLToPath(new URL('../', import.meta.url)))}`,
);
