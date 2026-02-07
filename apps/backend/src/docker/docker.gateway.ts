import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DockerService } from './docker.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/docker',
})
export class DockerGateway {
  @WebSocketServer()
  server: Server;

  private logStreams = new Map<string, any>();

  constructor(private dockerService: DockerService) {}

  /**
   * 컨테이너 로그 실시간 스트리밍
   */
  @SubscribeMessage('docker:stream-logs')
  async handleStreamLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string },
  ) {
    // 기존 스트림 정리
    const existingStream = this.logStreams.get(client.id);
    if (existingStream) {
      existingStream.destroy();
    }

    const stream = await this.dockerService.streamLogs(
      data.containerId,
      (chunk: string) => {
        client.emit('docker:log', {
          containerId: data.containerId,
          content: chunk,
        });
      },
    );

    this.logStreams.set(client.id, stream);
  }

  /**
   * 로그 스트리밍 중지
   */
  @SubscribeMessage('docker:stop-logs')
  handleStopLogs(@ConnectedSocket() client: Socket) {
    const stream = this.logStreams.get(client.id);
    if (stream) {
      stream.destroy();
      this.logStreams.delete(client.id);
    }
  }
}
