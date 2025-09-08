# 予約システム E2E プロジェクト

Next.js + Playwright を用いた予約システムの E2E テスト環境です。  
商用利用を想定し、CI/CD・テストレポート・モック決済(Stripe)などを統合しています。

---
## 🚀 セットアップ

```bash
# 依存関係のインストール
npm ci

# 開発サーバー起動 (http://localhost:3100)
npm run dev
```

---
## 🧪 テスト実行

```bash
# 型チェックのみ（任意）
npx tsc --noEmit

# Stripe をモックして E2E 実行（ローカル）
export E2E_STRIPE_MOCK=1
npx playwright test

# レポートをローカルで表示
npx playwright show-report
```

---
## 📊 E2E Test Reports

GitHub Pages に公開された最新レポートはこちら👇

🔗 [Playwright Report](https://inkproduction1400-bot.github.io/auto-loop-demo/)

> もしリポジトリの **Owner/Repo 名** が変わったら、  
> `https://<GitHubユーザーまたはOrg>.github.io/<リポジトリ名>/` に差し替えてください。