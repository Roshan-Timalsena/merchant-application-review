export enum AuditAction {
  APPLICATION_CREATED = 'application.created',
  APPLICATION_SUBMITTED = 'application.submitted',
  APPLICATION_ASSIGNED = 'application.assigned',
  APPLICATION_REVIEW_DECISION = 'application.review_decision',
  APPLICATION_KYB_COMPLETED = 'application.kyb_completed',
}

export enum AuditActorType {
  USER = 'user',
  SYSTEM = 'system',
}
