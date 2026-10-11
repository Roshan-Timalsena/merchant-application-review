import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditActorType } from '../enums/audit-action.enum';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ type: 'enum', enum: AuditAction })
  action?: AuditAction;

  @Column({ name: 'entity_type' })
  entityType?: string;

  @Column({ name: 'entity_id' })
  entityId?: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string | null;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: AuditActorType,
  })
  actorType?: AuditActorType;

  @Column({ type: 'jsonb', default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;
}
