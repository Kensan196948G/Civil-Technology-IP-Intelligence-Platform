// MVP用ダミーデータ投入スクリプト。
// 実在の人物・企業・案件を一切含まない架空データのみを使用する。
// すべてのレコードに is_sample=true（相当）を付与し、MVP画面に「デモ用」表示を出す根拠とする。
import { Pool } from '@neondatabase/serverless';
import { randomUUID as uuid } from 'node:crypto';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');
  const pool = new Pool({ connectionString: url });
  const sql = (text: string, params: any[] = []) => pool.query(text, params);

  console.log('🧹 既存データをクリア中...');
  const tables = [
    'audit_logs','ai_citations','ai_runs','approvals','workflow_instances',
    'inventions','field_applications','site_issues','sites',
    'claim_chart_rows','claim_analyses','claim_elements','patent_claims','patents',
    'technologies','netis_technologies','papers','users','departments'
  ];
  for (const t of tables) await sql(`TRUNCATE TABLE ${t} CASCADE`);

  // 部署（8部署）
  const depts = [
    ['01', '経営・統治・委員会'], ['02', '営業・案件形成'], ['03', '施工・調達・作業所'],
    ['04', '技術・研究開発'], ['05', '安全・品質・環境'], ['06', '管理本部・経営企画'],
    ['07', '支店・営業支店・営業所'], ['08', '船舶事業部']
  ] as const;
  const deptIds: Record<string, string> = {};
  for (const [code, name] of depts) {
    const id = uuid(); deptIds[code] = id;
    await sql(`INSERT INTO departments (id, code, name) VALUES ($1,$2,$3)`, [id, code, name]);
  }

  // 利用者（デモ用の架空人物のみ）
  const userDefs = [
    ['tanaka.makoto@demo.ctiip.example', '田村 誠', 'tech_manager', '04'],
    ['takahashi.minoru@demo.ctiip.example', '高橋 実', 'ip', '04'],
    ['sato.ken@demo.ctiip.example', '佐藤 建', 'engineer', '03'],
    ['inoue.akira@demo.ctiip.example', '井上 章', 'rnd', '04'],
    ['yamamoto.kei@demo.ctiip.example', '山本 恵', 'executive', '01'],
    ['kondo.jun@demo.ctiip.example', '近藤 純', 'sysadmin', '06'],
    ['morita.yui@demo.ctiip.example', '森田 結', 'engineer', '08']
  ] as const;
  const userIds: Record<string, string> = {};
  for (const [email, name, role, dept] of userDefs) {
    const id = uuid(); userIds[email] = id;
    await sql(
      `INSERT INTO users (id, email, display_name, role, department_id) VALUES ($1,$2,$3,$4,$5)`,
      [id, email, name, role, deptIds[dept]]
    );
  }
  const U = (e: string) => userIds[e]!;

  // 特許（架空企業。実在企業を想起させない名称）
  const patentDefs = [
    { title: 'ケーソン据付装置および据付方法', applicant: '北浜重工デモ株式会社', ipc: ['E02B 3/06'], wt: ['port'], claims: [
      { no: 1, indep: true, text: 'ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と、前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、前記偏差を打ち消す向きに前記吊具を移動させる動揺補償機構と、を備える据付装置。' }
    ]},
    { title: '水中構造物の据付位置計測システム', applicant: '第一土木デモ建設株式会社', ipc: ['E02D 27/18'], wt: ['port','marine'], claims: [
      { no: 1, indep: true, text: '水中に沈設される構造物について、音響測位と慣性計測を併用して位置を求める計測システムであって、音響測位手段と慣性計測手段の出力を統合する統合処理手段を備える。' }
    ]},
    { title: '起重機船の動揺補償装置', applicant: '旭洋テクノデモ工業株式会社', ipc: ['B63B 27/10'], wt: ['marine'], claims: [
      { no: 1, indep: true, text: '波浪による船体の動揺を打ち消し、吊荷の対地位置を一定に保つ補償装置であって、船体の動揺を検出する検出手段と、吊荷の位置を補正する補正手段とを備える。' }
    ]}
  ];
  const patentIds: string[] = [];
  const claimIdByPatentClaim: Record<string, string> = {};
  const elementIdsByClaim: Record<string, string[]> = {};
  for (const p of patentDefs) {
    const pid = uuid(); patentIds.push(pid);
    await sql(
      `INSERT INTO patents (id, country, publication_no, title, abstract, applicant_name, application_date, publication_date, ipc_codes, work_types, classification, source, source_url, retrieved_at, is_sample)
       VALUES ($1,'JP',$2,$3,$4,$5,$6,$7,$8,$9,'C1','デモ用サンプルデータ',NULL, now(), true)`,
      [pid, `特開2024-${String(500000 + patentIds.length).slice(0,6)}`, p.title, p.title + 'に関する要約（デモ）。', p.applicant,
       '2023-06-01', '2024-03-12', p.ipc, p.wt]
    );
    for (const c of p.claims) {
      const cid = uuid();
      claimIdByPatentClaim[`${pid}:${c.no}`] = cid;
      await sql(`INSERT INTO patent_claims (id, patent_id, claim_no, is_independent, text) VALUES ($1,$2,$3,$4,$5)`,
        [cid, pid, c.no, c.indep, c.text]);
      // 構成要件へ分解（簡易）
      const segs = c.text.split('、');
      const els: string[] = [];
      let cursor = 0;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i]!;
        const start = c.text.indexOf(seg, cursor);
        const end = start + seg.length;
        cursor = end;
        const eid = uuid();
        els.push(eid);
        await sql(
          `INSERT INTO claim_elements (id, claim_id, seq, label, text, char_start, char_end) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [eid, cid, i + 1, String.fromCharCode(65 + i), seg, start, end]
        );
      }
      elementIdsByClaim[cid] = els;
    }
  }

  // 論文
  const paperDefs = [
    ['港湾工事における自動据付技術の適用性評価', '土木学会論文集 B3（海洋開発）デモ号'],
    ['動揺補償制御を用いた海上施工の高精度化', '海洋工学シンポジウムデモ予稿集']
  ];
  for (const [title, venue] of paperDefs) {
    await sql(
      `INSERT INTO papers (id, title, abstract, venue, published_on, source, source_url, retrieved_at, is_sample)
       VALUES ($1,$2,$3,$4,'2025-04-01','デモ用サンプルデータ',NULL, now(), true)`,
      [uuid(), title, title + 'についての要旨（デモ）。', venue]
    );
  }

  // NETIS
  const netisId = uuid();
  await sql(
    `INSERT INTO netis_technologies (id, netis_no, name, summary, category, registered_on, source, retrieved_at, is_sample)
     VALUES ($1,'KT-990000-A','GNSS併用ケーソン据付支援システム（デモ）','RTK-GNSSと傾斜計を併用し、据付位置をリアルタイム表示する支援システム（デモデータ）。','港湾・海洋','2023-09-01','デモ用サンプルデータ', now(), true)`,
    [netisId]
  );

  // 自社技術台帳
  const techId = uuid();
  await sql(
    `INSERT INTO technologies (id, kind, name, summary, applicable_conditions, work_types, maturity, classification, is_sample)
     VALUES ($1,'technology','ケーソン据付管理システム（自社保有・デモ）','当社が港湾工事で運用する据付管理技術のデモデータ。動揺補償は未実装。',$2,$3,'実用','C2', true)`,
    [techId, JSON.stringify({ marine_wave_limit_m: 1.5, ground_min_n: 10, yard_min_m2: 500 }), ['port','marine']]
  );
  const techId2 = uuid();
  await sql(
    `INSERT INTO technologies (id, kind, name, summary, applicable_conditions, work_types, maturity, classification, is_sample)
     VALUES ($1,'method','GNSS併用ケーソン据付支援システム（デモ）','NETIS登録技術のデモ複製。据付精度向上を目的とする。',$2,$3,'実用','C1', true)`,
    [techId2, JSON.stringify({ marine_wave_limit_m: 2.5, ground_min_n: 10, yard_min_m2: 800 }), ['port','marine']]
  );

  // Claim比較（1件目の特許 × 自社技術）
  const analysisId = uuid();
  await sql(`INSERT INTO claim_analyses (id, patent_id, technology_id) VALUES ($1,$2,$3)`,
    [analysisId, patentIds[0], techId]);
  const claim1 = claimIdByPatentClaim[`${patentIds[0]}:1`]!;
  const els = elementIdsByClaim[claim1]!;
  const rowDefs: Array<[number, string, 'match'|'similar'|'differ', string]> = [
    [1, '吊具＋姿勢計測（傾斜計・IMU）を搭載。同一構成。', 'match', 'AI判定'],
    [2, '偏差算出は行うが、目標位置は作業員が都度入力する方式。自動追従は未実装。', 'similar', '高橋（知財）が修正（デモ）'],
    [3, '該当構成なし。自社案は動揺補償機構を持たない。', 'differ', 'AI判定'],
  ];
  for (const [seq, ourText, kind, note] of rowDefs) {
    const el = els[seq - 1];
    if (!el) continue;
    await sql(
      `INSERT INTO claim_chart_rows (id, analysis_id, seq, element_id, our_text, kind, rationale, quoted_text, char_start, char_end, edited_by, edited_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,$9,now())`,
      [uuid(), analysisId, seq, el, ourText, kind, note, '（デモ原文抜粋）' + ourText.slice(0, 20), U('takahashi.minoru@demo.ctiip.example')]
    );
  }

  // 現場・課題・適用性評価
  const siteId = uuid();
  await sql(`INSERT INTO sites (id, code, name, work_types, conditions) VALUES ($1,'SITE-001','◯◯港 岸壁改良工事（デモ）',$2,$3)`,
    [siteId, ['port','marine'], JSON.stringify({ marine_wave_m: 2.0, ground_n: 14, yard_m2: 640 })]);
  const issueId = uuid();
  await sql(
    `INSERT INTO site_issues (id, site_id, body, photos, status, created_by) VALUES ($1,$2,$3,'{}','open',$4)`,
    [issueId, siteId, '波が高い日にケーソンの据付がなかなか決まらない。潜水士の目視だと2.0mを超えると中断になってしまって、工程が押している。（デモ課題）',
     U('sato.ken@demo.ctiip.example')]
  );
  const axes = [
    { axis: '工種適合性', value: 1.0, weight: 3, basis: '技術の工種分類「港湾・海洋」と現場が一致（デモ）', is_estimated: false },
    { axis: '海象', value: 0.6, weight: 3, basis: '現場の有義波高2.0mに対し、技術の適用限界は2.5m（デモ）', is_estimated: false },
    { axis: '地盤', value: 0.9, weight: 2, basis: 'N値14 ≧ 適用条件N値10（デモ）', is_estimated: false },
    { axis: '作業ヤード', value: 0.7, weight: 2, basis: '確保可能640m² ／ 必要800m²（デモ）', is_estimated: false },
    { axis: '工期', value: 0.5, weight: 2, basis: '導入教育に約2週間を要すると推定（デモ・AI推定）', is_estimated: true },
    { axis: 'コスト', value: 0.5, weight: 2, basis: '類似事例からの推定値（デモ・AI推定）', is_estimated: true },
    { axis: '安全', value: 0.9, weight: 3, basis: '遠隔監視により水際作業を削減（デモ）', is_estimated: false },
    { axis: '導入難易度', value: 0.6, weight: 1, basis: '社内実績0件のため初回は支援が必要（デモ）', is_estimated: false }
  ];
  const num = axes.reduce((s, a) => s + a.value * a.weight, 0);
  const den = axes.reduce((s, a) => s + a.weight, 0);
  const score = Math.round((num / den) * 100 * 100) / 100;
  await sql(
    `INSERT INTO field_applications (id, site_issue_id, candidate_type, candidate_id, score, axes, blockers)
     VALUES ($1,$2,'technology',$3,$4,$5,'[]')`,
    [uuid(), issueId, techId2, score, JSON.stringify(axes)]
  );

  // 発明届 → ワークフロー（AI模擬審査ステップ相当・人間確認未完了）
  const inventionId = uuid();
  await sql(
    `INSERT INTO inventions (id, title, summary, site_id, classification, submitted_by)
     VALUES ($1,$2,$3,$4,'C3',$5)`,
    [inventionId, '吊具姿勢の自動補正による据付精度の向上（デモ発明）',
     '現場の工夫を発明届として整理したデモデータ。', siteId, U('sato.ken@demo.ctiip.example')]
  );
  const wfId = uuid();
  await sql(
    `INSERT INTO workflow_instances (id, kind, subject_type, subject_id, title, status, classification, author_id, due_on, human_check_required, human_check_completed_at, ai_risk_summary)
     VALUES ($1,'invention','invention',$2,$3,'ip_review','C3',$4,'2026-08-28', true, NULL, $5)`,
    [wfId, inventionId, '吊具姿勢の自動補正による据付精度の向上（デモ発明）', U('sato.ken@demo.ctiip.example'),
     JSON.stringify({ novelty: 'low', inventive: 'medium', description: 'low', overlap: 'medium',
       note: '請求項1の構成B・Cについて先行文献Aとの技術的類似性が高いため専門家確認を推奨（デモ）' })]
  );
  // 2件目（自分が起案＝承認不可のデモ、知財担当 高橋 実 自身の案件）
  const inventionId2 = uuid();
  await sql(
    `INSERT INTO inventions (id, title, summary, site_id, classification, submitted_by)
     VALUES ($1,$2,$3,$4,'C3',$5)`,
    [inventionId2, '浚渫土砂の含水比推定手法（デモ発明）', 'デモデータ。', siteId, U('takahashi.minoru@demo.ctiip.example')]
  );
  await sql(
    `INSERT INTO workflow_instances (id, kind, subject_type, subject_id, title, status, classification, author_id, due_on, human_check_required, human_check_completed_at)
     VALUES ($1,'invention','invention',$2,$3,'ip_review','C3',$4,'2026-09-04', false, now())`,
    [uuid(), inventionId2, '浚渫土砂の含水比推定手法（デモ発明）', U('takahashi.minoru@demo.ctiip.example')]
  );
  // 3件目（現場導入・技術レビュー中）
  const faWfId = uuid();
  await sql(
    `INSERT INTO workflow_instances (id, kind, subject_type, subject_id, title, status, classification, author_id, due_on, human_check_required, human_check_completed_at)
     VALUES ($1,'field_adoption','field_application',$2,$3,'technical_review','C2',$4,'2026-08-25', false, now())`,
    [faWfId, uuid(), 'GNSS併用ケーソン据付支援システムの導入（デモ）', U('sato.ken@demo.ctiip.example')]
  );

  // AI実行と根拠（Provenance の実演）
  const runId = uuid();
  await sql(`INSERT INTO ai_runs (id, kind, status, target_type, target_id, model) VALUES ($1,'examine','succeeded','invention',$2,'demo-model-v1')`,
    [runId, inventionId]);
  await sql(
    `INSERT INTO ai_citations (id, ai_run_id, source_type, source_id, quoted_text) VALUES ($1,$2,'patent',$3,$4)`,
    [uuid(), runId, patentIds[0], '（デモ原文抜粋）ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と']
  );

  // 監査ログ
  await sql(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, result, meta) VALUES ($1,$2,'seed','system',NULL,'success','{"note":"MVPデモデータ投入"}')`,
    [uuid(), U('kondo.jun@demo.ctiip.example')]
  );

  await pool.end();
  console.log('✅ シード完了');
  console.log(`   部署 ${depts.length} / 利用者 ${userDefs.length} / 特許 ${patentDefs.length} / 論文 ${paperDefs.length}`);
  console.log(`   NETIS 1 / 自社技術 2 / Claim比較 1件（要件${rowDefs.length}） / 現場適用スコア ${score}`);
  console.log(`   ワークフロー案件 3件（発明2・現場導入1） / AI実行1（根拠付き）`);
}

main().catch(e => { console.error('❌ シード失敗:', e); process.exit(1); });
