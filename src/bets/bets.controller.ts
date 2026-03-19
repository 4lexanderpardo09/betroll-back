import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BetsService } from './bets.service';
import { CreateBetDto, UpdateBetDto } from './dto/create-bet.dto';
import { ResolveBetDto } from './dto/resolve-bet.dto';

interface AuthRequest {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('bets')
@UseGuards(AuthGuard('jwt'))
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Get()
  async findAll(
    @Request() req: AuthRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.betsService.findAll(
      req.user.userId,
      parseInt(page, 10),
      parseInt(limit, 10),
      { sport, status, category, dateFrom, dateTo },
    );
  }

  @Get('pending')
  async findPending(@Request() req: AuthRequest) {
    return this.betsService.findPending(req.user.userId);
  }

  @Get('stats')
  async getStats(@Request() req: AuthRequest) {
    return this.betsService.getStats(req.user.userId);
  }

  @Get(':id')
  async findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.betsService.findOne(id, req.user.userId);
  }

  @Post()
  async create(@Request() req: AuthRequest, @Body() createBetDto: CreateBetDto) {
    const bet = await this.betsService.createBet(req.user.userId, createBetDto);
    return { data: bet, message: 'Apuesta creada exitosamente' };
  }

  @Patch(':id/resolve')
  async resolve(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() resolveBetDto: ResolveBetDto,
  ) {
    const bet = await this.betsService.resolveBet(id, req.user.userId, resolveBetDto);
    return { data: bet, message: 'Apuesta resuelta exitosamente' };
  }

  @Patch(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBetDto: UpdateBetDto,
  ) {
    const bet = await this.betsService.updateBet(id, req.user.userId, updateBetDto);
    return { data: bet, message: 'Apuesta actualizada exitosamente' };
  }

  @Delete(':id')
  async remove(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.betsService.remove(id, req.user.userId);
    return { message: 'Apuesta eliminada exitosamente' };
  }
}
