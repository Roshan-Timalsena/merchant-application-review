import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  ApplicationStatus,
  BusinessType,
  KybCheckStatus,
  RiskStatus,
} from '../enums/merchant-application.enums';

@Entity('merchant_applications')
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name' })
  businessName?: string;

  @Column({ name: 'legal_business_name' })
  legalBusinessName?: string;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: BusinessType,
  })
  businessType?: BusinessType;

  @Column({ name: 'owner_name' })
  ownerName?: string;

  @Column({ name: 'contact_email' })
  contactEmail?: string;

  @Column({ name: 'contact_phone' })
  contactPhone?: string;

  @Column({
    name: 'requested_monthly_volume',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  requestedMonthlyVolume?: string;

  @Column({
    name: 'average_ticket_size',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  averageTicketSize?: string;

  @Column({ length: 3, default: 'USD' })
  currency?: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  mcc?: string | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.DRAFT,
  })
  status!: ApplicationStatus;

  @Column({
    name: 'risk_status',
    type: 'enum',
    enum: RiskStatus,
    default: RiskStatus.NOT_ASSESSED,
  })
  riskStatus!: RiskStatus;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes?: string | null;

  @Column({ name: 'created_by_id' })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @Column({ name: 'assigned_reviewer_id', nullable: true })
  assignedReviewerId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_reviewer_id' })
  assignedReviewer?: User | null;

  @Column({ name: 'submission_version', type: 'int', default: 0 })
  submissionVersion!: number;

  @Column({
    name: 'kyb_check_status',
    type: 'enum',
    enum: KybCheckStatus,
    nullable: true,
  })
  kybCheckStatus?: KybCheckStatus | null;

  @Column({ name: 'kyb_provider_ref', type: 'varchar', nullable: true })
  kybProviderRef?: string | null;

  @Column({ name: 'kyb_result', type: 'jsonb', nullable: true })
  kybResult?: Record<string, unknown> | null;

  @Column({ name: 'kyb_checked_at', type: 'timestamptz', nullable: true })
  kybCheckedAt?: Date | null;

  @Column({ name: 'last_risk_job_id', type: 'varchar', nullable: true })
  lastRiskJobId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}
