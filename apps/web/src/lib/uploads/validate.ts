// M47/M48 Vision AI統合: ファイルアップロード（patent_drawings.image_data /
// engineering_documents.file_data）共通の検証ロジック。
// 悪意あるアップロードに対する最低限の防御として、サイズ上限とMIMEタイプの
// 許可リスト（ホワイトリスト）を必ず適用する。DBやNext.jsに依存しない純粋ロジックとして
// 切り出し、CIでユニットテスト可能にする。

export type FileValidationError =
  | 'file_missing'
  | 'file_empty'
  | 'file_too_large'
  | 'mime_type_not_allowed';

export interface FileValidationOk {
  ok: true;
  buffer: Buffer;
  mimeType: string;
}

export interface FileValidationErr {
  ok: false;
  error: FileValidationError;
}

export type FileValidationResult = FileValidationOk | FileValidationErr;

/**
 * FormData から取得した File（またはそれに準ずるBlob）を検証し、Buffer に変換する。
 * - 未指定・空ファイルは拒否する
 * - byteSize が maxBytes を超える場合は拒否する（悪意ある巨大アップロード対策）
 * - MIMEタイプが allowedMimeTypes に含まれない場合は拒否する（拡張子ではなくブラウザ報告の
 *   Content-Type で判定。完全な防御ではないが、最低限のホワイトリストとして機能する）
 */
export async function readValidatedUpload(
  fileEntry: FormDataEntryValue | null,
  opts: { maxBytes: number; allowedMimeTypes: readonly string[] }
): Promise<FileValidationResult> {
  if (!fileEntry || typeof fileEntry === 'string') {
    return { ok: false, error: 'file_missing' };
  }
  const file = fileEntry as File;
  if (!file.size) {
    return { ok: false, error: 'file_empty' };
  }
  if (file.size > opts.maxBytes) {
    return { ok: false, error: 'file_too_large' };
  }
  const mimeType = file.type || '';
  if (!opts.allowedMimeTypes.includes(mimeType)) {
    return { ok: false, error: 'mime_type_not_allowed' };
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength === 0) {
    return { ok: false, error: 'file_empty' };
  }
  if (buffer.byteLength > opts.maxBytes) {
    return { ok: false, error: 'file_too_large' };
  }
  return { ok: true, buffer, mimeType };
}
