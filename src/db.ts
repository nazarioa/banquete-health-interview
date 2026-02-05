import {PrismaClient} from "@prisma/client";

process.env.DATABASE_URL = 'postgresql://postgres:local@localhost:5442/dev'
export const db = new PrismaClient();
