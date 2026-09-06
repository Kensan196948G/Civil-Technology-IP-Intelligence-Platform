import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sql } from 'drizzle-orm';
import { fuseRrf, normalizeText, SEARCH_WEIGHTS, type RankedList } from '@/lib/search/rrf';
import { embedText, toPgVectorLiteral } from '@/lib/ai/embeddings';

// ハイブリッド検索API。docs/30-design/06-search-and-rag-design.md（ADR-0003）に基づき、
// ①構造検索（特許番号・NETIS番号の完全一致/前方一致）＋②字句検索（pg_trgm類似度）＋
// ③意味検索（pgvector, Voyage AI のコサイン距離）を RRF（Reciprocal Rank Fusion）で融合して返す。
//
// ③意味検索は VOYAGE_API_KEY 未設定時（本番APIキー未発行の間の既定動作）は
// embedText() が undefined を返すため、その場合は完全にスキップされ、①②のみで融合される
// （既存の /api/search のレスポンス形式・挙動は変えない）。

type SearchKind = 'patent' | 'paper' | 'netis' | 'tech';

interface ResultRow {
  kind: SearchKind;
  id: string;
  title: string;
}

const RESULT_LIMIT = 50;
const STRUCTURED_LIMIT = 10;
const LEXICAL_LIMIT_PER_TABLE = 30;
const SEMANTIC_LIMIT_PER_TABLE = 30;

function makeKey(kind: SearchKind, id: string): string {
  return `${kind}:${id}`;
}

export async function GET(req: Request) {
  // CodeRabbit指摘: 未認証アクセスを許していた。Cookie（デモ認証）を必須にする。
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'unauthenticated', message: 'ログインが必要です' }, { status: 401 });
  }

  const url = new URL(req.url);
  const qRaw = (url.searchParams.get('q') ?? '').trim();
  const db = getDb(getDatabaseUrl());

  if (!qRaw) {
    // 検索語未入力: 従来通り全種別横断で先頭 RESULT_LIMIT 件を返す（後方互換。RRF適用なし）。
    const rows = await db.execute(sql`
      select 'patent' as kind, id, title from patents
      union all
      select 'paper' as kind, id, title from papers
      union all
      select 'netis' as kind, id, name as title from netis_technologies
      union all
      select 'tech' as kind, id, name as title from technologies
      limit ${RESULT_LIMIT}
    `);
    return Response.json({
      query: qRaw,
      count: rows.rows.length,
      results: rows.rows,
      note: 'MVPデモ用の簡易検索です（検索語未入力のため全件表示）'
    });
  }

  // 字句検索側の正規化クエリ前処理（全半角統一・小文字化・空白圧縮）。
  // ①構造検索（特許番号・NETIS番号）は元の表記のまま（qRaw）で完全一致/前方一致させる。
  const qNorm = normalizeText(qRaw);
  const like = `%${qNorm}%`;
  const prefixLike = `${qRaw}%`;

  const [queryEmbedding, structured, patentLex, paperLex, netisLex, techLex] = await Promise.all([
    // ③意味検索用のクエリ埋め込み。VOYAGE_API_KEY未設定時（本番APIキー未発行の間の既定動作）は
    // undefined が返り、後段で意味検索そのものをスキップする（例外は投げない）。
    embedText(qRaw, { inputType: 'query' }),
    // ①構造検索: 特許番号・NETIS番号の完全一致/前方一致
    db.execute(sql`
      select 'patent' as kind, id, title
      from patents
      where publication_no = ${qRaw} or publication_no ilike ${prefixLike}
      union all
      select 'netis' as kind, id, name as title
      from netis_technologies
      where netis_no = ${qRaw} or netis_no ilike ${prefixLike}
      limit ${STRUCTURED_LIMIT}
    `),
    // ②字句検索（pg_trgm）: テーブルごとに similarity() でランク付けしてUNIONする。
    // トライグラムの類似度（%演算子）に加え、既存の部分一致挙動を退行させないよう
    // ILIKE も条件に含める（ILIKEのみ一致した行は sim が低い/NULL扱いで下位に並ぶ）。
    db.execute(sql`
      select id, title, similarity(title_norm, ctiip_text_norm(${qRaw})) as sim
      from patents
      where title_norm % ctiip_text_norm(${qRaw}) or title ilike ${like}
      order by sim desc nulls last, title asc
      limit ${LEXICAL_LIMIT_PER_TABLE}
    `),
    db.execute(sql`
      select id, title, similarity(title_norm, ctiip_text_norm(${qRaw})) as sim
      from papers
      where title_norm % ctiip_text_norm(${qRaw}) or title ilike ${like}
      order by sim desc nulls last, title asc
      limit ${LEXICAL_LIMIT_PER_TABLE}
    `),
    db.execute(sql`
      select id, name as title, similarity(name_norm, ctiip_text_norm(${qRaw})) as sim
      from netis_technologies
      where name_norm % ctiip_text_norm(${qRaw}) or name ilike ${like}
      order by sim desc nulls last, title asc
      limit ${LEXICAL_LIMIT_PER_TABLE}
    `),
    db.execute(sql`
      select id, name as title, similarity(name_norm, ctiip_text_norm(${qRaw})) as sim
      from technologies
      where name_norm % ctiip_text_norm(${qRaw}) or name ilike ${like}
      order by sim desc nulls last, title asc
      limit ${LEXICAL_LIMIT_PER_TABLE}
    `)
  ]);

  // SQLの行データを RankedList（IDの順位リスト）へ変換しつつ、表示用の行データを退避する。
  const rowsByKey = new Map<string, ResultRow>();

  function collect(kind: SearchKind, rows: Array<{ id: string; title: string }>): string[] {
    const ids: string[] = [];
    for (const r of rows) {
      const key = makeKey(kind, r.id);
      ids.push(key);
      if (!rowsByKey.has(key)) rowsByKey.set(key, { kind, id: r.id, title: r.title });
    }
    return ids;
  }

  const structuredRows = structured.rows as Array<{ kind: SearchKind; id: string; title: string }>;
  const structuredIds = structuredRows.map(r => {
    const key = makeKey(r.kind, r.id);
    if (!rowsByKey.has(key)) rowsByKey.set(key, { kind: r.kind, id: r.id, title: r.title });
    return key;
  });

  const lists: RankedList[] = [
    { name: 'structured', weight: SEARCH_WEIGHTS.structured, ids: structuredIds },
    { name: 'lexical:patents', weight: SEARCH_WEIGHTS.lexical, ids: collect('patent', patentLex.rows as Array<{ id: string; title: string }>) },
    { name: 'lexical:papers', weight: SEARCH_WEIGHTS.lexical, ids: collect('paper', paperLex.rows as Array<{ id: string; title: string }>) },
    { name: 'lexical:netis', weight: SEARCH_WEIGHTS.lexical, ids: collect('netis', netisLex.rows as Array<{ id: string; title: string }>) },
    { name: 'lexical:tech', weight: SEARCH_WEIGHTS.lexical, ids: collect('tech', techLex.rows as Array<{ id: string; title: string }>) }
  ];

  // ③意味検索（pgvector）: クエリ埋め込みが得られた場合（VOYAGE_API_KEY設定時）のみ実行する。
  // 未設定時は queryEmbedding が undefined のため、このブロックは丸ごとスキップされ、
  // 従来通り①②のみで融合される（挙動不変）。
  if (queryEmbedding) {
    const queryVector = toPgVectorLiteral(queryEmbedding);
    const [patentSem, paperSem, netisSem, techSem] = await Promise.all([
      db.execute(sql`
        select id, title
        from patents
        where embedding is not null
        order by embedding <=> ${queryVector}::vector
        limit ${SEMANTIC_LIMIT_PER_TABLE}
      `),
      db.execute(sql`
        select id, title
        from papers
        where embedding is not null
        order by embedding <=> ${queryVector}::vector
        limit ${SEMANTIC_LIMIT_PER_TABLE}
      `),
      db.execute(sql`
        select id, name as title
        from netis_technologies
        where embedding is not null
        order by embedding <=> ${queryVector}::vector
        limit ${SEMANTIC_LIMIT_PER_TABLE}
      `),
      db.execute(sql`
        select id, name as title
        from technologies
        where embedding is not null
        order by embedding <=> ${queryVector}::vector
        limit ${SEMANTIC_LIMIT_PER_TABLE}
      `)
    ]);
    lists.push(
      { name: 'semantic:patents', weight: SEARCH_WEIGHTS.semantic, ids: collect('patent', patentSem.rows as Array<{ id: string; title: string }>) },
      { name: 'semantic:papers', weight: SEARCH_WEIGHTS.semantic, ids: collect('paper', paperSem.rows as Array<{ id: string; title: string }>) },
      { name: 'semantic:netis', weight: SEARCH_WEIGHTS.semantic, ids: collect('netis', netisSem.rows as Array<{ id: string; title: string }>) },
      { name: 'semantic:tech', weight: SEARCH_WEIGHTS.semantic, ids: collect('tech', techSem.rows as Array<{ id: string; title: string }>) }
    );
  }

  // RRF融合（設計書§4.4）: rrf降順でソートされた {id, score} を、退避しておいた行データと結合する。
  const fused = fuseRrf(lists);
  const results = fused.slice(0, RESULT_LIMIT).map(({ id, score }) => ({
    ...rowsByKey.get(id)!,
    score
  }));

  const note = queryEmbedding
    ? 'ハイブリッド検索（①構造検索＋②字句検索[pg_trgm]＋③意味検索[pgvector, Voyage AI]をRRFで融合）。'
    : 'ハイブリッド検索（①構造検索＋②字句検索[pg_trgm]をRRFで融合）。③意味検索(pgvector)はVOYAGE_API_KEY未設定のため無効です。';

  return Response.json({
    query: qRaw,
    count: results.length,
    results,
    note
  });
}
