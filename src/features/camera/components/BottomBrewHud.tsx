import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CaptureWorkflowMode } from '../constants';
import type { CameraReadyStatus } from '../hooks/useCameraConfig';
import type { ExposureLockState } from '../services/exposureLockService';
import type { RecordedVideoInfo, RecordingStatus } from '../types';

export interface BottomBrewHudProps {
  captureMode: CaptureWorkflowMode;
  cameraStatus: CameraReadyStatus;
  cameraStatusMessage: string;
  blockingReason: string | null;
  recordingStatus: RecordingStatus;
  aeLockState: ExposureLockState;
  aeErrorMessage: string | null;
  canStartAutoPourDetection: boolean;
  lastRecordedVideo: RecordedVideoInfo | null;
  recordingError: string | null;
  onRequestPermissions: () => void;
  onRetryCamera: () => void;
}

/**
 * 下部パネル: BottomBrewHud
 * 半透明黒背景（rgba(0,0,0,0.65)）の3つのステータスボックス
 * （1.豆情報枠 / 2.抽出ステータス・動体検知枠 / 3.投数タイムスタンプ・録画ログ枠）を横並びで配置する。
 */
export function BottomBrewHud({
  captureMode,
  cameraStatus,
  cameraStatusMessage,
  blockingReason,
  recordingStatus,
  aeLockState,
  aeErrorMessage,
  canStartAutoPourDetection,
  lastRecordedVideo,
  recordingError,
  onRequestPermissions,
  onRetryCamera,
}: BottomBrewHudProps): React.JSX.Element {
  return (
    <View style={styles.bottomContainer}>
      {/* 1. 豆情報枠（Sprint 1 プレースホルダー） */}
      <View style={styles.hudBox}>
        <View style={styles.boxHeaderRow}>
          <Text style={styles.boxTitle}>1. BEAN INFO（豆情報）</Text>
          <Text style={styles.modeTag}>
            {captureMode === 'full-process' ? 'フル工程' : '抽出のみ'}
          </Text>
        </View>
        <Text style={styles.placeholderPrimary} numberOfLines={1}>
          Origin / Roaster: 未登録（Sprint 2 OCR）
        </Text>
        <Text style={styles.placeholderSecondary} numberOfLines={1}>
          パッケージ静止画認識は Sprint 2 で統合予定
        </Text>
      </View>

      {/* 2. 抽出ステータス・動体検知枠 */}
      <View style={styles.hudBox}>
        <View style={styles.boxHeaderRow}>
          <Text style={styles.boxTitle}>2. BREW / AE & ROI STATUS</Text>
          <Text
            style={[
              styles.aeBadge,
              aeLockState === 'locked' && styles.aeBadgeLocked,
            ]}>
            AE: {aeLockState.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.statusLine} numberOfLines={1}>
          {cameraStatusMessage}
        </Text>

        {blockingReason || recordingError || aeErrorMessage ? (
          <View style={styles.inlineAlertRow}>
            <Text style={styles.errorText} numberOfLines={1}>
              {recordingError ?? blockingReason ?? aeErrorMessage}
            </Text>
            {cameraStatus === 'permission-denied' ? (
              <TouchableOpacity
                style={styles.miniActionBtn}
                onPress={onRequestPermissions}>
                <Text style={styles.miniActionText}>権限許可</Text>
              </TouchableOpacity>
            ) : null}
            {cameraStatus === 'error' ? (
              <TouchableOpacity
                style={styles.miniActionBtn}
                onPress={onRetryCamera}>
                <Text style={styles.miniActionText}>再試行</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={styles.placeholderSecondary} numberOfLines={1}>
            ROI動体検知:{' '}
            {canStartAutoPourDetection
              ? 'READY（AEロック成立・Sprint 3連携）'
              : 'STANDBY（REC開始時にAE自動ロック）'}
          </Text>
        )}
      </View>

      {/* 3. 投数タイムスタンプ・録画出力ログ枠 */}
      <View style={styles.hudBox}>
        <View style={styles.boxHeaderRow}>
          <Text style={styles.boxTitle}>3. POUR TIMESTAMPS / LOG</Text>
          <Text style={styles.recStateTag}>
            {recordingStatus.toUpperCase()}
          </Text>
        </View>

        {lastRecordedVideo ? (
          <>
            <Text style={styles.recordedMetaText} numberOfLines={1}>
              保存完了 ({lastRecordedVideo.durationSec.toFixed(1)}s /{' '}
              {lastRecordedVideo.storageStatus === 'persisted'
                ? '写真フォルダ保存済み'
                : '一時保存: temporary'}
              )
            </Text>
            <Text style={styles.recordedPathText} numberOfLines={1}>
              Path: {lastRecordedVideo.path}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.placeholderPrimary} numberOfLines={1}>
              1st: --:-- / 2nd: --:-- / 3rd: --:--
            </Text>
            <Text style={styles.placeholderSecondary} numberOfLines={1}>
              録画停止後に保存パスと秒数がここへ表示されます
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hudBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
  },
  boxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  boxTitle: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modeTag: {
    color: '#4da3ff',
    fontSize: 9,
    fontWeight: '700',
  },
  aeBadge: {
    color: '#ffd60a',
    fontSize: 9,
    fontWeight: '800',
  },
  aeBadgeLocked: {
    color: '#30d158',
  },
  recStateTag: {
    color: '#aeaeb2',
    fontSize: 9,
    fontWeight: '700',
  },
  placeholderPrimary: {
    color: '#e5e5ea',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  placeholderSecondary: {
    color: '#98989d',
    fontSize: 10,
  },
  statusLine: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  errorText: {
    color: '#ff6961',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  miniActionBtn: {
    backgroundColor: '#2b84ea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  miniActionText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  recordedMetaText: {
    color: '#30d158',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  recordedPathText: {
    color: '#d1d1d6',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
