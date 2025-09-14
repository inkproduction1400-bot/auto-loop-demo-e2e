// src/lib/admin/auth.ts
/**
 * ADMIN_EMAILS に含まれる UID（メールアドレス想定）のみを管理者として扱うで御座る。
 * dev ログインは /dev/login?uid=xxx で cookie: uid=xxx が入る前提。
 */
export function getUidFromRequest(req: Request): string | null {
    try {
      // x-user-id ヘッダ
      const h = req.headers.get('x-user-id');
      if (h && h.trim()) return h.trim();
  
      // Authorization: Bearer <uid>
      const auth = req.headers.get('authorization');
      if (auth && /^Bearer\s+/i.test(auth)) {
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        if (token) return token;
      }
  
      // Cookie: uid=...
      const cookie = req.headers.get('cookie') ?? '';
      const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
  
      return null;
    } catch {
      return null;
    }
  }
  
  export function isAdmin(uid: string | null): boolean {
    if (!uid) return false;
    const raw = process.env.ADMIN_EMAILS ?? '';
    const allow = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return allow.includes(uid.toLowerCase());
  }
  