import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  Camera,
  CameraDevice,
  CameraDeviceFormat,
  CameraPermissionStatus,
  CameraPosition,
  CameraRuntimeError,
  useCameraDevice,
  useCameraFormat,
} from 'react-native-vision-camera';
import {
  PREFERRED_VIDEO_HEIGHT,
  PREFERRED_VIDEO_WIDTH,
  TARGET_FPS,
} from '../constants';

/**
 * 30fps対応フォーマットのみを厳密にフィルタ・選定する純粋関数。
 *
 * ARCHITECTURE.md §5.1 / §5.2 および AGENTS.md §2 に従い、
 * `format.minFps <= TARGET_FPS && format.maxFps >= TARGET_FPS` を満たさないフォーマットは除外し、
 * 24fpsや60fps専用フォーマットへの自動フォールバックを一切行わない。
 *
 * 選定順序（30fps対応候補内）:
 * 1. 目標動画解像度（3840x2160 4K 16:9）との差分が最小のもの
 * 2. 画角（fieldOfView）が広いもの（クロップのない標準画角を優先）
 * 3. 静止画解像度（photoWidth * photoHeight）が高いもの（Sprint 2のOCR精度確保）
 */
export function select30FpsFormat(
  formats: readonly CameraDeviceFormat[] | undefined | null,
  targetFps: number = TARGET_FPS,
): CameraDeviceFormat | null {
  if (!formats || formats.length === 0) {
    return null;
  }

  const candidates = formats.filter(
    format =>
      typeof format.minFps === 'number' &&
      typeof format.maxFps === 'number' &&
      format.minFps <= targetFps &&
      format.maxFps >= targetFps,
  );

  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const aResDiff =
      Math.abs(a.videoWidth - PREFERRED_VIDEO_WIDTH) +
      Math.abs(a.videoHeight - PREFERRED_VIDEO_HEIGHT);
    const bResDiff =
      Math.abs(b.videoWidth - PREFERRED_VIDEO_WIDTH) +
      Math.abs(b.videoHeight - PREFERRED_VIDEO_HEIGHT);
    if (aResDiff !== bResDiff) {
      return aResDiff - bResDiff;
    }

    if (b.fieldOfView !== a.fieldOfView) {
      return b.fieldOfView - a.fieldOfView;
    }

    const aPhotoPixels = a.photoWidth * a.photoHeight;
    const bPhotoPixels = b.photoWidth * b.photoHeight;
    return bPhotoPixels - aPhotoPixels;
  });

  return sorted[0] ?? null;
}

export type CameraReadyStatus =
  | 'checking-permission'
  | 'permission-denied'
  | 'no-device'
  | 'unsupported-fps'
  | 'initializing'
  | 'ready'
  | 'inactive'
  | 'error';

export interface UseCameraConfigResult {
  device: CameraDevice | undefined;
  selectedFormat: CameraDeviceFormat | null;
  targetFps: typeof TARGET_FPS;
  cameraPermission: CameraPermissionStatus;
  microphonePermission: CameraPermissionStatus;
  hasCameraPermission: boolean;
  hasMicrophonePermission: boolean;
  is30FpsSupported: boolean;
  isAppActive: boolean;
  isCameraActive: boolean;
  isInitialized: boolean;
  status: CameraReadyStatus;
  statusMessage: string;
  blockingReason: string | null;
  cameraError: string | null;
  canRecord30Fps: boolean;
  requestPermissions: () => Promise<void>;
  onCameraInitialized: () => void;
  onCameraError: (error: CameraRuntimeError) => void;
  retryCamera: () => void;
}

/**
 * カメラ権限・デバイス・30fps固定フォーマット選択・バックグラウンド非アクティブ化を管理するフック
 */
export function useCameraConfig(
  position: CameraPosition = 'back',
): UseCameraConfigResult {
  const device = useCameraDevice(position);

  const [cameraPermission, setCameraPermission] =
    useState<CameraPermissionStatus>(() => Camera.getCameraPermissionStatus());
  const [microphonePermission, setMicrophonePermission] =
    useState<CameraPermissionStatus>(() =>
      Camera.getMicrophonePermissionStatus(),
    );
  const [isRequestingPermission, setIsRequestingPermission] =
    useState<boolean>(false);
  const [isAppActive, setIsAppActive] = useState<boolean>(
    () =>
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const syncPermissions = useCallback(() => {
    setCameraPermission(Camera.getCameraPermissionStatus());
    setMicrophonePermission(Camera.getMicrophonePermissionStatus());
  }, []);

  const requestPermissions = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const currentCam = Camera.getCameraPermissionStatus();
      if (currentCam !== 'granted') {
        const nextCam = await Camera.requestCameraPermission();
        setCameraPermission(nextCam);
      } else {
        setCameraPermission(currentCam);
      }

      const currentMic = Camera.getMicrophonePermissionStatus();
      if (currentMic !== 'granted') {
        const nextMic = await Camera.requestMicrophonePermission();
        setMicrophonePermission(nextMic);
      } else {
        setMicrophonePermission(currentMic);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'カメラまたはマイクの権限要求に失敗しました。';
      setCameraError(message);
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // 初回マウント時に未決定の権限を要求
  useEffect(() => {
    const camStatus = Camera.getCameraPermissionStatus();
    const micStatus = Camera.getMicrophonePermissionStatus();
    if (camStatus === 'not-determined' || micStatus === 'not-determined') {
      requestPermissions().catch(() => {
        // requestPermissions内でエラー処理済み
      });
    }
  }, [requestPermissions]);

  // アプリのフォアグラウンド/バックグラウンド監視
  // バックグラウンド時は isAppActive=false により Camera の isActive=false となり安全に停止する。
  // VisionCamera v4 は isActive が false -> true に戻る際、デバイスやフォーマットが同一であれば
  // onInitialized ではなく onStarted を発火するため、ここで isInitialized を false に戻さない。
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const active = nextState === 'active';
      setIsAppActive(active);
      if (active) {
        syncPermissions();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [syncPermissions]);

  // デバイス変更時は初期化状態をリセット
  useEffect(() => {
    setIsInitialized(false);
    setCameraError(null);
  }, [device?.id]);

  const visionCameraFormat = useCameraFormat(device, [
    {
      videoResolution: {
        width: PREFERRED_VIDEO_WIDTH,
        height: PREFERRED_VIDEO_HEIGHT,
      },
    },
    { fps: TARGET_FPS },
  ]);

  const selectedFormat = useMemo(() => {
    const strictFormat = select30FpsFormat(device?.formats, TARGET_FPS);
    if (!strictFormat) {
      return null;
    }
    if (
      visionCameraFormat &&
      typeof visionCameraFormat.minFps === 'number' &&
      typeof visionCameraFormat.maxFps === 'number' &&
      visionCameraFormat.minFps <= TARGET_FPS &&
      visionCameraFormat.maxFps >= TARGET_FPS
    ) {
      return visionCameraFormat;
    }
    return strictFormat;
  }, [device?.formats, visionCameraFormat]);

  const hasCameraPermission = cameraPermission === 'granted';
  const hasMicrophonePermission = microphonePermission === 'granted';
  const is30FpsSupported = selectedFormat !== null;

  // 30fps対応フォーマットが存在し、権限があり、フォアグラウンドのときのみCameraをアクティブにする
  const isCameraActive =
    isAppActive &&
    hasCameraPermission &&
    device !== undefined &&
    is30FpsSupported &&
    cameraError === null;

  const onCameraInitialized = useCallback(() => {
    setIsInitialized(true);
    setCameraError(null);
  }, []);

  const onCameraError = useCallback((error: CameraRuntimeError) => {
    setIsInitialized(false);
    setCameraError(`[${error.code}] ${error.message}`);
  }, []);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setIsInitialized(false);
    syncPermissions();
  }, [syncPermissions]);

  const { status, statusMessage, blockingReason } = useMemo((): {
    status: CameraReadyStatus;
    statusMessage: string;
    blockingReason: string | null;
  } => {
    if (isRequestingPermission || cameraPermission === 'not-determined') {
      return {
        status: 'checking-permission',
        statusMessage: 'カメラ権限を確認中...',
        blockingReason: 'カメラ権限の確認が完了するまで録画できません。',
      };
    }

    if (!hasCameraPermission) {
      return {
        status: 'permission-denied',
        statusMessage: 'カメラ権限が拒否されています',
        blockingReason:
          'カメラへのアクセスが許可されていません。OSの設定画面からカメラ権限を許可してください。',
      };
    }

    if (!device) {
      return {
        status: 'no-device',
        statusMessage: 'カメラデバイスが見つかりません',
        blockingReason:
          '利用可能なカメラデバイスを検出できませんでした。実機で接続状態を確認してください。',
      };
    }

    if (!is30FpsSupported) {
      return {
        status: 'unsupported-fps',
        statusMessage: '30fps非対応デバイス',
        blockingReason:
          'このカメラは30fps録画に対応していません（仕様により24fpsや60fpsへの自動フォールバックは行いません）。',
      };
    }

    if (cameraError) {
      return {
        status: 'error',
        statusMessage: 'カメラエラーが発生しました',
        blockingReason: cameraError,
      };
    }

    if (!isAppActive) {
      return {
        status: 'inactive',
        statusMessage: 'バックグラウンド待機中（カメラ非アクティブ）',
        blockingReason: 'アプリがフォアグラウンドでないため録画できません。',
      };
    }

    if (!isInitialized) {
      return {
        status: 'initializing',
        statusMessage: 'カメラセッションを初期化中...',
        blockingReason: 'カメラの初期化が完了するまでお待ちください。',
      };
    }

    return {
      status: 'ready',
      statusMessage: `準備完了 (${selectedFormat.videoWidth}x${selectedFormat.videoHeight} @ ${TARGET_FPS}fps固定)`,
      blockingReason: null,
    };
  }, [
    isRequestingPermission,
    cameraPermission,
    hasCameraPermission,
    device,
    is30FpsSupported,
    cameraError,
    isAppActive,
    isInitialized,
    selectedFormat,
  ]);

  const canRecord30Fps = status === 'ready';

  return {
    device,
    selectedFormat,
    targetFps: TARGET_FPS,
    cameraPermission,
    microphonePermission,
    hasCameraPermission,
    hasMicrophonePermission,
    is30FpsSupported,
    isAppActive,
    isCameraActive,
    isInitialized,
    status,
    statusMessage,
    blockingReason,
    cameraError,
    canRecord30Fps,
    requestPermissions,
    onCameraInitialized,
    onCameraError,
    retryCamera,
  };
}
