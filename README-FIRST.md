# SIMS Site Collector v0.2.0-RC9

RC9は、利用者向け表示とEvidence Package保存操作を整理したSingle-Code版です。

## Apps Scriptへの反映
- 置換: `Code.gs`
- 変更なし: `appsscript.json`

## 通常の使い方
1. `収集するサイトを選ぶ`
2. `通常の診断データを収集（120日）`
3. 保存画面でGoogle Driveのフォルダとファイル名を選ぶ
4. `収集状況`シートで進捗を確認する

## シート
利用者が通常見るシートは `収集状況` だけです。内部データシートは非表示です。

## 保存画面について
Windowsのローカルフォルダを直接操作するものではありません。Google Drive内をフォルダ移動して保存先を選び、ZIPファイル名を指定する「名前を付けて保存」に近い操作です。

## 権限
`appsscript.json` はRC8から変更していません。Drive scopeは `https://www.googleapis.com/auth/drive` のままです。
