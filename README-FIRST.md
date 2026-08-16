# SIMS Site Collector v0.2.0

SIMS Site Collector v0.2.0 は、RC10.3までの実運用検証を反映した正式ベースラインです。
Search Consoleの診断用Evidenceを収集し、SIMS Doctor Site Diagnosisへ渡すZIPを生成します。

## Apps Scriptへの反映
- 置換: `Code.gs`
- 置換: `appsscript.json`（既にRC10.3を適用済みなら内容変更はありません）
- `VERSION` はリポジトリ管理用で、Apps Script側に作成する必要はありません

## 通常の使い方
1. `1. 収集するサイトを選ぶ`
2. `2. 通常の診断データを収集（120日）`
3. 保存画面でGoogle Driveの保存先とEvidence ZIP名を確認する
4. `収集状況`シートで進捗・完了状況を確認する
5. 生成されたEvidence ZIPをSIMS Doctor Site Diagnosisで読み込む

詳しく調べる必要がある場合だけ、`追加の操作 → 詳しく収集する（180日）` を使用します。

## Evidence Packageの保存先
保存画面ではGoogle Drive内をフォルダー移動して保存先を選択できます。
選択した保存先は収集処理中の自動再開でも維持されます。

Evidence ZIP名は新しい収集開始時に、
`SIMS-Evidence-{サイト名}-{yyyyMMdd-HHmm}.zip`
の形式で自動生成されます。

## シート
通常利用で確認する主なシートは `収集状況` です。
収集処理用の内部シートは通常は非表示にしています。

## OAuth権限
v0.2.0では、現行機能に必要な以下のOAuth scopeを使用します。

- `https://www.googleapis.com/auth/spreadsheets.currentonly`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/script.scriptapp`
- `https://www.googleapis.com/auth/script.container.ui`

Drive scopeは、保存先フォルダーの参照とEvidence ZIP作成・保存に使用します。
`script.container.ui` はEvidence Package保存ダイアログの表示に使用します。

## 正式版について
v0.2.0はRC10.3の収集ロジックを変更せず正式化したものです。
RC1〜RC10.3の開発・検証履歴は `CHANGELOG.md` および各RC/AUDIT資料に残しています。
