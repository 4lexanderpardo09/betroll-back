import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SofascoreService } from './sofascore.service';
import { ESPNQualitativeService } from './espn-qualitative.service';
import { ESPNOddsService } from './espn-odds.service';
import { ESPNStatsService } from './espn-stats.service';
import { OddsApiService } from './odds-api.service';
import { MiniMaxService } from './minimax.service';
import { DataNormalizer } from './data-normalizer.service';
import { NbaTeamStatsAggregator } from './nba-team-stats-aggregator.service';

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
    DataNormalizer,
    NbaTeamStatsAggregator,
  ],
  exports: [
    CacheService,
    SofascoreService,
    ESPNQualitativeService,
    ESPNOddsService,
    ESPNStatsService,
    OddsApiService,
    MiniMaxService,
    DataNormalizer,
    NbaTeamStatsAggregator,
  ],
})
export class DataServicesModule {}