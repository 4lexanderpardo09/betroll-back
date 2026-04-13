import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SofascoreService } from './sofascore.service';
import { ESPNQualitativeService } from './espn-qualitative.service';
import { ESPNOddsService } from './espn-odds.service';
import { ESPNStatsService } from './espn-stats.service';
import { OddsApiService } from './odds-api.service';
import { MiniMaxService } from './minimax.service';

@Global()
@Module({
  providers: [
    CacheService,
    SofascoreService,
    ESPNQualitativeService,
    ESPNOddsService,
    ESPNStatsService,
    OddsApiService,
    MiniMaxService,
  ],
  exports: [
    CacheService,
    SofascoreService,
    ESPNQualitativeService,
    ESPNOddsService,
    ESPNStatsService,
    OddsApiService,
    MiniMaxService,
  ],
})
export class DataServicesModule {}
