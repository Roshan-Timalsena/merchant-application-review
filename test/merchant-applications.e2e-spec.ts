import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import {
  BusinessType,
  RiskStatus,
} from '../src/merchant-applications/enums/merchant-application.enums';

const PASSWORD = 'Password123!';

const sampleCreate = {
  businessName: 'Acme Retail',
  legalBusinessName: 'Acme Retail LLC',
  businessType: BusinessType.LLC,
  ownerName: 'Jane Doe',
  contactEmail: 'owner@example.com',
  contactPhone: '+15551234567',
  requestedMonthlyVolume: '50000.00',
  averageTicketSize: '75.00',
  currency: 'USD',
  mcc: '5411',
};

async function login(
  app: INestApplication,
  email: string,
  password = PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  return res.body.accessToken as string;
}

async function waitForKyb(
  app: INestApplication,
  token: string,
  id: string,
  timeoutMs = 15000,
): Promise<Record<string, unknown>> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await request(app.getHttpServer())
      .get(`/api/merchant-application/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    if (res.body.kybCheckStatus === 'completed') {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('KYB check did not complete in time');
}

describe('Merchant applications (e2e)', () => {
  let app: INestApplication;
  jest.setTimeout(60000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces SALES ownership for list, get, edit, and submit', async () => {
    const salesAToken = await login(app, 'sales@example.com');
    const salesBEmail = `sales-b-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: salesBEmail, password: 'password123' })
      .expect(201);
    const salesBToken = await login(app, salesBEmail, 'password123');

    const createRes = await request(app.getHttpServer())
      .post('/api/merchant-application')
      .set('Authorization', `Bearer ${salesAToken}`)
      .send(sampleCreate)
      .expect(201);

    const appId = createRes.body.id as string;

    const listB = await request(app.getHttpServer())
      .get('/api/merchant-application')
      .set('Authorization', `Bearer ${salesBToken}`)
      .expect(200);
    expect(
      (listB.body.data as { id: string }[]).some((row) => row.id === appId),
    ).toBe(false);

    const listA = await request(app.getHttpServer())
      .get('/api/merchant-application')
      .set('Authorization', `Bearer ${salesAToken}`)
      .expect(200);
    expect(
      (listA.body.data as { id: string }[]).some((row) => row.id === appId),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesBToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesBToken}`)
      .send({ businessName: 'Hijacked' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/submit`)
      .set('Authorization', `Bearer ${salesBToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesAToken}`)
      .expect(200);
  });

  it('enforces REVIEWER assignee/creator scoping for list and get', async () => {
    const salesToken = await login(app, 'sales@example.com');
    const adminToken = await login(app, 'admin@example.com');
    const reviewerAToken = await login(app, 'reviewer@example.com');
    const reviewerBToken = await login(app, 'reviewer2@example.com');

    const createRes = await request(app.getHttpServer())
      .post('/api/merchant-application')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        ...sampleCreate,
        businessName: `Reviewer Scope Co ${Date.now()}`,
      })
      .expect(201);

    const appId = createRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/submit`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);

    await waitForKyb(app, salesToken, appId);

    const reviewerALogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reviewer@example.com', password: PASSWORD })
      .expect(201);
    const reviewerAId = reviewerALogin.body.user.id as string;

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewerId: reviewerAId })
      .expect(201);

    const listB = await request(app.getHttpServer())
      .get('/api/merchant-application')
      .set('Authorization', `Bearer ${reviewerBToken}`)
      .expect(200);
    expect(
      (listB.body.data as { id: string }[]).some((row) => row.id === appId),
    ).toBe(false);

    const listA = await request(app.getHttpServer())
      .get('/api/merchant-application')
      .set('Authorization', `Bearer ${reviewerAToken}`)
      .expect(200);
    expect(
      (listA.body.data as { id: string }[]).some((row) => row.id === appId),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${reviewerBToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${reviewerAToken}`)
      .expect(200);
  });

  it('runs lifecycle with KYB, assignment, object-level review, and audit', async () => {
    const salesToken = await login(app, 'sales@example.com');
    const adminToken = await login(app, 'admin@example.com');
    const reviewerAToken = await login(app, 'reviewer@example.com');
    const reviewerBToken = await login(app, 'reviewer2@example.com');

    const createRes = await request(app.getHttpServer())
      .post('/api/merchant-application')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        ...sampleCreate,
        businessName: `Lifecycle Co ${Date.now()}`,
      })
      .expect(201);

    const appId = createRes.body.id as string;
    expect(createRes.body.status).toBe('draft');

    const afterCreateKyb = await waitForKyb(app, salesToken, appId);
    expect(afterCreateKyb.kybCheckStatus).toBe('completed');
    expect(afterCreateKyb.kybResult).toBeDefined();
    expect(
      (afterCreateKyb.kybResult as { submissionVersion: number })
        .submissionVersion,
    ).toBe(1);
    expect(afterCreateKyb.riskStatus).not.toBe(RiskStatus.NOT_ASSESSED);
    expect((afterCreateKyb.kybResult as { outcome: string }).outcome).toMatch(
      /^(LOW_RISK|HIGH_RISK|MANUAL_REVIEW)$/,
    );

    await request(app.getHttpServer())
      .patch(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ ownerName: 'Jane Updated' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/submit`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);

    const afterSubmitKyb = await waitForKyb(app, salesToken, appId);
    expect(afterSubmitKyb.kybCheckStatus).toBe('completed');
    expect(
      (afterSubmitKyb.kybResult as { submissionVersion: number })
        .submissionVersion,
    ).toBe(2);

    const reviewerALogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reviewer@example.com', password: PASSWORD })
      .expect(201);
    const reviewerAId = reviewerALogin.body.user.id as string;

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/update-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', riskStatus: RiskStatus.LOW })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewerId: reviewerAId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/update-status`)
      .set('Authorization', `Bearer ${reviewerBToken}`)
      .send({ status: 'approved', riskStatus: RiskStatus.LOW })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/update-status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'approved', riskStatus: RiskStatus.LOW })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/update-status`)
      .set('Authorization', `Bearer ${reviewerAToken}`)
      .send({ status: 'info_requested', notes: 'Need bank letter' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ averageTicketSize: '80.00' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/submit`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(201);

    await waitForKyb(app, salesToken, appId);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewerId: reviewerAId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/merchant-application/${appId}/update-status`)
      .set('Authorization', `Bearer ${reviewerAToken}`)
      .send({
        status: 'approved',
        riskStatus: RiskStatus.LOW,
        notes: 'Looks good',
      })
      .expect(201);

    const finalRes = await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    expect(finalRes.body.status).toBe('approved');

    const auditRes = await request(app.getHttpServer())
      .get(`/api/merchant-application/${appId}/audit-logs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(3);
    const created = auditRes.body.find(
      (e: { action: string }) => e.action === 'application.created',
    );
    expect(created).toBeDefined();
    expect(created.metadata.contactEmail).toMatch(/\*\*\*@/);
    expect(created.metadata.password).toBeUndefined();
    expect(created.metadata.accessToken).toBeUndefined();
  });
});
