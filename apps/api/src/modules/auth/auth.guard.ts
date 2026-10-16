import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  createParamDecorator,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../../common/errors";
import { SessionService, type SessionContext } from "./session.service";

export const SESSION_COOKIE = "rp_session";
export const PENDING_COOKIE = "rp_pending";

type AuthedRequest = FastifyRequest & { auth?: SessionContext };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) throw new ApiException("unauthenticated", "Sign in to continue.");

    const session = await this.sessions.verify(raw);
    if (!session) throw new ApiException("unauthenticated", "Your session has expired.");

    req.auth = session;
    return true;
  }
}

export const CurrentSession = createParamDecorator((_data, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new ApiException("unauthenticated", "Sign in to continue.");
  return req.auth;
});
