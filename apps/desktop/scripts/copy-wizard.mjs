// tsc 는 .ts 만 옮기므로 설치 화면의 HTML·CSS·JS·아이콘은 따로 dist 로 복사한다.
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'dist', 'wizard');
mkdirSync(target, { recursive: true });
for (const file of ['index.html', 'wizard.css', 'wizard.js', 'tray.png']) {
  cpSync(path.join(root, 'src', 'wizard', file), path.join(target, file));
}
