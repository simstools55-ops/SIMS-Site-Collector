# SIMS Site Collector v0.2.0-RC9 Save UX

## 利用者向け変更
- 表示シート名: `収集状況`
- 項目名を日本語化
- 収集開始時にEvidence Package保存ダイアログを表示
- Google Driveのフォルダを階層移動して選択可能
- ファイル名は自動生成され、必要なら変更可能

## 保存の考え方
Windowsのローカル「名前を付けて保存」を直接呼び出すのではなく、Apps Script上で同じ感覚に近いDrive用ダイアログを提供する。
収集は途中で時間トリガーにより再開する可能性があるため、保存先とファイル名は収集開始前に確定してRunへ保持する。

## 非変更
- Search Console取得ロジック
- 120日/180日データ設計
- Evidence Packageの内部ファイル構成
- OAuth scope (`https://www.googleapis.com/auth/drive`)
