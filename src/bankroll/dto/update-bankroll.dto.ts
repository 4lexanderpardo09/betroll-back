import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateBankrollDto {
  @IsInt()
  @Min(1000, { message: 'El monto mínimo es de 1000 COP' })
  initialAmount: number;
}

export class DepositDto {
  @IsInt()
  @Min(1000, { message: 'El monto mínimo de operación es de 1000 COP' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class WithdrawDto {
  @IsInt()
  @Min(1000, { message: 'El monto mínimo de operación es de 1000 COP' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
