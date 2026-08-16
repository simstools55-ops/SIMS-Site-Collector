# SIMS Site Collector v0.2.1

SIMS Site Collector v0.2.1 は、RC10.3までの実運用検証を基礎にした正式運用版です。
Search Consoleの診断用Evidenceを収集し、SIMS Doctor Site Diagnosisへ渡すZIPを生成します。

## v0.2.1 の変更
「収集状況」シートのバージョン表示を分かりやすくしました。

- `Collectorバージョン`：現在実行しているスクリプトのバージョン
- `収集時バージョン`：画面に表示しているEvidenceを収集した時点のCollectorバージョン

過去にRC版で収集したデータを表示している場合でも、現在のスクリプト版と収集時の版を混同しません。

## Apps Scriptへの反映
- 置換: `Code.gs`
- `appsscript.json`：変更なし
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

## 収集状況シート
通常利用で確認する主なシートは `収集状況` です。

`Collectorバージョン` は現在の `SDSC_VERSION` を表示します。
`収集時バージョン` は収集開始時にRunへ保存された `collectorVersion` を表示します。

このため、Collectorを更新したあとでも、既存Evidenceがどの版で収集されたものか追跡できます。

## OAuth権限
現行機能に必要な以下のOAuth scopeを使用します。

- `https://www.googleapis.com/auth/spreadsheets.currentonly`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/script.scriptapp`
- `https://www.googleapis.com/auth/script.container.ui`

## 互換性
v0.2.1ではSearch Console収集ロジック、Evidence Package契約、Diagnosisとの受け渡し仕様は変更していません。
