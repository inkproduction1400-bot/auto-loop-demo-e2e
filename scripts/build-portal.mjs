// scripts/build-portal.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const README = resolve(repoRoot, "README.md");
const outDir = resolve(repoRoot, "site", "docs");

/** 見出しの正規化: 絵文字/記号除去 → 全角英数を半角 → 小文字化 */
function normalizeHeading(s) {
  if (!s) return "";
  // 絵文字・装飾っぽい記号を除去
  let t = s.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D]/gu, "");
  // 前後空白・記号を整理
  t = t.replace(/^[\s\-\*\#\:\|]+|[\s\-\*\#\:\|]+$/g, "").replace(/\s+/g, " ");
  // 全角英数字→半角
  t = t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  // 小文字化
  t = t.toLowerCase();
  return t;
}

// 章→出力ファイルマッピング（日本語表現を拡充）
const routes = [
  // セットアップ
  { key: /(getting started|setup|installation|install|セットアップ|導入|環境構築|初期設定|インストール)/i, file: "getting-started.html", title: "セットアップ" },
  // 開発ルール
  { key: /(rules|guidelines|convention|style|開発ルール|コーディング規約|コミット規約|pr規約|レビュー|命名規則)/i, file: "dev-rules.html", title: "開発ルール" },
  // アーキテクチャ
  { key: /(architecture|system|design|構成|アーキテクチャ|設計|ディレクトリ|フォルダ構成|システム構成)/i, file: "architecture.html", title: "アーキテクチャ" },
  // API
  { key: /(^|\s)(api|endpoint|エンドポイント|rest|graphql)(\s|$)/i, file: "api.html", title: "API" },
  // DB
  { key: /(db|database|schema|スキーマ|prisma|データベース|er図?)/i, file: "db-schema.html", title: "DB スキーマ" },
  // CI/CD・テスト
  { key: /(ci.?cd|workflow|actions|pipeline|deploy|デプロイ|ワークフロー|テスト|e2e|playwright)/i, file: "ci-cd.html", title: "CI / CD" },
];

function findRoute(headingRaw) {
  const h = normalizeHeading(headingRaw);
  for (const r of routes) if (r.key.test(h)) return r;
  return null;
}

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

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

function mdToHtml(md) {
  return marked.parse(md, { mangle: false, headerIds: true });
}

/** H2/H3 で分割し、各セクションを {heading, body} にする */
function splitByHeadings(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m2 = line.match(/^##\s+(.*)$/);     // H2
    const m3 = line.match(/^###\s+(.*)$/);    // H3
    const m = m2 || m3;
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function run() {
  const md = readFileSync(README, "utf8");
  const sections = splitByHeadings(md);
  ensureDir(outDir);

  const bucket = new Map(routes.map(r => [r.file, { title: r.title, parts: [] }]));

  for (const s of sections) {
    const route = findRoute(s.heading);
    if (!route) continue;
    // 見出し（H2/H3）をそのまま本文先頭に入れて、元の構造を保つ
    const content = [`## ${s.heading}`, ...s.body].join("\n");
    bucket.get(route.file).parts.push(content);
  }

  for (const [file, { title, parts }] of bucket.entries()) {
    const mdCombined = parts.length ? parts.join("\n\n") : `_${title} は README に該当章が見つかりませんでした。_`;
    const html = mdToHtml(mdCombined);
    const out = htmlShell(title, html);
    writeFileSync(resolve(outDir, file), out, "utf8");
    console.log(`Wrote: site/docs/${file} (${parts.length} section(s))`);
  }
}

run();
