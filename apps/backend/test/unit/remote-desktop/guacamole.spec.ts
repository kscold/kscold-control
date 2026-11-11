import {
  encodeInstruction,
  InstructionReader,
  rdpConnectValues,
  rdpHandshake,
} from '../../../src/remote-desktop/guacamole';

describe('Guacamole 명령 형식', () => {
  it('길이.값 을 쉼표로 잇고 세미콜론으로 끝낸다', () => {
    expect(encodeInstruction('select', 'rdp')).toBe('6.select,3.rdp;');
    expect(encodeInstruction('audio')).toBe('5.audio;');
    expect(encodeInstruction('', 'ping', '1')).toBe('0.,4.ping,1.1;');
  });

  it('길이는 바이트가 아니라 코드 포인트로 센다', () => {
    expect(encodeInstruction('a', '한글', '😀')).toBe('1.a,2.한글,1.😀;');
  });

  it('조각난 출력에서 완성된 명령만 꺼낸다', () => {
    const reader = new InstructionReader();
    expect(reader.push('4.args,13.VERSION_1_5_0,8.host')).toEqual([]);
    const [args] = reader.push('name;5.ready,2.$a;4.sy');
    expect(args).toEqual({
      raw: '4.args,13.VERSION_1_5_0,8.hostname;',
      opcode: 'args',
      args: ['VERSION_1_5_0', 'hostname'],
    });
    expect(reader.push('nc;').map((item) => item.opcode)).toEqual(['sync']);
  });

  it('쉼표·세미콜론이 든 값도 길이로 읽는다', () => {
    const reader = new InstructionReader();
    expect(reader.push('4.name,3.a;b;')[0].args).toEqual(['a;b']);
  });

  it('형식이 깨진 출력은 연결을 끊도록 오류를 낸다', () => {
    expect(() => new InstructionReader().push('x.args;')).toThrow();
  });

  it('guacd 가 요청한 순서대로 RDP 값을 채우고 모르는 값은 비운다', () => {
    expect(
      rdpConnectValues(
        ['VERSION_1_5_0', 'hostname', 'port', 'color-depth', 'unknown'],
        { hostname: '10.0.0.5', port: 3389 },
      ),
    ).toEqual(['VERSION_1_5_0', '10.0.0.5', '3389', '16', '']);
  });

  it('핸드셰이크는 size·audio·video·image·connect 순서다', () => {
    const reader = new InstructionReader();
    const opcodes = reader
      .push(rdpHandshake(['hostname'], { hostname: '10.0.0.5', port: 3389 }))
      .map((item) => item.opcode);
    expect(opcodes).toEqual(['size', 'audio', 'video', 'image', 'connect']);
  });
});
