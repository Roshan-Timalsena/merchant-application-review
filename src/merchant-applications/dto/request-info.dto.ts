import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class RequestInfoDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  notes!: string;
}
