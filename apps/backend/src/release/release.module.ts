import { Module } from '@nestjs/common';
import { ReleaseController } from './presentation/controllers/release.controller';

@Module({ controllers: [ReleaseController] })
export class ReleaseModule {}
