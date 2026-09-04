import { Module } from '@nestjs/common';
import { ReleaseController } from './release.controller';

@Module({ controllers: [ReleaseController] })
export class ReleaseModule {}
