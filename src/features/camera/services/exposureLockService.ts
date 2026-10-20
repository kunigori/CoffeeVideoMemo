import { NativeModules } from 'react-native';

/**
 * AE（自動露出）ロックの状態
 * ARCHITECTURE.md §6.2 の契約に準拠
 */
export type ExposureLockState =
  | 'unavailable' // ネイティブ機能未実装、または現セッションと接続できない
  | 'unsupported' // カメラハードウェアが非対応
  | 'unlocked'
  | 'locking'
  | 'locked'
  | 'unlocking'
  | 'error';

/**
 * Android/iOS共通のAEロックアダプター契約
 * ARCHITECTURE.md §6.2 に準拠
 */
export interface ExposureLockAdapter {
  isSupported(): Promise<boolean>;
  lock(): Promise<void>; // 成功時は現セッションのロック成立を確認
  unlock(): Promise<void>; // 成功時は解除成立を確認
}

export type ExposureLockErrorCode =
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'SESSION_NOT_READY'
  | 'LOCK_FAILED'
  | 'UNLOCK_FAILED';

export class ExposureLockError extends Error {
  public readonly code: ExposureLockErrorCode;

  constructor(code: ExposureLockErrorCode, message: string) {
    super(message);
    this.name = 'ExposureLockError';
    this.code = code;
  }
}

/**
 * ネイティブモジュール境界の型定義（iOS: AVFoundation / Android: CameraX Camera2Interop）
 * VisionCameraが現在保持している同一カメラセッションのViewタグを受け取り操作する。
 */
export interface NativeExposureLockModuleSpec {
  isExposureLockSupported(viewTag: number): Promise<boolean>;
  lockExposure(viewTag: number): Promise<boolean>;
  unlockExposure(viewTag: number): Promise<boolean>;
}

function getNativeExposureLockModule(): NativeExposureLockModuleSpec | null {
  const modules = NativeModules as Record<
    string,
    NativeExposureLockModuleSpec | undefined
  >;
  const candidate = modules.ExposureLockModule ?? modules.CameraView;
  if (
    candidate &&
    typeof candidate.isExposureLockSupported === 'function' &&
    typeof candidate.lockExposure === 'function' &&
    typeof candidate.unlockExposure === 'function'
  ) {
    return candidate;
  }
  return null;
}

/**
 * ネイティブモジュールが存在するかどうかを判定する。
 */
export function isNativeExposureLockModuleAvailable(): boolean {
  return getNativeExposureLockModule() !== null;
}

/**
 * VisionCameraの現在のセッション（viewTagまたはアクティブCameraView）に対するネイティブAEロックアダプターを生成する。
 * ネイティブ実装が未導入の場合は、偽の成功を返さず明示的に UNAVAILABLE エラーを送出する。
 */
export function createNativeExposureLockAdapter(
  getViewTag?: () => number | null,
): ExposureLockAdapter {
  const resolveTag = (): number => {
    const tag = getViewTag ? getViewTag() : null;
    return typeof tag === 'number' && tag > 0 ? tag : -1;
  };

  return {
    async isSupported(): Promise<boolean> {
      const nativeModule = getNativeExposureLockModule();
      if (!nativeModule) {
        throw new ExposureLockError(
          'UNAVAILABLE',
          'AEロックのネイティブモジュールが未接続です。',
        );
      }
      return nativeModule.isExposureLockSupported(resolveTag());
    },

    async lock(): Promise<void> {
      const nativeModule = getNativeExposureLockModule();
      if (!nativeModule) {
        throw new ExposureLockError(
          'UNAVAILABLE',
          'AEロックのネイティブモジュールが未接続のためロックできません。',
        );
      }
      try {
        const confirmed = await nativeModule.lockExposure(resolveTag());
        if (!confirmed) {
          throw new ExposureLockError(
            'LOCK_FAILED',
            'AEロックの適用結果を確認できませんでした。',
          );
        }
      } catch (err) {
        if (err instanceof ExposureLockError) {
          throw err;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'AEロックの実行中に不明なエラーが発生しました。';
        throw new ExposureLockError('LOCK_FAILED', message);
      }
    },

    async unlock(): Promise<void> {
      const nativeModule = getNativeExposureLockModule();
      if (!nativeModule) {
        throw new ExposureLockError(
          'UNAVAILABLE',
          'AEロックのネイティブモジュールが未接続のため解除できません。',
        );
      }
      try {
        const confirmed = await nativeModule.unlockExposure(resolveTag());
        if (!confirmed) {
          throw new ExposureLockError(
            'UNLOCK_FAILED',
            'AEロック解除の適用結果を確認できませんでした。',
          );
        }
      } catch (err) {
        if (err instanceof ExposureLockError) {
          throw err;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'AEロック解除中に不明なエラーが発生しました。';
        throw new ExposureLockError('UNLOCK_FAILED', message);
      }
    },
  };
}

let activeAdapter: ExposureLockAdapter = createNativeExposureLockAdapter();

/**
 * テストまたはカスタムネイティブ結線用にアダプターを差し替える
 */
export function setExposureLockAdapter(adapter: ExposureLockAdapter): void {
  activeAdapter = adapter;
}

/**
 * デフォルトのネイティブアダプターに戻す
 */
export function resetExposureLockAdapter(
  getViewTag?: () => number | null,
): void {
  activeAdapter = createNativeExposureLockAdapter(getViewTag);
}

/**
 * 共通AEロックサービス境界（AGENTS.md §3: isSupported / lock / unlock）
 */
export const exposureLockService: ExposureLockAdapter = {
  isSupported(): Promise<boolean> {
    return activeAdapter.isSupported();
  },
  lock(): Promise<void> {
    return activeAdapter.lock();
  },
  unlock(): Promise<void> {
    return activeAdapter.unlock();
  },
};
