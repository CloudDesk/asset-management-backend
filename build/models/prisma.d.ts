import { PrismaClient, Prisma } from '@prisma/client';
declare global {
    var __prisma: PrismaClient | undefined;
}
declare const prisma: PrismaClient<Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export { prisma };
//# sourceMappingURL=prisma.d.ts.map