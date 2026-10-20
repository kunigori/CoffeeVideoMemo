import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExposureLockAdapter,
  ExposureLockError,
  ExposureLockState,
  exposureLockService,
} from '../services/exposureLockService';

export interface UseExposureLockOptions {
  /** カメラセッションがアクティブかつ初期化済みか */
  isSessionActive: boolean;
  /** カメラデバイスID（デバイス切替時の再評価に使用） */
  deviceId?: string;
  /** テスト差し替え用アダプター（省略時は exposureLockService を使用） */
  adapter?: ExposureLockAdapter;
}

export interface UseExposureLockResult {
  /** AEロックの現在状態 */
  state: ExposureLockState;
  /** エラーや未対応の理由メッセージ（UI表示用） */
  errorMessage: string | null;
  /** ロック完了状態かどうか */
  isLocked: boolean;
  /** 自動注湯検出付き録画を開始可能か（AEロック成立時のみtrue） */
  canStartAutoPourDetection: boolean;
  /** 対応可否を再確認する */
  checkSupport: () => Promise<ExposureLockState>;
  /** AEロックを実行する */
  lock: () => Promise<boolean>;
  /** AEロックを解除する */
  unlock: () => Promise<boolean>;
  /** セッション切断・中断時にロック状態を無効化する */
  invalidateSession: () => void;
}

/**
 * AEロック状態を管理しUIへ公開するカスタムフック
 * AGENTS.md §3 / ARCHITECTURE.md §6.2 に準拠
 */
export function useExposureLock({
  isSessionActive,
  deviceId,
  adapter = exposureLockService,
}: UseExposureLockOptions): UseExposureLockResult {
  const [state, setState] = useState<ExposureLockState>('unavailable');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stateRef = useRef<ExposureLockState>(state);
  stateRef.current = state;

  const inFlightOperationRef = useRef<'check' | 'lock' | 'unlock' | null>(null);
  const sessionEpochRef = useRef<number>(0);

  const updateState = useCallback(
    (nextState: ExposureLockState, nextError: string | null = null) => {
      stateRef.current = nextState;
      setState(nextState);
      setErrorMessage(nextError);
    },
    [],
  );

  const invalidateSession = useCallback(() => {
    sessionEpochRef.current += 1;
    inFlightOperationRef.current = null;
    updateState(
      'unavailable',
      'カメラセッションが非アクティブのためAEロックは利用できません。',
    );
  }, [updateState]);

  const checkSupport = useCallback(async (): Promise<ExposureLockState> => {
    if (!isSessionActive) {
      updateState(
        'unavailable',
        'カメラセッションが準備できていないためAEロックは利用できません。',
      );
      return 'unavailable';
    }

    if (inFlightOperationRef.current !== null) {
      return stateRef.current;
    }

    const currentEpoch = sessionEpochRef.current;
    inFlightOperationRef.current = 'check';

    try {
      const supported = await adapter.isSupported();
      if (sessionEpochRef.current !== currentEpoch) {
        return stateRef.current;
      }
      inFlightOperationRef.current = null;

      if (supported) {
        updateState('unlocked', null);
        return 'unlocked';
      } else {
        updateState(
          'unsupported',
          'このカメラデバイスはAE（自動露出）ロックに対応していません。',
        );
        return 'unsupported';
      }
    } catch (err) {
      if (sessionEpochRef.current !== currentEpoch) {
        return stateRef.current;
      }
      inFlightOperationRef.current = null;

      if (err instanceof ExposureLockError && err.code === 'UNAVAILABLE') {
        updateState('unavailable', err.message);
        return 'unavailable';
      }
      if (err instanceof ExposureLockError && err.code === 'UNSUPPORTED') {
        updateState('unsupported', err.message);
        return 'unsupported';
      }
      const message =
        err instanceof Error
          ? err.message
          : 'AEロック対応確認中にエラーが発生しました。';
      updateState('error', message);
      return 'error';
    }
  }, [adapter, isSessionActive, updateState]);

  const lock = useCallback(async (): Promise<boolean> => {
    if (!isSessionActive) {
      updateState(
        'unavailable',
        'カメラセッションが非アクティブのためAEロックを実行できません。',
      );
      return false;
    }

    // 二重呼出し・競合防止
    const currentState = stateRef.current;
    if (currentState === 'locked') {
      return true;
    }
    if (
      inFlightOperationRef.current !== null ||
      currentState === 'locking' ||
      currentState === 'unlocking'
    ) {
      return false;
    }
    if (currentState === 'unavailable' || currentState === 'unsupported') {
      return false;
    }

    const currentEpoch = sessionEpochRef.current;
    inFlightOperationRef.current = 'lock';
    updateState('locking', null);

    try {
      await adapter.lock();
      if (sessionEpochRef.current !== currentEpoch) {
        return false;
      }
      inFlightOperationRef.current = null;
      updateState('locked', null);
      return true;
    } catch (err) {
      if (sessionEpochRef.current !== currentEpoch) {
        return false;
      }
      inFlightOperationRef.current = null;

      if (err instanceof ExposureLockError && err.code === 'UNAVAILABLE') {
        updateState('unavailable', err.message);
        return false;
      }
      if (err instanceof ExposureLockError && err.code === 'UNSUPPORTED') {
        updateState('unsupported', err.message);
        return false;
      }
      const message =
        err instanceof Error ? err.message : 'AEロックの適用に失敗しました。';
      updateState('error', message);
      return false;
    }
  }, [adapter, isSessionActive, updateState]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isSessionActive) {
      updateState(
        'unavailable',
        'カメラセッションが非アクティブのためAEロックを解除できません。',
      );
      return false;
    }

    const currentState = stateRef.current;
    if (currentState === 'unlocked') {
      return true;
    }
    if (
      inFlightOperationRef.current !== null ||
      currentState === 'locking' ||
      currentState === 'unlocking'
    ) {
      return false;
    }
    if (currentState === 'unavailable' || currentState === 'unsupported') {
      return false;
    }

    const currentEpoch = sessionEpochRef.current;
    inFlightOperationRef.current = 'unlock';
    updateState('unlocking', null);

    try {
      await adapter.unlock();
      if (sessionEpochRef.current !== currentEpoch) {
        return false;
      }
      inFlightOperationRef.current = null;
      updateState('unlocked', null);
      return true;
    } catch (err) {
      if (sessionEpochRef.current !== currentEpoch) {
        return false;
      }
      inFlightOperationRef.current = null;
      const message =
        err instanceof Error
          ? err.message
          : 'AEロックの解除に失敗しました。';
      updateState('error', message);
      return false;
    }
  }, [adapter, isSessionActive, updateState]);

  // セッション状態・デバイス変更時の再評価とアンマウント時の無効化
  useEffect(() => {
    sessionEpochRef.current += 1;
    inFlightOperationRef.current = null;

    if (!isSessionActive) {
      updateState(
        'unavailable',
        'カメラセッション待機中（AEロック未接続）',
      );
      return;
    }

    checkSupport().catch(() => {
      // checkSupport内で状態更新済み
    });

    return () => {
      sessionEpochRef.current += 1;
      inFlightOperationRef.current = null;
    };
  }, [isSessionActive, deviceId, checkSupport, updateState]);

  return {
    state,
    errorMessage,
    isLocked: state === 'locked',
    canStartAutoPourDetection: state === 'locked',
    checkSupport,
    lock,
    unlock,
    invalidateSession,
  };
}
