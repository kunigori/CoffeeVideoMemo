import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TARGET_FPS } from '../constants';
import type { CameraReadyStatus } from '../hooks/useCameraConfig';
import type { ExposureLockState } from '../services/exposureLockService';
import { formatElapsedDuration } from '../services/recordingService';
import type { RecordedVideoInfo, RecordingStatus } from '../types';

export interface RecordingControlsProps {
  cameraStatus: CameraReadyStatus;
  cameraStatusMessage: string;
  blockingReason: string | null;
  canRecord30Fps: boolean;
  recordingStatus: RecordingStatus;
  elapsedMs: number;
  aeLockState: ExposureLockState;
  aeErrorMessage: string | null;
  canStartAutoPourDetection: boolean;
  lastRecordedVideo: RecordedVideoInfo | null;
  recordingError: string | null;
  onToggleRecording: () => void;
  onToggleAeLock: () => void;
  onRequestPermissions: () => void;
  onRetryCamera: () => void;
}

function getAeStateLabel(state: ExposureLockState): string {
  switch (state) {
    case 'unavailable':
      return '未接続 / ネイティブ未導入 (unavailable)';
    case 'unsupported':
      return 'ハードウェア非対応 (unsupported)';
    case 'unlocked':
      return '未ロック (unlocked)';
    case 'locking':
      return 'ロック処理中... (locking)';
    case 'locked':
      return 'ロック成立 (locked)';
    case 'unlocking':
      return '解除処理中... (unlocking)';
    case 'error':
      return 'エラー (error)';
  }
}

function getRecordingStatusLabel(status: RecordingStatus): string {
  switch (status) {
    case 'idle':
      return '待機中';
    case 'starting':
      return '録画開始中...';
    case 'recording':
      return `録画中 (${TARGET_FPS}fps固定)`;
    case 'stopping':
      return '録画停止処理中...';
    case 'completed':
      return '録画完了';
    case 'error':
      return '録画エラー';
  }
}

export function RecordingControls({
  cameraStatus,
  cameraStatusMessage,
  blockingReason,
  canRecord30Fps,
  recordingStatus,
  elapsedMs,
  aeLockState,
  aeErrorMessage,
  canStartAutoPourDetection,
  lastRecordedVideo,
  recordingError,
  onToggleRecording,
  onToggleAeLock,
  onRequestPermissions,
  onRetryCamera,
}: RecordingControlsProps): React.JSX.Element {
  const isRecording =
    recordingStatus === 'recording' || recordingStatus === 'starting';
  const isStopping = recordingStatus === 'stopping';
  const recordButtonDisabled =
    isStopping || (!isRecording && !canRecord30Fps);

  const canOperateAeLock =
    canRecord30Fps &&
    !isRecording &&
    !isStopping &&
    (aeLockState === 'unlocked' ||
      aeLockState === 'locked' ||
      aeLockState === 'error');

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* 上部ステータスパネル */}
      <View style={styles.statusPanel}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>カメラ状態:</Text>
          <Text style={styles.statusValue}>{cameraStatusMessage}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>録画状態:</Text>
          <Text
            style={[
              styles.statusValue,
              isRecording && styles.recordingHighlight,
            ]}>
            {getRecordingStatusLabel(recordingStatus)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>経過時間:</Text>
          <Text style={styles.timerText}>
            {formatElapsedDuration(elapsedMs)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>AEロック:</Text>
          <Text
            style={[
              styles.statusValue,
              aeLockState === 'locked' && styles.lockedHighlight,
            ]}>
            {getAeStateLabel(aeLockState)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>自動注湯検出:</Text>
          <Text style={styles.statusValue}>
            {canStartAutoPourDetection
              ? '開始可能（AEロック成立）'
              : '無効（AEロック未成立のため実行不可）'}
          </Text>
        </View>

        {/* エラーおよびブロック理由の表示 */}
        {blockingReason ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{blockingReason}</Text>
            {cameraStatus === 'permission-denied' ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onRequestPermissions}>
                <Text style={styles.secondaryButtonText}>権限を再確認</Text>
              </TouchableOpacity>
            ) : null}
            {cameraStatus === 'error' ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onRetryCamera}>
                <Text style={styles.secondaryButtonText}>カメラ再試行</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {aeErrorMessage ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>AEロック: {aeErrorMessage}</Text>
          </View>
        ) : null}

        {recordingError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>録画エラー: {recordingError}</Text>
          </View>
        ) : null}

        {/* 直近の録画ファイル情報（一時保存と永続保存を明示的に区別） */}
        {lastRecordedVideo ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>
              直近の録画ファイル (
              {lastRecordedVideo.storageStatus === 'temporary'
                ? '一時保存: temporary'
                : '写真フォルダ保存済み: persisted'}
              )
            </Text>
            <Text style={styles.resultMeta}>
              時間: {lastRecordedVideo.durationSec.toFixed(1)}秒 / 解像度:{' '}
              {lastRecordedVideo.width}x{lastRecordedVideo.height} / 要求FPS:{' '}
              {lastRecordedVideo.requestedFps}fps
            </Text>
            <Text style={styles.resultPath} numberOfLines={2}>
              Path: {lastRecordedVideo.path}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 下部操作ボタン群 */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="AEロック切替"
          style={[
            styles.aeButton,
            !canOperateAeLock && styles.buttonDisabled,
            aeLockState === 'locked' && styles.aeButtonLocked,
          ]}
          disabled={!canOperateAeLock}
          onPress={onToggleAeLock}>
          <Text style={styles.aeButtonText}>
            {aeLockState === 'locked' ? 'AEロック解除' : 'AEロック実行'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRecording ? '録画停止' : '30fps録画開始'}
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            recordButtonDisabled && styles.buttonDisabled,
          ]}
          disabled={recordButtonDisabled}
          onPress={onToggleRecording}>
          <Text style={styles.recordButtonText}>
            {isStopping
              ? '停止中...'
              : isRecording
                ? 'STOP'
                : `REC (${TARGET_FPS}fps)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    padding: 16,
  },
  statusPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },
  timerText: {
    color: '#ffd60a',
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  recordingHighlight: {
    color: '#ff453a',
    fontWeight: 'bold',
  },
  lockedHighlight: {
    color: '#30d158',
    fontWeight: 'bold',
  },
  errorBanner: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderColor: '#ff3b30',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    gap: 6,
  },
  errorText: {
    color: '#ffaba6',
    fontSize: 12,
  },
  warningBanner: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 159, 10, 0.22)',
    borderColor: '#ff9f0a',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  warningText: {
    color: '#ffd494',
    fontSize: 12,
  },
  resultBox: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  resultTitle: {
    color: '#64d2ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultMeta: {
    color: '#e5e5ea',
    fontSize: 11,
  },
  resultPath: {
    color: '#aeaeb2',
    fontSize: 11,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3a3a3c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomControls: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  aeButton: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderColor: '#8e8e93',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  aeButtonLocked: {
    borderColor: '#30d158',
    backgroundColor: 'rgba(48, 209, 88, 0.25)',
  },
  aeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  recordButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  recordButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
