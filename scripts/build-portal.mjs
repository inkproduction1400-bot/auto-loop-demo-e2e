// scripts/build-portal.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const README = resolve(repoRoot, "README.md");
const outDir = resolve(repoRoot, "site", "docs");

// ---- 章 → 出力ファイルのマッピング（見出し名の一部一致で判定） ----
const routes = [
  { key: /^(getting started|setup|セットアップ|導入)/i, file: "getting-started.html", title: "セットアップ" },
  { key: /(rules|guidelines|convention|開発ルール|コーディング規約|コミット|PR)/i, file: "dev-rules.html", title: "開発ルール" },
  { key: /(architecture|system|構成|アーキテクチャ|ディレクトリ)/i, file: "architecture.html", title: "アーキテクチャ" },
  { key: /^(api|endpoint|エンドポイント)/i, file: "api.html", title: "API" },
  { key: /(db|schema|prisma|database|DB|スキーマ)/i, file: "db-schema.html", title: "DB スキーマ" },
  { key: /(ci.?cd|workflow|actions|テスト|E2E)/i, file: "ci-cd.html", title: "CI / CD" },
];

function findRoute(heading) {
  const h = heading.trim();
  for (const r of routes) if (r.key.test(h)) return r;
  return null;
}

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

function htmlShell(title, bodyHtml) {
  // サイドバー黒、メイン白の既存CSSを前提。index.html と同じナビを後で各自コピペしても良いが、
  // 最低限の戻りリンクとスタイル読込だけ入れる簡易版で御座る。
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
    <h2>Docs</h2>
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
  // コードブロックや表をそのままHTML化
  return marked.parse(md, { mangle: false, headerIds: true });
}

function splitByH2(md) {
  // H2で分割（先頭にH2が無い場合は捨てる）
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function run() {
  const md = readFileSync(README, "utf8");
  const sections = splitByH2(md);

  ensureDir(outDir);

  // 章→ファイルに振り分け
  const bucket = new Map(routes.map(r => [r.file, { title: r.title, parts: [] }]));

  for (const s of sections) {
    const route = findRoute(s.heading);
    if (!route) continue; // マッピング外の章はスキップ
    const content = [`## ${s.heading}`, ...s.body].join("\n");
    bucket.get(route.file).parts.push(content);
  }

  // 各HTMLを書き出し（該当章が無い場合はスケルトンを出力）
  for (const [file, { title, parts }] of bucket.entries()) {
    const mdCombined = parts.length ? parts.join("\n\n") : `_${title} は README に該当章が見つかりませんでした。_`;
    const html = mdToHtml(mdCombined);
    const out = htmlShell(title, html);
    writeFileSync(resolve(outDir, file), out, "utf8");
    console.log(`Wrote: site/docs/${file}`);
  }
}

run();
