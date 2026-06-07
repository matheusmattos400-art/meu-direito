import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma singleton.
 *
 * Em desenvolvimento, o hot-reload pode recriar o cliente a cada alteração;
 * guardamos a instância em globalThis para evitar esgotar o pool de conexões.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
