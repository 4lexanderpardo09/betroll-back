import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { Analysis } from './entities/analysis.entity';
import { MiniMaxService } from '../services/minimax.service';
import { ESPNService } from '../services/espn.service';
import { CacheService } from '../services/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Analysis])],
  controllers: [AnalysisController],
  providers: [AnalysisService, MiniMaxService, ESPNService, CacheService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
