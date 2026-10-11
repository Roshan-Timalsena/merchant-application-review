import { OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { AuditAction, AuditActorType } from '../audit/enums/audit-action.enum';
import { AuditService } from '../audit/services/audit.service';
import { Logger } from '../logger/logger.service';
import {
  ApplicationStatus,
  KybCheckStatus,
} from './enums/merchant-application.enums';
import { MerchantApplication } from './entities/merchant-application.entity';
import { RISK_KYB_QUEUE, RiskKybJobPayload } from './risk-kyb.queue';
import { simulateRiskProvider } from './risk-kyb.simulator';

const PROCESSABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.IN_REVIEW,
];

@Processor(RISK_KYB_QUEUE)
export class RiskKybProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    @InjectRepository(MerchantApplication)
    private readonly applicationsRepository: Repository<MerchantApplication>,
    private readonly auditService: AuditService,
    private readonly logger: Logger,
  ) {
    super();
  }

  onModuleInit(): void {
    this.logger.log('Risk KYB worker ready', {
      queue: RISK_KYB_QUEUE,
    });
  }

  async process(job: Job<RiskKybJobPayload>): Promise<void> {
    const { applicationId, submissionVersion } = job.data;

    this.logger.log('Risk review job started', {
      jobId: job.id,
      applicationId,
      submissionVersion,
      attempt: job.attemptsMade + 1,
    });

    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      this.logger.warn('Risk review job skipped', {
        reason: 'not_found',
        jobId: job.id,
        applicationId,
      });
      return;
    }

    if (
      application.kybCheckStatus === KybCheckStatus.COMPLETED &&
      application.kybResult?.submissionVersion === submissionVersion
    ) {
      this.logger.warn('Risk review job skipped', {
        reason: 'already_completed',
        jobId: job.id,
        applicationId,
        submissionVersion,
      });
      return;
    }

    if (application.submissionVersion !== submissionVersion) {
      this.logger.warn('Risk review job skipped', {
        reason: 'stale',
        jobId: job.id,
        applicationId,
        jobSubmissionVersion: submissionVersion,
        appSubmissionVersion: application.submissionVersion,
      });
      return;
    }

    if (!PROCESSABLE_STATUSES.includes(application.status)) {
      this.logger.warn('Risk review job skipped', {
        reason: 'wrong_status',
        jobId: job.id,
        applicationId,
        status: application.status,
      });
      return;
    }

    try {
      const checkedAt = new Date();
      const providerRef =
        job.id ?? `risk-kyb:${applicationId}:${submissionVersion}`;

      const simulation = simulateRiskProvider(application);

      this.logger.log('Risk provider simulation completed', {
        jobId: job.id,
        applicationId,
        outcome: simulation.outcome,
        riskStatus: simulation.riskStatus,
      });

      application.kybCheckStatus = KybCheckStatus.COMPLETED;
      application.kybProviderRef = providerRef;
      application.riskStatus = simulation.riskStatus;
      application.kybResult = {
        outcome: simulation.outcome,
        score: simulation.score,
        flags: simulation.flags,
        summary: simulation.summary,
        riskStatus: simulation.riskStatus,
        submissionVersion,
        jobId: job.id ?? null,
        checkedAt: checkedAt.toISOString(),
      };
      application.kybCheckedAt = checkedAt;
      application.lastRiskJobId = job.id ?? null;

      await this.applicationsRepository.save(application);

      this.logger.log('Risk review persisted', {
        jobId: job.id,
        applicationId,
        kybCheckStatus: application.kybCheckStatus,
        riskStatus: application.riskStatus,
      });

      await this.auditService.record({
        action: AuditAction.APPLICATION_KYB_COMPLETED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        actorUserId: null,
        actorType: AuditActorType.SYSTEM,
        metadata: {
          providerRef,
          submissionVersion,
          outcome: simulation.outcome,
          riskStatus: simulation.riskStatus,
        },
      });

      this.logger.log('Risk review job completed', {
        jobId: job.id,
        applicationId,
        submissionVersion,
        outcome: simulation.outcome,
        riskStatus: simulation.riskStatus,
      });
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      if (isFinalAttempt) {
        application.kybCheckStatus = KybCheckStatus.FAILED;
        application.lastRiskJobId = job.id ?? null;
        await this.applicationsRepository.save(application);
        this.logger.error('Risk review job failed after retries', {
          jobId: job.id,
          applicationId,
          submissionVersion,
        });
      }

      throw error;
    }
  }
}
