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

/**
 * Earth-Tone Palette (Espresso, Umber, Taupe, Oatmeal Beige, Warm Ivory) + Functional Primary Colors
 * pour_frame_side_view_edition (2).html 準拠
 */
export const BREW_THEME = {
  ink: '#17120f',
  topBarBg: '#1b1512',
  railBg: '#17120e',
  centerBg: '#1c1612',
  panel: '#211a15',
  panel2: '#2b221c',
  inspHeadBg: '#251d17',
  inspBottomBg: '#1d1612',
  taupe: '#382d25',
  edge: '#46392f',
  soft: '#a89988',
  oatmeal: '#e8dfd1',
  oatmealEdge: '#cfc2ae',
  oatmealInk: '#1e1713',
  ivory: '#f7f4ec',
  cobalt: '#355aff',
  cobalt2: '#7d96ff',
  verm: '#ff493d',
  acid: '#dbfb50',
} as const;

/** 露出補正（EV）の選択候補（-2.0 〜 +2.0） */
export const EXPOSURE_COMPENSATION_OPTIONS = [
  -2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0,
] as const;

/** フリッカー対策シャッタースピード表記の選択候補 */
export const SHUTTER_SPEED_OPTIONS = [
  '1/60',
  '1/120',
  '1/50',
  '1/100',
] as const;
export type ShutterSpeedLabel = (typeof SHUTTER_SPEED_OPTIONS)[number];

/** ちらつき防止（フリッカー対策）プリセット定義 */
export interface FlickerPresetSpec {
  readonly shutter: ShutterSpeedLabel;
  readonly areaGroup: 'area-a-60hz' | 'area-b-50hz';
  readonly radioLabel: string;
  readonly shortHzLabel: '60Hz' | '50Hz';
  readonly hudBadgeLabel: string;
}

export const FLICKER_PRESET_OPTIONS: readonly FlickerPresetSpec[] = [
  {
    shutter: '1/60',
    areaGroup: 'area-a-60hz',
    radioLabel: '60Hz - 標準 (1/60)',
    shortHzLabel: '60Hz',
    hudBadgeLabel: '60Hz',
  },
  {
    shutter: '1/120',
    areaGroup: 'area-a-60hz',
    radioLabel: '60Hz - 明るい部屋 (1/120)',
    shortHzLabel: '60Hz',
    hudBadgeLabel: '60Hz (1/120)',
  },
  {
    shutter: '1/50',
    areaGroup: 'area-b-50hz',
    radioLabel: '50Hz - 標準 (1/50)',
    shortHzLabel: '50Hz',
    hudBadgeLabel: '50Hz',
  },
  {
    shutter: '1/100',
    areaGroup: 'area-b-50hz',
    radioLabel: '50Hz - 明るい部屋 (1/100)',
    shortHzLabel: '50Hz',
    hudBadgeLabel: '50Hz (1/100)',
  },
] as const;

/** 撮影モード（フル工程 / ドリップのみ） */
export type CaptureWorkflowMode = 'full-process' | 'drip-only';

/** 右インスペクターの BREW SEQUENCE 3ステージ定義 */
export interface BrewSequenceStageSpec {
  readonly index: 0 | 1 | 2;
  readonly stepNum: '01' | '02' | '03';
  readonly title: string;
  readonly sub: string;
  readonly phaseLabel: string;
  readonly recPhaseLabel: string;
  readonly waterWeight: string;
  readonly timestampSummary: string;
  readonly progressPercent: number;
}

export const BREW_SEQUENCE_STAGES: readonly BrewSequenceStageSpec[] = [
  {
    index: 0,
    stepNum: '01',
    title: 'BLOOM (1投目)',
    sub: 'Initial saturation\n00:00 — 00:30',
    phaseLabel: '● 抽出 : 1投目',
    recPhaseLabel: '● REC : 1投目',
    waterWeight: '046.2 g',
    timestampSummary: '1st: 00:04 / 2nd: --:-- / 3rd: --:--',
    progressPercent: 33,
  },
  {
    index: 1,
    stepNum: '02',
    title: 'MAIN POUR (2投目)',
    sub: 'Controlled flow\n00:30 — 01:40',
    phaseLabel: '● 抽出 : 2投目',
    recPhaseLabel: '● REC : 2投目',
    waterWeight: '157.8 g',
    timestampSummary: '1st: 00:04 / 2nd: 00:36 / 3rd: --:--',
    progressPercent: 66.5,
  },
  {
    index: 2,
    stepNum: '03',
    title: 'DRAW DOWN (3投目)',
    sub: 'Final drainage\n01:40 — 02:40',
    phaseLabel: '● 抽出 : 3投目',
    recPhaseLabel: '● REC : 3投目',
    waterWeight: '238.4 g',
    timestampSummary: '1st: 00:04 / 2nd: 00:36 / 3rd: 01:18',
    progressPercent: 100,
  },
] as const;

/** AUDIO MONITOR の周波数バー高さ配列（HTML準拠） */
export const AUDIO_MONITOR_BAR_HEIGHTS: readonly number[] = [
  10, 18, 25, 12, 32, 24, 20, 35, 16, 28, 15, 27, 33, 15, 20, 29, 10, 18, 26,
  19, 12, 30, 17, 23, 11, 21, 15, 29, 9, 16, 20, 11,
] as const;

/** 16:9 カメラフレームに対する正規化矩形座標（0.0 〜 1.0） */
export interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 3分割撮影ガイドの領域ID */
export type PlacementZoneId = 'left-mill' | 'center-dripper' | 'right-beans';

export interface PlacementZoneSpec {
  readonly id: PlacementZoneId;
  readonly zoneNumber: '01 /' | '02 /' | '03 /';
  readonly title: string;
  readonly badgeLabel: string;
  readonly description: string;
  readonly accentColor: string;
  /** OCRクロップやTFLite推論の切り出しと共通利用する正規化座標 */
  readonly normalizedRect: NormalizedRect;
}

/**
 * 3分割配置ガイド枠の定義（01 / MILL, 02 / DRIPPER & SCALE, 03 / BEANS）
 * UI描画・静止画右領域OCRクロップ・TFLite左/中央領域推論で同一座標を参照する。
 */
export const PLACEMENT_GUIDE_ZONES: readonly PlacementZoneSpec[] = [
  {
    id: 'left-mill',
    zoneNumber: '01 /',
    title: 'MILL',
    badgeLabel: 'TFLite',
    description: 'ミル有無判定領域',
    accentColor: '#e8dfd1',
    normalizedRect: {
      x: 0.03,
      y: 0.14,
      width: 0.28,
      height: 0.64,
    },
  },
  {
    id: 'center-dripper',
    zoneNumber: '02 /',
    title: 'DRIPPER & SCALE',
    badgeLabel: 'ROI LOCKED',
    description: 'ペーパーのみ / 粉あり・注湯検知',
    accentColor: '#dbfb50',
    normalizedRect: {
      x: 0.33,
      y: 0.14,
      width: 0.34,
      height: 0.64,
    },
  },
  {
    id: 'right-beans',
    zoneNumber: '03 /',
    title: 'BEANS',
    badgeLabel: 'BEAN OCR',
    description: 'REC開始時に静止画OCR抽出',
    accentColor: '#e8dfd1',
    normalizedRect: {
      x: 0.69,
      y: 0.14,
      width: 0.28,
      height: 0.64,
    },
  },
] as const;
