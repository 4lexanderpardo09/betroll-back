import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { SofascoreService } from './sofascore.service';
import { ESPNService } from './espn.service';
import { OddsService } from './odds.service';

@Global()
@Module({
  providers: [CacheService, SofascoreService, ESPNService, OddsService],
  exports: [CacheService, SofascoreService, ESPNService, OddsService],
})
export class DataServicesModule {}
