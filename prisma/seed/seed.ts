import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { join } from 'path';
import { parseCsv } from './utils/parse';
import { tables } from './config';
import { getColumnTypes, seedManualTable } from './utils/db';

async function main() {
   for (const tableName of tables) {
      const filePath = join(__dirname, 'rawData', `./${tableName}.csv`);
      const columnTypes = await getColumnTypes(tableName);
      const rawData = await parseCsv(filePath, columnTypes);
      if (rawData.length === 0) {
         continue;
      }
      await seedManualTable({
         data: rawData,
         tableName,
      });
   }
}

main()
   .then(async () => {
      await prisma.$disconnect();
   })
   .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
   });
