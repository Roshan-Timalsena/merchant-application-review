import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Logger } from './logger/logger.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly logger: Logger) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health(@Req() req: Request) {
    this.logger.log(req, 'Health check');
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
