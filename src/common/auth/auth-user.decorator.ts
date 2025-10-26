import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const AuthUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest?.();
  if (req && req.user) return req.user;

  const gql = GqlExecutionContext.create(ctx);
  const gctx = gql.getContext?.();
  if (gctx?.user) return gctx.user;

  return null;
});
