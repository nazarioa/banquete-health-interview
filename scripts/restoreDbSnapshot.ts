import { PrismaClient } from "@prisma/client";
import { dbName, runCommand, seedDataDir } from "./utils"

// Need to connect to different database in order to drop the dev database
process.env.DATABASE_URL = 'postgresql://postgres:local@localhost:5442/postgres'
const db = new PrismaClient()

const resetDb = async () => {
    await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
    await db.$executeRawUnsafe(`CREATE DATABASE ${dbName}`)
}

const resetDbFromSnapshot = async () => {
    await resetDb()
    await runCommand(
        `docker run -e PGPASSWORD=local -v "${seedDataDir}:/tmp" --network host postgres:16 pg_restore --host=127.0.0.1 -p 5442 --disable-triggers --dbname=${dbName} --username=postgres /tmp/snapshot.sql`
    )
}

resetDbFromSnapshot()
    .then(() => {
        console.log('Database initialized successfully')
    })
    .catch((err) => {
        console.error(err)
    })
