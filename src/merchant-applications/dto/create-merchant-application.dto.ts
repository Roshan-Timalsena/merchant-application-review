import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BusinessType } from '../enums/merchant-application.enums';

export class CreateMerchantApplicationDto {
  @ApiProperty({ example: 'Acme Retail' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @ApiProperty({ example: 'Acme Retail LLC' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalBusinessName!: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  ownerName!: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  contactPhone!: string;

  @ApiProperty({ example: '50000.00' })
  @IsNumberString()
  requestedMonthlyVolume!: string;

  @ApiProperty({ example: '75.00' })
  @IsNumberString()
  averageTicketSize!: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: '5411' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  mcc?: string;
}
