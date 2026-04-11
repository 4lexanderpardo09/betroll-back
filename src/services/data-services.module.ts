import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SofascoreService } from './sofascore.service';
import { ESPNService } from './espn.service';
import { OddsService } from './odds.service';
import { OddsApiService } from './odds-api.service';
import { MiniMaxService } from './minimax.service';

@Global()
@Module({
  providers: [CacheService, SofascoreService, ESPNService, OddsService, OddsApiService, MiniMaxService],
  exports: [CacheService, SofascoreService, ESPNService, OddsService, OddsApiService, MiniMaxService],
})
export class DataServicesModule {}
