'use strict';

// deepmerge 4.3.1의 MIT 구현을 보존하고 양쪽 객체의 위험 키 쓰기만 차단한다.
function isMergeableObject(value) {
  if (!value || typeof value !== 'object') return false;
  const type = Object.prototype.toString.call(value);
  return (
    type !== '[object RegExp]' &&
    type !== '[object Date]' &&
    value.$$typeof !== Symbol.for('react.element')
  );
}

function emptyTarget(value) {
  return Array.isArray(value) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options)
    : value;
}

function defaultArrayMerge(target, source, options) {
  return target
    .concat(source)
    .map((element) => cloneUnlessOtherwiseSpecified(element, options));
}

function getMergeFunction(key, options) {
  if (!options.customMerge) return deepmerge;
  const customMerge = options.customMerge(key);
  return typeof customMerge === 'function' ? customMerge : deepmerge;
}

function getKeys(target) {
  return Object.keys(target).concat(
    Object.getOwnPropertySymbols(target).filter((symbol) =>
      Object.prototype.propertyIsEnumerable.call(target, symbol),
    ),
  );
}

function propertyIsOnObject(object, property) {
  try {
    return property in object;
  } catch {
    return false;
  }
}

function keyIsForbidden(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function propertyIsUnsafe(target, key) {
  if (keyIsForbidden(key)) return true;
  try {
    return (
      key in target &&
      !(
        Object.prototype.hasOwnProperty.call(target, key) &&
        Object.prototype.propertyIsEnumerable.call(target, key)
      )
    );
  } catch {
    // null/primitive 대상은 정상 병합하되 Proxy의 접근 검사 예외는 안전하게 거절한다.
    return (
      target !== null &&
      (typeof target === 'object' || typeof target === 'function')
    );
  }
}

function writeOwn(destination, key, value) {
  Object.defineProperty(destination, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function mergeObject(target, source, options) {
  const destination = {};
  if (options.isMergeableObject(target)) {
    getKeys(target).forEach((key) => {
      if (!keyIsForbidden(key))
        writeOwn(
          destination,
          key,
          cloneUnlessOtherwiseSpecified(target[key], options),
        );
    });
  }
  getKeys(source).forEach((key) => {
    if (propertyIsUnsafe(target, key)) return;
    const value =
      propertyIsOnObject(target, key) && options.isMergeableObject(source[key])
        ? getMergeFunction(key, options)(target[key], source[key], options)
        : cloneUnlessOtherwiseSpecified(source[key], options);
    writeOwn(destination, key, value);
  });
  return destination;
}

function deepmerge(target, source, options) {
  options = options || {};
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || isMergeableObject;
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
  const sourceIsArray = Array.isArray(source);
  const targetIsArray = Array.isArray(target);
  if (sourceIsArray !== targetIsArray)
    return cloneUnlessOtherwiseSpecified(source, options);
  return sourceIsArray
    ? options.arrayMerge(target, source, options)
    : mergeObject(target, source, options);
}

deepmerge.all = function deepmergeAll(array, options) {
  if (!Array.isArray(array))
    throw new Error('first argument should be an array');
  return array.reduce(
    (previous, next) => deepmerge(previous, next, options),
    {},
  );
};

module.exports = deepmerge;
