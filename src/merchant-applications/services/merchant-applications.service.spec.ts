import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditService } from '../../audit/services/audit.service';
import { Logger } from '../../logger/logger.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { UsersService } from '../../users/services/users.service';
import { CreateMerchantApplicationDto } from '../dto/create-merchant-application.dto';
import { MerchantApplication } from '../entities/merchant-application.entity';
import {
  ApplicationStatus,
  BusinessType,
  KybCheckStatus,
  RiskStatus,
} from '../enums/merchant-application.enums';
import { RISK_KYB_QUEUE } from '../risk-kyb.queue';
import { MerchantApplicationsService } from './merchant-applications.service';

describe('MerchantApplicationsService', () => {
  let service: MerchantApplicationsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let audit: { record: jest.Mock; findForEntity: jest.Mock };
  let usersService: { findById: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const salesA = {
    id: 'sales-a',
    email: 'sales-a@example.com',
    role: UserRole.SALES,
  } as never;
  const salesB = {
    id: 'sales-b',
    email: 'sales-b@example.com',
    role: UserRole.SALES,
  } as never;
  const reviewerA = {
    id: 'reviewer-a',
    email: 'reviewer-a@example.com',
    role: UserRole.REVIEWER,
  } as never;
  const admin = {
    id: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  } as never;

  const createDto: CreateMerchantApplicationDto = {
    businessName: 'Acme',
    legalBusinessName: 'Acme LLC',
    businessType: BusinessType.LLC,
    ownerName: 'Jane Doe',
    contactEmail: 'owner@example.com',
    contactPhone: '5551234567',
    requestedMonthlyVolume: '1000',
    averageTicketSize: '50',
  };

  const baseApp = (): MerchantApplication =>
    ({
      id: 'app-1',
      businessName: 'Acme',
      legalBusinessName: 'Acme LLC',
      businessType: BusinessType.LLC,
      ownerName: 'Jane Doe',
      contactEmail: 'owner@example.com',
      contactPhone: '5551234567',
      requestedMonthlyVolume: '1000',
      averageTicketSize: '50',
      currency: 'USD',
      mcc: null,
      status: ApplicationStatus.DRAFT,
      riskStatus: RiskStatus.NOT_ASSESSED,
      reviewerNotes: null,
      createdById: 'sales-a',
      assignedReviewerId: null,
      submissionVersion: 1,
      kybCheckStatus: KybCheckStatus.PENDING,
      kybProviderRef: null,
      kybResult: null,
      kybCheckedAt: null,
      lastRiskJobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as MerchantApplication;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => ({ id: 'app-1', ...x })),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    queue = { add: jest.fn() };
    audit = { record: jest.fn(), findForEntity: jest.fn() };
    usersService = { findById: jest.fn() };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantApplicationsService,
        { provide: getRepositoryToken(MerchantApplication), useValue: repo },
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: audit },
        { provide: Logger, useValue: logger },
        { provide: getQueueToken(RISK_KYB_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(MerchantApplicationsService);
  });

  it('forbids SALES from reading another user application', async () => {
    repo.findOne.mockResolvedValue(baseApp());
    await expect(service.findOne('app-1', salesB)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('forbids REVIEWER from reading an application assigned to someone else', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      assignedReviewerId: 'reviewer-a',
    });

    const reviewerB = {
      id: 'reviewer-b',
      email: 'reviewer-b@example.com',
      role: UserRole.REVIEWER,
    } as never;

    await expect(service.findOne('app-1', reviewerB)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows assigned REVIEWER to read an application', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      assignedReviewerId: 'reviewer-a',
    });

    await expect(service.findOne('app-1', reviewerA)).resolves.toMatchObject({
      id: 'app-1',
      assignedReviewerId: 'reviewer-a',
    });
  });

  it('allows REVIEWER to read an application they created', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      createdById: 'reviewer-a',
      assignedReviewerId: null,
    });

    await expect(service.findOne('app-1', reviewerA)).resolves.toMatchObject({
      id: 'app-1',
      createdById: 'reviewer-a',
    });
  });

  it('scopes REVIEWER findAll to assigned or created applications', async () => {
    const andWhere = jest.fn().mockReturnThis();
    const orderBy = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const take = jest.fn().mockReturnThis();
    const getManyAndCount = jest.fn().mockResolvedValue([[], 0]);

    repo.createQueryBuilder.mockReturnValue({
      andWhere,
      orderBy,
      skip,
      take,
      getManyAndCount,
    });

    await service.findAll({}, reviewerA);

    expect(andWhere).toHaveBeenCalledWith(
      '(app.assigned_reviewer_id = :reviewerId OR app.created_by_id = :reviewerId)',
      { reviewerId: 'reviewer-a' },
    );
  });

  it('rejects update when status is not editable', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.SUBMITTED,
    });
    await expect(
      service.update('app-1', { businessName: 'X' }, salesA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates draft and enqueues risk-review job', async () => {
    const result = await service.create(createDto, salesA);

    expect(result.status).toBe(ApplicationStatus.DRAFT);
    expect(result.submissionVersion).toBe(1);
    expect(result.kybCheckStatus).toBe(KybCheckStatus.PENDING);
    expect(queue.add).toHaveBeenCalledWith(
      'risk-review',
      expect.objectContaining({
        applicationId: 'app-1',
        submissionVersion: 1,
      }),
      expect.any(Object),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Risk review job enqueued',
      expect.objectContaining({
        applicationId: 'app-1',
        jobName: 'risk-review',
        queue: RISK_KYB_QUEUE,
      }),
    );
  });

  it('submits draft and enqueues KYB job', async () => {
    const app = baseApp();
    repo.findOne.mockResolvedValue(app);
    repo.save.mockImplementation(async (x) => x);

    const result = await service.submit('app-1', salesA);

    expect(result.status).toBe(ApplicationStatus.SUBMITTED);
    expect(result.submissionVersion).toBe(2);
    expect(queue.add).toHaveBeenCalledWith(
      'risk-review',
      expect.objectContaining({
        applicationId: 'app-1',
        submissionVersion: 2,
      }),
      expect.any(Object),
    );
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects assign when KYB check is not completed', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.SUBMITTED,
      kybCheckStatus: KybCheckStatus.PENDING,
    });

    await expect(
      service.assign('app-1', { reviewerId: 'reviewer-a' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns reviewer after KYB completes', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.SUBMITTED,
      kybCheckStatus: KybCheckStatus.COMPLETED,
      riskStatus: RiskStatus.LOW,
    });
    usersService.findById.mockResolvedValue(reviewerA);

    const result = await service.assign(
      'app-1',
      { reviewerId: 'reviewer-a' },
      admin,
    );

    expect(result.status).toBe(ApplicationStatus.IN_REVIEW);
    expect(result.assignedReviewerId).toBe('reviewer-a');
  });

  it('forbids decide when no reviewer is assigned', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.IN_REVIEW,
      assignedReviewerId: null,
    });

    await expect(
      service.updateStatus(
        'app-1',
        { status: ApplicationStatus.APPROVED, riskStatus: RiskStatus.LOW },
        admin,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids non-assignee reviewer from approving', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.IN_REVIEW,
      assignedReviewerId: 'reviewer-a',
    });

    const reviewerB = {
      id: 'reviewer-b',
      email: 'reviewer-b@example.com',
      role: UserRole.REVIEWER,
    } as never;

    await expect(
      service.updateStatus(
        'app-1',
        { status: ApplicationStatus.APPROVED, riskStatus: RiskStatus.LOW },
        reviewerB,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows assigned reviewer to approve in_review application', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.IN_REVIEW,
      assignedReviewerId: 'reviewer-a',
    });

    const result = await service.updateStatus(
      'app-1',
      { status: ApplicationStatus.APPROVED, riskStatus: RiskStatus.LOW },
      reviewerA,
    );

    expect(result.status).toBe(ApplicationStatus.APPROVED);
    expect(result.riskStatus).toBe(RiskStatus.LOW);
  });

  it('rejects approve when not in_review', async () => {
    repo.findOne.mockResolvedValue({
      ...baseApp(),
      status: ApplicationStatus.SUBMITTED,
      assignedReviewerId: 'reviewer-a',
    });

    await expect(
      service.updateStatus(
        'app-1',
        { status: ApplicationStatus.APPROVED, riskStatus: RiskStatus.LOW },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
