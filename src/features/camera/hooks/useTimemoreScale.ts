import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calculateMovingAverageFlowRate,
  DEFAULT_FLOW_RATE_WINDOW_MS,
  SCALE_UI_THROTTLE_INTERVAL_MS,
  TimestampedWeightSample,
  toVideoSyncedScaleSample,
  VideoSyncedPourMarker,
  VideoSyncedScaleLog,
  VideoSyncedScaleSample,
} from '../../../domain/timemoreScaleProtocol';
import { getMonotonicTimeMs } from '../services/recordingService';
import {
  TimemoreScaleConnectionState,
  TimemoreScaleSessionController,
} from '../services/timemoreScaleService';

export interface ThrottledScaleUiSnapshot {
  readonly weightGrams: number;
  readonly flowRateGramsPerSec: number;
  readonly batteryPercent: number | null;
  readonly isStable: boolean;
}

export interface UseTimemoreScaleResult {
  readonly connectionState: TimemoreScaleConnectionState;
  readonly deviceName: string | null;
  readonly diagnosticMessage: string;
  readonly uiSnapshot: ThrottledScaleUiSnapshot;
  readonly pourMarkers: readonly VideoSyncedPourMarker[];
  readonly lastSyncedLog: VideoSyncedScaleLog | null;
  readonly scanAndConnect: () => Promise<boolean>;
  readonly tare: () => Promise<boolean>;
  readonly disconnect: () => Promise<void>;
  readonly handleExtractionCardPress: () => Promise<void>;
  readonly beginRecordingSync: (
    recordingStartMonotonicMs: number,
    startedAtEpochMs: number,
  ) => void;
  readonly markPourStage: (stageNumber: 1 | 2 | 3) => void;
  readonly finishRecordingSync: () => VideoSyncedScaleLog;
}

const INITIAL_UI_SNAPSHOT: ThrottledScaleUiSnapshot = {
  weightGrams: 0.0,
  flowRateGramsPerSec: 0.0,
  batteryPercent: null,
  isStable: true,
};

/**
 * Timemore Black Mirror Dot (TES017) 連携フック
 *
 * 重要設計（30fpsカメラ録画とUI描画のパフォーマンス分離）:
 * - スケールから約10Hzで届くパケットはすべて useRef に蓄積し、React State を直接更新しない。
 * - UI表示用の State 更新は 150ms 間隔（約6.6fps）にスロットリングし、値に変化がある時のみ再描画する。
 * - 録画開始時刻（t = 0）を基準とした { timestampMs, weight, flowRate } 配列と 1〜3投目マーカーを同期記録する。
 */
export function useTimemoreScale(): UseTimemoreScaleResult {
  const controllerRef = useRef<TimemoreScaleSessionController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new TimemoreScaleSessionController();
  }

  const [connectionState, setConnectionState] =
    useState<TimemoreScaleConnectionState>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>(
    'TES017 未接続（03カードをタップして接続 / 底面3秒長押しで白LED高速点滅）',
  );
  const [uiSnapshot, setUiSnapshot] =
    useState<ThrottledScaleUiSnapshot>(INITIAL_UI_SNAPSHOT);
  const [pourMarkers, setPourMarkers] = useState<
    readonly VideoSyncedPourMarker[]
  >([]);
  const [lastSyncedLog, setLastSyncedLog] =
    useState<VideoSyncedScaleLog | null>(null);

  // 高頻度（約10Hz）パケット受信用 Ref（再レンダリングを引き起こさない）
  const latestRealtimeRef = useRef<ThrottledScaleUiSnapshot>(
    INITIAL_UI_SNAPSHOT,
  );
  const isDirtyRef = useRef<boolean>(false);
  const movingWindowRef = useRef<TimestampedWeightSample[]>([]);

  // 30fps動画同期ログ記録用 Ref
  const isRecordingSyncActiveRef = useRef<boolean>(false);
  const recordingStartMonotonicRef = useRef<number | null>(null);
  const recordingStartEpochRef = useRef<number>(0);
  const syncedSamplesRef = useRef<VideoSyncedScaleSample[]>([]);
  const pourMarkersRef = useRef<VideoSyncedPourMarker[]>([]);

  // 150ms（約6.6fps）スロットリングUI反映タイマー
  useEffect(() => {
    if (connectionState !== 'connected') {
      return;
    }

    const intervalId = setInterval(() => {
      if (!isDirtyRef.current) {
        return;
      }
      isDirtyRef.current = false;
      const latest = latestRealtimeRef.current;

      setUiSnapshot(prev => {
        const weightDiff = Math.abs(prev.weightGrams - latest.weightGrams);
        const flowDiff = Math.abs(
          prev.flowRateGramsPerSec - latest.flowRateGramsPerSec,
        );
        if (
          weightDiff < 0.05 &&
          flowDiff < 0.05 &&
          prev.batteryPercent === latest.batteryPercent &&
          prev.isStable === latest.isStable
        ) {
          return prev;
        }
        return { ...latest };
      });
    }, SCALE_UI_THROTTLE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [connectionState]);

  // アンマウント時の安全なBLE切断
  useEffect(() => {
    const ctrl = controllerRef.current;
    return () => {
      ctrl?.disconnect().catch(() => {});
    };
  }, []);

  const scanAndConnect = useCallback(async (): Promise<boolean> => {
    const ctrl = controllerRef.current;
    if (!ctrl) {
      return false;
    }

    return ctrl.scanAndConnect({
      onStateChange: (nextState, nextName, message) => {
        setConnectionState(nextState);
        setDeviceName(nextName);
        setDiagnosticMessage(message);
      },
      onPacketDecoded: packet => {
        const nowMonotonicMs = getMonotonicTimeMs();

        if (packet.isTareAck) {
          movingWindowRef.current = [
            { monotonicMs: nowMonotonicMs, weightGrams: 0.0 },
          ];
        } else {
          const cutoff = nowMonotonicMs - (DEFAULT_FLOW_RATE_WINDOW_MS + 400);
          const filtered = movingWindowRef.current.filter(
            s => s.monotonicMs >= cutoff,
          );
          filtered.push({
            monotonicMs: nowMonotonicMs,
            weightGrams: packet.weightGrams,
          });
          movingWindowRef.current = filtered;
        }

        // スケール側の流速値があれば参考にしつつ、800ms移動平均流速でUI暴れを抑制
        const smoothedFlow = calculateMovingAverageFlowRate(
          movingWindowRef.current,
          DEFAULT_FLOW_RATE_WINDOW_MS,
        );
        const effectiveFlowRate =
          packet.deviceFlowRateGramsPerSec !== null &&
          packet.deviceFlowRateGramsPerSec > 0 &&
          smoothedFlow === 0
            ? packet.deviceFlowRateGramsPerSec
            : smoothedFlow;

        latestRealtimeRef.current = {
          weightGrams: packet.weightGrams,
          flowRateGramsPerSec: effectiveFlowRate,
          batteryPercent:
            packet.batteryPercent ?? latestRealtimeRef.current.batteryPercent,
          isStable: packet.isStable,
        };
        isDirtyRef.current = true;

        // 録画中の場合は REC開始時刻 (t = 0) 基準の同期ログ配列へ追加（State更新なし）
        if (
          isRecordingSyncActiveRef.current &&
          recordingStartMonotonicRef.current !== null
        ) {
          const syncedPoint = toVideoSyncedScaleSample({
            recordingStartMonotonicMs: recordingStartMonotonicRef.current,
            sampleMonotonicMs: nowMonotonicMs,
            weightGrams: packet.weightGrams,
            flowRateGramsPerSec: effectiveFlowRate,
          });
          if (syncedPoint) {
            syncedSamplesRef.current.push(syncedPoint);
          }
        }
      },
    });
  }, []);

  const tare = useCallback(async (): Promise<boolean> => {
    const ctrl = controllerRef.current;
    if (!ctrl || connectionState !== 'connected') {
      return false;
    }
    try {
      const ok = await ctrl.sendTare();
      if (ok) {
        const nowMs = getMonotonicTimeMs();
        movingWindowRef.current = [{ monotonicMs: nowMs, weightGrams: 0.0 }];
        latestRealtimeRef.current = {
          ...latestRealtimeRef.current,
          weightGrams: 0.0,
          flowRateGramsPerSec: 0.0,
          isStable: true,
        };
        isDirtyRef.current = true;
        setUiSnapshot( latestRealtimeRef.current );
        setDiagnosticMessage('Tare (0.0g ゼロリセット) を送信しました');
      }
      return ok;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Tare送信に失敗しました。';
      setDiagnosticMessage(msg);
      return false;
    }
  }, [connectionState]);

  const disconnect = useCallback(async (): Promise<void> => {
    await controllerRef.current?.disconnect();
    setConnectionState('disconnected');
    setDeviceName(null);
    setDiagnosticMessage('TES017 切断済み（タップで再接続）');
  }, []);

  /**
   * 03 / POUR TIMESTAMPS (EXTRACTION) カードをタップした時のアクション:
   * - 接続済みなら Tare (0.0g ゼロリセット) コマンドを送信
   * - 未接続なら TES017 のスキャン・接続を開始
   */
  const handleExtractionCardPress = useCallback(async (): Promise<void> => {
    if (connectionState === 'connected') {
      await tare();
    } else if (
      connectionState !== 'scanning' &&
      connectionState !== 'connecting' &&
      connectionState !== 'handshaking'
    ) {
      await scanAndConnect();
    }
  }, [connectionState, tare, scanAndConnect]);

  const beginRecordingSync = useCallback(
    (recordingStartMonotonicMs: number, startedAtEpochMs: number): void => {
      recordingStartMonotonicRef.current = recordingStartMonotonicMs;
      recordingStartEpochRef.current = startedAtEpochMs;
      isRecordingSyncActiveRef.current = true;

      const currentWeight = latestRealtimeRef.current.weightGrams;
      const currentFlow = latestRealtimeRef.current.flowRateGramsPerSec;

      syncedSamplesRef.current = [
        {
          timestampMs: 0,
          weight: currentWeight,
          flowRate: currentFlow,
        },
      ];
      const initialMarker: VideoSyncedPourMarker = {
        stageNumber: 1,
        timestampMs: 0,
        weightAtMarker: currentWeight,
      };
      pourMarkersRef.current = [initialMarker];
      setPourMarkers([initialMarker]);
    },
    [],
  );

  const markPourStage = useCallback((stageNumber: 1 | 2 | 3): void => {
    if (
      !isRecordingSyncActiveRef.current ||
      recordingStartMonotonicRef.current === null
    ) {
      return;
    }
    const elapsedMs = Math.max(
      0,
      Math.round(getMonotonicTimeMs() - recordingStartMonotonicRef.current),
    );
    const currentWeight = latestRealtimeRef.current.weightGrams;

    const existingIdx = pourMarkersRef.current.findIndex(
      m => m.stageNumber === stageNumber,
    );
    const marker: VideoSyncedPourMarker = {
      stageNumber,
      timestampMs: elapsedMs,
      weightAtMarker: currentWeight,
    };

    if (existingIdx >= 0) {
      const updated = [...pourMarkersRef.current];
      updated[existingIdx] = marker;
      pourMarkersRef.current = updated;
    } else {
      pourMarkersRef.current = [...pourMarkersRef.current, marker];
    }
    setPourMarkers([...pourMarkersRef.current]);
  }, []);

  const finishRecordingSync = useCallback((): VideoSyncedScaleLog => {
    isRecordingSyncActiveRef.current = false;
    const log: VideoSyncedScaleLog = {
      deviceModel: 'TES017',
      recordingStartedAtEpochMs: recordingStartEpochRef.current,
      pourMarkers: [...pourMarkersRef.current],
      samples: [...syncedSamplesRef.current],
    };
    setLastSyncedLog(log);
    return log;
  }, []);

  return {
    connectionState,
    deviceName,
    diagnosticMessage,
    uiSnapshot,
    pourMarkers,
    lastSyncedLog,
    scanAndConnect,
    tare,
    disconnect,
    handleExtractionCardPress,
    beginRecordingSync,
    markPourStage,
    finishRecordingSync,
  };
}
