// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'module',
    },
    rules: {
      // 인프라 제어 코드 특성상 동적 타입이 잦아 any는 경고만.
      '@typescript-eslint/no-explicit-any': 'off',
      // _ 접두사 인자는 미사용 허용.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      // NestJS 데코레이터/DI 패턴과 충돌하는 규칙 완화.
      '@typescript-eslint/no-extraneous-class': 'off',
      // 동적 모듈 로딩(dockerode, 플랫폼별 분기 등)에서 require가 정당.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      // 아래는 실제 버그가 아닌 스타일/사소 항목 — 경고로 남겨 점진 개선.
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      // 에러 체이닝(cause) 권장 — 점진 개선 항목이라 경고로.
      'preserve-caught-error': 'warn',
    },
  },
);
