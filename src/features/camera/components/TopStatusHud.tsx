import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SHUTTER_SPEED_OPTIONS,
  ShutterSpeedLabel,
  TARGET_FPS,
} from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';
import { formatTimecode30Fps } from '../services/recordingService';

export interface TopStatusHudProps {
  elapsedMs: number;
  isRecording: boolean;
  shutterSpeed: ShutterSpeedLabel;
  aeLockState: ExposureLockState;
  exposureEv: number;
  videoWidth?: number;
  videoHeight?: number;
  onCycleShutterSpeed: () => void;
}

/**
 * 上部HUD: TopStatusHud
 * Blackmagic Camera 準拠のトップステータスバー。
 * LENS, FPS: 30, SHUTTER: 1/60 (1/50, 1/60, 1/100 対応), IRIS,
 * 中央に大きな等幅フォントのタイムコード (00:00:00:00), ISO, WB, 4K 16:9 バッジを表示。
 */
export function TopStatusHud({
  elapsedMs,
  isRecording,
  shutterSpeed,
  aeLockState,
  exposureEv,
  videoWidth,
  videoHeight,
  onCycleShutterSpeed,
}: TopStatusHudProps): React.JSX.Element {
  const timecode = formatTimecode30Fps(elapsedMs);
  const isLocked = aeLockState === 'locked';
  const evText =
    exposureEv > 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1);
  const resolutionBadge =
    videoWidth === 3840 && videoHeight === 2160
      ? '4K 16:9'
      : videoWidth && videoHeight
        ? `4K 16:9 (${videoWidth}x${videoHeight})`
        : '4K 16:9';

  return (
    <View style={styles.hudBar}>
      {/* 左側カメラパラメータ群 */}
      <View style={styles.metricsGroup}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>LENS</Text>
          <Text style={styles.metricValue}>24mm</Text>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>FPS</Text>
          <Text style={styles.metricValue}>FPS: {TARGET_FPS}</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`シャッタースピード切替 (${SHUTTER_SPEED_OPTIONS.join(', ')})`}
          style={styles.metricBlockInteractive}
          onPress={onCycleShutterSpeed}>
          <Text style={styles.metricLabel}>SHUTTER</Text>
          <Text style={styles.metricValueHighlight}>
            SHUTTER: {shutterSpeed}
          </Text>
        </TouchableOpacity>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>IRIS</Text>
          <Text style={styles.metricValue}>f/1.8</Text>
        </View>
      </View>

      {/* 中央: 大きな等幅フォントのタイムコード (00:00:00:00) */}
      <View style={styles.timecodeContainer}>
        <View
          style={[
            styles.recDot,
            isRecording ? styles.recDotActive : styles.recDotIdle,
          ]}
        />
        <Text
          style={[
            styles.timecodeText,
            isRecording && styles.timecodeTextRecording,
          ]}>
          {timecode}
        </Text>
      </View>

      {/* 右側センサー・フォーマットバッジ群 */}
      <View style={styles.metricsGroupRight}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>ISO / AE</Text>
          <Text
            style={[
              styles.metricValue,
              isLocked && styles.metricValueLocked,
            ]}>
            {isLocked ? `LOCK (${evText})` : `AUTO (${evText})`}
          </Text>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>WB</Text>
          <Text style={styles.metricValue}>5600K</Text>
        </View>

        <View style={styles.formatBadge}>
          <Text style={styles.formatBadgeText}>{resolutionBadge}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8, 8, 8, 0.78)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metricsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricsGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricBlock: {
    alignItems: 'flex-start',
  },
  metricBlockInteractive: {
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(43, 132, 234, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 132, 234, 0.45)',
  },
  metricLabel: {
    color: '#8e8e93',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#f2f2f7',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricValueHighlight: {
    color: '#64d2ff',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricValueLocked: {
    color: '#30d158',
  },
  timecodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recDotIdle: {
    backgroundColor: '#636366',
  },
  recDotActive: {
    backgroundColor: '#ff3b30',
  },
  timecodeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Courier',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timecodeTextRecording: {
    color: '#ff453a',
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  formatBadgeText: {
    color: '#ffd60a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
