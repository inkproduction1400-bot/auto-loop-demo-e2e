// scripts/build-portal.mjs
import {
    readFileSync,
    writeFileSync,
    mkdirSync,
    existsSync,
    readdirSync,
    statSync,
  } from "node:fs";
  import { resolve, dirname, join } from "node:path";
  import { fileURLToPath } from "node:url";
  import { marked } from "marked";
  
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, "..");
  const README = resolve(repoRoot, "README.md");
  const outDir = resolve(repoRoot, "site", "docs");
  const DRY = process.argv.includes("--dry-run") || process.argv.includes("--dry");
  
  function ensureDir(p) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
  
  /** 見出しの正規化（絵文字/記号/全角→半角/小文字） */
  function normalize(s) {
    if (!s) return "";
    let t = s
      .replace(
        /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D]/gu,
        ""
      )
      .replace(/^[\s\-*#:\|]+|[\s\-*#:\|]+$/g, "")
      .replace(/\s+/g, " ");
    t = t.replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
    return t.toLowerCase();
  }
  
  /** 章マップ：見出し一致 or 本文キーワード一致で振り分け */
  const ROUTES = [
    {
      file: "getting-started.html",
      title: "セットアップ",
      head:
        /\b(getting started|setup|installation|install|セットアップ|導入|環境構築|初期設定|インストール)\b/i,
      body:
        /npm\s+ci|prisma\s+(generate|db\s+push)|next\s+dev|setup|環境構築|インストール/i,
    },
    {
      file: "dev-rules.html",
      title: "開発ルール",
      head:
        /\b(rules|guidelines|convention|style|開発ルール|コーディング規約|コミット規約|pr規約|レビュー|命名規則)\b/i,
      body: /commit|conventional|lint|eslint|命名|レビュー|pull\s+request|PR/i,
    },
    {
      file: "architecture.html",
      title: "アーキテクチャ",
      // ★ 語彙を拡張：技術構成/技術選定/構成図/概要/全体像 なども拾う
      head:
        /\b(architecture|system|design|構成|アーキテクチャ|設計|ディレクトリ|フォルダ構成|システム構成|システム概要|技術構成|技術スタック|技術選定|構成図|アーキ図|概要|全体像)\b/i,
      body:
        /(next\.js|prisma|sqlite|playwright|stripe|構成|ディレクトリ|レイヤ|アーキテクチャ|依存関係|シーケンス|コンポーネント|mermaid|system\s*context)/i,
    },
    {
      file: "api.html",
      title: "API",
      // ★ 語彙を拡張：外部連携/インターフェース/IF/仕様 なども拾う
      head:
        /\b(api|endpoint|エンドポイント|rest|graphql|api仕様|外部連携|インターフェース|IF|仕様)\b/i,
      body:
        /\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b\s*\/|endpoint|エンドポイント|レスポンス|request|response|curl|openapi|swagger|schema/i,
    },
    {
      file: "db-schema.html",
      title: "DB スキーマ",
      head: /\b(db|database|schema|スキーマ|prisma|データベース|er図?)\b/i,
      body: /model\s+\w+\s*\{|@id|@default|@relation|schema|テーブル|カラム/i,
    },
    {
      file: "ci-cd.html",
      title: "CI / CD",
      head:
        /\b(ci.?cd|workflow|actions|pipeline|deploy|デプロイ|ワークフロー|テスト|e2e|playwright)\b/i,
      body:
        /github\s+actions|playwright|report|pages|workflow|ci|cd|テスト|E2E/i,
    },
  ];
  
  /** H1〜H4 を章として抽出 */
  function splitHeadings(md) {
    const lines = md.split(/\r?\n/);
    const out = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^#{1,4}\s+(.*)$/);
      if (m) {
        if (cur) out.push(cur);
        cur = { heading: m[1].trim(), body: [] };
      } else if (cur) {
        cur.body.push(line);
      }
    }
    if (cur) out.push(cur);
    return out;
  }
  
  function pickRoute(heading, bodyText) {
    const h = normalize(heading);
    for (const r of ROUTES) if (r.head.test(h)) return r;
    for (const r of ROUTES) if (r.body.test(bodyText)) return r;
    return null;
  }
  
  /* ===================== ▼ 自動補完（fallback） ▼ ===================== */
  
  function walkTree(root, depth = 0, maxDepth = 2, filter = (p) => true) {
    if (!existsSync(root)) return [];
    if (depth > maxDepth) return [];
    let lines = [];
    const items = readdirSync(root).filter((n) => !n.startsWith(".")).sort();
    for (const name of items) {
      const p = join(root, name);
      if (!filter(p)) continue;
      const isDir = statSync(p).isDirectory();
      const indent = "  ".repeat(depth);
      lines.push(`${indent}${isDir ? "📁" : "📄"} ${name}`);
      if (isDir) lines = lines.concat(walkTree(p, depth + 1, maxDepth, filter));
    }
    return lines;
  }
  
  function genArchitectureFallback(root) {
    const wanted = ["app", "prisma", "tests", "site", ".github/workflows"];
    const tree = [];
    for (const w of wanted) {
      const abs = join(root, w);
      if (!existsSync(abs)) continue;
      tree.push(`### ${w}`);
      tree.push("```text");
      tree.push(...walkTree(abs, 0, 2));
      tree.push("```");
      tree.push("");
    }
    const stack = [
      "- **Framework**: Next.js",
      "- **ORM**: Prisma (SQLite)",
      "- **E2E**: Playwright",
      "- **CI/CD**: GitHub Actions → Pages（/site, /playwright-report）",
    ].join("\n");
    return [
      "## 概要",
      "本プロジェクトのディレクトリ構成と主要スタックを自動抽出しました。",
      "",
      "## 技術スタック",
      stack,
      "",
      "## ディレクトリ構成（抜粋）",
      ...tree,
    ].join("\n");
  }
  
  function discoverApiRoutes(apiRoot) {
    const results = [];
    if (!existsSync(apiRoot)) return results;
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        if (name.startsWith(".")) continue;
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/route\.(ts|js|tsx|jsx)$/.test(name)) continue;
        const src = readFileSync(p, "utf8");
        const methods = [];
        for (const m of [
          "GET",
          "POST",
          "PUT",
          "DELETE",
          "PATCH",
          "OPTIONS",
          "HEAD",
        ]) {
          const re = new RegExp(
            `export\\s+async\\s+function\\s+${m}\\b|export\\s+const\\s+${m}\\b`,
            "i"
          );
          if (re.test(src)) methods.push(m);
        }
        const rel = p
          .split(apiRoot)[1]
          .replace(/\\/g, "/")
          .replace(/\/route\.(ts|js|tsx|jsx)$/, "/");
        results.push({ path: rel || "/", methods });
      }
    })(apiRoot);
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }
  
  function genApiFallback(root) {
    const apiRoot = join(root, "app", "api");
    const list = discoverApiRoutes(apiRoot);
    if (!list.length) {
      return "## API 概要\napp/api/ 配下に route ファイルが見つかりませんでした。";
    }
    const lines = ["## エンドポイント一覧", "", "| Path | Methods |", "|---|---|"];
    for (const r of list) lines.push(`| \`${r.path}\` | ${r.methods.join(", ")} |`);
    return lines.join("\n");
  }
  
  /* ===================== ▲ 自動補完（fallback） ▲ ===================== */
  
  function htmlShell(title, bodyHtml) {
    return `<!doctype html><html lang="ja">
  <head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} | 開発ポータル</title>
  <link rel="stylesheet" href="../assets/portal.css"/>
  </head>
  <body>
  <header class="header"><h1>${title}</h1></header>
  <div class="container">
    <nav class="nav">
      <h2>DOCS</h2>
      <a href="./getting-started.html">セットアップ</a>
      <a href="./dev-rules.html">開発ルール</a>
      <a href="./architecture.html">アーキテクチャ</a>
      <a href="./api.html">API</a>
      <a href="./db-schema.html">DB スキーマ</a>
      <a href="./ci-cd.html">CI / CD</a>
      <h2>テスト</h2>
      <a href="../reports/latest.html">E2E レポート</a>
      <h2>トップ</h2>
      <a href="../index.html">ポータルへ戻る</a>
    </nav>
    <main class="main">
      <section class="card">
        ${bodyHtml}
      </section>
    </main>
  </div>
  </body></html>`;
  }
  
  function run() {
    const md = readFileSync(README, "utf8");
    const sections = splitHeadings(md);
  
    // バケツ
    const bucket = new Map(ROUTES.map((r) => [r.file, { title: r.title, parts: [] }]));
    const report = [];
  
    for (const s of sections) {
      const bodyMd = s.body.join("\n");
      const bodyText = bodyMd.toLowerCase();
      const rt = pickRoute(s.heading, bodyText);
      report.push({ heading: s.heading, matched: rt ? rt.file : "(unmatched)" });
      if (!rt) continue;
      const mdCombined = `## ${s.heading}\n${bodyMd}`;
      bucket.get(rt.file).parts.push(mdCombined);
    }
  
    if (DRY) {
      console.log("=== DRY RUN: section mapping ===");
      for (const r of report) console.log(`- ${r.matched}: ${r.heading}`);
      return; // 生成せず終了
    }
  
    ensureDir(outDir);
    for (const [file, { title, parts }] of bucket.entries()) {
      let mdOut;
      if (parts.length) {
        mdOut = parts.join("\n\n");
      } else if (file === "architecture.html") {
        mdOut = genArchitectureFallback(repoRoot);
      } else if (file === "api.html") {
        mdOut = genApiFallback(repoRoot);
      } else {
        mdOut = `_${title} は README に該当章が見つかりませんでした。_`;
      }
      const html = marked.parse(mdOut, { mangle: false, headerIds: true });
      writeFileSync(resolve(outDir, file), htmlShell(title, html), "utf8");
      console.log(
        `Wrote: site/docs/${file}  sections=${parts.length}${
          parts.length ? "" : " (fallback)"
        }`
      );
    }
  
    console.log("=== mapping summary ===");
    for (const r of report) console.log(`- ${r.matched}: ${r.heading}`);
  }
  
  run();
  