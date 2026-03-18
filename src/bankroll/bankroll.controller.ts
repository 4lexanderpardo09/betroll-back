import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BankrollService } from './bankroll.service';
import { CreateBankrollDto } from './dto/create-bankroll.dto';
import { UpdateBankrollDto, DepositDto, WithdrawDto } from './dto/update-bankroll.dto';

interface AuthRequest {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('bankroll')
@UseGuards(AuthGuard('jwt'))
export class BankrollController {
  constructor(private readonly bankrollService: BankrollService) {}

  @Get()
  async getBankroll(@Request() req: AuthRequest) {
    const bankroll = await this.bankrollService.getBankroll(req.user.userId);
    return { data: bankroll };
  }

  @Post()
  async createBankroll(@Request() req: AuthRequest, @Body() dto: CreateBankrollDto) {
    const bankroll = await this.bankrollService.createBankroll(req.user.userId, dto);
    return { data: bankroll, message: 'Bankroll creado exitosamente' };
  }

  @Patch()
  async updateBankroll(@Request() req: AuthRequest, @Body() dto: UpdateBankrollDto) {
    const bankroll = await this.bankrollService.updateBankroll(req.user.userId, dto);
    return { data: bankroll, message: 'Bankroll actualizado exitosamente' };
  }

  @Patch('deposit')
  async deposit(@Request() req: AuthRequest, @Body() dto: DepositDto) {
    const bankroll = await this.bankrollService.deposit(
      req.user.userId,
      dto.amount,
      dto.description,
    );
    return { data: bankroll, message: 'Depósito realizado exitosamente' };
  }

  @Patch('withdraw')
  async withdraw(@Request() req: AuthRequest, @Body() dto: WithdrawDto) {
    const bankroll = await this.bankrollService.withdraw(
      req.user.userId,
      dto.amount,
      dto.description,
    );
    return { data: bankroll, message: 'Retiro realizado exitosamente' };
  }

  @Get('movements')
  async getMovements(
    @Request() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const result = await this.bankrollService.getMovements(
      req.user.userId,
      pageNum,
      limitNum,
    );
    return result;
  }
}
