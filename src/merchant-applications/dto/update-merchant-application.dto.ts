import { PartialType } from '@nestjs/swagger';
import { CreateMerchantApplicationDto } from './create-merchant-application.dto';

export class UpdateMerchantApplicationDto extends PartialType(
  CreateMerchantApplicationDto,
) {}
