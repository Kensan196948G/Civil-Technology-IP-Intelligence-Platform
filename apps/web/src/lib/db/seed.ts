// MVP用ダミーデータ投入スクリプト。
// 実在の人物・企業・案件を一切含まない架空データのみを使用する。
// すべてのレコードに is_sample=true（相当）を付与し、MVP画面に「デモ用」表示を出す根拠とする。
import { randomUUID as uuid } from 'node:crypto';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');

  // CodeRabbit指摘: このスクリプトは全業務テーブルを TRUNCATE する破壊的操作。
  // 誤って本番/共有DBに向けて実行しないよう、明示的な opt-in を必須にする。
  if (process.env.CTIIP_ALLOW_SEED_TRUNCATE !== 'true') {
    throw new Error(
      'このスクリプトは既存データを全て削除して再投入します（破壊的操作）。\n' +
      '意図した接続先であることを確認したうえで、環境変数 CTIIP_ALLOW_SEED_TRUNCATE=true を設定して再実行してください。\n' +
      '対象DB: ' + url.replace(/:[^:@]+@/, ':***@')
    );
  }
  // CodeRabbit指摘: prod/productionという文字列を「含まない」ことに依存した判定は、
  // 命名規則に従わない共有DB/本番DBを誤って通してしまう。ホスト名とDB名の完全一致による
  // 許可リストへ変更し、明示的に許可された接続先以外はすべて拒否する（fail closed）。
  const parsed = new URL(url.replace('postgresql://', 'postgres://'));
  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '');
  const allowedHost = process.env.CTIIP_SEED_ALLOWED_HOST;
  const allowedDb = process.env.CTIIP_SEED_ALLOWED_DB;
  if (!allowedHost || !allowedDb) {
    throw new Error(
      '安全確認のため、環境変数 CTIIP_SEED_ALLOWED_HOST と CTIIP_SEED_ALLOWED_DB の設定が必須です。\n' +
      '（このスクリプトが対象として良い接続先を、ホスト名・DB名の完全一致で明示してください）\n' +
      '現在の接続先: host=' + host + ' db=' + dbName
    );
  }
  if (host !== allowedHost || dbName !== allowedDb) {
    throw new Error(
      '接続先が許可リストと一致しません。安全のため中止しました。\n' +
      '接続先: host=' + host + ' db=' + dbName + '\n' +
      '許可リスト: host=' + allowedHost + ' db=' + allowedDb
    );
  }

  // postgres.js (TCPドライバ) を使用して接続する（ローカルPostgreSQL対応）
  // max: 1 にすることで、sql.unsafe で BEGIN/COMMIT を直接実行できる
  // （postgres.jsは複数接続時の手動トランザクションを安全のため拒否するため）
  const pg = postgres(url, { max: 1 });
  // 既存の client.query(text, params) 呼び出しと互換性を持たせる
  const client: any = {
    query: (text: string, params: any[] = []) => pg.unsafe(text, params),
    release: () => {}
  };
  // 既存の sql(text, params) 呼び出しと互換性を持たせる
  const sql = (text: string, params: any[] = []) => pg.unsafe(text, params);

  try {
    await client.query('BEGIN');

    console.log('🧹 既存データをクリア中... (接続先: ' + host + ')');
    const tables = [
      'audit_logs','ai_citations','ai_runs','approvals','workflow_instances',
      'inventions','field_applications','site_issues','sites',
      'claim_chart_rows','claim_analyses','claim_elements','patent_claims','patents',
      'technologies','netis_technologies','papers',
      'researchers','competitors','investigations','watches','licenses','reports',
      'feature_flags','settings','users','departments',
      // 第一拡張群（M26-M36・M33/M30/M32）
      'patent_citations','prosecution_events','fto_cases','fto_components','poc_experiments',
      'ip_entities','entity_aliases',
      'kg_edges','claim_versions','ip_value_scores',
      'patent_families','patent_family_members',
      'standards','technology_standards',
      'safety_reviews'
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
    { title: 'ケーソン据付装置および据付方法', applicant: '北浜重工デモ株式会社', country: 'JP', pubNo: '特開2024-500001', ipc: ['E02B 3/06'], wt: ['port'], claims: [
      { no: 1, indep: true, text: 'ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と、前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、前記偏差を打ち消す向きに前記吊具を移動させる動揺補償機構と、を備える据付装置。' }
    ]},
    { title: '水中構造物の据付位置計測システム', applicant: '第一土木デモ建設株式会社', country: 'JP', pubNo: '特開2024-500002', ipc: ['E02D 27/18'], wt: ['port','marine'], claims: [
      { no: 1, indep: true, text: '水中に沈設される構造物について、音響測位と慣性計測を併用して位置を求める計測システムであって、音響測位手段と慣性計測手段の出力を統合する統合処理手段を備える。' }
    ]},
    { title: '起重機船の動揺補償装置', applicant: '旭洋テクノデモ工業株式会社', country: 'JP', pubNo: '特開2024-500003', ipc: ['B63B 27/10'], wt: ['marine'], claims: [
      { no: 1, indep: true, text: '波浪による船体の動揺を打ち消し、吊荷の対地位置を一定に保つ補償装置であって、船体の動揺を検出する検出手段と、吊荷の位置を補正する補正手段とを備える。' }
    ]},
    { title: 'Method for autonomous marine pile driving alignment', applicant: 'Northport Marine Robotics Demo Inc.', country: 'US', pubNo: 'US2024/0123456A1', ipc: ['E02D 7/00'], wt: ['port','marine'], claims: [
      { no: 1, indep: true, text: 'A system comprising a pile guide frame, a positioning sensor array, and a control unit configured to align the pile axis with a target trajectory using real-time feedback.' }
    ]},
    { title: 'Verfahren zur automatisierten Tunnelvortriebssteuerung', applicant: 'Alpenbau Tunneltechnik Demo GmbH', country: 'EP', pubNo: 'EP4123456A1', ipc: ['E21D 9/00'], wt: ['tunnel'], claims: [
      { no: 1, indep: true, text: 'Ein Verfahren zur Steuerung einer Tunnelbohrmaschine, umfassend die Erfassung der Vortriebsrichtung mittels Lasermessung und die automatische Korrektur der Schneidkopfausrichtung.' }
    ]},
    { title: '一种用于桥梁健康监测的传感器融合方法（演示）', applicant: '华东桥梁科技演示有限公司', country: 'CN', pubNo: 'CN117123456A', ipc: ['G01M 5/00'], wt: ['bridge'], claims: [
      { no: 1, indep: true, text: '一种桥梁健康监测方法，包括布置于桥梁关键部位的振动传感器阵列，以及将多传感器数据融合以评估结构疲劳状态的处理单元。' }
    ]},
    // M31: 特許0（ケーソン据付装置・JP）を親とする同一発明の多国出願（PCT→米国移行）
    { title: 'ケーソン据付装置（PCT国際出願・デモ）', applicant: '北浜重工デモ株式会社', country: 'WO', pubNo: 'WO2024/500001A1', ipc: ['E02B 3/06'], wt: ['port'], claims: [
      { no: 1, indep: true, text: 'ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と、前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、を備える、ケーソン据付装置（PCT出願・デモ）。' }
    ]},
    { title: 'CAISSON PLACEMENT APPARATUS (US national phase)', applicant: 'KITAHAMA JUKO DEMO CO., LTD.', country: 'US', pubNo: 'US2025/500001A1', ipc: ['E02B 3/06'], wt: ['port'], claims: [
      { no: 1, indep: true, text: 'A caisson placement apparatus comprising a lifting tool for suspending a caisson, a measuring means for measuring an attitude of the lifting tool, and a computing means for computing a deviation from a target placement position based on an output of the measuring means (US national phase, demo).' }
    ]}
  ];
  const patentIds: string[] = [];
  const claimIdByPatentClaim: Record<string, string> = {};
  const elementIdsByClaim: Record<string, string[]> = {};
  for (const p of patentDefs) {
    const pid = uuid(); patentIds.push(pid);
    await sql(
      `INSERT INTO patents (id, country, publication_no, title, abstract, applicant_name, application_date, publication_date, ipc_codes, work_types, classification, source, source_url, retrieved_at, is_sample)
       VALUES ($1,$10,$2,$3,$4,$5,$6,$7,$8,$9,'C1','デモ用サンプルデータ',NULL, now(), true)`,
      [pid, p.pubNo, p.title, p.title + 'に関する要約（デモ）。', p.applicant,
       '2023-06-01', '2024-03-12', p.ipc, p.wt, p.country]
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
  const paperIds: string[] = [];
  for (const [title, venue] of paperDefs) {
    const pid = uuid(); paperIds.push(pid);
    await sql(
      `INSERT INTO papers (id, title, abstract, venue, published_on, source, source_url, retrieved_at, is_sample)
       VALUES ($1,$2,$3,$4,'2025-04-01','デモ用サンプルデータ',NULL, now(), true)`,
      [pid, title, title + 'についての要旨（デモ）。', venue]
    );
  }

  // 特許引用関係（M26 Patent Citation Intelligence）
  // 後方引用(backward)・NPL引用(npl)のデモエッジ。前方引用は登録後に他特許が引用した際に付与される想定。
  const citationDefs: Array<[number, string, number | 'paper0' | 'paper1', string]> = [
    [0, 'backward', 2, '審査官引用（デモ）'],
    [0, 'npl', 'paper0', '技術論文を根拠に引用（デモ）'],
    [1, 'backward', 0, '自社先行特許を引用（デモ）'],
    [2, 'backward', 1, '基本特許として引用（デモ）'],
    [3, 'npl', 'paper1', '制御方式の学術的背景（デモ）'],
    [4, 'backward', 0, '同一発明者の周辺特許（デモ）']
  ];
  for (const [srcIdx, kind, tgt, note] of citationDefs) {
    let citedPatent: string | null = null;
    let citedPaper: string | null = null;
    if (tgt === 'paper0') citedPaper = paperIds[0]!;
    else if (tgt === 'paper1') citedPaper = paperIds[1]!;
    else citedPatent = patentIds[tgt as number]!;
    await sql(
      `INSERT INTO patent_citations (id, source_patent_id, kind, cited_patent_id, cited_paper_id, note, is_sample)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [uuid(), patentIds[srcIdx]!, kind, citedPatent, citedPaper, note]
    );
  }

  // FTO / Clearance 予備調査（M28。AI類似度は侵害判断ではない＝表示注記は画面側で強制）
  const ftoCaseDefs = [
    {
      title: 'ケーソン据付装置のFTO予備調査（デモ）',
      description: '新規開発する動揺補償付き据付装置。制御・油圧・位置検出・施工方法・安全制御の5構成に分解して照合する（デモ）',
      status: 'in_review',
      components: [
        { label: 'A 制御装置', desc: '据付目標との偏差を打ち消す制御演算', patentIdx: 0, claim: '1', sim: 86, action: 'must_review', note: '制御演算が他社 Claim1 と近接。要専門確認' },
        { label: 'B 油圧機構', desc: '吊具を動かす油圧アクチュエータ', patentIdx: 4, claim: '3', sim: 74, action: 'confirm', note: '油圧系統の構成は公知例も多く要確認' },
        { label: 'C 位置検出', desc: 'RTK-GNSS・傾斜計による姿勢計測', patentIdx: 2, claim: '5', sim: 68, action: 'confirm', note: '計測センサ併用方式は参考レベル' },
        { label: 'D 施工方法', desc: '据付手順と作業管理のフロー', patentIdx: null, claim: null, sim: null, action: 'none', note: '関連特許なし（現状）' },
        { label: 'E 安全制御', desc: '過負荷・過変位時の自動停止', patentIdx: 1, claim: '2', sim: 42, action: 'reference', note: '安全停止の一般要件に近い' }
      ]
    },
    {
      title: '水中点検ロボットのFTO予備調査（デモ）',
      description: '港湾構造物の水中部材を対象にした点検ロボット（デモ）',
      status: 'completed',
      components: [
        { label: 'A 推進機構', desc: '水中スラスタによる移動制御', patentIdx: 3, claim: '1', sim: 82, action: 'must_review', note: '推進制御が他社 Claim1 と近接。要専門確認' },
        { label: 'B 撮像系', desc: 'ROV搭載カメラと照明', patentIdx: null, claim: null, sim: null, action: 'none', note: '関連特許なし（現状）' },
        { label: 'C 損傷検出', desc: 'AIによるひび割れ判定', patentIdx: 0, claim: '2', sim: 55, action: 'reference', note: '画像解析の一般手法に近い' }
      ]
    }
  ] as const;
  for (const f of ftoCaseDefs) {
    const caseId = uuid();
    await sql(
      `INSERT INTO fto_cases (id, title, description, status, created_by, is_sample) VALUES ($1,$2,$3,$4,$5,true)`,
      [caseId, f.title, f.description, f.status, U('takahashi.minoru@demo.ctiip.example')]
    );
    let seq = 1;
    for (const c of f.components) {
      await sql(
        `INSERT INTO fto_components
           (id, fto_case_id, seq, label, description, related_patent_id, claim_no, ai_similarity, action_level, note, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
        [uuid(), caseId, seq, c.label, c.desc,
         c.patentIdx == null ? null : patentIds[c.patentIdx]!,
         c.claim, c.sim, c.action, c.note]
      );
      seq += 1;
    }
  }

  // 特許庁審査経過（M27。出願→審査請求→拒絶理由→補正→意見書→登録）
  const prosecutionDefs: Array<[number, string, string, string]> = [
    [0, '2023-11-01', 'application', '特許出願（デモ）'],
    [0, '2024-02-10', 'exam_request', '審査請求（デモ）'],
    [0, '2024-06-20', 'rejection', '拒絶理由通知: 請求項1-3が引用文献1（北浜重工デモ特許）に対して進歩性なし（デモ）'],
    [0, '2024-08-05', 'amendment', '補正: 請求項1に「港湾構造物」「GPSにより位置を取得し」「油圧アクチュエータによって」の限定を追加（デモ）'],
    [0, '2024-08-05', 'opinion', '意見書: 補正後の構成と引用文献との技術的相違を主張（デモ）'],
    [0, '2025-01-15', 'registration', '特許登録（デモ）'],
    [1, '2024-03-12', 'application', '特許出願（デモ）'],
    [1, '2024-05-30', 'exam_request', '審査請求（デモ）'],
    [1, '2024-10-02', 'rejection', '拒絶理由通知: 新規性なし（デモ）'],
    [1, '2024-12-18', 'amendment', '補正: 請求項を限定（デモ）']
  ];
  for (const [pidx, date, kind, desc] of prosecutionDefs) {
    await sql(
      `INSERT INTO prosecution_events (id, patent_id, occurred_on, kind, description, is_sample)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [uuid(), patentIds[pidx]!, date, kind, desc]
    );
  }

  // IPエンティティ（出願人名寄せ・企業グループ。M29）
  const entityDefs = [
    {
      canonical: '北浜重工デモ株式会社', kind: 'company', parent: null,
      country: null,
      aliases: ['北浜重工デモ（株）', 'KITAHAMA JUKO DEMO CO., LTD.', '北浜重工デモ']
    },
    {
      canonical: '北浜重工デモグループ', kind: 'group', parent: null,
      country: null,
      aliases: ['北浜重工デモグループ（本社）']
    },
    {
      canonical: '第一土木デモ建設株式会社', kind: 'company', parent: null,
      country: null,
      aliases: ['第一土木デモ建設（株）', 'DAIICHI DOBOKU DEMO CONSTRUCTION CO., LTD.']
    },
    {
      canonical: '旭洋テクノデモ工業株式会社', kind: 'company', parent: null,
      country: null,
      aliases: ['旭洋テクノデモ（株）']
    },
    {
      canonical: 'Northport Marine Robotics Demo Inc.', kind: 'company', country: 'US',
      aliases: ['Northport Marine Robotics Demo', 'ノースポート・マリンロボティクスデモ（米国）']
    }
  ] as const;
  const entityIdByCanonical: Record<string, string> = {};
  for (const e of entityDefs) {
    const eid = uuid(); entityIdByCanonical[e.canonical] = eid;
    await sql(
      `INSERT INTO ip_entities (id, kind, canonical_name, country, parent_entity_id, note, is_sample)
       VALUES ($1,$2,$3,$4,NULL,'デモ名寄せエンティティ',true)`,
      [eid, e.kind, e.canonical, e.country ?? null]
    );
    for (const alias of e.aliases) {
      await sql(`INSERT INTO entity_aliases (id, entity_id, alias, is_sample) VALUES ($1,$2,$3,true)`,
        [uuid(), eid, alias]);
    }
  }
  // グループ親子関係の例（親: 北浜重工デモグループ → 子: 北浜重工デモ株式会社）
  await sql(`UPDATE ip_entities SET parent_entity_id = $1 WHERE id = $2`,
    [entityIdByCanonical['北浜重工デモグループ']!, entityIdByCanonical['北浜重工デモ株式会社']!]);

  // NETIS
  const netisId = uuid();
  await sql(
    `INSERT INTO netis_technologies (id, netis_no, name, summary, category, registered_on, source, retrieved_at, is_sample)
     VALUES ($1,'KT-990000-A','GNSS併用ケーソン据付支援システム（デモ）','RTK-GNSSと傾斜計を併用し、据付位置をリアルタイム表示する支援システム（デモデータ）。','港湾・海洋','2023-09-01','デモ用サンプルデータ', now(), true)`,
    [netisId]
  );
  await sql(
    `INSERT INTO netis_technologies (id, netis_no, name, summary, category, registered_on, source, retrieved_at, is_sample)
     VALUES ($1,'KK-000000-B','浚渫土砂の含水比自動計測装置（デモ）','浚渫土砂の含水比を現場でリアルタイム計測し、処分方法の判断を支援する装置のデモデータ。','土工・浚渫','2022-11-15','デモ用サンプルデータ', now(), true)`,
    [uuid()]
  );

  // 自社技術台帳
  const techId = uuid();
  await sql(
    `INSERT INTO technologies (id, kind, name, summary, applicable_conditions, work_types, maturity, classification, is_sample)
     VALUES ($1,'technology','ケーソン据付管理システム（自社保有・デモ）','当社が港湾工事で運用する据付管理技術のデモデータ。動揺補償は未実装。',$2::jsonb,$3,'実用','C2', true)`,
    [techId, { marine_wave_limit_m: 1.5, ground_min_n: 10, yard_min_m2: 500 }, ['port','marine']]
  );
  const techId2 = uuid();
  await sql(
    `INSERT INTO technologies (id, kind, name, summary, applicable_conditions, work_types, maturity, classification, is_sample)
     VALUES ($1,'method','GNSS併用ケーソン据付支援システム（デモ）','NETIS登録技術のデモ複製。据付精度向上を目的とする。',$2::jsonb,$3,'実用','C1', true)`,
    [techId2, { marine_wave_limit_m: 2.5, ground_min_n: 10, yard_min_m2: 800 }, ['port','marine']]
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
  await sql(`INSERT INTO sites (id, code, name, work_types, conditions) VALUES ($1,'SITE-001','◯◯港 岸壁改良工事（デモ）',$2,$3::jsonb)`,
    [siteId, ['port','marine'], { marine_wave_m: 2.0, ground_n: 14, yard_m2: 640 }]);
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
  // CodeRabbit指摘: 生成したIDを保持せず、下流のワークフローが別のIDを
  // subject_id に設定していたため、存在しない field_application を参照するバグがあった。
  const fieldApplicationId = uuid();
  await sql(
    `INSERT INTO field_applications (id, site_issue_id, candidate_type, candidate_id, score, axes, blockers)
     VALUES ($1,$2,'technology',$3,$4,$5::jsonb,'[]'::jsonb)`,
    [fieldApplicationId, issueId, techId2, score, axes]
  );

  // PoC / 実証実験（M36。失敗PoCも知見として記録する）
  const pocDefs = [
    {
      title: 'ケーソン据付 動揺補償装置の現地PoC（デモ）',
      hypothesis: '有義波高2.0m超の波浪下でも、動揺補償付き吊具なら潜水士中断なしで据付を続けられる',
      kpis: { '据付可能な波高上限_m': 2.5, '潜水士水際作業_h/基': 0.5, '据付サイクル_h/基': 4.0 },
      before: '潜水士の目視誘導による従来据付（波高2.0m超で中断）',
      after: '動揺補償付き吊具＋遠隔計測による据付（デモ技術: ケーソン据付装置）',
      cost: 8000000, result: 'success',
      lesson: '2.0〜2.3mの波浪下で作業継続できた。残課題は強風時の吊荷のふれまわり（実証データ: デモ）'
    },
    {
      title: '水中部材点検AIの適用性PoC（デモ）',
      hypothesis: 'ROV動画からのAI損傷検出で、潜水士目視点検の3割を代替できる',
      kpis: { '検出適合率': 0.82, '点検時間削減率': 0.3 },
      before: '潜水士による目視・打音点検', after: 'ROV動画＋AI損傷検出', cost: 3500000, result: 'partial_success',
      lesson: '照度が十分なら適合率0.8超。夜間・濁度大は精度低下（デモ）'
    },
    {
      title: '養生コンクリート温度AI制御のPoC（デモ）',
      hypothesis: '給熱量をAI制御すれば品質ばらつきを減らしつつ燃料を削減できる',
      kpis: { '強度ばらつき_Cv': 0.08, '燃料削減率': 0.15 },
      before: 'タイマーによる定時給熱養生', after: '温度センサ＋AI給熱制御', cost: 1200000, result: 'failed',
      lesson: '養生初期の外気温急変への追随が遅れ強度Cvが目標未達。センサ配置と応答ゲインを再設計して再PoC（デモ）'
    }
  ] as const;
  for (const p of pocDefs) {
    await sql(
      `INSERT INTO poc_experiments
         (id, title, hypothesis, kpis, before_method, after_method, cost_yen, result, lesson, site_issue_id, created_by, is_sample)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,true)`,
      [uuid(), p.title, p.hypothesis, p.kpis, p.before, p.after, p.cost, p.result, p.lesson, issueId,
       U('inoue.akira@demo.ctiip.example')]
    );
  }

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
     VALUES ($1,'invention','invention',$2,$3,'ip_review','C3',$4,'2026-08-28', true, NULL, $5::jsonb)`,
    [wfId, inventionId, '吊具姿勢の自動補正による据付精度の向上（デモ発明）', U('sato.ken@demo.ctiip.example'),
     { novelty: 'low', inventive: 'medium', description: 'low', overlap: 'medium',
       note: '請求項1の構成B・Cについて先行文献Aとの技術的類似性が高いため専門家確認を推奨（デモ）' }]
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
    [faWfId, fieldApplicationId, 'GNSS併用ケーソン据付支援システムの導入（デモ）', U('sato.ken@demo.ctiip.example')]
  );

  // AI実行と根拠（Provenance の実演。異なる機能から呼ばれたAI実行を横断的に一覧できることを示す）
  const runId = uuid();
  await sql(`INSERT INTO ai_runs (id, kind, status, target_type, target_id, model) VALUES ($1,'examine','succeeded','invention',$2,'demo-model-v1')`,
    [runId, inventionId]);
  await sql(
    `INSERT INTO ai_citations (id, ai_run_id, source_type, source_id, quoted_text) VALUES ($1,$2,'patent',$3,$4)`,
    [uuid(), runId, patentIds[0], '（デモ原文抜粋）ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と']
  );
  const claimCompareRunId = uuid();
  await sql(`INSERT INTO ai_runs (id, kind, status, target_type, target_id, model) VALUES ($1,'claim_compare','succeeded','claim_analysis',$2,'demo-model-v1')`,
    [claimCompareRunId, analysisId]);
  await sql(
    `INSERT INTO ai_citations (id, ai_run_id, source_type, source_id, quoted_text) VALUES ($1,$2,'patent',$3,$4)`,
    [uuid(), claimCompareRunId, patentIds[0], '（デモ原文抜粋）前記偏差を打ち消す向きに前記吊具を移動させる動揺補償機構と、を備える据付装置。']
  );
  const fieldScoreRunId = uuid();
  await sql(`INSERT INTO ai_runs (id, kind, status, target_type, target_id, model) VALUES ($1,'field_score','succeeded','field_application',$2,'demo-model-v1')`,
    [fieldScoreRunId, fieldApplicationId]);
  await sql(
    `INSERT INTO ai_citations (id, ai_run_id, source_type, source_id, quoted_text) VALUES ($1,$2,'technology',$3,$4)`,
    [uuid(), fieldScoreRunId, techId2, '（デモ原文抜粋）NETIS登録技術のデモ複製。据付精度向上を目的とする。']
  );

  // 発明者・研究者（M02/M07/M10で利用）
  const researcherDefs = [
    ['吉田 淳', '当社 技術研究所（デモ）', '港湾・海洋工学'],
    ['金子 遥', '当社 技術研究所（デモ）', '地盤工学'],
    ['大野 修', '国立海洋土木大学デモ校', 'ロボティクス'],
    ['清水 彩', '国立海洋土木大学デモ校', '構造ヘルスモニタリング'],
    ['Chen Wei', 'Pacific Coastal Engineering Demo Univ.', 'Autonomous Construction'],
    ['橋本 涼', '当社 技術研究所（デモ）', 'ICT施工']
  ] as const;
  const researcherIds: string[] = [];
  for (const [name, affiliation, field] of researcherDefs) {
    const id = uuid(); researcherIds.push(id);
    await sql(`INSERT INTO researchers (id, name, affiliation, field) VALUES ($1,$2,$3,$4)`, [id, name, affiliation, field]);
  }

  // ---- M31 Advanced Patent Family Intelligence（第一拡張群・実装順位6）----
  // 同一発明の多国出願をファミリーとして保持する（JP優先権出願 → PCT → 各国移行）。
  // 特許0（ケーソン据付装置・JP）を親とし、特許6（PCT）・特許7（US移行）が同一ファミリー。
  // デモのため国別の残存期間は特許の application_date から導出する（FR-M31-001/002）。
  const familyId = uuid();
  await sql(`INSERT INTO patent_families (id, name, note, is_sample) VALUES ($1,$2,$3,true)`,
    [familyId, 'ケーソン据付装置 特許ファミリー（デモ）', 'JP優先権出願を親とする同一発明の国際出願ファミリー（FR-M31 デモ）']);
  const familyMemberDefs: Array<[number, string, string]> = [
    [0, 'priority', '優先権出願（JP・親出願）'],
    [6, 'pct', 'PCT国際出願（WO）'],
    [7, 'national_phase', '米国移行（US national phase）']
  ];
  for (const [pidx, kind, note] of familyMemberDefs) {
    await sql(
      `INSERT INTO patent_family_members (id, family_id, patent_id, member_kind, note, is_sample)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [uuid(), familyId, patentIds[pidx]!, kind, note]
    );
  }

  // ---- M34 Standards & Specification Intelligence（第一拡張群・実装順位6）----
  // 規格台帳（JIS/ISO/国交省要領・設計施工基準/発注仕様/安全基準）と技術⇔規格の関連。
  // FR-M34-001（台帳・版管理）/003（関連付け・適用可否メモ）/004（収集元・版の記録）。
  const standardDefs = [
    { kind: 'jis', code: 'JIS A 5308', title: 'レディーミクストコンクリート', summary: '生コンクリートの品質・試験方法・検査を定めるJIS（デモデータ）。', version: '2023', issuedOn: '2023-03-25', source: 'JIS ハンドブック（デモ）', sourceUrl: null },
    { kind: 'iso', code: 'ISO 9001', title: '品質マネジメントシステム－要求事項', summary: '品質マネジメントの国際規格（デモデータ）。', version: '2015', issuedOn: '2015-09-15', source: 'ISO 公式（デモ）', sourceUrl: null },
    { kind: 'mlit_manual', code: '港湾の施設の技術上の基準', title: '港湾施設の設計・施工に関する技術基準', summary: '港湾構造物（ケーソン・岸壁等）の設計施工基準（デモデータ）。', version: '2023', issuedOn: '2023-04-01', source: '国交省 港湾局（デモ）', sourceUrl: null },
    { kind: 'mlit_manual', code: 'NETIS 評価制度 要領', title: '新技術情報提供システム（NETIS）評価・活用要領', summary: 'NETIS 登録技術の評価・活用に関する要領（デモデータ）。', version: 'Rev.11', issuedOn: '2022-10-01', source: '国交省（デモ）', sourceUrl: null },
    { kind: 'spec', code: '◯◯港 岸壁改良工事 特記仕様書', title: '発注仕様書（仮称・デモ）', summary: '発注者から提示される特記仕様書（デモデータ）。', version: 'Rev.2', issuedOn: '2024-06-01', source: '発注者（デモ）', sourceUrl: null },
    { kind: 'safety', code: '土木工事安全施工技術基準', title: '土木工事の安全施工技術基準', summary: '土木工事の安全確保に関する技術基準（デモデータ）。', version: '2023', issuedOn: '2023-04-01', source: '国交省（デモ）', sourceUrl: null }
  ] as const;
  const standardIdByCode: Record<string, string> = {};
  for (const st of standardDefs) {
    const sid = uuid(); standardIdByCode[st.code] = sid;
    await sql(
      `INSERT INTO standards (id, kind, code, title, summary, version, issued_on, source, source_url, retrieved_at, is_sample)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), true)`,
      [sid, st.kind, st.code, st.title, st.summary, st.version, st.issuedOn, st.source, st.sourceUrl]
    );
  }
  // 技術⇔規格の関連（適用可否と判断メモ。適用可否の最終判断は人）
  const techStdDefs: Array<[string, string, string, string]> = [
    [techId, 'JIS A 5308', 'conditional', 'ケーソン中詰めコンクリートの配合検討に適用（デモ）'],
    [techId, '港湾の施設の技術上の基準', 'applicable', '据付精度の基準適合を確認済み（デモ）'],
    [techId2, 'NETIS 評価制度 要領', 'applicable', 'NETIS 登録技術として評価対象（デモ）'],
    [techId2, '土木工事安全施工技術基準', 'conditional', '安全ゲート（M38）で要確認（デモ）']
  ];
  for (const [tech, code, applicability, memo] of techStdDefs) {
    await sql(
      `INSERT INTO technology_standards (id, technology_id, standard_id, applicability, memo, is_sample)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [uuid(), tech, standardIdByCode[code]!, applicability, memo]
    );
  }

  // ---- M38 Safety & Quality Intelligence（第一拡張群・実装順位8）----
  // 新技術導入前の安全ゲート。リスク候補と出典を保持し、M22 承認フローの安全ゲートへ連携する。
  // FR-M38-001（リスク収集）/003（出典必須）/004（最終判断は安全・品質担当者）。
  const safetyReviewDefs: Array<{
    techKey: string; gate: string; comment: string;
    risks: Array<{ type: string; detail: string; source: string; level: string }>;
    sources: string[];
  }> = [
    {
      techKey: 'techId2',
      gate: 'in_review',
      comment: '安全ゲート審査中（デモ）。海上作業の高所作業・波浪条件を要確認',
      risks: [
        { type: '高所作業', detail: 'ケーソン上の作業員の転落リスク。手すり・命綱の設置可否', source: '土木工事安全施工技術基準（デモ・M34規格）', level: 'high' },
        { type: '波浪・気象', detail: '有義波高2.0m超での作業中断基準の適用', source: '類似工事の事故・中断事例（デモ）', level: 'medium' },
        { type: '機械・設備', detail: '計測機器の電源・通信断による誤表示リスク', source: 'NETIS事後評価・論文（デモ）', level: 'medium' }
      ],
      sources: ['土木工事安全施工技術基準（M34規格）', '類似海上工事の不具合事例（デモ）', 'NETIS 登録情報（デモ）']
    },
    {
      techKey: 'techId',
      gate: 'cleared',
      comment: '安全ゲート通過（デモ）。陸上作業のため追加リスクは低い',
      risks: [
        { type: '機械・設備', detail: '据付管理システムの誤操作リスク。操作手順書で対応', source: '社内運用実績（デモ）', level: 'low' }
      ],
      sources: ['社内運用実績（デモ）']
    }
  ] as const;
  const safetyTechKey: Record<string, string> = { techId2, techId };
  for (const r of safetyReviewDefs) {
    await sql(
      `INSERT INTO safety_reviews
         (id, technology_id, risks, sources, gate_status, gate_reviewed_by, gate_reviewed_at, gate_comment, is_sample)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6, now(), $7,true)`,
      [uuid(), safetyTechKey[r.techKey]!, JSON.stringify(r.risks), JSON.stringify(r.sources), r.gate,
       r.gate === 'cleared' ? U('tanaka.makoto@demo.ctiip.example') : null, r.comment]
    );
  }

  // ---- M33 Technology Knowledge Graph（第一拡張群・実装順位5）----
  // 特許・論文・NETIS・技術・会社・研究者・現場を横断して結ぶグラフのデモリンク。
  // FR-M33-001（多種エンティティの関係）/002（n-hop関係検索の素材）。表示は /technology-graph。
  const kgEdgeDefs: Array<{
    sk: string; sid: string; rel: string; tk: string; tid: string; note: string
  }> = [];
  const kg = (sk: string, sid: string, rel: string, tk: string, tid: string, note: string) =>
    kgEdgeDefs.push({ sk, sid, rel, tk, tid, note });
  // 会社 → 特許（権利者・出願人との対応。M29名寄せと整合）
  kg('company', entityIdByCanonical['北浜重工デモ株式会社']!, 'owns', 'patent', patentIds[0]!, '出願人名寄せの正規エンティティ（M29）');
  kg('company', entityIdByCanonical['第一土木デモ建設株式会社']!, 'owns', 'patent', patentIds[1]!, '出願人名寄せの正規エンティティ（M29）');
  kg('company', entityIdByCanonical['旭洋テクノデモ工業株式会社']!, 'owns', 'patent', patentIds[2]!, '出願人名寄せの正規エンティティ（M29）');
  kg('company', entityIdByCanonical['Northport Marine Robotics Demo Inc.']!, 'owns', 'patent', patentIds[3]!, '出願人名寄せの正規エンティティ（M29）');
  // NETIS 登録技術 ⇔ 技術台帳（デモ複製の対応）
  kg('netis', netisId, 'registered_as', 'technology', techId2, 'NETIS登録技術のデモ複製が技術台帳に対応');
  // 技術 → 現場（適用性評価の対象）
  kg('technology', techId2, 'applied_at', 'site', siteId, '現場適用性評価の対象（M13）');
  // 論文 → 技術（研究対象）
  kg('paper', paperIds[0]!, 'studied_in', 'technology', techId2, '適用性評価の研究（デモ）');
  // 技術 ⇔ 特許（構成比較の対象・関連）
  kg('technology', techId, 'related_to', 'patent', patentIds[0]!, 'Claim構成比較（M06）の対象');
  kg('technology', techId, 'related_to', 'technology', techId2, '自社の関連技術（据付系）');
  // 技術 → 研究者（開発者）
  kg('technology', techId, 'developed_by', 'researcher', researcherIds[0]!, '当社技術研究所の研究者（デモ）');
  for (const e of kgEdgeDefs) {
    await sql(
      `INSERT INTO kg_edges (id, source_kind, source_id, relation, target_kind, target_id, note, is_sample)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [uuid(), e.sk, e.sid, e.rel, e.tk, e.tid, e.note]
    );
  }

  // ---- M30 Claim Evolution Intelligence（第一拡張群・実装順位11）----
  // Claim の版スナップショット（出願時→補正後→登録時）。changed_elements は前版から追加・限定された要素。
  // FR-M30-001〜005。補正経緯の法的評価は行わない（表示注記は画面側）。
  const claimVersionDefs: Array<{
    patentIdx: number; claimNo: number;
    versions: Array<{ kind: string; text: string; changed: string[]; note: string }>
  }> = [
    {
      patentIdx: 0, claimNo: 1,
      versions: [
        { kind: 'as_filed', text: 'ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と、前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、前記偏差を打ち消す向きに前記吊具を移動させる動揺補償機構と、を備える据付装置。', changed: [], note: '出願時の請求項1（デモ再現）' },
        { kind: 'after_amendment', text: '港湾構造物のケーソンを吊り下げる吊具と、GPSにより前記吊具の位置を取得する位置取得手段と、当該吊具の姿勢を計測する計測手段と、前記位置取得手段と前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、前記偏差を打ち消す向きに油圧アクチュエータによって前記吊具を移動させる動揺補償機構と、を備える据付装置。', changed: ['港湾構造物（対象の限定）', 'GPSによる位置取得手段の追加', '油圧アクチュエータによる駆動の限定'], note: '拒絶理由対応の補正（デモ再現）' },
        { kind: 'as_registered', text: '港湾構造物のケーソンを吊り下げる吊具と、GPSにより前記吊具の位置を取得する位置取得手段と、当該吊具の姿勢を計測する計測手段と、前記位置取得手段と前記計測手段の出力に基づいて据付目標位置との偏差を算出する演算手段と、前記偏差を打ち消す向きに油圧アクチュエータによって前記吊具を移動させる動揺補償機構と、を備えることを特徴とする据付装置。', changed: [], note: '登録時の請求項1（デモ再現）。審査で「港湾」「GPS」「油圧」に限定された可能性が高い（技術的示唆・法的評価は行わない）' }
      ]
    },
    {
      patentIdx: 1, claimNo: 1,
      versions: [
        { kind: 'as_filed', text: '水中に沈設される構造物について、音響測位と慣性計測を併用して位置を求める計測システム。', changed: [], note: '出願時の請求項1（デモ再現）' },
        { kind: 'after_amendment', text: '港湾の水中に沈設されるケーソンについて、音響測位と慣性計測を併用し、前記慣性計測のドリフトを音響測位で補正して位置を求める計測システムであって、測位結果を表示する表示手段を備える。', changed: ['対象の限定（港湾のケーソン）', 'ドリフト補正の追加', '表示手段の追加'], note: '新規性指摘への対応補正（デモ再現）' }
      ]
    }
  ];
  for (const c of claimVersionDefs) {
    for (const v of c.versions) {
      await sql(
        `INSERT INTO claim_versions (id, patent_id, claim_no, version_kind, text, changed_elements, note, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,true)`,
        [uuid(), patentIds[c.patentIdx]!, c.claimNo, v.kind, v.text, JSON.stringify(v.changed), v.note]
      );
    }
  }

  // ---- M32 IP Value & Quality Intelligence（第一拡張群・実装順位12）----
  // 7評価要素（技術力・権利強度・市場性・競合重要性・現場適用性・残存期間・コスト）を統合した
  // Strategic Score。スコアは「検討候補の並び替え材料」であり、決定は行わない（FR-M32-002/003）。
  const IP_VALUE_WEIGHTS: Record<string, number> = {
    technology: 0.2, patent_strength: 0.2, market: 0.15, competitor_importance: 0.15,
    field_applicability: 0.15, remaining_life: 0.1, cost: 0.05
  };
  const ipValueDefs = [
    {
      patentIdx: 0,
      elements: { technology: 88, patent_strength: 73, market: 91, competitor_importance: 82, field_applicability: 95, remaining_life: 67, cost: 54 },
      basis: {
        technology: '当社据付技術の中心であり技術価値が高い（デモ）', patent_strength: '請求項1のみ。補正で限定され権利範囲は中程度（デモ）',
        market: '港湾・海洋の自動化需要が高い（デモ）', competitor_importance: '競合も同分野に出願（デモ）',
        field_applicability: '適用性評価スコア高（デモ）', remaining_life: '登録から約7年経過（デモ）', cost: '維持費用は中程度（デモ）'
      },
      candidates: [
        { action: 'maintain', reason: '自社技術の中核。維持継続が妥当（デモ）' },
        { action: 'additional_filing', reason: '補正で限定された「GPS・油圧」周辺に追加出願余地（デモ）' }
      ],
      note: '経営レビュー用の評価例（デモ）'
    },
    {
      patentIdx: 2,
      elements: { technology: 76, patent_strength: 65, market: 62, competitor_importance: 58, field_applicability: 70, remaining_life: 81, cost: 62 },
      basis: {
        technology: '動揺補償制御は自社施工の課題と関連（デモ）', patent_strength: '独立請求項1。限定度は中（デモ）',
        market: '潜在需要はあるが実証が先（デモ）', competitor_importance: '旭洋等も関連出願（デモ）',
        field_applicability: '現場実績は限定的（デモ）', remaining_life: '登録から約2年（デモ）', cost: '維持費用は標準（デモ）'
      },
      candidates: [
        { action: 'joint_research', reason: '実証段階のため共同研究での価値検証が妥当（デモ）' },
        { action: 'maintain', reason: '残存期間が長く、当面維持（デモ）' }
      ],
      note: 'ライセンス候補としての評価例（デモ）'
    },
    {
      patentIdx: 4,
      elements: { technology: 61, patent_strength: 55, market: 40, competitor_importance: 35, field_applicability: 48, remaining_life: 92, cost: 70 },
      basis: {
        technology: '海外特許。国内施工との直接対応は低い（デモ）', patent_strength: '原文（独語）のクレーム。英訳確認が必要（デモ）',
        market: '国内市場では当面ニーズ小（デモ）', competitor_importance: '競合圧力は低い（デモ）',
        field_applicability: '適用現場は特定されず（デモ）', remaining_life: '出願から間もない（デモ）', cost: '海外維持費用を要する（デモ）'
      },
      candidates: [
        { action: 'consider_abandon', reason: '市場性・現場適用性が低く、海外維持費に見合わない可能性（デモ）' },
        { action: 'sell', reason: '他社（トンネル事業者）への売却余地を検討（デモ）' }
      ],
      note: 'ポートフォリオ見直しの評価例（デモ）'
    }
  ] as const;
  for (const d of ipValueDefs) {
    const elements = d.elements as Record<string, number>;
    const score = Math.round(
      Object.entries(IP_VALUE_WEIGHTS).reduce((s, [k, w]) => s + w * (elements[k] ?? 0), 0) * 100
    ) / 100;
    await sql(
      `INSERT INTO ip_value_scores (id, patent_id, evaluated_on, elements, weights, strategic_score, basis, candidates, evaluated_by, note, is_sample)
       VALUES ($1,$2, now(), $3::jsonb, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8, $9, true)`,
      [uuid(), patentIds[d.patentIdx]!, JSON.stringify(elements), JSON.stringify(IP_VALUE_WEIGHTS), score,
       JSON.stringify(d.basis), JSON.stringify(d.candidates), U('takahashi.minoru@demo.ctiip.example'), d.note]
    );
  }

  // 競合企業（M09 Competitor Intelligence）
  const competitorDefs = [
    ['北浜重工デモ株式会社', '総合建設'], ['第一土木デモ建設株式会社', '土木専門'],
    ['旭洋テクノデモ工業株式会社', '海洋機械'], ['Northport Marine Robotics Demo Inc.', '海外・ロボティクス'],
    ['Alpenbau Tunneltechnik Demo GmbH', '海外・トンネル'], ['华东桥梁科技演示有限公司', '海外・橋梁']
  ] as const;
  const competitorIds: string[] = [];
  for (const [name, category] of competitorDefs) {
    const id = uuid(); competitorIds.push(id);
    await sql(`INSERT INTO competitors (id, name, category) VALUES ($1,$2,$3)`, [id, name, category]);
  }

  // 先行技術調査案件（M04）
  const investigationDefs = [
    ['港湾ケーソン据付自動化の先行技術調査（デモ）', 'ケーソン 据付 自動化', 'open'],
    ['トンネル掘進AI制御の先行技術調査（デモ）', 'トンネル AI 掘進制御', 'open'],
    ['橋梁ヘルスモニタリングの先行技術調査（デモ）', '橋梁 センサ 健全性', 'closed']
  ] as const;
  const investigationIds: string[] = [];
  for (const [title, query, status] of investigationDefs) {
    const id = uuid(); investigationIds.push(id);
    await sql(`INSERT INTO investigations (id, title, query, status, created_by) VALUES ($1,$2,$3,$4,$5)`,
      [id, title, query, status, U('takahashi.minoru@demo.ctiip.example')]);
  }

  // ウォッチ登録（M19）
  const watchDefs = [
    ['patent', '北浜重工デモ株式会社の新規出願'], ['competitor', 'Northport Marine Robotics Demo Inc.'],
    ['technology', 'ICT施工'], ['ipc', 'E02B 3/06（外郭施設）'],
    ['researcher', 'Chen Wei'], ['netis', '港湾・海洋分野の新規登録']
  ] as const;
  for (const [kind, label] of watchDefs) {
    await sql(`INSERT INTO watches (id, kind, label, owner_id) VALUES ($1,$2,$3,$4)`,
      [uuid(), kind, label, U('takahashi.minoru@demo.ctiip.example')]);
  }

  // ライセンス案件（M11）
  const licenseDefs = [
    ['license_in', 'Northport Marine Robotics Demo Inc.', 'patent', patentIds[3], 'candidate'],
    ['license_out', '第一土木デモ建設株式会社', 'technology', techId, 'candidate'],
    ['license_in', 'Alpenbau Tunneltechnik Demo GmbH', 'patent', patentIds[4], 'evaluating']
  ] as const;
  for (const [kind, counterpart, subjectType, subjectId, status] of licenseDefs) {
    await sql(`INSERT INTO licenses (id, kind, counterpart_name, subject_type, subject_id, status, terms) VALUES ($1,$2,$3,$4,$5,$6,'{}')`,
      [uuid(), kind, counterpart, subjectType, subjectId, status]);
  }

  // レポート出力履歴（M23）
  const reportDefs = [
    ['patent-survey', '港湾ケーソン据付技術 特許調査報告書（デモ）', 'pdf'],
    ['claim-compare', 'ケーソン据付装置 Claim比較レポート（デモ）', 'docx'],
    ['field-application', '◯◯港 岸壁改良工事 現場適用性評価レポート（デモ）', 'pdf'],
    ['executive', '技術・知財 経営サマリー（デモ）', 'html']
  ] as const;
  for (const [kind, title, format] of reportDefs) {
    await sql(`INSERT INTO reports (id, kind, title, created_by, format) VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), kind, title, U('yamamoto.kei@demo.ctiip.example'), format]);
  }

  // Feature Flags（M19）
  const featureFlagDefs = [
    ['ultrareview_auto_merge', true, 'PRの自動マージ前にultrareviewを必須化する（デモ設定）'],
    ['ai_examiner_v2', false, '次期AI模擬審査モデルの先行有効化（デモ設定）'],
    ['hybrid_search', false, 'pg_trgm+pgvectorハイブリッド検索への切替（デモ設定・本番設計）']
  ] as const;
  for (const [key, enabled, description] of featureFlagDefs) {
    await sql(`INSERT INTO feature_flags (id, key, enabled, description) VALUES ($1,$2,$3,$4)`, [uuid(), key, enabled, description]);
  }

  // システム設定（M19、settings画面用のダミー設定値）
  const settingDefs = [
    ['ai.model.default', { model: 'demo-model-v1', temperature: 0.2 }, 'AIモデル設定：既定モデル'],
    ['ai.model.examiner', { model: 'demo-model-v1-examiner' }, 'AIモデル設定：AI模擬審査専用モデル'],
    ['agent.max_concurrency', { value: 3 }, 'Agent設定：同時実行数上限'],
    ['api.rate_limit', { requests_per_minute: 60 }, 'API設定：レート制限'],
    ['integration.jpo', { enabled: false, note: '本番設計（未接続）' }, '外部データ連携：JPO'],
    ['integration.netis', { enabled: false, note: '本番設計（未接続）' }, '外部データ連携：NETIS'],
    ['notification.email', { enabled: true }, '通知設定：メール通知'],
    ['workflow.human_check_default', { required_for: ['C3', 'C4'] }, 'ワークフロー設定：人間確認必須の分類'],
    ['master.work_types', { source: 'technologies.work_types（派生）' }, 'マスタ設定：工種マスタの生成元']
  ] as const;
  for (const [key, value, description] of settingDefs) {
    await sql(`INSERT INTO settings (id, key, value, description) VALUES ($1,$2,$3::jsonb,$4)`,
      [uuid(), key, value, description]);
  }

  // 監査ログ（種別を多様化し、履歴系画面のフィルタが実データで意味を持つようにする）
  const auditLogDefs: Array<[string, string, string | null, string]> = [
    ['login', 'auth', null, 'success'],
    ['search', 'query', null, 'success'],
    ['ai_run', 'ai_runs', runId, 'success'],
    ['view', 'patents', patentIds[0]!, 'success'],
    ['export', 'reports', null, 'success'],
    ['update', 'claim_chart_rows', null, 'success'],
    ['role_change', 'users', U('sato.ken@demo.ctiip.example'), 'success'],
    ['security_event', 'auth', null, 'blocked']
  ];
  for (const [action, targetType, targetId, result] of auditLogDefs) {
    await sql(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, result, meta) VALUES ($1,$2,$3,$4,$5,$6,'{"note":"デモ用ログ"}')`,
      [uuid(), U('kondo.jun@demo.ctiip.example'), action, targetType, targetId, result]
    );
  }
  await sql(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, result, meta) VALUES ($1,$2,'seed','system',NULL,'success','{"note":"MVPデモデータ投入"}')`,
    [uuid(), U('kondo.jun@demo.ctiip.example')]
  );

    await client.query('COMMIT');
    console.log('✅ シード完了');
    console.log(`   部署 ${depts.length} / 利用者 ${userDefs.length} / 特許 ${patentDefs.length} / 論文 ${paperDefs.length}`);
    console.log(`   NETIS 2 / 自社技術 2 / Claim比較 1件（要件${rowDefs.length}） / 現場適用スコア ${score}`);
    console.log(`   ワークフロー案件 3件（発明2・現場導入1） / AI実行3（根拠付き）`);
    console.log(`   研究者${researcherDefs.length} / 競合${competitorDefs.length} / 調査案件${investigationDefs.length} / ウォッチ${watchDefs.length} / ライセンス${licenseDefs.length} / レポート${reportDefs.length} / FeatureFlags${featureFlagDefs.length} / 設定${settingDefs.length}`);
    console.log(`   第一拡張群: KGエッジ${kgEdgeDefs.length} / Claim版${claimVersionDefs.flatMap(c => c.versions).length} / IP価値スコア${ipValueDefs.length} / 特許ファミリー1件（メンバー${familyMemberDefs.length}）`);
    console.log(`   M34規格: 台帳${standardDefs.length}件 / 技術⇔規格関連${techStdDefs.length}件`);
    console.log(`   M38安全ゲート: レビュー${safetyReviewDefs.length}件`);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (client) client.release();
    await pg.end();
  }
}

main().catch(e => { console.error('❌ シード失敗:', e); process.exit(1); });
