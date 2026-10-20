# CoffeeVideoMemo

コーヒー抽出動画の撮影、豆情報のOCR、注湯・待機イベントの検出とタイムスタンプ付き記録を目指す **React Native（TypeScript）** アプリです。

> 本READMEは開発準備のための文書です。現時点で各スプリントの機能がすべて実装されていることを保証しません。

## ドキュメントの読み方

| ファイル | 内容 |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | アプリ構造、ディレクトリ設計、30fps、AEロック、Frame Processorの技術仕様 |
| [AGENTS.md](./AGENTS.md) | Codex等のAIが変更するときのルールと検証・報告条件 |
| `README.md`（本書） | 開発環境、起動方法、確認手順 |

## 主要技術と機能

- React Native 0.88 / TypeScript
- react-native-vision-camera v4
- **30fps固定**の動画撮影（24fps等への自動フォールバックなし）
- Android・iOS両対応を目標とする **AEロック**
- コーヒー豆情報のOCR
- Frame ProcessorによるROI動体検知
- 注湯・待機タイミングの記録と確認

**AEロックに関する注意:** VisionCamera v4の公開TypeScript APIだけでは真のAEロックはできません。React Native側は共通フックを使用しますが、iOS/AndroidでVisionCameraが所有するカメラセッションへ接続するネイティブ拡張が必要です。機能の有効化や完了判定は [ARCHITECTURE.md §6](./ARCHITECTURE.md) の受け入れ条件に従ってください。

## 開発環境

- macOS：iOSアプリのビルドに必要（Xcode、CocoaPods）
- Android Studio / Android SDK / JDK：Androidビルドに必要
- Node.js / npm：React Native 0.88と `package.json` / lockfile に適合するバージョンを使用
- Android/iOS実機：カメラ、AEロック、Frame Processorの検証に必要

ツールの正確な最小バージョンはReact Native 0.88の公式環境設定・プロジェクトのGradle/Podfile/lockfileを優先します。既存プロジェクトを前提としており、この文書だけで新規プロジェクトのネイティブ雛形が作成されるものではありません。

## セットアップ（既存React Native CLIプロジェクト）

プロジェクトルートで依存関係をインストールします。既存のlockfileに合わせて`npm ci`か`npm install`を選択してください。

```bash
npm ci
```

macOSでiOS向けのネイティブ依存をインストールします。

```bash
cd ios
pod install
cd ..
```

Metroを起動します。

```bash
npx react-native start
```

別のターミナルで対象プラットフォームを起動します。

```bash
# Android
npx react-native run-android

# iOS（macOSのみ）
npx react-native run-ios
```

- `npm ci` は `package-lock.json` が存在し、`package.json` と整合している場合に利用できます。別のパッケージマネージャーを採用している場合は、そのlockfileに従ってください。
- 実機向けの署名・Xcode設定・Android権限は、ローカルのプロジェクト設定と対象OSで確認してください。
- 新しいネイティブ依存の追加後は、必要な `pod install`、Gradle同期、ネイティブ再ビルドを実施してください。

## カメラ権限

- Androidではカメラ権限をManifestおよびランタイムで管理します。音声録音機能を使用する場合はマイク権限も必要です。
- iOSでは `Info.plist` にカメラ利用目的の説明を記述します。音声録音機能を使用する場合はマイクの利用目的も記述します。
- 権限拒否時は設定への誘導を表示し、撮影を開始しません。

権限名や現行設定は `ios/`、`android/` の実ファイルで必ず確認してください。

## 撮影時の期待動作

1. カメラ権限を確認してプレビューを開始する。
2. 対象カメラが30fpsに対応するフォーマットを持つか確認する。非対応の場合は撮影ボタンを無効化する。
3. AEの自動調整が落ち着いたら、Android/iOS共通APIを通じてAEロックする。
4. AEロックの成立を確認してから、30fps録画と注湯検出を開始する。
5. Frame ProcessorはROIだけを必要な頻度で解析し、`domain` の状態マシンが注湯ログを記録する。
6. 録画停止後に動画とイベントログを保存し、要約画面で確認する。
7. カメラ中断・バックグラウンド移行・ロック失敗時は安全に処理を停止し、状態を再評価する。

**30fps固定の意味:** `<Camera fps={30} />` のようにフレームレートを固定値で要求します。デバイスが30fpsに非対応なら24fps等へ下げません。実際の録画に処理落ちが無いことは実機で別途確認します。

## 動作確認チェック

### Sprint 1：カメラ/AEロック

- [ ] iOS実機でプレビューと30fps録画が動く
- [ ] Android実機でプレビューと30fps録画が動く
- [ ] 30fps非対応時に録画せずエラー表示する
- [ ] 両OSでAEロック/解除を行い、明るさの変化に対する露出追従を確認する
- [ ] ロック未対応時に成功表示や自動注湯判定を行わない
- [ ] 権限拒否、バックグラウンド移行、録画中断から復帰できる

### Sprint 2：OCR

- [ ] 静止画キャプチャ、OCR、文字列照合が動く
- [ ] 読み取り失敗・未一致でも復帰または手動入力が可能

### Sprint 3：Frame Processor

- [ ] ROIの位置が画面回転・解像度変更後も一致する
- [ ] 注湯開始、停止、再開、誤検知抑制を検証した
- [ ] 解析を実行しても録画の30fps設定と安定性を維持できる

### Sprint 4：統合

- [ ] 動画保存、タイムスタンプ、要約画面が整合する
- [ ] 保存失敗・容量不足・アプリ終了時の一時ファイルを適切に処理する
- [ ] ユニットテスト・両OSの実機テスト結果を記録した

## テストコマンド

実際のテストスクリプト名は `package.json` を確認してください。一般的には以下のような設定を利用します。

```bash
# package.jsonに対応スクリプトが存在する場合のみ実行
npm test

# TypeScript設定が存在する場合の例
npx tsc --noEmit
```

テストが未設定の場合は先にテストランナーと設定ファイルを導入してください。コマンドを実行していないのに「テスト済み」とは記載しません。

## トラブルシューティング

| 現象 | 確認箇所 |
| --- | --- |
| カメラ画面が出ない | カメラ権限、実機、VisionCameraのビルド、カメラ初期化エラー |
| 30fps録画できない | 選択した `CameraDeviceFormat` の `minFps` / `maxFps` と `fps={30}` |
| AEロックできない | ネイティブ統合の有無、ハードウェア対応、現在のセッション、ロック状態の確認 |
| Frame Processorが動かない | Workletsの対応バージョン、Babel設定、プラグインのネイティブビルド |
| 動画を保存できない | 一時パス、保存先、容量不足、ファイルアクセス、エラーハンドリング |

## 開発ステータスの扱い

`ARCHITECTURE.md` は**目標仕様**です。実装状況・ビルド結果・iOS/Android実機検証状況は、コードと検証ログに基づいて更新してください。AIが実装を行う際は、必ず [AGENTS.md](./AGENTS.md) を遵守します。

## 公式リファレンス

- VisionCamera v4: https://visioncamera4.margelo.com/docs
- React Native 環境構築: https://reactnative.dev/docs/set-up-your-environment
- Apple AVFoundation Exposure: https://developer.apple.com/documentation/avfoundation/capture-device-exposure
- Android Camera2 CONTROL_AE_LOCK: https://developer.android.com/reference/android/hardware/camera2/CaptureRequest
