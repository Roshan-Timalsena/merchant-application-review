import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { redactAuditMetadata } from '../../common/security/redact';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditActorType } from '../enums/audit-action.enum';
import { AuditLog } from '../entities/audit-log.entity';

export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  actorType: AuditActorType;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    const entry = this.auditLogsRepository.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      metadata: redactAuditMetadata(input.metadata ?? {}),
    });
    return this.auditLogsRepository.save(entry);
  }

  findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogsRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
