import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new Error('Unauthorized');
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      
      const user = request.user as any;
      
      if (!user || !user.role) {
        return reply.code(403).send({ error: 'Access denied: No role found' });
      }
      
      if (!allowedRoles.includes(user.role)) {
        return reply.code(403).send({ 
          error: 'Access denied: Insufficient permissions',
          required: allowedRoles,
          current: user.role
        });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };
}
