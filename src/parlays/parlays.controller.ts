import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ParlaysService, CreateParlayDto, ResolveParlayDto } from './parlays.service';

interface AuthRequest {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('parlays')
@UseGuards(AuthGuard('jwt'))
export class ParlaysController {
  constructor(private readonly parlaysService: ParlaysService) {}

  @Get()
  async findAll(@Request() req: AuthRequest) {
    return this.parlaysService.findAll(req.user.userId);
  }

  @Get('pending')
  async getPendingBets(@Request() req: AuthRequest) {
    return this.parlaysService.getPendingBets(req.user.userId);
  }

  @Get(':id')
  async findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parlaysService.findOneWithBets(id, req.user.userId);
  }

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateParlayDto) {
    const parlay = await this.parlaysService.createParlay(req.user.userId, dto);
    return { data: parlay, message: 'Parlay creado exitosamente' };
  }

  @Patch(':id/resolve')
  async resolve(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveParlayDto,
  ) {
    const parlay = await this.parlaysService.resolveParlay(id, req.user.userId, dto);
    return { data: parlay, message: 'Parlay resuelto exitosamente' };
  }

  @Delete(':id')
  async remove(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.parlaysService.remove(id, req.user.userId);
    return { message: 'Parlay eliminado exitosamente' };
  }
}
