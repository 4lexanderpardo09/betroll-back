import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SofascoreService } from './sofascore.service';
import { ESPNService } from './espn.service';
import { OddsApiService } from './odds-api.service';
import { MiniMaxService } from './minimax.service';

@Global()
@Module({
  providers: [CacheService, SofascoreService, ESPNService, OddsApiService, MiniMaxService],
  exports: [CacheService, SofascoreService, ESPNService, OddsApiService, MiniMaxService],
})
export class DataServicesModule {}
