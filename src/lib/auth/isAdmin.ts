// src/lib/auth/isAdmin.ts
export function getUidFromCookieOrHeader(req: Request): string | null {
    try {
      const h = req.headers.get("x-user-id");
      if (h && h.trim()) return h.trim();
      const auth = req.headers.get("authorization");
      if (auth && /^Bearer\s+/i.test(auth)) {
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (token) return token;
      }
      const cookie = req.headers.get("cookie") ?? "";
      const m = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
      return null;
    } catch {
      return null;
    }
  }
  
  export function isAdmin(uid: string | null): boolean {
    if (!uid) return false;
    const admins = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(uid.toLowerCase()); // UID=メール想定（dev運用と同様）
  }
  