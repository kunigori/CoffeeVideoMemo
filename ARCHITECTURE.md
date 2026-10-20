# CoffeeVideoMemo — アーキテクチャ設計書

> 対象: React Native 0.88 / TypeScript / react-native-vision-camera v4 / Android・iOS  
> 文書の役割: システム設計・構成・技術上の制約を定義する。AIへの作業指示は [AGENTS.md](./AGENTS.md)、起動方法は [README.md](./README.md) を参照。  
> 状態: 設計仕様。記載された機能が実装済みであることを意味しない。

## 1. 目的と基本方針

CoffeeVideoMemoは、コーヒー抽出の動画を撮影し、豆情報のOCRおよび注湯・待機の検出結果をタイムスタンプ付きで記録・確認するアプリケーションである。Sprint 1〜4の段階的開発を行う。

- **Android/iOS共通のUIと業務ロジックはTypeScript/React Nativeで実装**する。
- カメラ・OCR・画像処理などの端末機能はフック／サービス／必要に応じたネイティブアダプターで分離する。
- 録画フレームレートは **30fps固定（可変FPS・代替FPSへのフォールバックなし）**。
- 自動注湯検出を行う撮影では、AE（Auto Exposure：自動露出）ロックが成立していることを前提とする。
- UIは状態遷移の判定ロジックや画像解析アルゴリズムを直接持たない。
- 機能の未実装・非対応・失敗を「成功」として扱わない。

## 2. 技術スタックと前提

| 項目 | 方針 |
| --- | --- |
| フレームワーク | React Native 0.88（実際のパッチバージョンはpackage.jsonを優先） |
| 言語 | TypeScript |
| カメラ | react-native-vision-camera v4（v5のAPIを混在させない） |
| リアルタイム処理 | VisionCamera v4 Frame Processor / react-native-worklets-core（対応バージョンを確認） |
| プラットフォーム | iOS / Android（実機検証必須） |
| AEロック | TypeScript共通インターフェース + **同一VisionCameraセッションへ接続する**ネイティブ実装 |
| テスト | domainのユニットテスト、端末機能の結合／実機テスト |

**互換性ゲート:** RN 0.88と採用するVisionCamera v4パッチ版、Worklets、iOS/Androidツールチェーンの組み合わせは、作業開始時にビルドを通して確認する。ビルド未確認の組み合わせを「対応済み」と断定しない。

## 3. 全体構造（Feature-based Architecture）

本プロジェクトは、カメラ撮影だけでなく将来的な**動画解析（情報抽出）・解析結果の確認/編集・動画や解析情報の投稿・位置情報のマップ表示**への機能拡張を見据え、**Feature-based Architecture（機能単位のディレクトリ構成）**を採用する。

```text
App.tsx
  ↓
app/（ナビゲーション・全体プロバイダー ※将来拡張時）
  ↓
features/（機能単位のモジュール：camera, 将来の video-analysis / posts / map）
  ├── screens/      （機能内の画面統合）
  ├── components/   （機能固有のUI表示・入力）
  ├── hooks/        （機能固有のReact状態・ライフサイクル・副作用制御）
  ├── services/     （機能固有の外部API・ネイティブ連携窓口）
  ├── constants.ts  （機能固有の定数）
  └── types.ts      （機能固有の型定義）
  ↓
domain/（複数機能で共有するデータモデル・純粋ロジック）
```

### 3.1 各ディレクトリの責務

- `App.tsx`: 薄いエントリーポイント（100行以内）。SafeAreaやルート画面（または将来のナビゲーション）のマウントのみを行う。
- `src/app/`: アプリ全体の画面遷移（`navigation/`）やグローバルプロバイダー（`providers/`）を配置する層（※単一画面の現時点では空ディレクトリを作らず、`App.tsx` から直接画面をマウントする）。
- `src/features/`: **機能単位のモジュール群**。各機能（現在は `camera/`）の内部に `screens/`, `components/`, `hooks/`, `services/`, `constants.ts`, `types.ts` を凝集させる。
  - `components/`: 表示とユーザー入力。カメラ・OCR・ファイルAPIを直接呼ばない。
  - `screens/`: フックを組み合わせ、画面ごとの表示と操作フローを構成する。
  - `hooks/`: Reactのライフサイクル、非同期処理、デバイスイベント、サービス呼び出しを調停する。
  - `services/`: AEロック、録画制御、OCR実行など、外部API・ネイティブモジュールとの境界。
- `src/domain/`: 複数機能（カメラ・動画解析・投稿・マップなど）で共有するデータモデル（将来の `Video`, `VideoAnalysis`, `Post`, `Location` 等）およびReact非依存の純粋関数（状態マシン、文字列照合、時間判定）。
- `src/repositories/`: 投稿・動画・解析結果などの永続化データ保存と取得（DB・ローカルストレージ・リモートAPI通信の抽象化境界）。
- `src/platform/`: 複数の機能から共通利用されるネイティブ・OS依存処理（例：将来の `platform/media/` による共通メディアファイル管理、位置情報・権限基盤など）。
- `src/shared/`: 特定の機能（feature）やドメイン知識に依存しない汎用UI部品（`shared/components/`）および汎用ユーティリティ関数（`shared/utils/`）。

### 3.2 機能間の依存ルール

以下の単方向依存を基本方針とし、**循環依存およびfeature間の内部実装への直接依存を禁止**する。

```text
App
 ↓
app
 ↓
features
 ↓
domain

features → repositories
features → platform
features → shared

repositories → domain
platform     → domain（必要な場合のみ）
shared       → 外側のアプリ固有層に依存しない
```

禁止事項（アンチパターン）:
- あるfeatureが別featureの内部ファイル（例：`features/map/` から `features/posts/screens/` や `features/camera/hooks/`）へ直接依存すること。
- `domain/` がReactコンポーネントや画面、ネイティブモジュールに依存すること。
- `shared/` が特定featureの内部実装に依存すること、または置き場所に迷ったファイルを無秩序に `shared/` へ入れること。
- 機能間でデータや型を共有する必要が生じた場合は、feature同士を直接参照させず、`domain/`（共有モデル）や `repositories/`、`platform/` を通じて連携する。

## 4. ディレクトリ構成

### 4.1 現在の実装構成（Sprint 1 時点）

必要のない空ディレクトリや未使用のプレースホルダーファイルは作成せず、実装済みの機能のみを配置している。

```text
CoffeeVideoMemo/
├── App.tsx                                         # エントリー/プロバイダーのみ。100行以内
├── ARCHITECTURE.md                                 # 本書（システム設計）
├── AGENTS.md                                       # AIによる変更ルール
├── README.md                                       # 環境構築・起動・確認方法
├── package.json
├── tsconfig.json
├── babel.config.js
├── patches/
│   └── react-native-vision-camera+4.5.3.patch      # VisionCamera v4 へのAEロック・写真保存パッチ
├── ios/                                            # iOSネイティブプロジェクト
├── android/                                        # Androidネイティブプロジェクト
├── src/
│   └── features/
│       └── camera/                                 # カメラ撮影機能モジュール（実装済み）
│           ├── screens/
│           │   └── CameraScreen.tsx
│           ├── components/
│           │   ├── MainNavRail.tsx
│           │   ├── CameraToolColumn.tsx
│           │   ├── OptionFlyoutOverlay.tsx
│           │   ├── TopStatusHud.tsx
│           │   ├── BottomBrewHud.tsx
│           │   └── RecordingControls.tsx
│           ├── hooks/
│           │   ├── useCameraConfig.ts              # 4K・30fps固定フォーマット選択・カメラ状態管理
│           │   └── useExposureLock.ts              # AEロックのUI向け7状態管理
│           ├── services/
│           │   ├── exposureLockService.ts          # AEロック共通API（ネイティブ連携）
│           │   └── recordingService.ts             # 録画開始/停止・30fpsタイムコード・写真フォルダ保存
│           ├── constants.ts                        # TARGET_FPS=30、4K解像度、EV/シャッター定数
│           └── types.ts                            # カメラ録画状態・録画ファイルメタデータ型
└── __tests__/
    ├── App.test.tsx
    ├── cameraConfig.test.ts
    ├── exposureLock.test.ts
    └── recordingService.test.ts
```

`App.tsx`、`ios/`、`android/`、`patches/`、ビルド設定・テスト設定は `src/` 配下への配置ルールの**例外**とする。

### 4.2 将来の機能拡張方針（未実装・設計上の配置予定）

今後の開発フェーズで以下の機能を段階的に追加する際は、下記の構成に従って拡張する（※現時点では未実装であり、実装時に必要なディレクトリのみを作成する）。

```text
src/
├── app/
│   ├── navigation/             # 複数画面（カメラ・解析編集・投稿・マップ）間の画面遷移
│   └── providers/              # アプリ横断の状態・コンテキストプロバイダー
├── features/
│   ├── camera/                 # 1. カメラで動画を撮影する（実装済み）
│   ├── video-analysis/         # 2. 撮影した動画・静止画から情報を解析・抽出する（OCR・ROI注湯検知・解析結果編集）
│   ├── posts/                  # 3. 解析結果や動画を投稿・一覧・詳細表示する
│   └── map/                    # 4. 投稿に紐づく位置情報を地図上に表示する
├── domain/                     # 複数機能で共有するモデル（Video, VideoAnalysis, Post, Location）と純粋ロジック
├── repositories/               # 投稿・動画・解析データの保存と取得
├── platform/                   # 複数機能で共有するOS/ネイティブ処理（platform/media 等）
└── shared/
    ├── components/             # 特定機能に依存しない汎用UIコンポーネント
    └── utils/                  # 汎用ユーティリティ
```

## 5. カメラ仕様：30fps固定

### 5.1 必須条件

1. `TARGET_FPS = 30` を共通定数として定義する。
2. 使用する `CameraDeviceFormat` は `minFps <= 30 && maxFps >= 30` を満たすものに限る。
3. `Camera` コンポーネントには **`fps={30}`（単一数値）**を設定する。`fps={[24, 30]}` 等の可変範囲設定は禁止。
4. 対応フォーマットがなければ録画ボタンを無効にし、ユーザーに「このカメラは30fps録画に対応していません」と表示する。**24fps等へ自動変更しない**。
5. 暗所でのFPS低下を防ぐため、低照度時の可変FPSにつながる機能（例: `lowLightBoost`）を有効にしない。`videoHdr` 等も選択フォーマットとの整合性を確認する。
6. 30fps指定は撮影設定の要求値であり、端末負荷等による実際のフレーム欠落を数学的に保証するものではない。実機テストで出力ファイルのフレームレートとドロップを確認する。
7. 注湯時間の計測は `フレーム数 / 30` のみを根拠にせず、**単調増加する時刻またはフレームのタイムスタンプ**を利用する。時刻基準と記録開始時刻の対応を明示する。

### 5.2 選択ロジック（TypeScript実装方針）

```ts
// src/features/camera/constants.ts
export const TARGET_FPS = 30 as const;
export const INITIAL_ANALYSIS_FPS = 10 as const; // ROI解析の初期目安。録画FPSとは独立
export const PREFERRED_VIDEO_WIDTH = 3840 as const;
export const PREFERRED_VIDEO_HEIGHT = 2160 as const;

// src/features/camera/hooks/useCameraConfig.ts などで採用する判定
const candidates = device.formats.filter(
  format => format.minFps <= TARGET_FPS && TARGET_FPS <= format.maxFps,
);

if (candidates.length === 0) {
  // 30fps非対応として録画不可。フォールバックは禁止。
}
// candidates内から目的の画角・解像度（4K 3840x2160優先）を満たすformatを選ぶ。
// <Camera format={selectedFormat} fps={TARGET_FPS} ... />
```

候補の選択順序（解像度や画角）はSprint 1で確定し、選定理由をコメント／テストに残す。

## 6. AEロック：Android/iOS共通API

### 6.1 目標と重要な制約

注湯検出時にカメラの自動露出変化を抑えるため、**現在のAE値をロック・解除する**。AFロック（ピント固定）や露出補正（EV設定）とは別機能とする。

**VisionCamera v4にはAndroid/iOS共通の公開AEロックAPIがない。React NativeのTypeScriptだけでは真のAEロックを実現できない。** したがってアプリからは共通TypeScript APIを呼ぶが、カメラを保持している同一ネイティブセッションへの連携が必要。ビルド・端末試験まで終わるまで「対応済み」と表記しない。

`<Camera exposure={0} />`、`focus()`、AEロックを模したフラグ、Frame Processorの画像の明るさ補正は**AEロックの代替ではない**。

### 6.2 共通API契約

```ts
// src/features/camera/services/exposureLockService.ts に設けるインターフェース契約
export type ExposureLockState =
  | 'unavailable'  // ネイティブ機能未実装、または現セッションと接続できない
  | 'unsupported'  // カメラハードウェアが非対応
  | 'unlocked'
  | 'locking'
  | 'locked'
  | 'unlocking'
  | 'error';

export interface ExposureLockAdapter {
  isSupported(): Promise<boolean>;
  lock(): Promise<void>;     // 成功時は現セッションのロック成立を確認
  unlock(): Promise<void>;   // 成功時は解除成立を確認
}
```

- `useExposureLock.ts` はこのアダプターを介して状態管理し、画面表示と撮影可否へ反映する。
- アダプターは**画面が保持する現在のVisionCamera v4セッション**へアクセスする。別のカメラを勝手にオープンしない。
- カメラ起動→AE収束（または適切なタイミング）→lock→実行結果確認→録画開始の順にする。
- `lock()` が呼べただけで成功と見なさない。可能ならキャプチャ結果・露出モードによってロック成立を確認する。
- セッションの再作成・カメラ切替・中断・バックグラウンド移行時はロック状態を無効化し、復帰時に再評価する。
- 解除は停止処理と合わせて行い、失敗も記録する。必要なら再初期化時に初期状態へ戻す。
- **AEロックと30fpsは別要件。** 露光時間の制約等で30fpsが維持できない構成は不合格とする。

### 6.3 iOSネイティブ側（Swift）

- VisionCameraが使用している `AVCaptureDevice` を特定し、そのデバイスの制御キューで処理する。
- `isExposureModeSupported(.locked)` を確認する。
- `lockForConfiguration()` → `exposureMode = .locked` → `unlockForConfiguration()` を適切な例外処理付きで行う。
- 解除時は対応する自動露出モード（通常 `.continuousAutoExposure`）へ戻す。
- VisionCameraのセッション再設定により上書きされる可能性を考慮する。**別セッションのデバイスを変更しただけで成功としない**。

### 6.4 Androidネイティブ側（Kotlin）

- 実際に固定したVisionCamera v4パッチ版のカメラ実装を調査し、同一カメラセッションのキャプチャ制御へ接続する。
- Camera2の場合は `CaptureRequest.CONTROL_AE_LOCK = true/false` を同一セッションの繰り返しリクエストへ反映する。
- CameraX経由の実装であれば利用版に合致するCamera2相互運用APIを用いる。**VisionCameraがカメラを所有する状態で独立したCamera2セッションを作成しない**。
- 対応判定に `CameraCharacteristics.CONTROL_AE_LOCK_AVAILABLE` を使用し、実際のロック反映を確認する。
- 他のCamera2/CameraX設定と競合しないよう、露出補正・フレームレート・再構成時の復元順を検証する。

### 6.5 実装方法・完了条件

実装経路はVisionCamera v4内部への**保守可能なパッチ／フォーク**、または現セッションを安全に参照できる拡張とする。通常の独立 `NativeModule` を作っただけではVisionCamera内部のアクティブセッションにアクセスできるとは限らない。

**完了条件:** iOS/Androidの実機で (1) ロック可否判定、(2) ロック後に明るさを変えても自動露出が追従しないこと、(3) アンロック後の再追従、(4) 30fps録画との共存、(5) カメラ停止・復帰後の再ロックを確認する。

**撮影の扱い:** 自動注湯検出付き録画はAEロック成立時のみ開始できる。未対応・失敗時には理由と再試行の案内を表示し、成功したふりをして解析を開始しない。

## 7. Frame Processor（Sprint 3）

### 7.1 責務

- ROI（Region of Interest: 注湯を観測する画面領域）内の動体情報を抽出する。
- フレーム処理部が返すのは、時刻・動体スコア・信頼度など最小限の結果。
- 「注湯開始」「注湯停止」「待機」の判定は `domain/pourStateMachine.ts` の純粋関数で実行する。
- Worklet上でReact State、画面操作、通常のJSモジュール・非対応APIを直接呼び出さない。

### 7.2 性能と安全性

1. 録画30fpsは固定。**解析実行頻度のみ独立して間引く**。初期目標は `INITIAL_ANALYSIS_FPS = 10`、実機性能・検出精度に合わせて見直す。
2. VisionCamera v4の `runAtTargetFps` や必要に応じ `runAsync` を検討する。ただし、APIやワークレット実行環境は利用するパッチ版で検証する。
3. フレーム全体をJSへコピーしない。ROIの切り出し・縮小・輝度差分などを優先し、重い処理はネイティブFrame Processor Pluginの利用を検討する。
4. 30fps時の1フレーム間隔は約33.3ms。録画・プレビューへの影響を実測し、フレーム処理の所要時間と処理落ちを記録する。
5. 毎フレームのReact State更新、詳細ログ出力、無制限のイベントキューを禁止。変化時や必要な頻度だけ通知する。
6. ROIは向き・センサー回転・プレビューのクロップ・画面縦横比に応じて正しく座標変換する。
7. 時刻順序の乱れ、フレーム欠落、セッション再開後の古いイベントを検出し、無効データを破棄する。
8. Frame Processor障害時は自動注湯検出を停止し、ユーザーへ明示する。映像録画と判定ログが食い違わないよう整合性を保つ。

### 7.3 データ契約（例）

```ts
type MotionSample = {
  timestampMs: number;  // 統一した単調時刻基準
  motionScore: number;  // ROI動体スコア
  confidence: number;   // 0〜1、計算できない場合は設計を再検討
};

type PourEvent = {
  type: 'pour-start' | 'pour-end' | 'pause-start' | 'pause-end';
  elapsedMs: number;    // 録画開始を0とした相対時刻
};
```

しきい値、ヒステリシス、最短継続時間、停止時の確定方法は `domain/` に定義してテストする。状態マシンは前回状態と新しいサンプルを入力として次状態・イベントを返す純粋ロジックにする。

## 8. OCRと録画ファイル

- `useBeanOcr.ts` は撮影とOCRサービスの実行を調停し、OCRの具体的なライブラリ呼び出しは `ocrService.ts` に閉じ込める。
- `beanMatcher.ts` はOCR文字列の正規化・抽出・照合のみを行い、ライブラリ・DBアクセスから独立させる。
- 動画の一時パスと永続パスを区別し、保存完了を確認してから要約画面へ遷移する。
- 録画中断・保存失敗・空ファイル・容量不足・アプリ終了に備え、不要な一時ファイルを安全に削除する。
- 将来のDB保存は `services/` のリポジトリ境界を追加し、UIや`domain/`から直接アクセスしない。
- 撮影結果には端末OS、選択したカメラ、設定FPS、測定した録画FPS（確認できる場合）、AE状態、録画開始基準時刻、判定イベントを記録する。

## 9. エラー処理方針

| 場面 | 方針 |
| --- | --- |
| カメラ権限拒否 | 許可方法を案内。録画開始禁止 |
| カメラ不在・初期化失敗 | リトライ/設定案内。無限リトライ禁止 |
| 30fps非対応 | 録画不可。別FPSへのフォールバック禁止 |
| AEロック未対応・失敗 | 自動検出付き録画を開始しない。理由を表示 |
| カメラ中断・バックグラウンド | 録画/解析/AE状態を一貫して停止・破棄・復元 |
| 録画開始・停止・保存失敗 | エラー表示、状態復帰、一時ファイルの安全なクリーンアップ |
| OCR失敗 | 再試行または手動入力へ誘導。空結果を成功扱いしない |
| Frame Processor失敗 | 解析停止、判定の無効化、診断情報の記録 |
| 時刻不整合・順序逆転 | 破棄またはエラー扱いし、負の経過時間を作らない |

ログには診断に必要なエラーコード・OS・端末情報・セッション状態を記録する。撮影内容、OCRで得た個人情報、ファイルの機密内容を無条件で出力しない。

## 10. テストと受け入れ条件

### ユニットテスト（毎回）

- `pourStateMachine`: 開始/停止、ノイズ1回、チャタリング、連続注湯、短時間の中断、フレーム欠落、時刻逆転、録画停止時の確定。
- `beanMatcher`: 正規化、空文字、OCR誤認識、複数候補、照合失敗。
- `cameraConfig`: 30fps対応/非対応、候補選択、可変FPSの不使用。
- `useExposureLock`: 非対応、成功、失敗、二重ロック、解除、セッション切替（モックによるテスト）。

### Android/iOS実機テスト（Sprint 1から）

- 30fps設定、録画ファイルのFPS・長さ、暗所、端末発熱時の挙動。
- AEロック成功時の明度安定、解除後の露出追従、権限拒否、カメラ切替、中断、バックグラウンド復帰。
- 録画中のFrame Processor実行とプレビュー/録画の安定性。
- 長時間録画時のメモリ、電池、ストレージ、Frame Processorの処理遅延。

テスト不可または未実施の項目は完了済みと書かず、検証状況を記録する。シミュレーター・エミュレーターだけでカメラ機能を合格としない。

## 11. スプリント計画

| Sprint | 主な成果 | 完了ゲート |
| --- | --- | --- |
| 1 | カメラプレビュー、権限、30fps固定、iOS/Android共通AEロック、動画録画 | 両OS実機で30fpsとAEロックを検証 |
| 2 | 静止画撮影、豆パッケージOCR、文字列照合 | 正常系と失敗系を確認 |
| 3 | ROI検出、Frame Processor、注湯状態マシン | 録画30fps維持・誤検知評価・単体テスト |
| 4 | ログ統合、要約画面、保存・復元、品質改善 | 通しテスト、エラー時復帰、実機検証 |

## 12. 技術参考資料

- VisionCamera v4 — CameraProps / FPS: https://visioncamera4.margelo.com/docs/api/interfaces/CameraProps
- VisionCamera v4 — Frame Processors: https://visioncamera4.margelo.com/docs/guides/frame-processors
- VisionCamera v4 — Recording Videos: https://visioncamera4.margelo.com/docs/guides/recording-videos
- Apple — AVCaptureDevice.ExposureMode: https://developer.apple.com/documentation/avfoundation/avcapturedevice/exposuremode-swift.enum
- Android — CaptureRequest.CONTROL_AE_LOCK: https://developer.android.com/reference/android/hardware/camera2/CaptureRequest
- Android — CameraCharacteristics.CONTROL_AE_LOCK_AVAILABLE: https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics

> 注意: ドキュメントにあるAPI名と実際の採用パッケージの型定義を照合してから実装する。v5専用APIをv4のコードへコピーしない。
