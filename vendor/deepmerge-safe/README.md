# 빌드 도구용 deepmerge 보완 사본

출처: [TehShrike/deepmerge v4.3.1](https://github.com/TehShrike/deepmerge/tree/v4.3.1)
의 `dist/cjs.js` (MIT). 원저작권과 라이선스를 함께 보존한다.

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)는
2026-10-28 기준 공식 수정 버전이 없다. 검사를 무시하거나 취약한 이전 버전으로
내리는 대신, `fork-ts-checker-webpack-plugin > deepmerge` 경로만 이 사본으로
대체하며 같은 의존성을 쓰는 `jest-config > deepmerge`에도 적용한다.
네트워크에서 임의의 포크를 다운로드하지 않으며 런타임 코드는 바꾸지 않는다.

`__proto__`, `constructor`, `prototype` 키를 대상·원본 양쪽에서 제외하고
`Object.defineProperty`로 자신의 데이터 속성만 쓴다. 대상 Proxy의 `in` 검사가
실패하면 해당 키를 거절한다. Node 24 환경의 배열 병합, clone, customMerge,
mergeable 판정, symbol, Date/RegExp/React element, `all` API는 유지한다.

`pnpm test:dependency-security`로 취약 입력과 실제 Nest CLI의 플러그인 경로를
검증한다. 보완 코드 변경 시 사본 버전도 올리고 lockfile을 갱신한다.
공식 수정 버전이 나오면 이 override와 사본을 제거하고 같은 회귀 테스트를
공식 패키지에 실행한다. `pnpm audit`에 예외를 등록하지 않는다.
