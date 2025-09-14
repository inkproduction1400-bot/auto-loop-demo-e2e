# 🧭 プロジェクト開発ポータル

**予約システム E2E プロジェクト**  
Next.js + Playwright + Prisma をベースに、CI/CD・テストレポート・モック決済(Stripe)を統合。  
このページは、**開発者が利用する内部ドキュメント** でありつつ、  
「システムの特徴やアクセス方法」が把握できるように整理しています。

ーーーーーーーーーーーーーーーーー

## 📑 目次
- アクセス方法まとめ
- システムの特徴（PM 向け概要）
- アーキテクチャ概要（技術スタック）
- 環境構成
- ディレクトリ構成
- 環境変数
- セットアップ手順
- 開発ルール
- テスト戦略
- データベース (Prisma/SQLite/Postgres)
- CI/CD パイプライン
- リリース運用
- トラブルシュート
- 付録：リンク集

---

## 🌐 アクセス方法まとめ

### 本番環境（Vercel）
- **予約ページ（ユーザー用）**  
  👉 [https://auto-loop-demo-e2e.vercel.app/](https://auto-loop-demo-e2e.vercel.app/)

- **管理者ダッシュボード（管理用）**  
  👉 [https://auto-loop-demo-e2e.vercel.app/admin](https://auto-loop-demo-e2e.vercel.app/admin)

ーーーーーーーーーーーーーーーーー

### ローカル開発環境
- **Next.js 開発サーバー**  
  ```bash
  npm run dev

→ http://localhost:3000/
→ 管理画面は http://localhost:3000/admin


【 Prisma Studio（DB GUI） 】
npx prisma studio

→ http://localhost:5556/
→ 左上プルダウンから Customer / Reservation を切替
ーーーーーーーーーーーーーーーーー

【　データベース（Neon PostgreSQL）　】
・接続確認
psql "postgresql://...neon.tech/neondb?sslmode=require"

・マイグレーション
npx prisma migrate deploy

・シード投入
npx prisma db seed
ーーーーーーーーーーーーーーーーー
管理者・ユーザー（テスト用）
管理者: nagai-admin
一般ユーザー: alice
ーーーーーーーーーーーーーーーーー

【　✨ システムの特徴（PM向け概要）　】
・予約機能
　　ユーザーは日時と人数を指定して予約可能
　　管理者はダッシュボードから予約を確認・キャンセル可能
・決済機能
　　Stripe をモック化して E2E テストに統合
　　実運用時は本物の Stripe API に切替可能
・ダッシュボード機能
　　顧客一覧・予約一覧を管理者が閲覧可能
　　CSV ダウンロード対応（予約データをエクスポート可能）
・開発/運用の工夫
　　Playwright で UI テストを自動化（E2E テスト）
　　GitHub Actions による CI/CD、自動デプロイ
　　Prisma による DB マイグレーション管理
　　Neon (Postgres) を本番データベースに採用

【　🏗️ アーキテクチャ概要（技術スタック）　】
UI/SSR: Next.js (App Router)
E2E: Playwright（モック/実ブラウザ両対応、レポート出力）
DB: Prisma + SQLite（CI/ローカル）、Neon (Postgres)（本番）
決済: Stripe（既定はモック）
CI/CD: GitHub Actions（PR と main マージで自動テスト）

【　🖥 環境構成　】
ローカル … 開発者が npm run dev で検証
CI … GitHub Actions による自動テスト
Pages … E2E レポートやポータルを公開

【　📂 ディレクトリ構成　】
.
├─ app/                     # Next.js アプリ (API ルート含む)
│  ├─ api/checkout/         # Stripe API（モック/実API切替）
│  └─ api/admin/            # 管理API（顧客/予約）
├─ prisma/                  # Prisma スキーマ & マイグレーション
├─ tests/e2e/               # Playwright テスト一式
├─ .github/workflows/       # GitHub Actions 定義
└─ README.md

【　🔑 環境変数（例）　】
変数名	　　　　　　　　　　　用途	　　　　　　　　例/既定
PORT	　　　　　　　　　　 Next.js ポート	　　　3100
NEXT_PUBLIC_BASE_URL	　テスト対象ベースURL	http://127.0.0.1:3100
E2E_STRIPE_MOCK	　　　　　 Stripe モック切替    1=モック / 0=実Stripe
STRIPE_SECRET_KEY	      Stripe サーバ鍵	  CI Secrets 推奨
DATABASE_URL	          Neon DB 接続	     .env に記載

【　⚙️ セットアップ手順　】
npm ci                   # 依存関係
npx prisma generate      # Prisma クライアント生成
npm run dev              # 開発サーバー起動

【　📜 開発ルール　】
ブランチ戦略: main=安定 / feature=新機能 / fix=修正
コミット規約: Conventional Commits 準拠
コード規約: TypeScript 厳格モード + ESLint/Prettier
PR チェックリスト: E2E 通過・Secrets無流出・ドキュメント反映済み

【　🧪 テスト戦略　】
E2E テスト（主軸）: 予約・決済・バリデーションをブラウザで確認
API テスト: Prisma 経由の CRUD 確認
型チェック: npx tsc --noEmit

【　🗄 データベース　】
・ローカル/CI: SQLite
・本番: Neon (Postgres)
・主要コマンド
　　npx prisma generate
　　npx prisma migrate deploy
　　npx prisma studio

【　🚀 CI/CD パイプライン　】
PR 作成/更新時 → E2E 自動実行
main マージ時 → E2E + Pages 反映
将来 → Vercel 本番デプロイと連携予定

【　📦 リリース運用　】
main は常にデプロイ可能
PR は E2E グリーン必須
Vercel デプロイは main 成功時のみ

【　🛠 トラブルシュート　】
ビルド失敗 → npm run build 確認
DB接続不可 → DATABASE_URL を確認
Stripeエラー → E2E_STRIPE_MOCK=1 に戻す

【　📚 付録：リンク集　】
🔗 Playwright Report: GitHub Pages 公開済み
🧪 Actions: GitHub → Actions → E2E
🗂️ Prisma Schema: prisma/schema.prisma
⚙️ CI 設定: .github/workflows/playwright.yml
