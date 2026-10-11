import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../authorization/guards/roles.guard';
import { PoliciesGuard } from '../../authorization/guards/policies.guard';
import { Logger } from '../../logger/logger.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { AssignReviewerDto } from '../dto/assign-reviewer.dto';
import { CreateMerchantApplicationDto } from '../dto/create-merchant-application.dto';
import { ListMerchantApplicationsQueryDto } from '../dto/list-merchant-applications.query.dto';
import { UpdateMerchantApplicationDto } from '../dto/update-merchant-application.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { MerchantApplication } from '../entities/merchant-application.entity';
import { MerchantApplicationsService } from '../services/merchant-applications.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('merchant-applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchant-application')
export class MerchantApplicationsController {
  constructor(
    private readonly merchantApplicationsService: MerchantApplicationsService,
    private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a merchant application' })
  @UseGuards(
    PoliciesGuard((ability) => ability.can('create', MerchantApplication)),
  )
  async create(
    @Body() dto: CreateMerchantApplicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Create merchant application', {
      businessName: dto.businessName,
    });
    const application = await this.merchantApplicationsService.create(
      dto,
      req.user,
    );
    this.logger.log(req, 'Merchant application created', {
      applicationId: application.id,
    });
    return application;
  }

  @Get()
  @ApiOperation({ summary: 'List merchant applications' })
  @UseGuards(
    PoliciesGuard((ability) => ability.can('read', MerchantApplication)),
  )
  async findAll(
    @Query() query: ListMerchantApplicationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'List merchant applications', {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return this.merchantApplicationsService.findAll(query, req.user);
  }

  @Get(':id/audit-logs')
  @UseGuards(
    RolesGuard(UserRole.ADMIN),
    PoliciesGuard((ability) => ability.can('manage', 'all')),
  )
  @ApiOperation({ summary: 'List audit logs for an application (ADMIN)' })
  async listAuditLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'List application audit logs', { applicationId: id });
    return this.merchantApplicationsService.listAuditLogs(id, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a merchant application by id' })
  @UseGuards(
    PoliciesGuard((ability) => ability.can('read', MerchantApplication)),
  )
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Get merchant application', { applicationId: id });
    return this.merchantApplicationsService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an editable merchant application' })
  @UseGuards(
    PoliciesGuard((ability) => ability.can('update', MerchantApplication)),
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantApplicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Update merchant application', {
      applicationId: id,
      fields: Object.keys(dto),
    });
    const application = await this.merchantApplicationsService.update(
      id,
      dto,
      req.user,
    );
    this.logger.log(req, 'Merchant application updated', {
      applicationId: application.id,
      status: application.status,
    });
    return application;
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit application and enqueue KYB check' })
  @UseGuards(
    PoliciesGuard((ability) => ability.can('submit', MerchantApplication)),
  )
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Submit merchant application', { applicationId: id });
    const application = await this.merchantApplicationsService.submit(
      id,
      req.user,
    );
    this.logger.log(req, 'Merchant application submitted', {
      applicationId: application.id,
      submissionVersion: application.submissionVersion,
      status: application.status,
    });
    return application;
  }

  @Post(':id/assign')
  @UseGuards(
    RolesGuard(UserRole.ADMIN),
    PoliciesGuard((ability) => ability.can('assign', MerchantApplication)),
  )
  @ApiOperation({ summary: 'Assign a reviewer (ADMIN)' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Assign reviewer', {
      applicationId: id,
      reviewerId: dto.reviewerId,
    });
    const application = await this.merchantApplicationsService.assign(
      id,
      dto,
      req.user,
    );
    this.logger.log(req, 'Reviewer assigned', {
      applicationId: application.id,
      assignedReviewerId: application.assignedReviewerId,
      status: application.status,
    });
    return application;
  }

  @Post(':id/update-status')
  @ApiOperation({
    summary:
      'Update review status (approved, rejected, or info_requested) — assigned reviewer',
  })
  @UseGuards(
    PoliciesGuard(
      (ability) =>
        ability.can('approve', MerchantApplication) ||
        ability.can('requestInfo', MerchantApplication),
    ),
  )
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(req, 'Update merchant application status', {
      applicationId: id,
      status: dto.status,
      riskStatus: dto.riskStatus,
      notesLength: dto.notes?.length,
    });
    const application = await this.merchantApplicationsService.updateStatus(
      id,
      dto,
      req.user,
    );
    this.logger.log(req, 'Merchant application status updated', {
      applicationId: application.id,
      status: application.status,
      riskStatus: application.riskStatus,
    });
    return application;
  }
}
