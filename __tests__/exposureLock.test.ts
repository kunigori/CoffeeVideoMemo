import React from 'react';
import { NativeModules } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  useExposureLock,
  UseExposureLockResult,
} from '../src/features/camera/hooks/useExposureLock';
import {
  createNativeExposureLockAdapter,
  ExposureLockAdapter,
  ExposureLockError,
} from '../src/features/camera/services/exposureLockService';

function renderExposureLockHook(initialProps: {
  isSessionActive: boolean;
  deviceId?: string;
  adapter: ExposureLockAdapter;
}) {
  let latest: UseExposureLockResult | null = null;

  function TestComponent(props: typeof initialProps) {
    latest = useExposureLock(props);
    return null;
  }

  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      React.createElement(TestComponent, initialProps),
    );
  });

  return {
    get result(): UseExposureLockResult {
      if (!latest) {
        throw new Error('Hook result not initialized');
      }
      return latest;
    },
    rerender(nextProps: typeof initialProps) {
      act(() => {
        renderer.update(React.createElement(TestComponent, nextProps));
      });
    },
    unmount() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

describe('exposureLockService & useExposureLock', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).CameraView;
  });

  test('ネイティブモジュール未接続時、createNativeExposureLockAdapterは偽の成功を返さずUNAVAILABLEを送出する', async () => {
    const adapter = createNativeExposureLockAdapter();

    await expect(adapter.isSupported()).rejects.toMatchObject({
      name: 'ExposureLockError',
      code: 'UNAVAILABLE',
    });
    await expect(adapter.lock()).rejects.toMatchObject({
      name: 'ExposureLockError',
      code: 'UNAVAILABLE',
    });
    await expect(adapter.unlock()).rejects.toMatchObject({
      name: 'ExposureLockError',
      code: 'UNAVAILABLE',
    });
  });

  test('NativeModules.CameraView接続時、createNativeExposureLockAdapterは同一セッションのviewTagを渡してロック・解除を検証する', async () => {
    const mockNativeCameraView = {
      isExposureLockSupported: jest.fn(async (_tag: number) => true),
      lockExposure: jest.fn(async (_tag: number) => true),
      unlockExposure: jest.fn(async (_tag: number) => true),
    };
    (NativeModules as Record<string, unknown>).CameraView =
      mockNativeCameraView;

    const adapter = createNativeExposureLockAdapter(() => 42);

    await expect(adapter.isSupported()).resolves.toBe(true);
    expect(mockNativeCameraView.isExposureLockSupported).toHaveBeenCalledWith(
      42,
    );

    await expect(adapter.lock()).resolves.toBeUndefined();
    expect(mockNativeCameraView.lockExposure).toHaveBeenCalledWith(42);

    await expect(adapter.unlock()).resolves.toBeUndefined();
    expect(mockNativeCameraView.unlockExposure).toHaveBeenCalledWith(42);

    // ネイティブがfalseを返した場合は成功扱いせずLOCK_FAILEDを送出する
    mockNativeCameraView.lockExposure.mockResolvedValueOnce(false);
    await expect(adapter.lock()).rejects.toMatchObject({
      name: 'ExposureLockError',
      code: 'LOCK_FAILED',
    });
  });

  test('ハードウェア非対応の場合、unsupported状態となり自動注湯検出は不可となる', async () => {
    const adapter: ExposureLockAdapter = {
      isSupported: jest.fn(async () => false),
      lock: jest.fn(async () => {}),
      unlock: jest.fn(async () => {}),
    };

    const hook = renderExposureLockHook({
      isSessionActive: true,
      deviceId: 'camera-1',
      adapter,
    });

    await act(async () => {});

    expect(hook.result.state).toBe('unsupported');
    expect(hook.result.isLocked).toBe(false);
    expect(hook.result.canStartAutoPourDetection).toBe(false);

    let locked = false;
    await act(async () => {
      locked = await hook.result.lock();
    });
    expect(locked).toBe(false);
    expect(adapter.lock).not.toHaveBeenCalled();
  });

  test('対応デバイスでlock()成功時にlocked、unlock()成功時にunlockedへ遷移する', async () => {
    const adapter: ExposureLockAdapter = {
      isSupported: jest.fn(async () => true),
      lock: jest.fn(async () => {}),
      unlock: jest.fn(async () => {}),
    };

    const hook = renderExposureLockHook({
      isSessionActive: true,
      deviceId: 'camera-1',
      adapter,
    });

    await act(async () => {});
    expect(hook.result.state).toBe('unlocked');
    expect(hook.result.canStartAutoPourDetection).toBe(false);

    let lockSuccess = false;
    await act(async () => {
      lockSuccess = await hook.result.lock();
    });
    expect(lockSuccess).toBe(true);
    expect(hook.result.state).toBe('locked');
    expect(hook.result.isLocked).toBe(true);
    expect(hook.result.canStartAutoPourDetection).toBe(true);

    let unlockSuccess = false;
    await act(async () => {
      unlockSuccess = await hook.result.unlock();
    });
    expect(unlockSuccess).toBe(true);
    expect(hook.result.state).toBe('unlocked');
    expect(hook.result.isLocked).toBe(false);
    expect(hook.result.canStartAutoPourDetection).toBe(false);
  });

  test('lock()失敗時はlockedにならずerror状態となりエラーメッセージを保持する', async () => {
    const adapter: ExposureLockAdapter = {
      isSupported: jest.fn(async () => true),
      lock: jest.fn(async () => {
        throw new ExposureLockError('LOCK_FAILED', '露出ロックに失敗');
      }),
      unlock: jest.fn(async () => {}),
    };

    const hook = renderExposureLockHook({
      isSessionActive: true,
      deviceId: 'camera-1',
      adapter,
    });

    await act(async () => {});
    expect(hook.result.state).toBe('unlocked');

    let lockSuccess = true;
    await act(async () => {
      lockSuccess = await hook.result.lock();
    });

    expect(lockSuccess).toBe(false);
    expect(hook.result.state).toBe('error');
    expect(hook.result.errorMessage).toContain('露出ロックに失敗');
    expect(hook.result.canStartAutoPourDetection).toBe(false);
  });

  test('locking中の二重lock()呼び出しを防止する', async () => {
    let resolveLock: (() => void) | null = null;
    const adapter: ExposureLockAdapter = {
      isSupported: jest.fn(async () => true),
      lock: jest.fn(
        () =>
          new Promise<void>(resolve => {
            resolveLock = resolve;
          }),
      ),
      unlock: jest.fn(async () => {}),
    };

    const hook = renderExposureLockHook({
      isSessionActive: true,
      deviceId: 'camera-1',
      adapter,
    });

    await act(async () => {});
    expect(hook.result.state).toBe('unlocked');

    let firstPromise!: Promise<boolean>;
    let secondResult = true;
    act(() => {
      firstPromise = hook.result.lock();
    });
    expect(hook.result.state).toBe('locking');

    await act(async () => {
      secondResult = await hook.result.lock();
    });
    expect(secondResult).toBe(false);
    expect(adapter.lock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLock?.();
      await firstPromise;
    });
    expect(hook.result.state).toBe('locked');
  });

  test('セッション非アクティブ化（バックグラウンド移行）時にロック状態を無効化する', async () => {
    const adapter: ExposureLockAdapter = {
      isSupported: jest.fn(async () => true),
      lock: jest.fn(async () => {}),
      unlock: jest.fn(async () => {}),
    };

    const hook = renderExposureLockHook({
      isSessionActive: true,
      deviceId: 'camera-1',
      adapter,
    });

    await act(async () => {});
    await act(async () => {
      await hook.result.lock();
    });
    expect(hook.result.state).toBe('locked');

    hook.rerender({
      isSessionActive: false,
      deviceId: 'camera-1',
      adapter,
    });

    expect(hook.result.state).toBe('unavailable');
    expect(hook.result.isLocked).toBe(false);
    expect(hook.result.canStartAutoPourDetection).toBe(false);
  });
});
