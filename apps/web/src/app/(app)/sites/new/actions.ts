'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
import { getDatabaseUrl } from '@/lib/env';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// /tech/civil-category/* と同じ工種区分コードのみを許可する（クライアント入力の
// 任意文字列がそのまま work_types 配列へ混入するのを防ぐ、フォームなのでホワイトリスト化）。
const KNOWN_WORK_TYPES = new Set([
  'port', 'river', 'road', 'bridge', 'tunnel', 'foundation', 'earthwork',
  'dredging', 'concrete', 'maintenance', 'repair', 'disaster-prevention', 'environment'
]);

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export async function createSite(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const codeRaw = String(formData.get('code') ?? '').trim();
  const code = codeRaw === '' ? null : codeRaw;

  const workTypes = formData.getAll('workTypes')
    .map(v => String(v))
    .filter(v => KNOWN_WORK_TYPES.has(v));

  const conditions: Record<string, number> = {};
  const marineWaveM = parseOptionalNumber(formData.get('marineWaveM'));
  const groundN = parseOptionalNumber(formData.get('groundN'));
  const yardM2 = parseOptionalNumber(formData.get('yardM2'));
  if (marineWaveM !== null) conditions.marine_wave_m = marineWaveM;
  if (groundN !== null) conditions.ground_n = groundN;
  if (yardM2 !== null) conditions.yard_m2 = yardM2;

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 登録者は認証Cookieから解決する（フォーム値は信用しない）
  const me = await requireCurrentDbUser(db);

  const siteId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  // 現場登録と監査ログ記録を原子的に行う
  const sql = getRawSql(dbUrl);
  await sql.transaction([
    sql`insert into sites (id, code, name, work_types, conditions)
        values (${siteId}, ${code}, ${name}, ${workTypes}::text[], ${JSON.stringify(conditions)}::jsonb)`,
    sql`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
        values (${auditId}, ${me.id}, 'create', 'site', ${siteId}, 'success', ${JSON.stringify({ name, workTypes })}::jsonb)`
  ]);

  revalidatePath('/sites/new');
  revalidatePath('/sites');
  redirect(`/sites/${siteId}/issue`);
}
