import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  Prisma,
  type User,
  type Workspace,
  type WorkspaceRole,
} from '@prisma/client';
import type {
  AuthMe,
  AuthSession,
  LoginDto,
  RegisterDto,
} from '@tutorio/validation';
import { PrismaService } from '../prisma/prisma.service';
import {
  emailTaken,
  invalidCredentials,
  invalidRefreshToken,
  sessionExpired,
} from './auth.errors';
import type { AuthenticatedUser } from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

// Parallel requests that hit an expired access token each try to rotate the
// same refresh token. The losers present the token that was rotated away a
// moment ago; within this window they receive the already-issued successor
// instead of being treated as a replay. Older tokens, or the previous token
// after the window, still revoke the session.
export const REFRESH_REUSE_GRACE_MS = 30_000;

type AuthSessionRow = Prisma.AuthSessionGetPayload<object>;
type LiveMembership = Prisma.WorkspaceMemberGetPayload<{
  include: { user: true; workspace: true };
}>;

@Injectable()
export class AuthService {
  // Verified against when the email is unknown so both branches cost one
  // argon2 verification and login timing does not reveal registered emails.
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      // User, workspace, owner membership and session are created atomically;
      // concurrent duplicate emails are settled by the unique constraint.
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: dto.email, passwordHash, name: dto.name },
        });
        const workspace = await tx.workspace.create({
          data: { name: dto.workspaceName, mode: dto.mode },
        });
        const membership = await tx.workspaceMember.create({
          data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
        });
        // Every workspace starts with a teaching profile for the owner so
        // enrollments/lessons can be created immediately (a solo tutor teaches).
        await tx.teacher.create({
          data: {
            workspaceId: workspace.id,
            fullName: user.name,
            workspaceMemberId: membership.id,
          },
        });
        const tokens = await this.createSession(
          tx,
          user.id,
          workspace.id,
          membership.role,
        );
        return this.toAuthSession(user, workspace, membership.role, tokens);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw emailTaken();
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const hashToCheck =
      user && !user.deletedAt ? user.passwordHash : await this.getDummyHash();
    const passwordValid = await this.passwords.verify(
      hashToCheck,
      dto.password,
    );
    if (!user || user.deletedAt || !passwordValid) {
      throw invalidCredentials();
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      include: { workspace: true },
    });
    if (!membership) {
      throw invalidCredentials();
    }

    const tokens = await this.createSession(
      this.prisma,
      user.id,
      membership.workspaceId,
      membership.role,
    );
    return this.toAuthSession(
      user,
      membership.workspace,
      membership.role,
      tokens,
    );
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw invalidRefreshToken();
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
    });
    if (!session || session.revokedAt) {
      throw invalidRefreshToken();
    }
    if (session.expiresAt <= new Date()) {
      throw sessionExpired();
    }

    const presentedHash = this.tokens.hashRefreshToken(refreshToken);
    if (presentedHash !== session.refreshTokenHash) {
      const successor = this.graceSuccessor(session, presentedHash);
      if (successor) {
        return this.issueSession(session, successor);
      }
      // A previously rotated token is being replayed — revoke the session.
      await this.revokeSession(session.id);
      throw invalidRefreshToken();
    }

    const membership = await this.findLiveMembership(session);
    if (!membership) {
      await this.revokeSession(session.id);
      throw invalidRefreshToken();
    }

    const rotatedAt = new Date();
    const newRefreshToken = this.tokens.signRefreshToken({
      userId: session.userId,
      sessionId: session.id,
      workspaceId: session.workspaceId,
      jti: this.tokens.successorJti(presentedHash),
      issuedAt: rotatedAt,
    });

    // Guarded update: rotation only succeeds if the stored hash still matches
    // the presented token, so concurrent rotations cannot both win.
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: presentedHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: this.tokens.hashRefreshToken(newRefreshToken),
        lastUsedAt: rotatedAt,
        expiresAt: new Date(rotatedAt.getTime() + this.tokens.refreshTtlMs),
      },
    });
    if (rotated.count === 0) {
      // A concurrent request rotated this token first: share its successor.
      const current = await this.prisma.authSession.findUnique({
        where: { id: session.id },
      });
      const successor =
        current && !current.revokedAt
          ? this.graceSuccessor(current, presentedHash)
          : null;
      if (current && successor) {
        return this.issueSession(current, successor, membership);
      }
      await this.revokeSession(session.id);
      throw invalidRefreshToken();
    }

    return this.toAuthSession(
      membership.user,
      membership.workspace,
      membership.role,
      {
        accessToken: this.signAccessTokenFor(session, membership.role),
        refreshToken: newRefreshToken,
      },
    );
  }

  // Re-derives the token that replaced `presentedHash` at the session's last
  // rotation. It matches the stored hash only when the presented token is the
  // immediate predecessor, and it is honoured only inside the grace window.
  private graceSuccessor(
    session: AuthSessionRow,
    presentedHash: string,
  ): string | null {
    if (Date.now() - session.lastUsedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
      return null;
    }
    const candidate = this.tokens.signRefreshToken({
      userId: session.userId,
      sessionId: session.id,
      workspaceId: session.workspaceId,
      jti: this.tokens.successorJti(presentedHash),
      issuedAt: session.lastUsedAt,
    });
    return this.tokens.hashRefreshToken(candidate) === session.refreshTokenHash
      ? candidate
      : null;
  }

  // Answers with the session's current refresh token and a fresh access
  // token, without rotating again.
  private async issueSession(
    session: AuthSessionRow,
    refreshToken: string,
    knownMembership?: LiveMembership,
  ): Promise<AuthSession> {
    const membership =
      knownMembership ?? (await this.findLiveMembership(session));
    if (!membership) {
      await this.revokeSession(session.id);
      throw invalidRefreshToken();
    }
    return this.toAuthSession(
      membership.user,
      membership.workspace,
      membership.role,
      {
        accessToken: this.signAccessTokenFor(session, membership.role),
        refreshToken,
      },
    );
  }

  private async findLiveMembership(
    session: AuthSessionRow,
  ): Promise<LiveMembership | null> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.workspaceId,
          userId: session.userId,
        },
      },
      include: { user: true, workspace: true },
    });
    if (
      !membership ||
      membership.user.deletedAt ||
      membership.workspace.deletedAt
    ) {
      return null;
    }
    return membership;
  }

  private signAccessTokenFor(
    session: AuthSessionRow,
    role: WorkspaceRole,
  ): string {
    return this.tokens.signAccessToken({
      userId: session.userId,
      sessionId: session.id,
      workspaceId: session.workspaceId,
      role,
    });
  }

  // Idempotent: revoking an unknown or already revoked session is a no-op.
  async logout(refreshToken: string): Promise<void> {
    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await this.revokeSession(payload.sid);
  }

  async me(auth: AuthenticatedUser): Promise<AuthMe> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: auth.workspaceId,
          userId: auth.userId,
        },
      },
      include: { user: true, workspace: true },
    });
    if (
      !membership ||
      membership.user.deletedAt ||
      membership.workspace.deletedAt
    ) {
      throw new UnauthorizedException();
    }
    return {
      user: this.toAuthUser(membership.user),
      workspace: this.toAuthWorkspace(membership.workspace),
      role: membership.role,
    };
  }

  private async createSession(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const refreshToken = this.tokens.signRefreshToken({
      userId,
      sessionId,
      workspaceId,
      jti: randomUUID(),
    });
    const accessToken = this.tokens.signAccessToken({
      userId,
      sessionId,
      workspaceId,
      role,
    });

    await db.authSession.create({
      data: {
        id: sessionId,
        userId,
        workspaceId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private revokeSession(sessionId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHashPromise ??= this.passwords.hash(randomUUID());
    return this.dummyHashPromise;
  }

  private toAuthUser(user: User) {
    return { id: user.id, email: user.email, name: user.name };
  }

  private toAuthWorkspace(workspace: Workspace) {
    return {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      mode: workspace.mode,
      defaultCurrency: workspace.defaultCurrency,
      cancellationDeadlineHours: workspace.cancellationDeadlineHours,
    };
  }

  private toAuthSession(
    user: User,
    workspace: Workspace,
    role: WorkspaceRole,
    tokens: { accessToken: string; refreshToken: string },
  ): AuthSession {
    return {
      tokens,
      user: this.toAuthUser(user),
      workspace: this.toAuthWorkspace(workspace),
      role,
    };
  }
}
