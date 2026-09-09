import "dotenv/config";
import { getPrisma } from "../src/lib/db";
import { backfillClientsFromAppointments } from "../src/lib/booking/clients";

async function main() {
  const db = getPrisma();
  const result = await backfillClientsFromAppointments(db);
  console.log(result);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
