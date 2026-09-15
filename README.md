# viz_study

**🔗 公開サイト: https://on6848.github.io/viz_study/**

毎日1本の論文を読み、自分の言葉でまとめ、その中核アイデアを**実際に操作できる可視化デモ**で
直感的に理解できるようにする個人アーカイブです。ビルド不要の静的サイト（プレーンHTML/CSS/JS）で、
GitHub Pagesでの公開を想定しています。

## サイト構成

```
index.html              トップページ（papers.json を読んで論文カード一覧を描画）
papers.json              論文メタデータ一覧
assets/css/style.css     共通デザイントークン（色・レイアウト）。ライト/ダーク両対応
assets/js/site.js        テーマ切替 + トップページのカード描画
papers/
  _template/             新規ページ作成用テンプレート（一覧には出ない）
  YYYY-MM-DD-slug/       各論文のページ（index.html + demo.js）
```

## 運用フロー

1. ユーザーが論文（PDF・URL・テキストなど）を渡す。
2. Claudeが読み込み、`papers/_template/README.md` の定型セクションに沿って
   **オリジナルの要約**を作成し、論文の核心的なアイデアを直感的に理解できる
   **インタラクティブな可視化デモ**を作る。
3. `papers.json` にエントリを追加。
4. git commit & push（GitHub Pagesに自動反映）。
5. ユーザーは手法・デモへの改善提案を出し、Claudeが反映する。

日々の運用ルールの詳細は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## 権利について

- 各ページの要約文・解説・可視化コードはすべてオリジナルです。原論文の本文・図表の転載はしません。
- デモで使うデータは、原則として説明目的の合成データです（実データを使う場合は出典と利用条件を明記します）。
- 各ページから原論文（arXiv等）へのリンクを必ず貼り、出典を明示します。

## ローカルで見る

ビルド不要です。リポジトリ直下で簡易サーバーを立てて開いてください（`fetch` で `papers.json` を
読み込むため `file://` では動きません）。

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## 公開（GitHub Pages）

Settings → Pages → Source は `main` ブランチ / `/ (root)` で設定済みです。
`main` に push するたびに https://on6848.github.io/viz_study/ に自動反映されます。
