import { NativeModules } from 'react-native';
import {
  MatchCoffeeBeanResult,
  matchCoffeeBeanFromOcr,
} from '../../../domain/beanMatcher';
import { NormalizedRect, PLACEMENT_GUIDE_ZONES } from '../constants';

export interface PhotoCaptureCapable {
  takePhoto?: (options?: Record<string, unknown>) => Promise<{
    path: string;
    width?: number;
    height?: number;
  }>;
}

export interface NativeOcrRegionResult {
  engine: 'mlkit-japanese' | 'ios-vision' | string;
  lines: string[];
  fullText: string;
}

export interface BeanOcrAdapter {
  recognizeTextInRegion: (
    filePath: string,
    region: NormalizedRect,
  ) => Promise<NativeOcrRegionResult>;
}

export type BeanRecognitionState =
  | 'idle'
  | 'scanning'
  | 'matched'
  | 'unmatched'
  | 'no-text'
  | 'error';

export interface BeanOcrSessionResult {
  state: BeanRecognitionState;
  engine: string | null;
  photoPath: string | null;
  rawLines: string[];
  matchOutput: MatchCoffeeBeanResult | null;
  errorMessage: string | null;
}

interface NativeCameraOcrModule {
  recognizeTextInRegion?: (
    filePath: string,
    region: NormalizedRect,
  ) => Promise<NativeOcrRegionResult>;
}

function getNativeCameraOcrModule(): NativeCameraOcrModule | null {
  const modules = NativeModules as Record<string, unknown>;
  const candidate =
    modules.CameraView ??
    modules.CameraViewModule ??
    modules.CameraViewManager ??
    null;
  return (candidate as NativeCameraOcrModule | null) ?? null;
}

export function createNativeBeanOcrAdapter(): BeanOcrAdapter {
  return {
    async recognizeTextInRegion(
      filePath: string,
      region: NormalizedRect,
    ): Promise<NativeOcrRegionResult> {
      const nativeModule = getNativeCameraOcrModule();
      if (
        !nativeModule ||
        typeof nativeModule.recognizeTextInRegion !== 'function'
      ) {
        throw new Error(
          'ネイティブOCRブリッジ (recognizeTextInRegion) が利用できません。アプリを再ビルドしてください。',
        );
      }
      const res = await nativeModule.recognizeTextInRegion(filePath, region);
      return {
        engine: typeof res?.engine === 'string' ? res.engine : 'unknown',
        lines: Array.isArray(res?.lines) ? res.lines : [],
        fullText: typeof res?.fullText === 'string' ? res.fullText : '',
      };
    },
  };
}

let activeBeanOcrAdapter: BeanOcrAdapter = createNativeBeanOcrAdapter();

export function setBeanOcrAdapter(adapter: BeanOcrAdapter | null): void {
  activeBeanOcrAdapter = adapter ?? createNativeBeanOcrAdapter();
}

export function getRightBeansZoneRect(): NormalizedRect {
  const rightZone = PLACEMENT_GUIDE_ZONES.find(z => z.id === 'right-beans');
  return (
    rightZone?.normalizedRect ?? {
      x: 0.69,
      y: 0.14,
      width: 0.28,
      height: 0.64,
    }
  );
}

/**
 * 静止画1枚を撮影し、右側ゾーン（豆袋配置枠）のみをクロップしてオンデバイスOCRを実行、
 * 2段階ファジーマッチャー（ロースター特定 → 農園・産地スコア計算）で豆銘柄を推論する。
 */
export async function captureAndRecognizeBeanInfo(
  camera: PhotoCaptureCapable | null,
  customRegion?: NormalizedRect,
): Promise<BeanOcrSessionResult> {
  if (!camera || typeof camera.takePhoto !== 'function') {
    return {
      state: 'error',
      engine: null,
      photoPath: null,
      rawLines: [],
      matchOutput: null,
      errorMessage: '静止画撮影用のカメラ参照が有効ではありません。',
    };
  }

  try {
    const photo = await camera.takePhoto({
      enableShutterSound: false,
    });
    if (!photo || typeof photo.path !== 'string' || photo.path.trim() === '') {
      return {
        state: 'error',
        engine: null,
        photoPath: null,
        rawLines: [],
        matchOutput: null,
        errorMessage: '静止画ファイルパスの取得に失敗しました。',
      };
    }

    const region = customRegion ?? getRightBeansZoneRect();
    const ocrResult = await activeBeanOcrAdapter.recognizeTextInRegion(
      photo.path,
      region,
    );

    if (ocrResult.lines.length === 0) {
      return {
        state: 'no-text',
        engine: ocrResult.engine,
        photoPath: photo.path,
        rawLines: [],
        matchOutput: null,
        errorMessage:
          '右枠（豆袋エリア）から文字を検出できませんでした。豆袋を右枠内に配置してください。',
      };
    }

    const matchOutput = matchCoffeeBeanFromOcr(ocrResult.lines);

    if (matchOutput.bestMatch) {
      return {
        state: 'matched',
        engine: ocrResult.engine,
        photoPath: photo.path,
        rawLines: ocrResult.lines,
        matchOutput,
        errorMessage: null,
      };
    }

    return {
      state: 'unmatched',
      engine: ocrResult.engine,
      photoPath: photo.path,
      rawLines: ocrResult.lines,
      matchOutput,
      errorMessage:
        'OCR文字列は抽出できましたが、登録済みカタログと一致する豆が特定できませんでした。',
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : '豆袋の静止画OCR処理中にエラーが発生しました。';
    return {
      state: 'error',
      engine: null,
      photoPath: null,
      rawLines: [],
      matchOutput: null,
      errorMessage: message,
    };
  }
}
