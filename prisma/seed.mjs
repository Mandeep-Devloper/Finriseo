// Seeds the Lender table with the initial loan partners.
// Run via `npx prisma db seed` (configured in package.json) or `node prisma/seed.mjs`.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const lenders = [
  {
    name: 'Partner A',
    interestRate: 10.49,
    tenureMonths: 36,
    processingFee: '1.5%',
    color: '#0369a1',
    minIncome: 0,
    maxMultiplier: 10,
    active: true,
    priority: 30,
  },
  {
    name: 'Partner B',
    interestRate: 11.25,
    tenureMonths: 24,
    processingFee: '2.0%',
    color: '#4338ca',
    minIncome: 0,
    maxMultiplier: 10,
    active: true,
    priority: 20,
  },
  {
    name: 'Partner C',
    interestRate: 12.0,
    tenureMonths: 48,
    processingFee: '1.0%',
    color: '#059669',
    minIncome: 0,
    maxMultiplier: 10,
    active: true,
    priority: 10,
  },
];

async function main() {
  for (const lender of lenders) {
    // Idempotent: update if a lender with this name exists, else create.
    const existing = await db.lender.findFirst({ where: { name: lender.name } });
    if (existing) {
      await db.lender.update({ where: { id: existing.id }, data: lender });
    } else {
      await db.lender.create({ data: lender });
    }
  }
  const count = await db.lender.count();
  console.log(`✔ Seeded lenders. Total lenders in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
