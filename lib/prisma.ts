import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Prisma 7 adapter requires an object with the database URL
const adapter = new PrismaBetterSqlite3({
  url: 'file:./dev.db',
});

export const prisma = new PrismaClient({ adapter });