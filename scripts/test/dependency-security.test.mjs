import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const backendRequire = createRequire(
  new URL('../../apps/backend/package.json', import.meta.url),
);
const cliRequire = createRequire(
  backendRequire.resolve('@nestjs/cli/package.json'),
);
const pluginRequire = createRequire(
  cliRequire.resolve('fork-ts-checker-webpack-plugin/package.json'),
);
const merge = pluginRequire('deepmerge');
const expressRequire = createRequire(
  backendRequire.resolve('express/package.json'),
);
const qs = expressRequire('qs');

test('실제 플러그인이 검증한 로컬 보완 사본을 사용함', () => {
  const resolved = pluginRequire('deepmerge/package.json');
  assert.equal(resolved.name, '@kscold-control/deepmerge-safe');
  assert.equal(resolved.version, '4.3.1-patched.1');
  const jestRequire = createRequire(
    backendRequire.resolve('jest/package.json'),
  );
  const coreRequire = createRequire(
    jestRequire.resolve('@jest/core/package.json'),
  );
  const configRequire = createRequire(
    coreRequire.resolve('jest-config/package.json'),
  );
  assert.equal(configRequire('deepmerge/package.json').name, resolved.name);
  assert.equal(configRequire('deepmerge').all, merge.all);
});

test('null prototype와 원본/대상의 __proto__ 키가 결과에 권한을 주입하지 못함', () => {
  const payload = JSON.parse(
    '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"secret":true},"safe":1}',
  );
  for (const target of [
    {},
    Object.create(null),
    JSON.parse('{"__proto__":{"isAdmin":true}}'),
  ]) {
    for (const result of [merge(target, payload), merge(payload, target)]) {
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(result.isAdmin, undefined);
      assert.equal(result.polluted, undefined);
      assert.equal(Object.hasOwn(result, '__proto__'), false);
      assert.equal(Object.hasOwn(result, 'constructor'), false);
      assert.equal(Object.hasOwn(result, 'prototype'), false);
    }
  }
  for (const placeholder of [null, undefined, 0, 'default']) {
    const result = merge({ session: placeholder }, { session: payload });
    assert.equal(result.session.isAdmin, undefined);
    assert.equal(result.session.safe, 1);
  }
  assert.equal(
    merge({ items: [] }, { items: [payload] }).items[0].isAdmin,
    undefined,
  );
  assert.equal({}.isAdmin, undefined);
});

test('기존 플러그인 설정과 deepmerge 옵션의 동작을 보존함', () => {
  const first = {
    typescript: {
      configOverwrite: { compilerOptions: { paths: { '@app/*': ['src/*'] } } },
    },
    issue: { include: ['src'] },
  };
  const second = {
    typescript: { memoryLimit: 2048 },
    issue: { include: ['tests'] },
  };
  const result = merge(first, second);
  assert.deepEqual(result.issue.include, ['src', 'tests']);
  assert.deepEqual(
    result.typescript.configOverwrite,
    first.typescript.configOverwrite,
  );
  assert.equal(result.typescript.memoryLimit, 2048);
  assert.notEqual(
    result.typescript.configOverwrite,
    first.typescript.configOverwrite,
  );
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  assert.throws(() => merge.all({}));
  assert.deepEqual(merge([1], [2], { arrayMerge: (_a, b) => b }), [2]);
  const custom = merge(
    { x: { a: 1 } },
    { x: { b: 2 } },
    { customMerge: () => () => 'custom' },
  );
  assert.equal(custom.x, 'custom');
  const object = { x: 1 };
  assert.equal(merge({}, { object }, { clone: false }).object, object);
  assert.equal(
    merge({}, { object }, { isMergeableObject: () => false }).object,
    object,
  );
  const symbol = Symbol('config');
  assert.equal(merge({}, { [symbol]: 3 })[symbol], 3);
  for (const value of [
    new Date(),
    /test/,
    { $$typeof: Symbol.for('react.element') },
  ]) {
    assert.equal(merge({}, { value }).value, value);
  }
});

test('qs comma 문자열화의 비정상 toString 입력을 처리함', () => {
  for (const encodeValuesOnly of [false, true]) {
    assert.doesNotThrow(() =>
      qs.stringify(JSON.parse('{"a":[{"toString":"x"}]}'), {
        arrayFormat: 'comma',
        encodeValuesOnly,
      }),
    );
  }
  assert.equal(
    qs.stringify({ a: ['one', 'two'] }, { arrayFormat: 'comma' }),
    'a=one%2Ctwo',
  );
});
