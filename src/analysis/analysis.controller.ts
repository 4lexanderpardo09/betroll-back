import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';
import { AnalyzeBetDto } from './dto/analyze-bet.dto';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * POST /analysis/analyze
   * Generate analysis for a match
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeMatch(
    @Request() req: any,
    @Body() analyzeDto: AnalyzeBetDto,
  ) {
    const analysis = await this.analysisService.analyzeMatch(
      req.user.sub,
      analyzeDto.homeTeam,
      analyzeDto.awayTeam,
      analyzeDto.sport,
      {
        tournament: analyzeDto.tournament,
        eventDate: analyzeDto.eventDate,
        userOdds: analyzeDto.userOdds,
        userSportsbook: analyzeDto.userSportsbook,
      },
    );

    return {
      success: true,
      data: analysis,
    };
  }

  /**
   * GET /analysis/:id
   * Get a specific analysis
   */
  @Get(':id')
  async getAnalysis(@Request() req: any, @Param('id') id: string) {
    const analysis = await this.analysisService.getAnalysis(req.user.sub, id);

    return {
      success: true,
      data: analysis,
    };
  }

  /**
   * GET /analysis
   * Get all analyses for the current user
   */
  @Get()
  async getUserAnalyses(
    @Request() req: any,
  ) {
    const analyses = await this.analysisService.getUserAnalyses(req.user.sub);

    return {
      success: true,
      data: analyses,
    };
  }
}
