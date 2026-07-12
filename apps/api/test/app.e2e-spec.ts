import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end tests. Requires DATABASE_URL and REDIS_URL pointing at running
 * services (docker compose up -d postgres redis) with migrations applied.
 */
describe('AKILI API (e2e)', () => {
  let app: INestApplication;
  const email = `e2e-${Date.now()}@akili.test`;
  const password = 'E2eTest@1234';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health -> reports dependency health', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.data.checks.database).toBe('up');
  });

  it('POST /api/v1/auth/register -> creates an account and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'E2e', lastName: 'Tester' })
      .expect(201);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('POST /api/v1/auth/register -> rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'E2e', lastName: 'Tester' })
      .expect(409);
  });

  it('POST /api/v1/auth/login -> rejects wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);
  });

  it('POST /api/v1/auth/login -> succeeds with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('GET /api/v1/auth/me -> returns the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.planTier).toBe('FREE');
  });

  it('GET /api/v1/auth/me -> rejects missing token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('POST /api/v1/auth/refresh -> rotates the refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(res.body.data.accessToken).toBeDefined();
    // Old refresh token is now revoked
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/mood -> logs a mood entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ score: 7, emotions: ['calm'], factors: ['sleep'] })
      .expect(201);
    expect(res.body.data.score).toBe(7);
  });

  it('POST /api/v1/mood -> validates score bounds', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ score: 15 })
      .expect(400);
  });

  it('GET /api/v1/mood/stats -> returns aggregates', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mood/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.totalEntries).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/journal -> creates an entry with sentiment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/journal')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Grateful', content: 'I feel happy and grateful today.' })
      .expect(201);
    expect(res.body.data.sentimentScore).toBeGreaterThan(0);
  });

  it('GET /api/v1/therapists -> lists approved therapists publicly', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/therapists').expect(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('GET /api/v1/admin/users -> denies regular users', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('POST /api/v1/auth/logout -> revokes the refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
