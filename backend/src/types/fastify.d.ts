import type { AppPermission } from "../auth/permissions.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermissions: (
      permissions: readonly AppPermission[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: string;
      permissions: AppPermission[];
      email: string;
    };
    user: {
      sub: string;
      role: string;
      permissions: AppPermission[];
      email: string;
    };
  }
}
