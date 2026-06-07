import type { FastifyReply, FastifyRequest } from 'fastify'

export interface JwtPayload {
  sub: string        // user id
  email: string
  deviceId?: string
  iat: number
  exp: number
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    await reply.status(401).send({
      error: 'Unauthorized',
      message: 'Valid authentication token required',
    })
  }
}

export function getCurrentUser(request: FastifyRequest): JwtPayload {
  return request.user as JwtPayload
}
