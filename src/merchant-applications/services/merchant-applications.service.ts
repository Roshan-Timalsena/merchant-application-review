import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditActorType } from '../../audit/enums/audit-action.enum';
import { AuditService } from '../../audit/services/audit.service';
import { Logger } from '../../logger/logger.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { UsersService } from '../../users/services/users.service';
import { AssignReviewerDto } from '../dto/assign-reviewer.dto';
import { CreateMerchantApplicationDto } from '../dto/create-merchant-application.dto';
import { ListMerchantApplicationsQueryDto } from '../dto/list-merchant-applications.query.dto';
import { UpdateMerchantApplicationDto } from '../dto/update-merchant-application.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { MerchantApplication } from '../entities/merchant-application.entity';
import {
  ApplicationStatus,
  EDITABLE_STATUSES,
  KybCheckStatus,
  RiskStatus,
} from '../enums/merchant-application.enums';
import {
  RISK_KYB_QUEUE,
  RiskKybJobPayload,
  riskKybJobId,
} from '../risk-kyb.queue';

const ENTITY_TYPE = 'MerchantApplication';
const RISK_REVIEW_JOB_NAME = 'risk-review';

@Injectable()
export class MerchantApplicationsService {
  constructor(
    @InjectRepository(MerchantApplication)
    private readonly applicationsRepository: Repository<MerchantApplication>,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly logger: Logger,
    @InjectQueue(RISK_KYB_QUEUE)
    private readonly riskKybQueue: Queue<RiskKybJobPayload>,
  ) {}

  async create(
    dto: CreateMerchantApplicationDto,
    actor: User,
  ): Promise<MerchantApplication> {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SALES) {
      throw new ForbiddenException(
        'Only SALES or ADMIN can create applications',
      );
    }

    const application = this.applicationsRepository.create({
      ...dto,
      currency: dto.currency ?? 'USD',
      mcc: dto.mcc ?? null,
      status: ApplicationStatus.DRAFT,
      riskStatus: RiskStatus.NOT_ASSESSED,
      createdById: actor.id,
      assignedReviewerId: null,
      submissionVersion: 1,
      kybCheckStatus: KybCheckStatus.PENDING,
    });

    const saved = await this.applicationsRepository.save(application);

    await this.auditService.record({
      action: AuditAction.APPLICATION_CREATED,
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      actorUserId: actor.id,
      actorType: AuditActorType.USER,
      metadata: {
        status: saved.status,
        contactEmail: saved.contactEmail,
        contactPhone: saved.contactPhone,
        ownerName: saved.ownerName,
        businessName: saved.businessName,
      },
    });

    await this.enqueueRiskReview(saved);

    return saved;
  }

  async findAll(
    query: ListMerchantApplicationsQueryDto,
    actor: User,
  ): Promise<{
    data: MerchantApplication[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.applicationsRepository.createQueryBuilder('app');

    if (actor.role === UserRole.SALES) {
      qb.andWhere('app.created_by_id = :createdById', {
        createdById: actor.id,
      });
    }

    if (query.status) {
      qb.andWhere('app.status = :status', { status: query.status });
    }

    qb.orderBy('app.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string, actor: User): Promise<MerchantApplication> {
    const application = await this.getByIdOrThrow(id);
    this.assertCanRead(application, actor);
    return application;
  }

  async update(
    id: string,
    dto: UpdateMerchantApplicationDto,
    actor: User,
  ): Promise<MerchantApplication> {
    const application = await this.getByIdOrThrow(id);
    this.assertCanWriteContent(application, actor);

    if (!EDITABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `Application cannot be updated in status ${application.status}`,
      );
    }

    Object.assign(application, dto);
    return this.applicationsRepository.save(application);
  }

  async submit(id: string, actor: User): Promise<MerchantApplication> {
    const application = await this.getByIdOrThrow(id);
    this.assertCanWriteContent(application, actor);

    if (
      application.status !== ApplicationStatus.DRAFT &&
      application.status !== ApplicationStatus.INFO_REQUESTED
    ) {
      throw new BadRequestException(
        `Cannot submit application from status ${application.status}`,
      );
    }

    application.status = ApplicationStatus.SUBMITTED;
    application.submissionVersion += 1;
    application.kybCheckStatus = KybCheckStatus.PENDING;
    application.riskStatus = RiskStatus.NOT_ASSESSED;
    application.kybResult = null;
    application.kybProviderRef = null;
    application.kybCheckedAt = null;
    application.assignedReviewerId = null;

    const saved = await this.applicationsRepository.save(application);

    const jobId = await this.enqueueRiskReview(saved);

    await this.auditService.record({
      action: AuditAction.APPLICATION_SUBMITTED,
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      actorUserId: actor.id,
      actorType: AuditActorType.USER,
      metadata: {
        status: saved.status,
        submissionVersion: saved.submissionVersion,
        jobId,
      },
    });

    return saved;
  }

  async assign(
    id: string,
    dto: AssignReviewerDto,
    actor: User,
  ): Promise<MerchantApplication> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can assign reviewers');
    }

    const application = await this.getByIdOrThrow(id);
    if (application.status !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException(
        `Can only assign reviewer when status is submitted (current: ${application.status})`,
      );
    }

    if (application.kybCheckStatus !== KybCheckStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot assign reviewer until KYB check has completed',
      );
    }

    const reviewer = await this.usersService.findById(dto.reviewerId);
    if (!reviewer || reviewer.role !== UserRole.REVIEWER) {
      throw new BadRequestException(
        'reviewerId must reference a REVIEWER user',
      );
    }

    const previousStatus = application.status;
    application.assignedReviewerId = reviewer.id;
    application.status = ApplicationStatus.IN_REVIEW;
    const saved = await this.applicationsRepository.save(application);

    await this.auditService.record({
      action: AuditAction.APPLICATION_ASSIGNED,
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      actorUserId: actor.id,
      actorType: AuditActorType.USER,
      metadata: {
        reviewerId: reviewer.id,
        previousStatus,
        status: saved.status,
      },
    });

    return saved;
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    actor: User,
  ): Promise<MerchantApplication> {
    if (dto.status === ApplicationStatus.APPROVED) {
      return this.recordDecision(id, actor, ApplicationStatus.APPROVED, {
        riskStatus: dto.riskStatus!,
        notes: dto.notes,
      });
    }

    if (dto.status === ApplicationStatus.REJECTED) {
      return this.recordDecision(id, actor, ApplicationStatus.REJECTED, {
        riskStatus: dto.riskStatus!,
        notes: dto.notes,
      });
    }

    return this.requestInfo(id, { notes: dto.notes! }, actor);
  }

  private async requestInfo(
    id: string,
    dto: { notes: string },
    actor: User,
  ): Promise<MerchantApplication> {
    const application = await this.getByIdOrThrow(id);
    this.assertCanRecordRiskDecision(application, actor);

    if (application.status !== ApplicationStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Can only request info when status is in_review (current: ${application.status})`,
      );
    }

    const previousStatus = application.status;
    application.status = ApplicationStatus.INFO_REQUESTED;
    application.riskStatus = RiskStatus.NOT_ASSESSED;
    application.reviewerNotes = dto.notes;
    application.assignedReviewerId = null;

    const saved = await this.applicationsRepository.save(application);

    await this.auditService.record({
      action: AuditAction.APPLICATION_REVIEW_DECISION,
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      actorUserId: actor.id,
      actorType: AuditActorType.USER,
      metadata: {
        decision: 'request_info',
        previousStatus,
        status: saved.status,
        riskStatus: saved.riskStatus,
        notesLength: dto.notes.length,
      },
    });

    return saved;
  }

  async listAuditLogs(id: string, actor: User) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can view audit logs');
    }
    await this.getByIdOrThrow(id);
    return this.auditService.findForEntity(ENTITY_TYPE, id);
  }

  private async enqueueRiskReview(
    application: MerchantApplication,
  ): Promise<string> {
    const jobId = riskKybJobId(application.id, application.submissionVersion);
    await this.riskKybQueue.add(
      RISK_REVIEW_JOB_NAME,
      {
        applicationId: application.id,
        submissionVersion: application.submissionVersion,
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100, age: 1000 * 60 * 60 * 24 },
        removeOnFail: { count: 100, age: 1000 * 60 * 60 * 24 },
      },
    );

    this.logger.log('Risk review job enqueued', {
      applicationId: application.id,
      submissionVersion: application.submissionVersion,
      jobId,
      jobName: RISK_REVIEW_JOB_NAME,
      queue: RISK_KYB_QUEUE,
    });

    return jobId;
  }

  private async recordDecision(
    id: string,
    actor: User,
    nextStatus: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED,
    dto: { riskStatus: RiskStatus; notes?: string },
  ): Promise<MerchantApplication> {
    const application = await this.getByIdOrThrow(id);
    this.assertCanRecordRiskDecision(application, actor);

    if (application.status !== ApplicationStatus.IN_REVIEW) {
      throw new BadRequestException(
        `Can only decide when status is in_review (current: ${application.status})`,
      );
    }

    const previousStatus = application.status;
    application.status = nextStatus;
    application.riskStatus = dto.riskStatus;
    application.reviewerNotes = dto.notes ?? null;

    const saved = await this.applicationsRepository.save(application);

    await this.auditService.record({
      action: AuditAction.APPLICATION_REVIEW_DECISION,
      entityType: ENTITY_TYPE,
      entityId: saved.id,
      actorUserId: actor.id,
      actorType: AuditActorType.USER,
      metadata: {
        decision:
          nextStatus === ApplicationStatus.APPROVED ? 'approve' : 'reject',
        previousStatus,
        status: saved.status,
        riskStatus: saved.riskStatus,
        notesLength: dto.notes?.length ?? 0,
      },
    });

    return saved;
  }

  private async getByIdOrThrow(id: string): Promise<MerchantApplication> {
    const application = await this.applicationsRepository.findOne({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private assertCanRead(application: MerchantApplication, actor: User): void {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.REVIEWER) {
      return;
    }
    if (actor.role === UserRole.SALES && application.createdById === actor.id) {
      return;
    }
    throw new ForbiddenException('You do not have access to this application');
  }

  private assertCanWriteContent(
    application: MerchantApplication,
    actor: User,
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role === UserRole.SALES && application.createdById === actor.id) {
      return;
    }
    throw new ForbiddenException('You do not have access to this application');
  }

  private assertCanRecordRiskDecision(
    application: MerchantApplication,
    actor: User,
  ): void {
    if (!application.assignedReviewerId) {
      throw new ForbiddenException(
        'Cannot record a risk decision until a reviewer is assigned',
      );
    }
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (
      actor.role === UserRole.REVIEWER &&
      application.assignedReviewerId === actor.id
    ) {
      return;
    }
    throw new ForbiddenException(
      'Only the assigned reviewer may record a risk decision',
    );
  }
}
