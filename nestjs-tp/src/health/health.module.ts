import { Module } from '@nestjs/common';
import { DatabaseProbe } from './database-probe.js';
import { HealthController } from './health.controller.js';

/** Chequeo de salud (spec 007 RF-5). */
@Module({
  controllers: [HealthController],
  providers: [DatabaseProbe],
})
export class HealthModule {}
