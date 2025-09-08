🧭 プロジェクト開発ポータル
予約システム E2E プロジェクト
Next.js + Playwright + Prisma をベースに、CI/CD・テストレポート・モック決済(Stripe)を統合。
このページは、チーム開発のための 入口 / 規約 / 運用メモ です。

目次
アーキテクチャ概要
環境構成
ディレクトリ構成
環境変数
セットアップ
開発ルール
テスト戦略
データベース (Prisma/SQLite)
CI/CD パイプライン
リリース運用
トラブルシュート
アーキテクチャ概要
UI/SSR: Next.js (App Router)
E2E: Playwright（モック/実ブラウザ両対応、HTML/JUnit/Blob レポート出力）
DB: Prisma + SQLite（CI はローカル DB、将来は Postgres/MySQL に移行可）
決済: Stripe
E2E 既定は モック（E2E_STRIPE_MOCK=1）
実 Stripe を使う場合は Secrets を設定して CI/ローカルで切替
CI/CD: GitHub Actions
ブランチ PR 時に E2E を並列実行
main マージ時に Playwright HTML レポートを GitHub Pages へ公開

環境構成
ローカル: 開発/検証用。npm run dev で起動。
CI: Pull Request と main で GitHub Actions が動作。
Pages: 最新 E2E レポートとポータルページを静的公開。
レポートURL: リポジトリに応じて https://<owner>.github.io/<repo>/ 配下

ディレクトリ構成
.
├─ app/                     # Next.js アプリ (API ルートを含む)
│  ├─ api/
│  │  ├─ checkout/         # Stripe Checkout API（モック/実 API 切替）
│  │  └─ admin/            # 管理API（顧客/予約）
│  └─ ...
├─ prisma/
│  ├─ schema.prisma        # Prisma スキーマ
│  └─ migrations/          # 将来用（必要に応じて migrate を利用）
├─ tests/
│  └─ e2e/                 # Playwright テスト一式
│     ├─ pages/            # シナリオ別
│     ├─ fixtures/         # テスト用ヘルパ/データ
│     └─ *.spec.ts
├─ .github/workflows/      # Actions 定義 (playwright.yml ほか)
├─ playwright.config.ts    # E2E 設定（webServer 起動等）
├─ README.md               # ← このページ
└─ ...

環境変数
変数名	用途	例/既定
PORT	Next.js ポート	3100（既定）
NEXT_PUBLIC_BASE_URL	テスト対象のベース URL	http://127.0.0.1:3100
PW_BASE_URL	Playwright 側の baseURL	NEXT_PUBLIC_BASE_URL と同じ
E2E_STRIPE_MOCK	Stripe モック切替	1=モック / 0=実Stripe
STRIPE_SECRET_KEY	Stripe サーバ鍵	CI Secrets 推奨
STRIPE_PUBLISHABLE_KEY	Stripe 公開鍵	CI Secrets 推奨
DATABASE_URL	Prisma DB 接続	file:./prisma/dev.db（CI/ローカル）
CI では playwright.yml で上記を注入。ローカルは .env / .env.local を利用。

セットアップ
# 依存関係のインストール
npm ci

# Prisma クライアント生成（schema 変更時は都度）
npx prisma generate

# 開発サーバー起動 (http://localhost:3100)
npm run dev

開発ルール
ブランチ戦略
main … 常にデプロイ可能な安定ブランチ
feature/*, fix/*, chore/* … 作業ブランチ
PR は Draft → Ready for review → Merge の流れ
コミット規約（Conventional Commits）
feat: 機能追加, fix: 不具合修正, chore: 雑務, docs: 文書のみ, test: テストのみ など
例: fix: fallback to mock when Stripe keys missing (CI)

コード規約
TypeScript 厳格モード
Prettier/ ESLint を標準設定（必要なら追加）
CSS Module を既定（global.d.ts で型宣言済）

PR チェックリスト
 単体/手元で E2E が通る（npx playwright test）
 .env* や秘密情報をコミットしていない
 変更点が README/コメントに反映されている
 スクショ/動画（Playwright artifacts）が必要なら添付

テスト戦略
レイヤ
E2E（本プロジェクトの主軸）: 重要なフローをブラウザで検証
予約の新規作成、バリデーション、Stripe モック成功/失敗など
API: Prisma 経由の CRUD とレスポンス整形（管理画面 API）
型: npx tsc --noEmit でビルド前に静的検査

コマンド
# 型チェック
npx tsc --noEmit

# Stripe をモックして E2E 実行（既定）
export E2E_STRIPE_MOCK=1
npx playwright test

# 実 Stripe で実行（Secrets 必須 / 注意！）
export E2E_STRIPE_MOCK=0
export STRIPE_SECRET_KEY=sk_test_xxx
export STRIPE_PUBLISHABLE_KEY=pk_test_xxx
npx playwright test

# レポート表示（ローカル）
npx playwright show-report
データベース (Prisma/SQLite)
ローカル/CI は SQLite を利用（軽量・セットアップ不要）
スキーマ: prisma/schema.prisma
Reservation: adultCount / studentCount / childCount / infantCount に分割済
ReservationStatus: SQLite 用に String 列として運用（将来 RDB で enum に変更可）
よく使うコマンド
# Prisma クライアント生成（スキーマ変更時は必須）
npx prisma generate

# スキーマを DB に反映（SQLite）
npx prisma db push

# DB リセット（注意：データ消える）
npx prisma migrate reset
CI では ビルド前に DB を準備（db push相当）し、Next.js の webServer 起動時に参照できるようにしています。
CI/CD パイプライン
フロー概要（PR → main）
PR 作成/更新
  ├─ E2E: chromium / firefox / webkit を並列実行
  └─ （blob レポートをアーティファクト収集）

main へ Merge
  ├─ 上記 E2E が再走（main）
  ├─ HTML レポートにマージ
  └─ GitHub Pages へ公開（成功時は PR/Job Summary にリンク）
Workflow: .github/workflows/playwright.yml

ポイント
Generate Prisma client → Build Next.js → Verify build → Playwright
Pages 公開は main かつ blob がある時のみ
Stripe は既定 モック。Secrets 設定があれば実 Stripe も可

リリース運用
PR は緑（E2E 通過）であること
main マージ後に Pages が自動更新
将来、本番デプロイ（Vercel 等）と連携する場合は *main or release/ に限定**し、
E2E 成功時のみデプロイにするのが推奨

トラブルシュート
「Could not find a production build in .next」
npm run build が失敗。playwright.yml の Verify step で詳細を確認
Prisma のエラー（Unable to open the database file）
DATABASE_URL のパス/権限を確認。CI では file:./prisma/dev.db を使用
Stripe のモジュールが見つからない/キー不足
モック実行に戻す：E2E_STRIPE_MOCK=1
実行が必要なら Secrets（STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY）を設定
Pages の公開が PR で拒否
セキュリティ仕様。main のみ公開可にしているため正常挙動です

付録：リンク集
🔗 Playwright Report (最新): このページ下部のリンクから
🧪 Actions: GitHub → Actions → E2E (Playwright)
🗂️ スキーマ: prisma/schema.prisma
⚙️ CI 設定: .github/workflows/playwright.yml