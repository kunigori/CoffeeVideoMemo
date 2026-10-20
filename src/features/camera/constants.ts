/**
 * カメラおよびフレーム解析に関する共通定数
 * AGENTS.md §2 / ARCHITECTURE.md §5.1 に従い、録画FPSは30fps固定とする。
 */

/** 録画フレームレート（30fps固定・フォールバック禁止） */
export const TARGET_FPS = 30 as const;

/** ROI動体解析の初期目標FPS（録画30fpsとは独立して間引く） */
export const INITIAL_ANALYSIS_FPS = 10 as const;

/** フォーマット選択時の優先動画解像度（4K UHD 16:9: 3840x2160） */
export const PREFERRED_VIDEO_WIDTH = 3840 as const;
export const PREFERRED_VIDEO_HEIGHT = 2160 as const;

/** 録画中タイムコード表示の更新間隔（ミリ秒・30fpsフレーム表示連動用） */
export const RECORDING_TIMER_INTERVAL_MS = 33 as const;

/** 露出補正（EV）の選択候補（-2.0 〜 +2.0） */
export const EXPOSURE_COMPENSATION_OPTIONS = [
  -2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0,
] as const;

/** フリッカー対策シャッタースピード表記の選択候補 */
export const SHUTTER_SPEED_OPTIONS = ['1/50', '1/60', '1/100'] as const;
export type ShutterSpeedLabel = (typeof SHUTTER_SPEED_OPTIONS)[number];

/** 撮影モード（フル工程 / 抽出のみ） */
export type CaptureWorkflowMode = 'full-process' | 'drip-only';
