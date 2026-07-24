/**
 * Bulk import of the All-India PIN-code directory into public.pincodes.
 *
 * Zero runtime dependencies beyond @prisma/client (already installed). Reads the
 * official India Post CSV, parses it safely (RFC-4180 quoting — the source has
 * ~140 office names with embedded commas), and inserts in batches with
 * skipDuplicates so the whole run is idempotent and re-runnable.
 *
 *   node --env-file=.env scripts/import-pincodes.mjs
 *   npm run db:import-pincodes
 *
 * Options (env):
 *   PINCODE_CSV        path to the CSV (default: prisma/data/pincodes.csv)
 *   PINCODE_CSV_URL    download source used only when the file is missing
 *   PINCODE_BATCH_SIZE rows per insert   (default: 2000)
 *
 * The CSV is gitignored (~19 MB); if absent it is downloaded from PINCODE_CSV_URL.
 */
import { PrismaClient } from '@prisma/client';
import { createWriteStream } from 'node:fs';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const CSV_PATH = process.env.PINCODE_CSV || 'prisma/data/pincodes.csv';
const CSV_URL =
  process.env.PINCODE_CSV_URL ||
  'https://raw.githubusercontent.com/saravanakumargn/All-India-Pincode-Directory/master/all-india-pincode-html-csv.csv';
const BATCH_SIZE = Number(process.env.PINCODE_BATCH_SIZE) || 2000;
const MAX_RETRIES = 3;

// Same rule as src/lib/pincode.ts PINCODE_REGEX — real Indian PINs never lead with 0.
const PINCODE_REGEX = /^[1-9]\d{5}$/;

// Source header → our column. Header-name driven, so column re-ordering upstream
// can't silently shift values into the wrong field.
const COLUMN_MAP = {
  officename: 'officeName',
  pincode: 'pincode',
  officetype: 'officeType',
  deliverystatus: 'deliveryStatus',
  divisionname: 'division',
  regionname: 'region',
  circlename: 'circle',
  taluk: 'taluk',
  districtname: 'district',
  statename: 'state',
};

const db = new PrismaClient();

/** Minimal RFC-4180 CSV parser: handles "quoted, fields", "" escapes, CR/LF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* ignore CR */ }
    else field += ch;
  }
  // trailing field/row with no final newline
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** 'NA', '' → null; otherwise trimmed value. */
function clean(value) {
  const v = (value ?? '').trim();
  return v === '' || v.toUpperCase() === 'NA' ? null : v;
}

async function ensureCsv() {
  try {
    await stat(CSV_PATH);
    return;
  } catch {
    /* missing → download */
  }
  console.log(`CSV not found at ${CSV_PATH} — downloading from:\n  ${CSV_URL}`);
  await mkdir(path.dirname(CSV_PATH), { recursive: true });
  const res = await fetch(CSV_URL);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(CSV_PATH));
  console.log('Download complete.');
}

/** Insert one batch with retry/backoff for transient DB errors. */
async function insertBatch(records) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { count } = await db.pincode.createMany({ data: records, skipDuplicates: true });
      return count;
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const backoff = 500 * attempt;
      console.warn(`  batch failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message} — retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

async function main() {
  await ensureCsv();

  console.log(`Reading ${CSV_PATH} …`);
  const rows = parseCsv(await readFile(CSV_PATH, 'utf8'));
  if (rows.length < 2) throw new Error('CSV has no data rows');

  // Map headers (lower-cased) to our field names by position.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const fieldByIndex = header.map((h) => COLUMN_MAP[h] ?? null);
  for (const required of ['pincode', 'officeName', 'district', 'state']) {
    if (!fieldByIndex.includes(required)) {
      throw new Error(`CSV is missing a column that maps to "${required}". Headers seen: ${header.join(', ')}`);
    }
  }

  const total = rows.length - 1;
  const seen = new Set();       // (pincode|officeName) dedupe — avoids ON CONFLICT intra-batch errors
  let skippedInvalid = 0;
  let skippedDup = 0;
  let inserted = 0;
  let processed = 0;
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    inserted += await insertBatch(batch);
    batch = [];
    const pct = ((processed / total) * 100).toFixed(1);
    console.log(`  ${processed}/${total} (${pct}%) — inserted ${inserted}, skipped ${skippedDup} dup / ${skippedInvalid} invalid`);
  };

  for (let r = 1; r < rows.length; r++) {
    processed++;
    const cols = rows[r];
    const rec = {};
    fieldByIndex.forEach((f, i) => { if (f) rec[f] = cols[i]; });

    const pincode = (rec.pincode ?? '').trim();
    const officeName = clean(rec.officeName);
    const district = clean(rec.district);
    const state = clean(rec.state);

    if (!PINCODE_REGEX.test(pincode) || !officeName || !district || !state) {
      skippedInvalid++;
      continue;
    }
    const key = `${pincode}|${officeName}`;
    if (seen.has(key)) { skippedDup++; continue; }
    seen.add(key);

    batch.push({
      pincode,
      officeName,
      district,
      state,
      circle: clean(rec.circle),
      region: clean(rec.region),
      division: clean(rec.division),
      taluk: clean(rec.taluk),
      officeType: clean(rec.officeType),
      deliveryStatus: clean(rec.deliveryStatus),
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  const dbCount = await db.pincode.count();
  console.log('\n✅ Import complete');
  console.log(`   parsed ${total} rows → inserted ${inserted}, ${skippedDup} in-file dups, ${skippedInvalid} invalid`);
  console.log(`   pincodes table now holds ${dbCount} rows`);
}

main()
  .catch((err) => {
    console.error('\n❌ Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
