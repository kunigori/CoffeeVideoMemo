import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { VideoSyncedPourMarker } from '../../../domain/timemoreScaleProtocol';
import {
  BREW_SEQUENCE_STAGES,
  BREW_THEME,
  CaptureWorkflowMode,
  FLICKER_PRESET_OPTIONS,
  ShutterSpeedLabel,
} from '../constants';
import type { CameraReadyStatus } from '../hooks/useCameraConfig';
import type { ThrottledScaleUiSnapshot } from '../hooks/useTimemoreScale';
import type { BeanOcrSessionResult } from '../services/beanOcrService';
import type { EquipmentInferenceSnapshot } from '../services/equipmentInferenceService';
import type { ExposureLockState } from '../services/exposureLockService';
import type { TimemoreScaleConnectionState } from '../services/timemoreScaleService';
import type { RecordedVideoInfo, RecordingStatus } from '../types';

export interface BottomBrewHudProps {
  captureMode: CaptureWorkflowMode;
  activeStageIndex: 0 | 1 | 2;
  shutterSpeed: ShutterSpeedLabel;
  cameraStatus: CameraReadyStatus;
  cameraStatusMessage: string;
  blockingReason: string | null;
  recordingStatus: RecordingStatus;
  aeLockState: ExposureLockState;
  aeErrorMessage: string | null;
  canStartAutoPourDetection: boolean;
  lastRecordedVideo: RecordedVideoInfo | null;
  recordingError: string | null;
  beanOcrResult: BeanOcrSessionResult | null;
  equipmentSnapshot: EquipmentInferenceSnapshot | null;
  scaleConnectionState?: TimemoreScaleConnectionState;
  scaleSnapshot?: ThrottledScaleUiSnapshot;
  scaleDiagnosticMessage?: string;
  scalePourMarkers?: readonly VideoSyncedPourMarker[];
  onTriggerBeanScan: () => void;
  onPressExtractionCard?: () => void;
  onRequestPermissions: () => void;
  onRetryCamera: () => void;
}

function formatMarkerTimeMmSs(timestampMs: number): string {
  const totalSec = Math.max(0, Math.floor(timestampMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function buildPourTimestampSummary(
  markers: readonly VideoSyncedPourMarker[] | undefined,
  fallbackSummary: string,
): string {
  if (!markers || markers.length === 0) {
    return fallbackSummary;
  }
  const m1 = markers.find(m => m.stageNumber === 1);
  const m2 = markers.find(m => m.stageNumber === 2);
  const m3 = markers.find(m => m.stageNumber === 3);

  const s1 = m1 ? formatMarkerTimeMmSs(m1.timestampMs) : '--:--';
  const s2 = m2 ? formatMarkerTimeMmSs(m2.timestampMs) : '--:--';
  const s3 = m3 ? formatMarkerTimeMmSs(m3.timestampMs) : '--:--';
  return `1st: ${s1} / 2nd: ${s2} / 3rd: ${s3}`;
}

/**
 * BOTTOM 3 DATA CARDS: BottomBrewHud
 * 1. 01 / BEAN INFO (Oatmeal Beige Card #e8dfd1 + Cobalt Badge #355aff)
 * 2. 02 / BREW / AE & ML STATUS (Roasted Umber Card #211a15 + Acid Status Pill #dbfb50)
 * 3. 03 / POUR TIMESTAMPS & TES017 SCALE (タップで接続 / 接続中はタップで 0.0g Tare リセット)
 */
export function BottomBrewHud({
  captureMode,
  activeStageIndex,
  shutterSpeed,
  cameraStatus,
  cameraStatusMessage,
  blockingReason,
  aeLockState,
  aeErrorMessage,
  lastRecordedVideo,
  recordingError,
  beanOcrResult,
  equipmentSnapshot,
  scaleConnectionState = 'disconnected',
  scaleSnapshot,
  scaleDiagnosticMessage,
  scalePourMarkers,
  onTriggerBeanScan,
  onPressExtractionCard,
  onRequestPermissions,
  onRetryCamera,
}: BottomBrewHudProps): React.JSX.Element {
  const bestMatch = beanOcrResult?.matchOutput?.bestMatch ?? null;
  const stage =
    BREW_SEQUENCE_STAGES[activeStageIndex] ?? BREW_SEQUENCE_STAGES[0];
  const flickerPreset =
    FLICKER_PRESET_OPTIONS.find(item => item.shutter === shutterSpeed) ??
    FLICKER_PRESET_OPTIONS[0];

  const beanTitleText =
    beanOcrResult?.state === 'scanning'
      ? '右枠の豆袋をOCR解析中...'
      : beanOcrResult?.state === 'matched' && bestMatch
        ? bestMatch.bean.displaySummary
        : beanOcrResult?.state === 'unmatched'
          ? `候補未特定 (${beanOcrResult.rawLines.slice(0, 2).join(' / ')})`
          : beanOcrResult?.state === 'no-text' ||
              beanOcrResult?.state === 'error'
            ? 'OCR未検出 (タップして再スキャン)'
            : 'Ethiopia Guji / Mameya';

  const beanFootText =
    beanOcrResult?.state === 'matched' && bestMatch
      ? `${bestMatch.bean.country} / ${bestMatch.bean.farmOrProducer} (一致度 ${Math.round(bestMatch.confidence * 100)}%)`
      : beanOcrResult?.errorMessage
        ? beanOcrResult.errorMessage
        : '右枠に豆袋を配置 (REC開始時に静止画OCR抽出)';

  const alertMessage = recordingError ?? blockingReason ?? aeErrorMessage;

  const isScaleConnected = scaleConnectionState === 'connected';
  const weightBadgeText =
    isScaleConnected && scaleSnapshot
      ? `${scaleSnapshot.weightGrams.toFixed(1)} g (${scaleSnapshot.flowRateGramsPerSec.toFixed(1)} g/s)`
      : stage.waterWeight;

  const pourTimestampsText = buildPourTimestampSummary(
    scalePourMarkers,
    stage.timestampSummary,
  );

  return (
    <View style={styles.bottomBar}>
      {/* Card 1: 01 / BEAN INFO (Warm Oatmeal Beige Card) */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="豆情報OCRスキャン"
        activeOpacity={0.88}
        style={[styles.dataCard, styles.oatmealCard]}
        onPress={onTriggerBeanScan}>
        <View style={styles.dataEyebrow}>
          <Text style={[styles.eyebrowText, styles.eyebrowTextOatmeal]}>
            01  /  BEAN INFO (豆情報)
          </Text>
          <View style={styles.badgeCobalt}>
            <Text style={styles.badgeCobaltText}>
              {captureMode === 'full-process' ? 'フル工程' : 'ドリップのみ'}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.cardMainValue, styles.cardMainValueOatmeal]}
          numberOfLines={1}>
          {beanTitleText}
        </Text>

        <Text
          style={[styles.miniFoot, styles.miniFootOatmeal]}
          numberOfLines={1}>
          {beanFootText}
        </Text>
      </TouchableOpacity>

      {/* Card 2: 02 / BREW / AE & ML STATUS */}
      <View style={styles.dataCard}>
        <View style={styles.dataEyebrow}>
          <Text style={styles.eyebrowText}>02  /  BREW / AE & ML STATUS</Text>
          <Text style={styles.statusPillAcid}>
            AE: {aeLockState.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.cardMainValue} numberOfLines={1}>
          {cameraStatus === 'ready'
            ? '準備完了 (4K @ 30fps)'
            : cameraStatusMessage}
        </Text>

        {alertMessage ? (
          <View style={styles.alertRow}>
            <Text style={styles.alertText} numberOfLines={1}>
              {alertMessage}
            </Text>
            {cameraStatus === 'permission-denied' ? (
              <TouchableOpacity
                style={styles.inlineActionBtn}
                onPress={onRequestPermissions}>
                <Text style={styles.inlineActionText}>権限許可</Text>
              </TouchableOpacity>
            ) : cameraStatus === 'error' ? (
              <TouchableOpacity
                style={styles.inlineActionBtn}
                onPress={onRetryCamera}>
                <Text style={styles.inlineActionText}>再試行</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={styles.miniFoot} numberOfLines={1}>
            {equipmentSnapshot?.readiness === 'ready'
              ? `TFLite 2モデル準備完了 (フリッカー防止: ${flickerPreset.shortHzLabel})`
              : `TFLite学習モデル待機中 (フリッカー防止: ${flickerPreset.shortHzLabel})`}
          </Text>
        )}
      </View>

      {/* Card 3: 03 / POUR TIMESTAMPS & TIMEMORE TES017 SCALE (タップでTareゼロリセットまたは接続) */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          isScaleConnected
            ? 'スケールゼロリセット (Tare)'
            : 'タイムモア TES017 スケール接続'
        }
        activeOpacity={0.85}
        style={styles.dataCard}
        onPress={onPressExtractionCard}>
        <View style={styles.dataEyebrow}>
          <Text style={styles.eyebrowText}>03  /  POUR TIMESTAMPS</Text>
          <Text style={styles.statusPillAcid}>{weightBadgeText}</Text>
        </View>

        {lastRecordedVideo ? (
          <>
            <Text style={styles.cardMainValue} numberOfLines={1}>
              保存完了 ({lastRecordedVideo.durationSec.toFixed(1)}s /{' '}
              {lastRecordedVideo.storageStatus === 'persisted'
                ? '写真フォルダ保存済'
                : '一時保存'}
              )
            </Text>
            <Text style={styles.miniFoot} numberOfLines={1}>
              {lastRecordedVideo.scaleTelemetryLog
                ? `重量同期ログ: ${lastRecordedVideo.scaleTelemetryLog.samples.length}件 | Path: ${lastRecordedVideo.path}`
                : `Path: ${lastRecordedVideo.path}`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardMainValue} numberOfLines={1}>
              {pourTimestampsText}
            </Text>
            <Text style={styles.miniFoot} numberOfLines={1}>
              {scaleDiagnosticMessage ??
                '録画停止後に保存パスと秒数がここに表示'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  dataCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: BREW_THEME.panel,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
    gap: 3,
  },
  oatmealCard: {
    backgroundColor: BREW_THEME.oatmeal,
    borderColor: BREW_THEME.oatmealEdge,
  },
  dataEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  eyebrowText: {
    color: BREW_THEME.soft,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eyebrowTextOatmeal: {
    color: '#5e4e3e',
  },
  badgeCobalt: {
    backgroundColor: BREW_THEME.cobalt,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  badgeCobaltText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
  },
  statusPillAcid: {
    color: BREW_THEME.acid,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardMainValue: {
    color: BREW_THEME.ivory,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Courier',
    fontVariant: ['tabular-nums'],
  },
  cardMainValueOatmeal: {
    color: BREW_THEME.oatmealInk,
  },
  miniFoot: {
    color: BREW_THEME.soft,
    fontSize: 9,
  },
  miniFootOatmeal: {
    color: '#5a4b3c',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  alertText: {
    flex: 1,
    color: BREW_THEME.verm,
    fontSize: 9,
    fontWeight: '700',
  },
  inlineActionBtn: {
    backgroundColor: BREW_THEME.cobalt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
  },
  inlineActionText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
  },
});
