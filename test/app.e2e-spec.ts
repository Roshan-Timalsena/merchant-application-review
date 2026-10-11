import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('App (e2e)', () => {
  let app: INestApplication;

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

  it('GET /api/health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: { body: { status: string; timestamp: string } }) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
      });
  });

  it('POST /api/auth/register and login', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'password123';

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.user.email).toBe(email);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    expect(loginRes.body.accessToken).toBeDefined();
  });
});
