import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Logger } from '../../logger/logger.service';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: Logger,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    this.logger.log(req, 'Register request called', { email: dto.email });
    const result = await this.authService.register(dto);
    this.logger.log(req, 'Register request completed', {});
    return result;
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and receive a JWT' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    this.logger.log(req, 'Login request called', { email: dto.email });
    const result = await this.authService.login(dto);
    this.logger.log(req, 'Login request completed', {});
    return result;
  }
}
