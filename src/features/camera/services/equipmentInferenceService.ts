import { NativeModules } from 'react-native';
import { NormalizedRect, PLACEMENT_GUIDE_ZONES } from '../constants';

/**
 * パターンA（2モデル構成）のクラス定義
 * - モデル1（左領域: ミル有無判定）: mill_classifier.tflite
 * - モデル2（中央領域: ドリッパー状態3クラス判定）: dripper_classifier.tflite
 */
export type MillClassifierLabel = 'mill_present' | 'mill_absent';

export type DripperClassifierLabel =
  | 'dripper_empty_or_none'
  | 'dripper_paper_only'
  | 'dripper_with_grounds';

export type EquipmentModelReadiness =
  | 'checking'
  | 'model-not-bundled'
  | 'ready'
  | 'error';

export interface EquipmentInferenceSnapshot {
  readiness: EquipmentModelReadiness;
  millModelFile: 'mill_classifier.tflite';
  dripperModelFile: 'dripper_classifier.tflite';
  millModelBundled: boolean;
  dripperModelBundled: boolean;
  leftMillZone: NormalizedRect;
  centerDripperZone: NormalizedRect;
  millLabel: MillClassifierLabel | null;
  millConfidence: number | null;
  dripperLabel: DripperClassifierLabel | null;
  dripperConfidence: number | null;
  diagnosticMessage: string;
}

interface NativeEquipmentModelModule {
  getEquipmentModelStatus?: () => Promise<{
    millModelBundled?: boolean;
    dripperModelBundled?: boolean;
  }>;
}

function getNativeEquipmentModule(): NativeEquipmentModelModule | null {
  const modules = NativeModules as Record<string, unknown>;
  const candidate =
    modules.CameraView ??
    modules.CameraViewModule ??
    modules.CameraViewManager ??
    null;
  return (candidate as NativeEquipmentModelModule | null) ?? null;
}

export function getLeftMillZoneRect(): NormalizedRect {
  const leftZone = PLACEMENT_GUIDE_ZONES.find(z => z.id === 'left-mill');
  return (
    leftZone?.normalizedRect ?? {
      x: 0.03,
      y: 0.14,
      width: 0.27,
      height: 0.64,
    }
  );
}

export function getCenterDripperZoneRect(): NormalizedRect {
  const centerZone = PLACEMENT_GUIDE_ZONES.find(z => z.id === 'center-dripper');
  return (
    centerZone?.normalizedRect ?? {
      x: 0.32,
      y: 0.12,
      width: 0.35,
      height: 0.68,
    }
  );
}

export function createInitialEquipmentSnapshot(): EquipmentInferenceSnapshot {
  return {
    readiness: 'model-not-bundled',
    millModelFile: 'mill_classifier.tflite',
    dripperModelFile: 'dripper_classifier.tflite',
    millModelBundled: false,
    dripperModelBundled: false,
    leftMillZone: getLeftMillZoneRect(),
    centerDripperZone: getCenterDripperZoneRect(),
    millLabel: null,
    millConfidence: null,
    dripperLabel: null,
    dripperConfidence: null,
    diagnosticMessage:
      'TFLiteモデル待機中 (mill_classifier.tflite / dripper_classifier.tflite 未配置)',
  };
}

export function hasNativeEquipmentStatusBridge(): boolean {
  const nativeModule = getNativeEquipmentModule();
  return Boolean(
    nativeModule && typeof nativeModule.getEquipmentModelStatus === 'function',
  );
}

/**
 * パターンAの2つのTFLiteモデルファイル（mill_classifier.tflite / dripper_classifier.tflite）が
 * アプリバンドル内に配置されているかを検査し、現在の推論パイプライン状態を返す。
 * AGENTS.md §1-8 に従い、モデル未配置時はダミーの推論成功を返さず `model-not-bundled` を明示する。
 */
export async function checkPatternAEquipmentModels(): Promise<EquipmentInferenceSnapshot> {
  const leftMillZone = getLeftMillZoneRect();
  const centerDripperZone = getCenterDripperZoneRect();

  const nativeModule = getNativeEquipmentModule();
  if (
    !nativeModule ||
    typeof nativeModule.getEquipmentModelStatus !== 'function'
  ) {
    return {
      readiness: 'model-not-bundled',
      millModelFile: 'mill_classifier.tflite',
      dripperModelFile: 'dripper_classifier.tflite',
      millModelBundled: false,
      dripperModelBundled: false,
      leftMillZone,
      centerDripperZone,
      millLabel: null,
      millConfidence: null,
      dripperLabel: null,
      dripperConfidence: null,
      diagnosticMessage:
        'TFLiteモデル待機中 (mill_classifier.tflite / dripper_classifier.tflite 未配置)',
    };
  }

  try {
    const status = await nativeModule.getEquipmentModelStatus();
    const millBundled = Boolean(status?.millModelBundled);
    const dripperBundled = Boolean(status?.dripperModelBundled);

    if (millBundled && dripperBundled) {
      return {
        readiness: 'ready',
        millModelFile: 'mill_classifier.tflite',
        dripperModelFile: 'dripper_classifier.tflite',
        millModelBundled: true,
        dripperModelBundled: true,
        leftMillZone,
        centerDripperZone,
        millLabel: null,
        millConfidence: null,
        dripperLabel: null,
        dripperConfidence: null,
        diagnosticMessage:
          'パターンA 2モデル検出済み（左:ミル判定 / 中央:ドリッパー3状態）',
      };
    }

    const missing: string[] = [];
    if (!millBundled) {
      missing.push('mill_classifier.tflite');
    }
    if (!dripperBundled) {
      missing.push('dripper_classifier.tflite');
    }

    return {
      readiness: 'model-not-bundled',
      millModelFile: 'mill_classifier.tflite',
      dripperModelFile: 'dripper_classifier.tflite',
      millModelBundled: millBundled,
      dripperModelBundled: dripperBundled,
      leftMillZone,
      centerDripperZone,
      millLabel: null,
      millConfidence: null,
      dripperLabel: null,
      dripperConfidence: null,
      diagnosticMessage: `TFLite学習モデル待機中（未配置: ${missing.join(', ')}）`,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'TFLiteモデル状態確認エラー';
    return {
      readiness: 'error',
      millModelFile: 'mill_classifier.tflite',
      dripperModelFile: 'dripper_classifier.tflite',
      millModelBundled: false,
      dripperModelBundled: false,
      leftMillZone,
      centerDripperZone,
      millLabel: null,
      millConfidence: null,
      dripperLabel: null,
      dripperConfidence: null,
      diagnosticMessage: msg,
    };
  }
}
