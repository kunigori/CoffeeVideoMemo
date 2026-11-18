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
import type { FlyoutType } from '../components/CameraToolColumn';
import { MainNavRail, MainNavTab } from '../components/MainNavRail';
import { OptionFlyoutOverlay } from '../components/OptionFlyoutOverlay';
import { PlacementGuideOverlay } from '../components/PlacementGuideOverlay';
import { TopStatusHud } from '../components/TopStatusHud';
import {
  AUDIO_MONITOR_BAR_HEIGHTS,
  BREW_SEQUENCE_STAGES,
  BREW_THEME,
  CaptureWorkflowMode,
  RECORDING_TIMER_INTERVAL_MS,
  ShutterSpeedLabel,
  TARGET_FPS,
} from '../constants';
import { useCameraConfig } from '../hooks/useCameraConfig';
import { useExposureLock } from '../hooks/useExposureLock';
import { useTimemoreScale } from '../hooks/useTimemoreScale';
import {
  BeanOcrSessionResult,
  captureAndRecognizeBeanInfo,
} from '../services/beanOcrService';
import {
  checkPatternAEquipmentModels,
  createInitialEquipmentSnapshot,
  EquipmentInferenceSnapshot,
  hasNativeEquipmentStatusBridge,
} from '../services/equipmentInferenceService';
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

  // COFFEE VIDEO MEMO — Brew Motion System (pour_frame_side_view_edition (2).html 準拠) UI 状態
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>('camera');
  const [activeFlyout, setActiveFlyout] = useState<FlyoutType>(null);
  const [captureMode, setCaptureMode] =
    useState<CaptureWorkflowMode>('full-process');
  const [activeStageIndex, setActiveStageIndex] = useState<0 | 1 | 2>(0);
  const [showPlacementGuide, setShowPlacementGuide] = useState<boolean>(true);
  const [exposureEv] = useState<number>(0.0);
  const [shutterSpeed, setShutterSpeed] = useState<ShutterSpeedLabel>('1/60');

  // 録画・タイムコード状態
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [lastRecordedVideo, setLastRecordedVideo] =
    useState<RecordedVideoInfo | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // 右枠（豆袋）OCR推論結果 & パターンA（左:ミル / 中央:ドリッパー）TFLiteモデル状態
  const [beanOcrResult, setBeanOcrResult] =
    useState<BeanOcrSessionResult | null>(null);
  const [equipmentSnapshot, setEquipmentSnapshot] =
    useState<EquipmentInferenceSnapshot>(() =>
      createInitialEquipmentSnapshot(),
    );

  const recordingStatusRef = useRef<RecordingStatus>(recordingStatus);
  recordingStatusRef.current = recordingStatus;

  useEffect(() => {
    let isMounted = true;
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
    if (hasNativeEquipmentStatusBridge()) {
      checkPatternAEquipmentModels()
        .then(snapshot => {
          if (isMounted) {
            setEquipmentSnapshot(snapshot);
          }
        })
        .catch(() => {
          // モデル未配置・初期化前エラーは snapshot 内で通知
        });
    }
    return () => {
      isMounted = false;
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

  const {
    connectionState: scaleConnectionState,
    diagnosticMessage: scaleDiagnosticMessage,
    uiSnapshot: scaleSnapshot,
    pourMarkers: scalePourMarkers,
    handleExtractionCardPress,
    beginRecordingSync,
    markPourStage,
    finishRecordingSync,
  } = useTimemoreScale();

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

  const handleSelectStage = useCallback(
    (nextIndex: 0 | 1 | 2) => {
      setActiveStageIndex(nextIndex);
      markPourStage((nextIndex + 1) as 1 | 2 | 3);
    },
    [markPourStage],
  );

  const handleCycleBrewPhase = useCallback(() => {
    setActiveStageIndex(prev => {
      const next = ((prev + 1) % 3) as 0 | 1 | 2;
      markPourStage((next + 1) as 1 | 2 | 3);
      return next;
    });
  }, [markPourStage]);

  const handleSelectAutoBrightness = useCallback(async () => {
    if (aeLockState === 'locked') {
      await unlockAe();
    }
  }, [aeLockState, unlockAe]);

  const handleSelectLockBrightness = useCallback(async () => {
    if (aeLockState !== 'locked') {
      await lockAe();
    }
  }, [aeLockState, lockAe]);

  const handleTriggerBeanScan = useCallback(async () => {
    const cam = cameraRef.current as unknown as {
      takePhoto?: (options?: Record<string, unknown>) => Promise<{
        path: string;
        width?: number;
        height?: number;
      }>;
    } | null;

    if (!cam || typeof cam.takePhoto !== 'function') {
      return;
    }

    setBeanOcrResult({
      state: 'scanning',
      engine: null,
      photoPath: null,
      rawLines: [],
      matchOutput: null,
      errorMessage: null,
    });

    const result = await captureAndRecognizeBeanInfo(cam);
    setBeanOcrResult(result);
  }, []);

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
            const scaleTelemetryLog = finishRecordingSync();
            const enrichedInfo: RecordedVideoInfo = {
              ...info,
              scaleTelemetryLog,
            };
            // まず一時保存（temporary）として記録し、直後に端末の写真フォルダへ永続保存する
            setLastRecordedVideo(enrichedInfo);
            setRecordingStatus('completed');
            setRecordingError(null);

            persistRecordedVideo(enrichedInfo)
              .then(persistedInfo => {
                setLastRecordedVideo({
                  ...persistedInfo,
                  scaleTelemetryLog,
                });
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
            finishRecordingSync();
            setRecordingStatus('error');
            setRecordingError(`[${error.code}] ${error.message}`);
          },
        },
      });

      setRecordingStatus('recording');
      startElapsedTimer(startedAtMonotonicMs);
      beginRecordingSync(startedAtMonotonicMs, Date.now());

      // フル工程モードのREC開始時に、右領域（豆袋枠）の高解像度静止画1枚を撮影してOCR・銘柄推論を非同期実行する
      if (captureMode === 'full-process') {
        handleTriggerBeanScan().catch(() => {
          // OCR失敗時は30fps動画録画自体を止めず、BottomBrewHud枠内にのみ診断を表示する
        });
      }
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
    captureMode,
    handleTriggerBeanScan,
    beginRecordingSync,
    finishRecordingSync,
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

  const currentStage =
    BREW_SEQUENCE_STAGES[activeStageIndex] ?? BREW_SEQUENCE_STAGES[0];

  return (
    <View style={styles.appRoot}>
      {/* TOP HEADER: Brand + Timer + Synchronized Camera Specs */}
      <TopStatusHud
        elapsedMs={elapsedMs}
        isRecording={isRecording}
        activeStageIndex={activeStageIndex}
        shutterSpeed={shutterSpeed}
        aeLockState={aeLockState}
        videoWidth={selectedFormat?.videoWidth}
        videoHeight={selectedFormat?.videoHeight}
        onCycleBrewPhase={handleCycleBrewPhase}
        onPressBrightnessBadge={() => handleToggleFlyout('bright')}
        onPressFlickerBadge={() => handleToggleFlyout('flicker')}
      />

      {/* MAIN WORKSPACE: Single Left Rail + Center Monitor + Right Inspector */}
      <View style={styles.workspace}>
        {/* 1. SINGLE LEFT RAIL (カメラ, MEDIA, RECORD, MAP, 設定 + MODE, BRIGHT, FLICKER + REC) */}
        <MainNavRail
          activeTab={activeNavTab}
          captureMode={captureMode}
          activeFlyout={activeFlyout}
          aeLockState={aeLockState}
          shutterSpeed={shutterSpeed}
          isRecording={isRecording}
          isStopping={isStopping}
          canRecord={canRecord30Fps && targetFps === TARGET_FPS}
          onSelectTab={setActiveNavTab}
          onToggleFlyout={handleToggleFlyout}
          onToggleRecording={handleToggleRecording}
        />

        {/* 2. CENTER VIEWFINDER (SIDE-VIEW DRIPPER) + BOTTOM 3 DATA CARDS */}
        <View style={styles.centerColumn}>
          <View style={styles.monitorHead}>
            <Text style={styles.overlineText} numberOfLines={1}>
              <Text style={styles.overlineBold}>01</Text>
              {'  /  LIVE MONITOR  ——  SIDE-VIEW BREW SESSION'}
            </Text>

            <View style={styles.headRight}>
              <View style={styles.microStatusRow}>
                <View style={styles.liveDot} />
                {isRecording ? (
                  <Text style={styles.microRecPrefix}>REC / </Text>
                ) : null}
                <Text style={styles.microText}>TFLite / OCR READY</Text>
              </View>
              <View style={styles.shotCounter}>
                <Text style={styles.shotCounterText}>SHOT 001</Text>
              </View>
            </View>
          </View>

          {/* Viewfinder Stage */}
          <View style={styles.viewfinder}>
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
                photo={true}
                video={true}
                audio={hasMicrophonePermission}
                onInitialized={onCameraInitialized}
                onStarted={onCameraInitialized}
                onPreviewStarted={onCameraInitialized}
                onError={onCameraError}
              />
            ) : (
              <View style={styles.viewfinderFallback}>
                <Text style={styles.fallbackTitle}>{statusMessage}</Text>
                {blockingReason ? (
                  <Text style={styles.fallbackBody}>{blockingReason}</Text>
                ) : null}
              </View>
            )}

            <PlacementGuideOverlay
              visible={showPlacementGuide}
              captureMode={captureMode}
              isRecording={isRecording}
              videoWidth={selectedFormat?.videoWidth}
              videoHeight={selectedFormat?.videoHeight}
            />

            <OptionFlyoutOverlay
              activeFlyout={activeFlyout}
              captureMode={captureMode}
              showPlacementGuide={showPlacementGuide}
              aeLockState={aeLockState}
              shutterSpeed={shutterSpeed}
              canOperateAeLock={canOperateAeLock}
              onSelectCaptureMode={mode => setCaptureMode(mode)}
              onTogglePlacementGuide={() =>
                setShowPlacementGuide(prev => !prev)
              }
              onSelectAutoBrightness={handleSelectAutoBrightness}
              onSelectLockBrightness={handleSelectLockBrightness}
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
                  ・フリッカー対策シャッター: {shutterSpeed} / AEロック状態:{' '}
                  {aeLockState}
                </Text>
                <Text style={styles.settingsItem}>
                  ・保存先: 端末のデフォルト「写真」フォルダ（PHPhotoLibrary /
                  MediaStore）
                </Text>
              </View>
            ) : null}
          </View>

          {/* Bottom 3 Data Cards */}
          <BottomBrewHud
            captureMode={captureMode}
            activeStageIndex={activeStageIndex}
            shutterSpeed={shutterSpeed}
            cameraStatus={status}
            cameraStatusMessage={statusMessage}
            blockingReason={blockingReason}
            recordingStatus={recordingStatus}
            aeLockState={aeLockState}
            aeErrorMessage={aeErrorMessage}
            canStartAutoPourDetection={canStartAutoPourDetection}
            lastRecordedVideo={lastRecordedVideo}
            recordingError={recordingError}
            beanOcrResult={beanOcrResult}
            equipmentSnapshot={equipmentSnapshot}
            scaleConnectionState={scaleConnectionState}
            scaleSnapshot={scaleSnapshot}
            scaleDiagnosticMessage={scaleDiagnosticMessage}
            scalePourMarkers={scalePourMarkers}
            onTriggerBeanScan={handleTriggerBeanScan}
            onPressExtractionCard={handleExtractionCardPress}
            onRequestPermissions={requestPermissions}
            onRetryCamera={retryCamera}
          />
        </View>

        {/* 3. RIGHT INSPECTOR: BREW SEQUENCE + OVERLAY + AUDIO MONITOR */}
        <View style={styles.inspector}>
          <View style={styles.inspHead}>
            <Text style={styles.inspSub}>BREW SEQUENCE</Text>
            <View style={styles.inspSessionRow}>
              <Text style={styles.inspSessionNum}>{currentStage.stepNum}</Text>
              <Text style={styles.inspSessionTotal}>/ 03 STAGES</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${currentStage.progressPercent}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.inspBody}>
            <Text style={styles.inspSectionLabel}>CURRENT PHASE</Text>

            {BREW_SEQUENCE_STAGES.map((stage, idx) => {
              const isActive = idx === activeStageIndex;
              const isDone = idx < activeStageIndex;
              const isLast = idx === BREW_SEQUENCE_STAGES.length - 1;

              return (
                <TouchableOpacity
                  key={stage.stepNum}
                  accessibilityRole="button"
                  accessibilityLabel={stage.title}
                  activeOpacity={0.78}
                  style={styles.stepRow}
                  onPress={() => handleSelectStage(stage.index)}>
                  {!isLast ? <View style={styles.stepConnectorLine} /> : null}
                  <View
                    style={[
                      styles.stepNumCircle,
                      isActive && styles.stepNumCircleActive,
                      isDone && styles.stepNumCircleDone,
                    ]}>
                    <Text
                      style={[
                        styles.stepNumText,
                        isActive && styles.stepNumTextActive,
                        isDone && styles.stepNumTextDone,
                      ]}>
                      {stage.stepNum}
                    </Text>
                  </View>

                  <View style={styles.stepTextBlock}>
                    <Text
                      style={[
                        styles.stepTitle,
                        isActive && styles.stepTitleActive,
                      ]}
                      numberOfLines={1}>
                      {stage.title}
                    </Text>
                    <Text
                      style={[
                        styles.stepSub,
                        isActive && styles.stepSubActive,
                      ]}
                      numberOfLines={2}>
                      {stage.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inspBottom}>
            <View style={styles.utilityRow}>
              <Text style={styles.inspBottomLabel}>OVERLAY</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="ガイド表示切替"
                activeOpacity={0.8}
                style={styles.guideToggleButton}
                onPress={() => setShowPlacementGuide(prev => !prev)}>
                <Text style={styles.guideToggleButtonText}>
                  {showPlacementGuide ? 'GUIDES ON' : 'GUIDES OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inspBottomLabel}>AUDIO MONITOR</Text>
            <View style={styles.frequencyRow}>
              {AUDIO_MONITOR_BAR_HEIGHTS.slice(0, 24).map((barH, i) => (
                <View
                  key={i}
                  style={[
                    styles.frequencyBar,
                    {
                      height: Math.max(3, Math.round(barH * 0.65)),
                      opacity: Number((0.35 + 0.55 * (barH / 35)).toFixed(2)),
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.audioStatusRow}>
              <Text style={styles.audioStatusLeft}>INPUT  /  CH 01</Text>
              <Text style={styles.audioStatusRight}>−18 dB</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: BREW_THEME.ink,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  centerColumn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    backgroundColor: BREW_THEME.centerBg,
    justifyContent: 'space-between',
  },
  monitorHead: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  overlineText: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  overlineBold: {
    color: BREW_THEME.oatmeal,
    fontWeight: '800',
  },
  headRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  microStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BREW_THEME.acid,
    marginRight: 6,
  },
  microRecPrefix: {
    color: BREW_THEME.verm,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  microText: {
    color: BREW_THEME.oatmeal,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  shotCounter: {
    backgroundColor: BREW_THEME.oatmeal,
    borderWidth: 1,
    borderColor: BREW_THEME.oatmealEdge,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  shotCounterText: {
    color: BREW_THEME.oatmealInk,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  viewfinder: {
    flex: 1,
    minHeight: 140,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    backgroundColor: '#241c16',
    overflow: 'hidden',
    position: 'relative',
  },
  viewfinderFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 6,
    backgroundColor: '#241c16',
  },
  fallbackTitle: {
    color: BREW_THEME.oatmeal,
    fontSize: 13,
    fontWeight: '800',
  },
  fallbackBody: {
    color: BREW_THEME.soft,
    fontSize: 11,
    textAlign: 'center',
  },
  settingsOverlayCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: 16,
    width: '78%',
    backgroundColor: 'rgba(33, 26, 21, 0.96)',
    borderWidth: 1,
    borderColor: BREW_THEME.cobalt,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    zIndex: 30,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  settingsTitle: {
    color: BREW_THEME.oatmeal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  settingsCloseBtn: {
    backgroundColor: BREW_THEME.cobalt,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
  },
  settingsCloseText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  settingsItem: {
    color: BREW_THEME.ivory,
    fontSize: 11,
  },
  inspector: {
    width: 196,
    backgroundColor: BREW_THEME.panel,
    borderLeftWidth: 1,
    borderLeftColor: BREW_THEME.edge,
    justifyContent: 'space-between',
  },
  inspHead: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BREW_THEME.edge,
    backgroundColor: BREW_THEME.inspHeadBg,
  },
  inspSub: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  inspSessionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  inspSessionNum: {
    color: BREW_THEME.oatmeal,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  inspSessionTotal: {
    color: BREW_THEME.soft,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginLeft: 6,
  },
  progressTrack: {
    marginTop: 8,
    height: 3,
    backgroundColor: BREW_THEME.edge,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BREW_THEME.cobalt,
  },
  inspBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  inspSectionLabel: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  stepRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 12,
  },
  stepConnectorLine: {
    position: 'absolute',
    top: 18,
    bottom: 2,
    left: 8.5,
    width: 1,
    backgroundColor: BREW_THEME.edge,
  },
  stepNumCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: BREW_THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BREW_THEME.panel,
  },
  stepNumCircleActive: {
    backgroundColor: BREW_THEME.cobalt,
    borderColor: BREW_THEME.cobalt,
  },
  stepNumCircleDone: {
    borderColor: BREW_THEME.acid,
  },
  stepNumText: {
    color: BREW_THEME.soft,
    fontSize: 8,
    fontWeight: '800',
  },
  stepNumTextActive: {
    color: '#ffffff',
  },
  stepNumTextDone: {
    color: BREW_THEME.acid,
  },
  stepTextBlock: {
    flex: 1,
  },
  stepTitle: {
    color: BREW_THEME.oatmeal,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  stepTitleActive: {
    color: BREW_THEME.ivory,
  },
  stepSub: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    lineHeight: 12,
  },
  stepSubActive: {
    color: BREW_THEME.oatmeal,
  },
  inspBottom: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BREW_THEME.edge,
    backgroundColor: BREW_THEME.inspBottomBg,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inspBottomLabel: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  guideToggleButton: {
    backgroundColor: BREW_THEME.oatmeal,
    borderWidth: 1,
    borderColor: BREW_THEME.oatmealEdge,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  guideToggleButtonText: {
    color: BREW_THEME.oatmealInk,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 22,
    marginVertical: 6,
  },
  frequencyBar: {
    width: 4,
    backgroundColor: BREW_THEME.oatmeal,
    borderRadius: 1,
  },
  audioStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioStatusLeft: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  audioStatusRight: {
    color: BREW_THEME.acid,
    fontSize: 8.5,
    fontWeight: '800',
  },
});
