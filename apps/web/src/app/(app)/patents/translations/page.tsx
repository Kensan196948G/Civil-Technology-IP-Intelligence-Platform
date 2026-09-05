import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';

// M46 Multilingual Patent Intelligence — 特許の多言語翻訳（日英中韓ほか）を管理し、
// Claim 対訳・専門用語辞書の土台を提供する。

const LANG_META: Record<string, { label: string; icon: string }> = {
  ja: { label: '日本語', icon: '🇯🇵' },
  en: { label: '英語', icon: '🇺🇸' },
  de: { label: 'ドイツ語', icon: '🇩🇪' },
  zh: { label: '中国語', icon: '🇨🇳' },
  ko: { label: '韓国語', icon: '🇰🇷' },
  fr: { label: 'フランス語', icon: '🇫🇷' }
};

const PROVIDER_META: Record<string, { label: string }> = {
  deepseek: { label: 'DeepSeek（機械翻訳）' },
  claude: { label: 'Claude（機械翻訳）' },
  human: { label: '人手翻訳' },
  jpo_machine: { label: 'JPO 機械翻訳' }
};

const QUALITY_META: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'var(--ink-2)' },
  reviewed: { label: '要確認（機械翻訳）', color: 'var(--amber)' },
  certified: { label: '確認済み', color: 'var(--green)' }
};

export default async function TranslationsPage() {
  const db = getDb(getDatabaseUrl());
  const translations = await db.select().from(s.patentTranslations).orderBy(desc(s.patentTranslations.createdAt));
  const patentIds = [...new Set(translations.map(t => t.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const byLang: Record<string, number> = {};
  for (const t of translations) byLang[t.language] = (byLang[t.language] ?? 0) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>多言語特許翻訳</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M46 / MULTILINGUAL</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        海外特許の多言語翻訳（日英中韓ほか）を管理し、Claim 対訳・専門用語辞書の土台を提供します。
        機械翻訳の品質フラグ（下書き／要確認／確認済み）を管理し、専門家確認の要否を示します。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(LANG_META).map(([lang, meta]) => (
          <div key={lang} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 14 }}>{meta.icon}</span>
            <span className="mono" style={{ fontSize: 18, color: 'var(--blue)' }}>{byLang[lang] ?? 0}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {translations.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          多言語翻訳がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {translations.map(t => {
          const lang = LANG_META[t.language] ?? { label: t.language, icon: '🌐' };
          const quality = QUALITY_META[t.qualityFlag] ?? { label: t.qualityFlag, color: 'var(--ink-2)' };
          const patent = patentById.get(t.patentId);
          return (
            <div key={t.id} className="card" style={{ padding: '11px 15px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13 }}>{lang.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{lang.label}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</span>
                <span className="badge" style={{ color: quality.color, border: `1px solid ${quality.color}`, fontSize: 10, marginLeft: 'auto' }}>{quality.label}</span>
              </div>
              {patent && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>元特許: {patent.title}（{patent.country}）</div>}
              {t.claim1Text && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', paddingLeft: 8, borderLeft: '2px solid var(--line)' }}>Claim 1: {t.claim1Text.slice(0, 120)}{(t.claim1Text?.length ?? 0) > 120 ? '…' : ''}</div>}
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>翻訳: {PROVIDER_META[t.provider]?.label ?? t.provider}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
