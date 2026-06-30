// Bootstrap / invite an admin user. This is how the FIRST admin (the owner) gets
// access — there is deliberately no public admin signup. It also doubles as a
// CLI to add further admins/agents if you prefer the terminal to the in-panel
// invite flow (Phase 5).
//
// What it does:
//   1. Creates (or reuses) a Firebase Auth user for the email.
//   2. Upserts the AdminUser row (email, firebaseUid, name, role, active=true) —
//      this DB row is the source of truth for authorization.
//   3. Prints a Firebase password-RESET link the owner uses to set their password.
//
// Usage (note the `--` so npm passes the flags through):
//   npm run admin:create -- --email=owner@finriseo.com --name="Owner Name"
//   npm run admin:create -- --email=ops@finriseo.com   --name="Ops"  --role=ADMIN
//   npm run admin:create -- --email=agent@finriseo.com --name="Agent" --role=AGENT
//
// Optional: --password=... sets a password directly (otherwise use the link).
// Default role is SUPER_ADMIN (intended for the very first bootstrap).
//
// Requires the same server env as the app (FIREBASE_* + DATABASE_URL). The npm
// script loads .env via Node's --env-file.

import { PrismaClient } from '@prisma/client';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'AGENT'];

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv);
const email = (args.email ?? '').trim().toLowerCase();
const name = (args.name ?? '').trim();
const role = (args.role ?? 'SUPER_ADMIN').trim().toUpperCase();
const password = args.password;

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail('Provide a valid --email=... (e.g. --email=owner@finriseo.com)');
}
if (!name) fail('Provide --name="Full Name"');
if (!VALID_ROLES.includes(role)) {
  fail(`--role must be one of ${VALID_ROLES.join(', ')} (got "${role}")`);
}

for (const k of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'DATABASE_URL']) {
  if (!process.env[k]) fail(`Missing required env ${k}. Run via "npm run admin:create" so .env is loaded.`);
}

function adminApp() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = new PrismaClient();

async function main() {
  const auth = getAuth(adminApp());

  // 1. Create or reuse the Firebase user.
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`• Firebase user already exists (uid ${user.uid}).`);
    if (password) {
      await auth.updateUser(user.uid, { password });
      console.log('• Password updated.');
    }
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      user = await auth.createUser({
        email,
        displayName: name,
        emailVerified: false,
        ...(password ? { password } : {}),
      });
      console.log(`• Created Firebase user (uid ${user.uid}).`);
    } else {
      throw err;
    }
  }

  // 2. Upsert the AdminUser row (DB = source of truth for role + active).
  const adminUser = await db.adminUser.upsert({
    where: { email },
    update: { firebaseUid: user.uid, name, role, active: true },
    create: { email, firebaseUid: user.uid, name, role, active: true },
  });
  console.log(`• AdminUser upserted: ${adminUser.email} → ${adminUser.role} (active).`);

  // 3. Password-set link (unless a password was supplied directly).
  if (!password) {
    try {
      const link = await auth.generatePasswordResetLink(email);
      console.log('\n→ Send this password-set link to the admin (single use):\n');
      console.log(`  ${link}\n`);
    } catch (err) {
      console.warn(
        `\n! Could not generate a password link (${err?.code ?? 'unknown'}). ` +
          'Set a password from the Firebase console, or re-run with --password=...\n'
      );
    }
  }

  console.log('✔ Done. The admin can now sign in at /admin/login.');
}

main()
  .catch((e) => {
    console.error('\n✖ admin:create failed:', e?.message ?? e, '\n');
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
