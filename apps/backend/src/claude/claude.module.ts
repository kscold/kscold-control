import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClaudeGateway } from './claude.gateway';
import { Session } from '../entities/session.entity';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Message, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
  ],
  providers: [ClaudeGateway],
  exports: [ClaudeGateway],
})
export class ClaudeModule {}
