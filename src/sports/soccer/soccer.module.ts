import { Module } from '@nestjs/common';
import { SoccerController } from './soccer.controller';
import { SoccerAnalysisService } from './soccer-analysis.service';
import { SoccerPromptBuilder } from './soccer-prompt.builder';

@Module({
  providers: [SoccerAnalysisService, SoccerPromptBuilder],
  controllers: [SoccerController],
  exports: [SoccerAnalysisService],
})
export class SoccerModule {}
