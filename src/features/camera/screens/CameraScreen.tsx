import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findNodeHandle,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { BottomBrewHud } from '../components/BottomBrewHud';
import {
  CameraToolColumn,
  FlyoutType,
} from '../components/CameraToolColumn';
import { MainNavRail, MainNavTab } from '../components/MainNavRail';
import { OptionFlyoutOverlay } from '../components/OptionFlyoutOverlay';
import { TopStatusHud } from '../components/TopStatusHud';
import {
  CaptureWorkflowMode,
  RECORDING_TIMER_INTERVAL_MS,
  SHUTTER_SPEED_OPTIONS,
  ShutterSpeedLabel,
  TARGET_FPS,
} from '../constants';
import { useCameraConfig } from '../hooks/useCameraConfig';
import { useExposureLock } from '../hooks/useExposureLock';
import { resetExposureLockAdapter } from '../services/exposureLockService';
import {
  calculateElapsedMs,
  cancelRecordingSession,
  createNativePhotoLibraryPersistenceAdapter,
  getMonotonicTimeMs,
  persistRecordedVideo,
  setVideoPersistenceAdapter,
  startRecordingSession,
  stopRecordingSession,
} from '../services/recordingService';
import type { RecordedVideoInfo, RecordingStatus } from '../types';

export function CameraScreen(): React.JSX.Element {
  const cameraRef = useRef<Camera>(null);
  const recordingStartMonotonicRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Blackmagic Camera 準拠 UI 状態
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>('camera');
  const [activeFlyout, setActiveFlyout] = useState<FlyoutType>(null);
  const [captureMode, setCaptureMode] =
    useState<CaptureWorkflowMode>('full-process');
  const [exposureEv, setExposureEv] = useState<number>(0.0);
  const [shutterSpeed, setShutterSpeed] = useState<ShutterSpeedLabel>('1/60');

  // 録画・タイムコード状態
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [lastRecordedVideo, setLastRecordedVideo] =
    useState<RecordedVideoInfo | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recordingStatusRef = useRef<RecordingStatus>(recordingStatus);
  recordingStatusRef.current = recordingStatus;

  useEffect(() => {
    resetExposureLockAdapter(() => {
      try {
        const cam = cameraRef.current as unknown as { handle?: number } | null;
        if (cam && typeof cam.handle === 'number') {
          return cam.handle;
        }
        return findNodeHandle(cameraRef.current) ?? null;
      } catch {
        return null;
      }
    });
    setVideoPersistenceAdapter(createNativePhotoLibraryPersistenceAdapter());
    return () => {
      resetExposureLockAdapter();
      setVideoPersistenceAdapter(null);
    };
  }, []);

  const {
    device,
    selectedFormat,
    targetFps,
    hasCameraPermission,
    hasMicrophonePermission,
    isCameraActive,
    isInitialized,
    status,
    statusMessage,
    blockingReason,
    canRecord30Fps,
    requestPermissions,
    onCameraInitialized,
    onCameraError,
    retryCamera,
  } = useCameraConfig('back');

  const {
    state: aeLockState,
    errorMessage: aeErrorMessage,
    canStartAutoPourDetection,
    lock: lockAe,
    unlock: unlockAe,
    invalidateSession: invalidateAeSession,
  } = useExposureLock({
    isSessionActive: isCameraActive && isInitialized,
    deviceId: device?.id,
  });

  // デバイスが許容する露出補正範囲内にクランプ（-2.0 〜 +2.0）
  const clampedExposure = useMemo(() => {
    if (!device) {
      return exposureEv;
    }
    const min = typeof device.minExposure === 'number' ? device.minExposure : -2;
    const max = typeof device.maxExposure === 'number' ? device.maxExposure : 2;
    return Math.max(min, Math.min(max, exposureEv));
  }, [device, exposureEv]);

  const clearElapsedTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startElapsedTimer = useCallback(
    (startMonotonicMs: number) => {
      clearElapsedTimer();
      recordingStartMonotonicRef.current = startMonotonicMs;
      setElapsedMs(0);

      timerIntervalRef.current = setInterval(() => {
        if (recordingStartMonotonicRef.current !== null) {
          setElapsedMs(
            calculateElapsedMs(
              recordingStartMonotonicRef.current,
              getMonotonicTimeMs(),
            ),
          );
        }
      }, RECORDING_TIMER_INTERVAL_MS);
    },
    [clearElapsedTimer],
  );

  // カメラ非アクティブ化（バックグラウンド移行・権限喪失・デバイス切断）時の安全な停止処理
  useEffect(() => {
    if (!isCameraActive) {
      clearElapsedTimer();
      invalidateAeSession();

      const currentRecStatus = recordingStatusRef.current;
      if (
        currentRecStatus === 'recording' ||
        currentRecStatus === 'starting'
      ) {
        recordingStartMonotonicRef.current = null;
        setRecordingStatus('error');
        setRecordingError(
          'カメラが非アクティブ化されたため、進行中の録画を安全に中断しました。',
        );
        cancelRecordingSession(cameraRef.current).catch(() => {
          // 既にセッションが閉じている場合の例外は無視
        });
      }
    }
  }, [isCameraActive, clearElapsedTimer, invalidateAeSession]);

  // 画面アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      clearElapsedTimer();
    };
  }, [clearElapsedTimer]);

  const handleToggleFlyout = useCallback(
    (flyout: Exclude<FlyoutType, null>) => {
      setActiveNavTab('camera');
      setActiveFlyout(prev => (prev === flyout ? null : flyout));
    },
    [],
  );

  const handleCycleShutterSpeed = useCallback(() => {
    setShutterSpeed(prev => {
      const idx = SHUTTER_SPEED_OPTIONS.indexOf(prev);
      const nextIdx = (idx + 1) % SHUTTER_SPEED_OPTIONS.length;
      return SHUTTER_SPEED_OPTIONS[nextIdx] ?? '1/60';
    });
  }, []);

  const handleToggleAeLock = useCallback(async () => {
    if (aeLockState === 'locked') {
      await unlockAe();
    } else {
      await lockAe();
    }
  }, [aeLockState, lockAe, unlockAe]);

  const handleToggleRecording = useCallback(async () => {
    const currentStatus = recordingStatusRef.current;

    if (currentStatus === 'stopping') {
      return;
    }

    if (currentStatus === 'recording' || currentStatus === 'starting') {
      setRecordingStatus('stopping');
      clearElapsedTimer();
      try {
        await stopRecordingSession(cameraRef.current);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '録画停止に失敗しました。';
        setRecordingStatus('error');
        setRecordingError(message);
      }
      return;
    }

    if (!canRecord30Fps || !selectedFormat) {
      setRecordingStatus('error');
      setRecordingError(
        blockingReason ?? '30fps録画の開始条件を満たしていません。',
      );
      return;
    }

    setRecordingError(null);
    setRecordingStatus('starting');
    setActiveFlyout(null);

    try {
      // 録画開始時に自動で現在の露出をロック（固定）する
      let effectiveAeState = aeLockState;
      if (aeLockState === 'unlocked' || aeLockState === 'error') {
        const lockedOk = await lockAe();
        if (lockedOk) {
          effectiveAeState = 'locked';
        }
      }

      const { startedAtMonotonicMs } = startRecordingSession({
        recorder: cameraRef.current,
        aeLockState: effectiveAeState,
        requireAeLockForAutoDetection: false,
        callbacks: {
          onFinished: info => {
            clearElapsedTimer();
            recordingStartMonotonicRef.current = null;
            setElapsedMs(info.measuredDurationMs);
            // まず一時保存（temporary）として記録し、直後に端末の写真フォルダへ永続保存する
            setLastRecordedVideo(info);
            setRecordingStatus('completed');
            setRecordingError(null);

            persistRecordedVideo(info)
              .then(persistedInfo => {
                setLastRecordedVideo(persistedInfo);
              })
              .catch(err => {
                const message =
                  err instanceof Error
                    ? err.message
                    : '写真フォルダへの保存に失敗しました（一時ファイルのみ保持）。';
                setRecordingError(message);
              });
          },
          onError: error => {
            clearElapsedTimer();
            recordingStartMonotonicRef.current = null;
            setRecordingStatus('error');
            setRecordingError(`[${error.code}] ${error.message}`);
          },
        },
      });

      setRecordingStatus('recording');
      startElapsedTimer(startedAtMonotonicMs);
    } catch (err) {
      clearElapsedTimer();
      recordingStartMonotonicRef.current = null;
      const message =
        err instanceof Error ? err.message : '録画の開始に失敗しました。';
      setRecordingStatus('error');
      setRecordingError(message);
    }
  }, [
    canRecord30Fps,
    selectedFormat,
    blockingReason,
    aeLockState,
    lockAe,
    clearElapsedTimer,
    startElapsedTimer,
  ]);

  const isRecording =
    recordingStatus === 'recording' || recordingStatus === 'starting';
  const isStopping = recordingStatus === 'stopping';
  const canOperateAeLock =
    canRecord30Fps &&
    !isRecording &&
    !isStopping &&
    (aeLockState === 'unlocked' ||
      aeLockState === 'locked' ||
      aeLockState === 'error');

  return (
    <View style={styles.rootLandscapeRow}>
      {/* 1列目（最端）: MainNavRail（幅 約64px） */}
      <MainNavRail activeTab={activeNavTab} onSelectTab={setActiveNavTab} />

      {/* 2列目: CameraToolColumn（幅 約76px） */}
      <CameraToolColumn
        captureMode={captureMode}
        activeFlyout={activeFlyout}
        isRecording={isRecording}
        isStopping={isStopping}
        canRecord={canRecord30Fps && targetFps === TARGET_FPS}
        aeLockState={aeLockState}
        exposureEv={exposureEv}
        onToggleFlyout={handleToggleFlyout}
        onToggleRecording={handleToggleRecording}
      />

      {/* 3列目（メイン領域）: 16:9 カメラプレビュー ＋ オーバーレイHUD */}
      <View style={styles.mainViewportArea}>
        {/* 16:9 アスペクト比のプレビューフレーム */}
        <View style={styles.previewStage}>
          <View style={styles.aspectFrame16by9}>
            {hasCameraPermission && device && selectedFormat ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                format={selectedFormat}
                fps={TARGET_FPS}
                exposure={clampedExposure}
                outputOrientation="device"
                lowLightBoost={false}
                videoHdr={false}
                isActive={isCameraActive}
                video={true}
                audio={hasMicrophonePermission}
                onInitialized={onCameraInitialized}
                onStarted={onCameraInitialized}
                onPreviewStarted={onCameraInitialized}
                onError={onCameraError}
              />
            ) : (
              <View style={styles.previewFallback}>
                <Text style={styles.previewFallbackTitle}>{statusMessage}</Text>
                {blockingReason ? (
                  <Text style={styles.previewFallbackBody}>
                    {blockingReason}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* HUD オーバーレイ層（TopStatusHud / OptionFlyoutOverlay / BottomBrewHud） */}
        <View style={styles.hudOverlayLayer} pointerEvents="box-none">
          <TopStatusHud
            elapsedMs={elapsedMs}
            isRecording={isRecording}
            shutterSpeed={shutterSpeed}
            aeLockState={aeLockState}
            exposureEv={exposureEv}
            videoWidth={selectedFormat?.videoWidth}
            videoHeight={selectedFormat?.videoHeight}
            onCycleShutterSpeed={handleCycleShutterSpeed}
          />

          <View style={styles.middleOverlayZone} pointerEvents="box-none">
            <OptionFlyoutOverlay
              activeFlyout={activeFlyout}
              captureMode={captureMode}
              aeLockState={aeLockState}
              exposureEv={exposureEv}
              shutterSpeed={shutterSpeed}
              canOperateAeLock={canOperateAeLock}
              onSelectCaptureMode={mode => setCaptureMode(mode)}
              onToggleAeLock={handleToggleAeLock}
              onSelectExposureEv={ev => setExposureEv(ev)}
              onSelectShutterSpeed={shutter => setShutterSpeed(shutter)}
              onClose={() => setActiveFlyout(null)}
            />

            {activeNavTab === 'settings' ? (
              <View style={styles.settingsOverlayCard}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>
                    CAMERA & SYSTEM SETTINGS
                  </Text>
                  <TouchableOpacity
                    style={styles.settingsCloseBtn}
                    onPress={() => setActiveNavTab('camera')}>
                    <Text style={styles.settingsCloseText}>カメラへ戻る</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.settingsItem}>
                  ・録画フォーマット:{' '}
                  {selectedFormat
                    ? `${selectedFormat.videoWidth}x${selectedFormat.videoHeight} @ ${TARGET_FPS}fps固定`
                    : '未選択'}
                </Text>
                <Text style={styles.settingsItem}>
                  ・フリッカー対策シャッター表記: {shutterSpeed} (50Hz/60Hz対応)
                </Text>
                <Text style={styles.settingsItem}>
                  ・露出制御: EV {exposureEv >= 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1)} / AEロック状態: {aeLockState}
                </Text>
                <Text style={styles.settingsItem}>
                  ・保存先: 端末のデフォルト「写真」フォルダ（PHPhotoLibrary / MediaStore）
                </Text>
              </View>
            ) : null}
          </View>

          <BottomBrewHud
            captureMode={captureMode}
            cameraStatus={status}
            cameraStatusMessage={statusMessage}
            blockingReason={blockingReason}
            recordingStatus={recordingStatus}
            aeLockState={aeLockState}
            aeErrorMessage={aeErrorMessage}
            canStartAutoPourDetection={canStartAutoPourDetection}
            lastRecordedVideo={lastRecordedVideo}
            recordingError={recordingError}
            onRequestPermissions={requestPermissions}
            onRetryCamera={retryCamera}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootLandscapeRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#080808',
  },
  mainViewportArea: {
    flex: 1,
    backgroundColor: '#080808',
    position: 'relative',
  },
  previewStage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080808',
  },
  aspectFrame16by9: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  previewFallbackTitle: {
    color: '#e5e5ea',
    fontSize: 14,
    fontWeight: '700',
  },
  previewFallbackBody: {
    color: '#8e8e93',
    fontSize: 12,
    textAlign: 'center',
  },
  hudOverlayLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },
  middleOverlayZone: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  settingsOverlayCard: {
    alignSelf: 'center',
    width: '72%',
    backgroundColor: 'rgba(15, 15, 18, 0.94)',
    borderWidth: 1,
    borderColor: '#2b84ea',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingsTitle: {
    color: '#4da3ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  settingsCloseBtn: {
    backgroundColor: '#2b84ea',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  settingsCloseText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  settingsItem: {
    color: '#e5e5ea',
    fontSize: 12,
  },
});
