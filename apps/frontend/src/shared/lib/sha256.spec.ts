import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256 } from './sha256';

const expected = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

function bytes(length: number, seed = 7): Uint8Array {
  const out = new Uint8Array(length);
  let value = seed;
  for (let i = 0; i < length; i += 1) {
    value = (value * 1103515245 + 12345) >>> 0;
    out[i] = value >>> 24;
  }
  return out;
}

describe('Sha256', () => {
  it.each([0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 1000, 1024 * 1024 + 7])(
    '%i 바이트를 한 번에 넣으면 Node crypto 와 같은 값을 낸다',
    (length) => {
      const data = bytes(length);
      expect(new Sha256().update(data).digestHex()).toBe(expected(data));
    },
  );

  it('여러 번 나눠 넣어도 한 번에 넣은 것과 같다', () => {
    const data = bytes(300_001, 11);
    const hash = new Sha256();
    for (let offset = 0; offset < data.length;) {
      const size = 1 + ((offset * 31) % 4099);
      hash.update(data.subarray(offset, offset + size));
      offset += size;
    }
    expect(hash.digestHex()).toBe(expected(data));
  });
});
