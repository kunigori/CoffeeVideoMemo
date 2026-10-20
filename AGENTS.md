# CoffeeVideoMemo — AI開発・変更ルール（AGENTS.md）

> Codex / Claude Code / その他のAIコーディングエージェント向け。変更前に本書と [ARCHITECTURE.md](./ARCHITECTURE.md) を読むこと。実機起動方法は [README.md](./README.md) を参照。

## 1. 基本ルール

1. プロジェクトの技術スタックは **React Native 0.88 + TypeScript + VisionCamera v4**。`package.json` のインストール済み正確な版を確認する。
2. 変更前に既存ソース・型・テスト・ビルド設定を調査する。存在しない機能やファイルを「既存」と決めつけない。
3. **`App.tsx` は100行以内。** 役割はエントリーポイントとプロバイダー構成に限定する。
4. ビジネスロジックをUIに実装しない。React副作用は `hooks/`、純粋ロジックは `domain/`、外部APIは `services/` とする。
5. アプリ実装コードは原則 `src/`。例外は `App.tsx`、`ios/`、`android/`、設定、テストなど。
6. 不要な依存追加・大規模リファクタリング・既存機能削除を行わない。要求した範囲に修正を限定する。
7. ネイティブ依存パッケージを導入・変更する**前**に、iOS `pod install`、Info.plist、AndroidManifest、Gradle、Xcode/Android再ビルドが必要かを明示する。
8. コンパイルできないサンプル、ダミーの成功処理、空の例外握りつぶし、根拠のないOS対応宣言を禁止する。
9. 仕様とコードに矛盾があれば、それを指摘し、影響範囲と最小の解決案を示す。

## 2. 30fps固定 — 変更禁止の要件

- `src/features/camera/constants.ts` の `TARGET_FPS = 30` を唯一の設定元とする。
- VisionCamera v4の `Camera` に渡す `fps` は単一数値 `30` とする。FPS範囲配列や24fps等への自動フォールバックを実装しない。
- `format.minFps <= 30 && format.maxFps >= 30` の対応確認を事前に行う。
- 30fps非対応端末では撮影を開始させず、理由を画面に表示する。
- `lowLightBoost` やその他の設定で可変FPSを招かないようにする。
- 録画30fpsとFrame Processorの解析頻度を混同しない。解析だけを間引いてよい。
- 実機のフレームドロップまでは設定値だけで保証できないため、録画結果を検証する。

## 3. AE（自動露出）ロック — 必須要件

- 対象: **Android/iOSの両方**。React Native/TypeScript側の呼び出しAPIは共通化する。
- **VisionCamera v4の公開JS APIだけでAEロックできると仮定しない。** `Camera.exposure` は露出補正でありAEロックではない。
- `src/features/camera/services/exposureLockService.ts` に `isSupported()` / `lock()` / `unlock()` の共通境界を実装する。
- `src/features/camera/hooks/useExposureLock.ts` は状態（unavailable/unsupported/unlocked/locking/locked/unlocking/error）をUIへ公開する。
- iOSは、VisionCameraが使用する同一 `AVCaptureDevice` へ接続して `exposureMode = .locked` を利用する。
- Androidは同じVisionCameraカメラセッション内でCamera2の `CONTROL_AE_LOCK` を利用する。CameraXなら当該版に適した相互運用方法を選ぶ。
- VisionCameraとは別のネイティブカメラセッションを開いて操作してはならない。
- 既存セッションへの接続手段が無い場合は、保守可能なVisionCamera v4パッチ/フォークまたは統合拡張を検討し、改造箇所を記録する。
- ハードウェア対応判定と、ロックが**実際に適用されたことの確認**を分ける。
- 成功を確認するまで `locked` を返さない。未実装・未確認なら `unavailable`/`error` とする。
- カメラ再構成、アプリ中断、復帰、切替時はロック状態を再評価する。二重呼出し・競合を防ぐ。
- 自動注湯検出付き録画はAEロック成立時のみ開始する。失敗時に偽の成功として処理を進めない。
- **iOS/Androidの実機で検証が終わるまで「AEロック実装完了」と報告しない。**

## 4. Frame Processor — 負荷とスレッド境界

- ROI内の差分・動体スコア抽出を担当させる。注湯・待機の最終判定は `domain/pourStateMachine.ts` で行う。
- VisionCamera v4に対応するWorklet APIを使い、Worklet上からReact Stateを直接更新しない。
- 解析頻度の初期目標は10fps。実測で調整可能だが録画は30fps固定のままとする。
- `runAtTargetFps`、必要なら `runAsync` を利用する際は採用版の正確なAPI・制約を確認する。
- フレーム全体の不要なCPUコピー、同期的な高負荷計算、毎フレームのJSブリッジ通知、無制限ログを避ける。
- ROI座標変換は画面向き・動画クロップ・センサー向きを考慮する。
- 検知サンプルはタイムスタンプ付きにし、重複・順序逆転・古いセッションのイベントを無視する。
- Frame Processorの故障を黙殺して正常な注湯イベントを生成しない。

## 5. テスト規約

- `domain/` の新規・修正ロジックには単体テストを必ず追加する。
- 状態マシンは開始/終了、短いノイズ、連続注湯、停止・再開、時刻異常、欠落サンプルをテストする。
- カメラのフォーマット選択は**30fps以外にフォールバックしない**ことをテストする。
- AEロックサービス／フックは、成功・非対応・失敗・二重呼出し・セッション破棄をモックで検証する。
- Android/iOSのAEロック・30fps・Frame Processorは実機試験が必要。ユニットテスト合格だけでは完了でない。
- 既存テストを削除してテストを通してはならない。失敗は原因と制約を報告する。
- 必要に応じTypeScript型チェック、lint、既存テスト、両OSビルドを実行する。プロジェクトに無いスクリプトを勝手に存在すると報告しない。

## 6. エラー処理とライフサイクル

- 権限拒否、カメラ初期化失敗、30fps非対応、AE未対応/失敗、録画失敗、ストレージ不足、OCR失敗、Frame Processor失敗を明示的に扱う。
- カメラがinactive、アプリがbackground、画面unmount、デバイス切替となった場合は関連する録画・解析・AE状態を安全に終了または無効化する。
- 録画ファイルは一時保存と永続保存を区別し、保存成功後に結果画面へ遷移する。
- エラーメッセージはユーザー向けと開発者診断向けを区別する。個人情報やフレーム画像を不用意にログへ出さない。
- 例外を捕捉したら回復方針を決める（再試行、ユーザー案内、機能停止）。失敗を成功扱いしない。

## 7. スプリント境界

1. **Sprint 1:** 30fps固定、撮影・録画、実AEロック（Android/iOS）、カメラ権限・中断への対応。
2. **Sprint 2:** 静止画撮影、OCRサービス、豆情報の照合。
3. **Sprint 3:** ROI Frame Processor、状態マシン、処理性能・誤検知評価。
4. **Sprint 4:** ログ統合、要約画面、動画保存、リグレッションテスト。

Sprintをまたぐ新機能は依存関係を先に説明する。必須機能（特にAEロック）が未完了のまま、後段が完成したと主張しない。

## 8. AIの変更報告フォーマット

変更のたび、簡潔に以下を報告する。

1. **変更内容:** 修正したファイルと要点。
2. **設計への影響:** レイヤー分離、FPS、AEロック、Frame Processorへの影響。
3. **ネイティブ作業:** iOS/Android別の設定・再ビルドの要否。
4. **検証結果:** 型チェック、テスト、ビルド、実機試験の実施／未実施を区別。
5. **残課題:** 実装前提、ハードウェア非対応、既知の制約。未完了を明示。

## 9. ドキュメントの扱い

- システム構造や設計方針が変わったら `ARCHITECTURE.md` を更新する。
- AIの実装ルールが変わったら `AGENTS.md` を更新する。
- コマンド・インストール方法・動作条件が変わったら `README.md` を更新する。
- 上記3ファイルで矛盾する記述を作らない。実コードが仕様と不一致なら、仕様変更と実装不備を区別して報告する。

## 10. Feature-based Architecture 規約

コードを編集・追加する際は、以下のアーキテクチャ規約を遵守すること。

1. 新規機能は原則 `src/features/<feature-name>/` 内に実装する。
2. 機能固有のUI（`screens/`, `components/`）・`hooks/`・`services/`・`constants.ts`・`types.ts` はその機能内に配置する。
3. 複数機能で共有する概念（データモデルや純粋ドメインロジック）のみ `src/domain/` 等に切り出す。
4. `src/shared/` を何でも入れるディレクトリにしない（特定機能に依存しない純粋な共通UI・汎用ユーティリティに限定する）。
5. 他のfeatureの内部ファイルへの直接依存を避ける（例：`features/map/` から `features/posts/screens/` や `features/camera/hooks/` を直接参照しない）。
6. 機能間共有が必要になった場合は、公開APIまたは共通層（`domain/`, `repositories/`, `platform/`）を設計する。
7. 循環依存を禁止する。
8. 既存のカメラ仕様（4K・30fps固定、フォールバック禁止）・AEロック仕様（7状態管理・二重呼出し防止）・録画仕様を維持する。
9. 過剰な抽象化を避ける。
10. 未実装機能の雛形（空ディレクトリやダミーファイル）を無意味に増やさない。
