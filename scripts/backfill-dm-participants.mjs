#!/usr/bin/env node
/**
 * One-time (re-runnable) backfill for rules-level DM privacy.
 *
 * WHY: DM privacy is now enforced in firestore.rules using two fields that older
 * message docs don't have:
 *   - `isDm`         (boolean)  — true for direct messages, false for channel msgs
 *   - `participants` (string[]) — the two member uids of a DM conversation
 * The new client queries filter by these (`isDm == false` / `participants
 * array-contains uid`), and the rules can only prove a read is allowed when the
 * query carries them. Existing docs therefore become unreadable/invisible until
 * they are backfilled. Run this ONCE after deploying indexes and BEFORE (or right
 * alongside) deploying the tightened rules + new app build. Safe to re-run.
 *
 * A doc is classified as a DM when it has a truthy `conversationId`; participants
 * are derived from that id (`[uidA, uidB].sort().join('_')`, so `.split('_')`
 * recovers the pair). Everything else is a channel message (`isDm = false`).
 *
 * USAGE
 *   npm i -D firebase-admin           # if not already installed
 *   # auth: either set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON,
 *   # or pass --key=./serviceAccountKey.json
 *   node scripts/backfill-dm-participants.mjs --project=<your-project-id> [--dry-run]
 *   node scripts/backfill-dm-participants.mjs --project=<id> --purge-orphans  # delete DM docs whose workspace is gone
 *
 * FLAGS
 *   --project=<id>     Firebase project id (or set GOOGLE_CLOUD_PROJECT)
 *   --key=<path>       Path to a service-account key JSON (else app-default creds)
 *   --dry-run          Report what would change; write nothing
 *   --purge-orphans    Also delete DM message docs whose workspace doc no longer exists
 */

import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const DRY_RUN = !!args['dry-run'];
const PURGE_ORPHANS = !!args['purge-orphans'];
const PROJECT = args.project || process.env.GOOGLE_CLOUD_PROJECT;
const KEY_PATH = args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (KEY_PATH && typeof KEY_PATH === 'string') {
  const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT || serviceAccount.project_id
  });
} else {
  // Application Default Credentials (e.g. `gcloud auth application-default login`)
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
}

const db = admin.firestore();
const BATCH_LIMIT = 400; // Firestore caps a batch at 500 ops; stay under it.

async function run() {
  console.log(`\n🔧 DM-privacy backfill${DRY_RUN ? ' (DRY RUN)' : ''} on project "${PROJECT || '(default)'}"\n`);

  const snap = await db.collection('messages').get();
  console.log(`Scanned ${snap.size} message docs.`);

  // Cache workspace existence lookups for --purge-orphans.
  const workspaceExists = new Map();
  async function wsExists(id) {
    if (!id) return false;
    if (workspaceExists.has(id)) return workspaceExists.get(id);
    const doc = await db.collection('workspaces').doc(id).get();
    workspaceExists.set(id, doc.exists);
    return doc.exists;
  }

  let updated = 0, skipped = 0, purged = 0;
  let batch = db.batch();
  let ops = 0;

  async function flush() {
    if (ops === 0) return;
    if (!DRY_RUN) await batch.commit();
    batch = db.batch();
    ops = 0;
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const isDm = !!data.conversationId;

    // --purge-orphans: drop DM docs whose workspace no longer exists (unreachable
    // under the strict rules anyway — the owner can't read them to clean up).
    if (PURGE_ORPHANS && isDm && !(await wsExists(data.workspaceId))) {
      console.log(`  🗑️  orphan DM ${doc.id} (workspace ${data.workspaceId} gone)`);
      if (!DRY_RUN) { batch.delete(doc.ref); ops++; }
      purged++;
      if (ops >= BATCH_LIMIT) await flush();
      continue;
    }

    const wantParticipants = isDm ? String(data.conversationId).split('_') : null;
    const alreadyCorrect =
      data.isDm === isDm &&
      (!isDm ||
        (Array.isArray(data.participants) &&
          data.participants.length === wantParticipants.length &&
          wantParticipants.every((p) => data.participants.includes(p))));

    if (alreadyCorrect) { skipped++; continue; }

    const patch = { isDm };
    if (isDm) patch.participants = wantParticipants;
    batch.update(doc.ref, patch);
    ops++;
    updated++;
    if (ops >= BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(`\n✅ Done. updated=${updated} skipped(already-correct)=${skipped} purged=${purged}${DRY_RUN ? '  (dry run — nothing written)' : ''}\n`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
