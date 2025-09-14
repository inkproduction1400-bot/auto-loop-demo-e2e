/**
 * CSV 文字列化（Excel 互換のため BOM 付与を想定）
 * - 値はダブルクォートで囲み、内部の `"` は `""` にエスケープ
 * - 改行/カンマ/タブ/ダブルクォートを含む場合は必ず囲む
 */
export function toCSV(rows: Array<Record<string, unknown>>, headers?: string[]): string {
    if (!rows || rows.length === 0) {
      return '\uFEFF'; // BOM のみ
    }
  
    const cols: string[] =
      headers && headers.length > 0 ? headers : Object.keys(rows[0]);
  
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\r\n\t]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
  
    const lines: string[] = [];
    // ヘッダ行
    lines.push(cols.map((c) => escape(c)).join(','));
    // データ行
    for (const r of rows) {
      lines.push(
        cols
          .map((c) => {
            const val: unknown = r[c];
            return escape(val);
          })
          .join(',')
      );
    }
    // 先頭に BOM を付ける（Excel での文字化け防止）
    return '\uFEFF' + lines.join('\r\n');
  }
  
  export function fileNameWithDate(prefix: string, ext = 'csv'): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${prefix}_${y}${m}${day}.${ext}`;
  }
  