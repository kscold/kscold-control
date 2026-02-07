import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerService } from './docker.service';
import { DockerController } from './docker.controller';
import { DockerGateway } from './docker.gateway';
import { Container } from '../entities/container.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Container]), AuthModule],
  controllers: [DockerController],
  providers: [DockerService, DockerGateway],
  exports: [DockerService],
})
export class DockerModule {}
