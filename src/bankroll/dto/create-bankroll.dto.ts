import { IsInt, Min } from 'class-validator';

export class CreateBankrollDto {
  @IsInt()
  @Min(1000, { message: 'El monto mínimo es de 1000 COP' })
  initialAmount: number;
}
