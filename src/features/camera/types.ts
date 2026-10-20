import type { ExposureLockState } from './services/exposureLockService';

/**
 * 録画ファイルの保存状態
 * ARCHITECTURE.md §8 に従い、一時ファイルと永続保存済みファイルを区別する。
 */
export type VideoStorageStatus = 'temporary' | 'persisted';

/**
 * 録画済み動画ファイルのメタデータ
 */
export interface RecordedVideoInfo {
  /** ファイルパス */
  path: string;
  /** 一時保存か永続保存済みかの区別 */
  storageStatus: VideoStorageStatus;
  /** 動画の長さ（秒・VisionCamera報告値） */
  durationSec: number;
  /** 単調増加タイマーに基づく計測録画時間（ミリ秒） */
  measuredDurationMs: number;
  /** 動画の幅（px） */
  width: number;
  /** 動画の高さ（px） */
  height: number;
  /** 要求した固定FPS（常に30） */
  requestedFps: number;
  /** 録画開始時点のAEロック状態 */
  aeLockStateAtStart: ExposureLockState;
  /** 自動注湯検出が有効だったか（AEロック成立時のみtrueになり得る） */
  autoPourDetectionEnabled: boolean;
  /** 録画開始基準時刻（epoch ms） */
  startedAtEpochMs: number;
  /** 録画完了時刻（epoch ms） */
  finishedAtEpochMs: number;
}

/**
 * 録画セッションの状態
 */
export type RecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'completed'
  | 'error';
