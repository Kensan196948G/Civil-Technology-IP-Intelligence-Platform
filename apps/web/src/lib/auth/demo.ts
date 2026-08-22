// MVPデモ用の簡易認証。実SSO/MFAは本番設計（docs/40-infrastructure）で定義済みだが、
// MVPではロール切替のみのデモログインとする（本番運用には使用しない）。
export type DemoRole = 'engineer' | 'tech_manager' | 'rnd' | 'ip' | 'legal' | 'executive' | 'sysadmin' | 'viewer';

export const DEMO_USERS: Array<{ email: string; name: string; role: DemoRole; dept: string }> = [
  { email: 'tanaka.makoto@demo.ctiip.example', name: '田村 誠', role: 'tech_manager', dept: '04 技術・研究開発' },
  { email: 'takahashi.minoru@demo.ctiip.example', name: '高橋 実', role: 'ip', dept: '04 技術・研究開発' },
  { email: 'sato.ken@demo.ctiip.example', name: '佐藤 建', role: 'engineer', dept: '03 施工・調達・作業所' },
  { email: 'inoue.akira@demo.ctiip.example', name: '井上 章', role: 'rnd', dept: '04 技術・研究開発' },
  { email: 'yamamoto.kei@demo.ctiip.example', name: '山本 恵', role: 'executive', dept: '01 経営・統治・委員会' },
  { email: 'kondo.jun@demo.ctiip.example', name: '近藤 純', role: 'sysadmin', dept: '06 管理本部・経営企画' }
];

export const ROLE_LABEL: Record<DemoRole, string> = {
  engineer: '一般技術者', tech_manager: '技術管理者', rnd: 'R&D担当', ip: '知財担当',
  legal: '法務担当', executive: '経営者', sysadmin: 'システム管理者', viewer: '閲覧専用'
};

export const COOKIE_NAME = 'ctiip_demo_user';
