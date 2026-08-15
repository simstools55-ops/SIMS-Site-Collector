# SIMS Site Collector v0.2.0-RC8 UX

## 目的
利用者が通常の収集で迷わないよう、メニューとシート表示を整理する。

## メニュー
通常操作:
1. 収集するサイトを選ぶ
2. 通常の診断データを収集（120日）
3. 収集状況を確認

追加の操作:
- 詳しく収集する（180日）
- 中断した収集を再開

保守・トラブル対応:
- Step 5を修復してEvidenceを再生成
- 収集中の状態をリセット
- 内部シートを再整理

## シート
- `_SDSC_STATUS`: 利用者向け。表示する。
- `_SDSC_SITE_DAILY`, `_SDSC_PAGE_PERIOD`, `_SDSC_PAGE_WEEKLY`, `_SDSC_QUERY_PERIOD`, `_SDSC_PAGE_QUERY_TOP`: 内部データ。非表示。
- `シート1` / `Sheet1`: 初期状態の空シートである場合だけ自動削除。利用者データが入っていれば削除しない。

## 非変更
収集期間、Search Console取得、Evidence生成、Drive権限、診断用データ形式などの収集ロジックは変更しない。
