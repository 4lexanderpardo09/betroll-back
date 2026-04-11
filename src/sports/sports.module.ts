import { Module } from '@nestjs/common';
import { NbaModule } from './nba/nba.module';
import { NflModule } from './nfl/nfl.module';
import { SoccerModule } from './soccer/soccer.module';

@Module({
  imports: [NbaModule, NflModule, SoccerModule],
  exports: [NbaModule, NflModule, SoccerModule],
})
export class SportsModule {}
