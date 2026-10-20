import type { CameraDeviceFormat } from 'react-native-vision-camera';
import { TARGET_FPS } from '../src/features/camera/constants';
import { select30FpsFormat } from '../src/features/camera/hooks/useCameraConfig';

function createFormat(
  overrides: Partial<CameraDeviceFormat> = {},
): CameraDeviceFormat {
  return {
    photoWidth: 4032,
    photoHeight: 3024,
    videoWidth: 1920,
    videoHeight: 1080,
    minISO: 50,
    maxISO: 3200,
    fieldOfView: 75,
    supportsVideoHdr: false,
    supportsPhotoHdr: false,
    supportsDepthCapture: false,
    minFps: 1,
    maxFps: 30,
    autoFocusSystem: 'phase-detection',
    videoStabilizationModes: ['off', 'standard'],
    ...overrides,
  };
}

describe('cameraConfig / select30FpsFormat', () => {
  test('TARGET_FPS定数は30に固定されている', () => {
    expect(TARGET_FPS).toBe(30);
  });

  test('フォーマット配列が空または未定義の場合はnullを返す', () => {
    expect(select30FpsFormat([])).toBeNull();
    expect(select30FpsFormat(undefined)).toBeNull();
    expect(select30FpsFormat(null)).toBeNull();
  });

  test('24fps以下または60fps以上専用のフォーマットしかない場合、フォールバックせずnullを返す', () => {
    const formats: CameraDeviceFormat[] = [
      createFormat({ minFps: 1, maxFps: 24, videoWidth: 1920, videoHeight: 1080 }),
      createFormat({ minFps: 24, maxFps: 24, videoWidth: 1280, videoHeight: 720 }),
      createFormat({ minFps: 60, maxFps: 120, videoWidth: 1920, videoHeight: 1080 }),
    ];

    expect(select30FpsFormat(formats)).toBeNull();
  });

  test('minFps <= 30 && maxFps >= 30 を満たすフォーマットのみを選択する', () => {
    const format24 = createFormat({ minFps: 1, maxFps: 24 });
    const format30 = createFormat({ minFps: 30, maxFps: 30 });
    const format60Only = createFormat({ minFps: 60, maxFps: 120 });

    const selected = select30FpsFormat([format24, format30, format60Only]);
    expect(selected).toBe(format30);
  });

  test('複数の30fps対応フォーマットがある場合、4K (3840x2160) に最も近い解像度を優先する', () => {
    const format720p = createFormat({
      videoWidth: 1280,
      videoHeight: 720,
      minFps: 1,
      maxFps: 30,
    });
    const format1080p = createFormat({
      videoWidth: 1920,
      videoHeight: 1080,
      minFps: 1,
      maxFps: 60,
    });
    const format4k = createFormat({
      videoWidth: 3840,
      videoHeight: 2160,
      minFps: 1,
      maxFps: 30,
    });

    const selected = select30FpsFormat([format720p, format1080p, format4k]);
    expect(selected).toBe(format4k);
  });

  test('同一動画解像度の候補間では画角（fieldOfView）が広いものを優先し、次に静止画解像度を優先する', () => {
    const narrowFov = createFormat({
      videoWidth: 1920,
      videoHeight: 1080,
      fieldOfView: 60,
      photoWidth: 4032,
      photoHeight: 3024,
    });
    const wideFovLowPhoto = createFormat({
      videoWidth: 1920,
      videoHeight: 1080,
      fieldOfView: 78,
      photoWidth: 1920,
      photoHeight: 1080,
    });
    const wideFovHighPhoto = createFormat({
      videoWidth: 1920,
      videoHeight: 1080,
      fieldOfView: 78,
      photoWidth: 4032,
      photoHeight: 3024,
    });

    const selected = select30FpsFormat([
      narrowFov,
      wideFovLowPhoto,
      wideFovHighPhoto,
    ]);
    expect(selected).toBe(wideFovHighPhoto);
  });

  test('useCameraConfig はバックグラウンド移行・フォアグラウンド復帰後に initializing で停止せず ready へ復帰する', () => {
    const React = require('react');
    const ReactTestRenderer = require('react-test-renderer');
    const { AppState } = require('react-native');
    const { useCameraConfig } = require('../src/features/camera/hooks/useCameraConfig');

    let appStateListener: ((state: string) => void) | null = null;
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type: unknown, listener: unknown) => {
        appStateListener = listener as (state: string) => void;
        return { remove: jest.fn() };
      });

    let latestConfig: ReturnType<typeof useCameraConfig> | null = null;
    function Harness() {
      latestConfig = useCameraConfig('back');
      return null;
    }

    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(React.createElement(Harness));
    });

    expect(latestConfig?.status).toBe('initializing');

    // 初回初期化完了
    ReactTestRenderer.act(() => {
      latestConfig?.onCameraInitialized();
    });
    expect(latestConfig?.status).toBe('ready');
    expect(latestConfig?.isCameraActive).toBe(true);

    // バックグラウンドへ移行
    ReactTestRenderer.act(() => {
      appStateListener?.('background');
    });
    expect(latestConfig?.status).toBe('inactive');
    expect(latestConfig?.isCameraActive).toBe(false);

    // フォアグラウンドへ復帰 -> initializing で固まらず ready に戻る
    ReactTestRenderer.act(() => {
      appStateListener?.('active');
    });
    expect(latestConfig?.status).toBe('ready');
    expect(latestConfig?.isCameraActive).toBe(true);
    expect(latestConfig?.canRecord30Fps).toBe(true);

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
    addEventListenerSpy.mockRestore();
  });
});
