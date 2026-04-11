import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analysis } from './entities/analysis.entity';

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(Analysis)
    private analysisRepository: Repository<Analysis>,
  ) {}

  async getAnalysis(userId: string, analysisId: string): Promise<Analysis> {
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    return analysis;
  }

  async getUserAnalyses(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Analysis[]> {
    return this.analysisRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });
  }
}
