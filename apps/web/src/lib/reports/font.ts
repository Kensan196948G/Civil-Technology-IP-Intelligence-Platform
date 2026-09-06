// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
//
// pdf-lib の標準14フォント（Helvetica等）は WinAnsi エンコーディングのみ対応のため、
// 日本語テキストを描画すると例外になる。そのため日本語グリフを含むフォントを同梱し、
// @pdf-lib/fontkit で埋め込む。
//
// 同梱フォント: NotoSansJP-Regular.ttf（Google Fonts「Noto Sans JP」の可変フォントを
// 固定ウェイト化（wght=400）した上で、常用の日本語文字域
// （基本ラテン/句読点・記号/ひらがな/カタカナ/全角形/CJK統合漢字）にサブセット化したもの）。
// ライセンス: SIL Open Font License 1.1（OFL.txt はフォント配布元に準拠。埋め込み・再配布可）。
//
// Next.js のサーバーバンドル配下では __dirname がソースディレクトリと一致しない場合が
// あるため、process.cwd()（自社ホストNode運用でのアプリのルート）からの相対パスを優先し、
// 見つからない場合のみ __dirname 相対にフォールバックする。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RELATIVE_PATH = join('src', 'lib', 'reports', 'assets', 'NotoSansJP-Regular.ttf');

let cached: Buffer | null = null;

export function loadJapaneseFontBytes(): Buffer {
  if (cached) return cached;
  const candidates = [
    join(process.cwd(), RELATIVE_PATH),
    join(__dirname, 'assets', 'NotoSansJP-Regular.ttf')
  ];
  const path = candidates.find(p => existsSync(p));
  if (!path) {
    throw new Error(`日本語フォントが見つかりません（候補: ${candidates.join(', ')}）`);
  }
  cached = readFileSync(path);
  return cached;
}
