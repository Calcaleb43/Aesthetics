import "dotenv/config";
import { getPrisma } from "../src/lib/db";

async function main() {
  const db = getPrisma();
  const [clients, appts, acuity] = await Promise.all([
    db.client.count(),
    db.appointment.count(),
    db.appointment.count({ where: { externalId: { startsWith: "acuity:" } } }),
  ]);
  console.log({ clients, appts, acuity });
  await db.$disconnect();
}

main();
