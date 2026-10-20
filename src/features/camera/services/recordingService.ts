import { NativeModules } from 'react-native';
import type {
  CameraCaptureError,
  RecordVideoOptions,
  VideoFile,
} from 'react-native-vision-camera';
import { TARGET_FPS } from '../constants';
import type { RecordedVideoInfo, VideoStorageStatus } from '../types';
import type { ExposureLockState } from './exposureLockService';

/**
 * VisionCameraの録画制御に必要な最小インターフェース（モックテスト可能）
 */
export interface CameraRecorderHandle {
  startRecording(options: RecordVideoOptions): void;
  stopRecording(): Promise<void>;
  cancelRecording(): Promise<void>;
}

export class RecordingServiceError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RecordingServiceError';
    this.code = code;
  }
}

/**
 * 単調増加する現在時刻（ミリ秒）を取得する。
 * ARCHITECTURE.md §5.1.7 / §9 に従い、フレーム数/30ではなく単調時刻基準を用いる。
 */
export function getMonotonicTimeMs(): number {
  const perf = (
    globalThis as { performance?: { now?: () => number } }
  ).performance;
  if (perf && typeof perf.now === 'function') {
    return perf.now();
  }
  return Date.now();
}

/**
 * 開始時刻と現在時刻から経過ミリ秒を算出する（時刻不整合時も負の値を返さない）。
 */
export function calculateElapsedMs(
  startMonotonicMs: number,
  currentMonotonicMs: number = getMonotonicTimeMs(),
): number {
  const diff = currentMonotonicMs - startMonotonicMs;
  if (!Number.isFinite(diff) || diff < 0) {
    return 0;
  }
  return Math.floor(diff);
}

/**
 * 経過時間（ミリ秒）を `MM:SS.d` 形式にフォーマットする。
 */
export function formatElapsedDuration(elapsedMs: number): string {
  const safeMs = Math.max(0, Math.floor(elapsedMs));
  const totalTenths = Math.floor(safeMs / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}.${tenths}`;
}

/**
 * 経過時間（ミリ秒）を30fps基準のSMPTEタイムコード `HH:MM:SS:FF`（00:00:00:00）形式にフォーマットする。
 * FF は 00 〜 29 のフレーム番号。
 */
export function formatTimecode30Fps(elapsedMs: number): string {
  const safeMs = Math.max(0, Math.floor(elapsedMs));
  const totalFrames = Math.floor((safeMs * TARGET_FPS) / 1000);
  const frames = totalFrames % TARGET_FPS;
  const totalSeconds = Math.floor(totalFrames / TARGET_FPS);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const ff = String(frames).padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

export interface CreateRecordedVideoInfoParams {
  videoFile: VideoFile;
  startedAtEpochMs: number;
  finishedAtEpochMs: number;
  measuredDurationMs: number;
  aeLockStateAtStart: ExposureLockState;
  autoPourDetectionEnabled: boolean;
  storageStatus?: VideoStorageStatus;
}

/**
 * VisionCameraから返却されたVideoFileを検証し、一時保存状態のRecordedVideoInfoを生成する。
 * パスが空、または不正な場合はエラーを送出し、失敗を成功として扱わない。
 */
export function buildRecordedVideoInfo(
  params: CreateRecordedVideoInfoParams,
): RecordedVideoInfo {
  const {
    videoFile,
    startedAtEpochMs,
    finishedAtEpochMs,
    measuredDurationMs,
    aeLockStateAtStart,
    autoPourDetectionEnabled,
    storageStatus = 'temporary',
  } = params;

  const trimmedPath =
    typeof videoFile?.path === 'string' ? videoFile.path.trim() : '';
  if (!trimmedPath) {
    throw new RecordingServiceError(
      'capture/empty-video-path',
      '録画完了イベントを受信しましたが、出力ファイルパスが空です。',
    );
  }

  // 自動注湯検出はAEロック成立時のみ有効化可能（AGENTS.md §3）
  const safeAutoPourEnabled =
    aeLockStateAtStart === 'locked' && autoPourDetectionEnabled;

  return {
    path: trimmedPath,
    storageStatus,
    durationSec:
      typeof videoFile.duration === 'number' && videoFile.duration >= 0
        ? videoFile.duration
        : measuredDurationMs / 1000,
    measuredDurationMs: Math.max(0, measuredDurationMs),
    width: typeof videoFile.width === 'number' ? videoFile.width : 0,
    height: typeof videoFile.height === 'number' ? videoFile.height : 0,
    requestedFps: TARGET_FPS,
    aeLockStateAtStart,
    autoPourDetectionEnabled: safeAutoPourEnabled,
    startedAtEpochMs,
    finishedAtEpochMs: Math.max(startedAtEpochMs, finishedAtEpochMs),
  };
}

/**
 * ファイル永続化・一時ファイル削除のアダプターインターフェース
 * ARCHITECTURE.md §8 に従い、一時保存（temporary）と永続保存（persisted）を明示的に区別する。
 */
export interface VideoPersistenceAdapter {
  persistTemporaryVideo(tempPath: string): Promise<string>;
  deleteTemporaryVideo(tempPath: string): Promise<void>;
}

export interface NativePhotoLibraryModule {
  saveVideoToPhotoLibrary?: (filePath: string) => Promise<string>;
}

/**
 * iOS（PHPhotoLibrary / デフォルトの「写真」アプリ）および
 * Android（MediaStore / デフォルトのギャラリー・DCIM/Camera）へ動画を保存するネイティブアダプターを生成する。
 */
export function createNativePhotoLibraryPersistenceAdapter(
  nativeModule: NativePhotoLibraryModule | undefined = (
    NativeModules as { CameraView?: NativePhotoLibraryModule }
  ).CameraView,
): VideoPersistenceAdapter {
  return {
    async persistTemporaryVideo(tempPath: string): Promise<string> {
      if (
        !nativeModule ||
        typeof nativeModule.saveVideoToPhotoLibrary !== 'function'
      ) {
        throw new RecordingServiceError(
          'storage/persistence-not-configured',
          '写真ライブラリ保存用のネイティブモジュールが利用できません。',
        );
      }

      try {
        const savedIdOrUri =
          await nativeModule.saveVideoToPhotoLibrary(tempPath);
        const trimmed =
          typeof savedIdOrUri === 'string' ? savedIdOrUri.trim() : '';
        if (!trimmed) {
          throw new RecordingServiceError(
            'storage/invalid-persisted-path',
            '写真ライブラリへの保存結果識別子を取得できませんでした。',
          );
        }
        if (
          trimmed.startsWith('ph://') ||
          trimmed.startsWith('content://') ||
          trimmed.startsWith('file://')
        ) {
          return trimmed;
        }
        return `ph://${trimmed}`;
      } catch (err) {
        if (err instanceof RecordingServiceError) {
          throw err;
        }
        const message =
          err instanceof Error
            ? err.message
            : '端末の写真フォルダへの動画保存に失敗しました。';
        throw new RecordingServiceError('storage/save-failed', message);
      }
    },
    async deleteTemporaryVideo(_tempPath: string): Promise<void> {
      // 一時ファイル削除が不要な場合はno-op
    },
  };
}

let persistenceAdapter: VideoPersistenceAdapter | null = null;

export function setVideoPersistenceAdapter(
  adapter: VideoPersistenceAdapter | null,
): void {
  persistenceAdapter = adapter;
}

/**
 * 一時録画ファイルを永続保存領域（端末の写真フォルダ等）へ保存する。
 * 永続化アダプターが未設定または保存失敗時は偽の成功を返さずエラーを送出する。
 */
export async function persistRecordedVideo(
  record: RecordedVideoInfo,
): Promise<RecordedVideoInfo> {
  if (record.storageStatus === 'persisted') {
    return record;
  }
  if (!persistenceAdapter) {
    throw new RecordingServiceError(
      'storage/persistence-not-configured',
      '永続保存アダプターが未構成のため、動画は一時ファイル（temporary）のまま保持されています。',
    );
  }
  const persistedPath = await persistenceAdapter.persistTemporaryVideo(
    record.path,
  );
  if (!persistedPath || !persistedPath.trim()) {
    throw new RecordingServiceError(
      'storage/invalid-persisted-path',
      '永続保存先のファイルパスを取得できませんでした。',
    );
  }
  return {
    ...record,
    path: persistedPath.trim(),
    storageStatus: 'persisted',
  };
}

export interface StartRecordingSessionCallbacks {
  onFinished: (info: RecordedVideoInfo) => void;
  onError: (error: RecordingServiceError) => void;
}

export interface StartRecordingSessionParams {
  recorder: CameraRecorderHandle | null;
  aeLockState: ExposureLockState;
  requireAeLockForAutoDetection?: boolean;
  callbacks: StartRecordingSessionCallbacks;
}

/**
 * 30fps録画セッションを開始する。
 * 自動注湯検出が要求されている場合、AEロックが `'locked'` でなければ開始を拒否する。
 */
export function startRecordingSession({
  recorder,
  aeLockState,
  requireAeLockForAutoDetection = false,
  callbacks,
}: StartRecordingSessionParams): {
  startedAtEpochMs: number;
  startedAtMonotonicMs: number;
} {
  if (!recorder) {
    throw new RecordingServiceError(
      'session/camera-not-ready',
      'カメラ参照が準備できていないため録画を開始できません。',
    );
  }

  if (requireAeLockForAutoDetection && aeLockState !== 'locked') {
    throw new RecordingServiceError(
      'ae-lock/not-locked',
      `自動注湯検出付き録画にはAEロックの成立が必要ですが、現在の状態は "${aeLockState}" です。`,
    );
  }

  const startedAtEpochMs = Date.now();
  const startedAtMonotonicMs = getMonotonicTimeMs();

  try {
    recorder.startRecording({
      fileType: 'mp4',
      onRecordingFinished: (video: VideoFile) => {
        try {
          const finishedAtEpochMs = Date.now();
          const measuredDurationMs = calculateElapsedMs(
            startedAtMonotonicMs,
            getMonotonicTimeMs(),
          );
          const info = buildRecordedVideoInfo({
            videoFile: video,
            startedAtEpochMs,
            finishedAtEpochMs,
            measuredDurationMs,
            aeLockStateAtStart: aeLockState,
            autoPourDetectionEnabled:
              requireAeLockForAutoDetection && aeLockState === 'locked',
            storageStatus: 'temporary',
          });
          callbacks.onFinished(info);
        } catch (err) {
          const serviceError =
            err instanceof RecordingServiceError
              ? err
              : new RecordingServiceError(
                  'capture/invalid-output',
                  err instanceof Error
                    ? err.message
                    : '録画出力の検証に失敗しました。',
                );
          callbacks.onError(serviceError);
        }
      },
      onRecordingError: (error: CameraCaptureError) => {
        const code = error?.code ?? 'capture/recording-error';
        const message =
          error?.message ?? '録画中にエラーが発生しました。';
        callbacks.onError(new RecordingServiceError(code, message));
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '録画開始呼び出しに失敗しました。';
    throw new RecordingServiceError('capture/start-failed', message);
  }

  return {
    startedAtEpochMs,
    startedAtMonotonicMs,
  };
}

/**
 * 進行中の録画セッションを停止する。
 */
export async function stopRecordingSession(
  recorder: CameraRecorderHandle | null,
): Promise<void> {
  if (!recorder) {
    throw new RecordingServiceError(
      'session/camera-not-ready',
      'カメラ参照が無効なため録画停止に失敗しました。',
    );
  }
  try {
    await recorder.stopRecording();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '録画停止処理に失敗しました。';
    throw new RecordingServiceError('capture/stop-failed', message);
  }
}

/**
 * カメラ中断・バックグラウンド移行時に進行中の録画を安全にキャンセルする。
 */
export async function cancelRecordingSession(
  recorder: CameraRecorderHandle | null,
): Promise<void> {
  if (!recorder) {
    return;
  }
  try {
    await recorder.cancelRecording();
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : '録画キャンセル処理中にエラーが発生しました。';
    throw new RecordingServiceError('capture/cancel-failed', message);
  }
}
