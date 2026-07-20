import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

// Owner-only fixture route used to prove RolesGuard denies teachers.
@Controller('rbac-fixture')
class RbacFixtureController {
  @Roles('OWNER')
  @Get('owner-only')
  ownerOnly() {
    return { ok: true };
  }
}

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;

const ownerRegistration = {
  name: 'Owner Olena',
  workspaceName: 'E2E SpeakWise',
  email: emailFor('owner'),
  password: 'correct horse battery staple',
};

describe('Auth + Workspace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacFixtureController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Remove everything created by this run (FK-safe order).
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      include: { memberships: true },
    });
    const userIds = users.map((user) => user.id);
    const workspaceIds = [
      ...new Set(
        users.flatMap((user) => user.memberships.map((m) => m.workspaceId)),
      ),
    ];
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  describe('health', () => {
    it('stays public', async () => {
      await server().get('/api/health').expect(200).expect({ status: 'ok' });
    });
  });

  describe('register', () => {
    it('creates the user, workspace and owner membership atomically', async () => {
      const response = await server()
        .post('/api/auth/register')
        .send(ownerRegistration)
        .expect(201);

      expect(response.body.role).toBe('OWNER');
      expect(response.body.user.email).toBe(ownerRegistration.email);
      expect(response.body.workspace).toMatchObject({
        name: ownerRegistration.workspaceName,
        plan: 'FREE',
        defaultCurrency: 'EUR',
        cancellationDeadlineHours: 24,
      });
      expect(response.body.tokens.accessToken).toEqual(expect.any(String));
      expect(response.body.tokens.refreshToken).toEqual(expect.any(String));
      // Secret fields never leave the API.
      expect(JSON.stringify(response.body)).not.toContain('Hash');

      const user = await prisma.user.findUnique({
        where: { email: ownerRegistration.email },
        include: { memberships: { include: { workspace: true } } },
      });
      expect(user).not.toBeNull();
      expect(user?.memberships).toHaveLength(1);
      expect(user?.memberships[0]?.role).toBe('OWNER');
      expect(user?.memberships[0]?.workspace.name).toBe(
        ownerRegistration.workspaceName,
      );
    });

    it('rejects a duplicate email with EMAIL_TAKEN', async () => {
      const response = await server()
        .post('/api/auth/register')
        .send({ ...ownerRegistration, workspaceName: 'Another Workspace' })
        .expect(409);
      expect(response.body.code).toBe('EMAIL_TAKEN');

      // The failed registration must not leave an orphaned workspace behind.
      const orphan = await prisma.workspace.findFirst({
        where: { name: 'Another Workspace' },
      });
      expect(orphan).toBeNull();
    });

    it('rejects invalid payloads and unknown properties', async () => {
      await server()
        .post('/api/auth/register')
        .send({ ...ownerRegistration, password: 'short' })
        .expect(400);
      await server()
        .post('/api/auth/register')
        .send({
          ...ownerRegistration,
          confirmPassword: ownerRegistration.password,
        })
        .expect(400);
    });
  });

  describe('login and me', () => {
    it('logs in and resolves /auth/me with the same context', async () => {
      const login = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: ownerRegistration.password,
        })
        .expect(200);

      const me = await server()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
        .expect(200);

      expect(me.body.user.email).toBe(ownerRegistration.email);
      expect(me.body.role).toBe('OWNER');
      expect(me.body.workspace.name).toBe(ownerRegistration.workspaceName);
      expect(me.body.tokens).toBeUndefined();
    });

    it('returns the same INVALID_CREDENTIALS body for unknown email and wrong password', async () => {
      const unknownEmail = await server()
        .post('/api/auth/login')
        .send({ email: emailFor('ghost'), password: 'whatever whatever' })
        .expect(401);
      const wrongPassword = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: 'wrong horse battery staple',
        })
        .expect(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(unknownEmail.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects protected routes without a token', async () => {
      await server().get('/api/auth/me').expect(401);
      await server().get('/api/workspaces/current').expect(401);
    });
  });

  describe('refresh rotation', () => {
    it('rotates tokens, rejects the rotated-away token and revokes on reuse', async () => {
      const login = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: ownerRegistration.password,
        })
        .expect(200);
      const firstRefreshToken = login.body.tokens.refreshToken;

      const rotated = await server()
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(200);
      const secondRefreshToken = rotated.body.tokens.refreshToken;
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // Replaying the rotated-away token revokes the whole session…
      const reuse = await server()
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(401);
      expect(reuse.body.code).toBe('INVALID_REFRESH_TOKEN');

      // …so even the newest token is now rejected.
      await server()
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session idempotently', async () => {
      const login = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: ownerRegistration.password,
        })
        .expect(200);
      const { refreshToken } = login.body.tokens;

      await server()
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(204);
      await server()
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      // Logging out again (or with garbage) still succeeds.
      await server()
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(204);
      await server()
        .post('/api/auth/logout')
        .send({ refreshToken: 'garbage' })
        .expect(204);
    });
  });

  describe('workspaces and roles', () => {
    it('returns the current workspace for an owner', async () => {
      const login = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: ownerRegistration.password,
        })
        .expect(200);

      const current = await server()
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
        .expect(200);
      expect(current.body.role).toBe('OWNER');
      expect(current.body.workspace.name).toBe(ownerRegistration.workspaceName);
    });

    it('lets an owner through an owner-only route and denies a teacher with FORBIDDEN', async () => {
      const ownerLogin = await server()
        .post('/api/auth/login')
        .send({
          email: ownerRegistration.email,
          password: ownerRegistration.password,
        })
        .expect(200);
      await server()
        .get('/api/rbac-fixture/owner-only')
        .set('Authorization', `Bearer ${ownerLogin.body.tokens.accessToken}`)
        .expect(200);

      // Seed a teacher directly: their only membership is TEACHER in the
      // owner's workspace.
      const teacherPassword = 'teacher passphrase long enough';
      const teacher = await prisma.user.create({
        data: {
          email: emailFor('teacher'),
          name: 'Teacher Taras',
          passwordHash: await hash(teacherPassword, {
            algorithm: 2,
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          }),
        },
      });
      await prisma.workspaceMember.create({
        data: {
          userId: teacher.id,
          workspaceId: ownerLogin.body.workspace.id,
          role: 'TEACHER',
        },
      });

      const teacherLogin = await server()
        .post('/api/auth/login')
        .send({ email: teacher.email, password: teacherPassword })
        .expect(200);
      expect(teacherLogin.body.role).toBe('TEACHER');

      const denied = await server()
        .get('/api/rbac-fixture/owner-only')
        .set('Authorization', `Bearer ${teacherLogin.body.tokens.accessToken}`)
        .expect(403);
      expect(denied.body.code).toBe('FORBIDDEN');

      // The teacher can still read shared workspace context.
      const teacherMe = await server()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${teacherLogin.body.tokens.accessToken}`)
        .expect(200);
      expect(teacherMe.body.workspace.id).toBe(ownerLogin.body.workspace.id);
    });
  });
});
