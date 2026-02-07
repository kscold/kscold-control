import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeGateway } from './claude.gateway';
import { Session } from '../entities/session.entity';
import { Message } from '../entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Message])],
  providers: [ClaudeGateway],
  exports: [ClaudeGateway],
})
export class ClaudeModule {}
