import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CaptureWorkflowMode } from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';

export type FlyoutType = 'mode' | 'ae' | null;

export interface CameraToolColumnProps {
  captureMode: CaptureWorkflowMode;
  activeFlyout: FlyoutType;
  isRecording: boolean;
  isStopping: boolean;
  canRecord: boolean;
  aeLockState: ExposureLockState;
  exposureEv: number;
  onToggleFlyout: (flyout: Exclude<FlyoutType, null>) => void;
  onToggleRecording: () => void;
}

/**
 * 2列目: CameraToolColumn（幅 約76px）
 * 1列目のすぐ隣に独立した列として配置。背景は #0f0f0f。
 * 「モード」「REC」「AE」の3つのみ有効とし、他はレイアウト維持用の仮アイコン（opacity: 0.3、タップ無効）。
 */
export function CameraToolColumn({
  captureMode,
  activeFlyout,
  isRecording,
  isStopping,
  canRecord,
  aeLockState,
  exposureEv,
  onToggleFlyout,
  onToggleRecording,
}: CameraToolColumnProps): React.JSX.Element {
  const isModeFlyoutOpen = activeFlyout === 'mode';
  const isAeFlyoutOpen = activeFlyout === 'ae';
  const isAeLocked = aeLockState === 'locked';
  const recDisabled = isStopping || (!isRecording && !canRecord);

  const formattedEv =
    exposureEv > 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1);

  return (
    <View style={styles.columnContainer}>
      {/* 上部1: 「モード切替」ボタン（有効：フル工程 / 抽出のみ） */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="モード切替"
        style={[
          styles.toolButton,
          isModeFlyoutOpen && styles.toolButtonActive,
        ]}
        onPress={() => onToggleFlyout('mode')}>
        <Text style={styles.toolCaption}>MODE</Text>
        <Text
          style={[
            styles.toolValue,
            isModeFlyoutOpen && styles.toolValueActive,
          ]}
          numberOfLines={1}>
          {captureMode === 'full-process' ? 'フル工程' : '抽出のみ'}
        </Text>
      </TouchableOpacity>

      {/* 上部2: 仮アイコン（ダミー） */}
      <View style={[styles.toolButton, styles.dummySlot]} pointerEvents="none">
        <Text style={styles.toolCaption}>LUT</Text>
        <Text style={styles.toolValue}>OFF</Text>
      </View>

      {/* 上部3: 仮アイコン（ダミー） */}
      <View style={[styles.toolButton, styles.dummySlot]} pointerEvents="none">
        <Text style={styles.toolCaption}>ZEBRA</Text>
        <Text style={styles.toolValue}>OFF</Text>
      </View>

      {/* 中央: 大型の白い外枠＋赤丸の「RECボタン」（有効：録画開始/停止） */}
      <View style={styles.recSlot}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRecording ? '録画停止' : '30fps録画開始'}
          style={[
            styles.recOuterRing,
            isRecording && styles.recOuterRingActive,
            recDisabled && styles.recButtonDisabled,
          ]}
          disabled={recDisabled}
          onPress={onToggleRecording}>
          <View
            style={[
              styles.recInnerCore,
              isRecording && styles.recInnerCoreRecording,
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* 下部1: 「AE（露出ロック・補正）」ボタン（有効：AEロックON/OFFおよび露出調整） */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="AEロック・露出補正メニュー"
        style={[
          styles.toolButton,
          isAeFlyoutOpen && styles.toolButtonActive,
          isAeLocked && styles.toolButtonLocked,
        ]}
        onPress={() => onToggleFlyout('ae')}>
        <View style={styles.aeHeaderRow}>
          <Text style={styles.toolCaption}>AE</Text>
          {isAeLocked ? <Text style={styles.lockBadge}>LOCK</Text> : null}
        </View>
        <Text
          style={[
            styles.toolValue,
            isAeFlyoutOpen && styles.toolValueActive,
            isAeLocked && styles.toolValueLocked,
          ]}>
          {formattedEv} EV
        </Text>
      </TouchableOpacity>

      {/* 下部2: 仮アイコン（ダミー） */}
      <View style={[styles.toolButton, styles.dummySlot]} pointerEvents="none">
        <Text style={styles.toolCaption}>FOCUS</Text>
        <Text style={styles.toolValue}>AF-C</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columnContainer: {
    width: 76,
    backgroundColor: '#0f0f0f',
    borderRightWidth: 1,
    borderRightColor: '#1f1f1f',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolButton: {
    width: 62,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  toolButtonActive: {
    backgroundColor: '#0a2540',
    borderColor: '#2b84ea',
  },
  toolButtonLocked: {
    borderColor: '#2b84ea',
  },
  dummySlot: {
    opacity: 0.3,
  },
  toolCaption: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toolValue: {
    color: '#f2f2f7',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  toolValueActive: {
    color: '#4da3ff',
  },
  toolValueLocked: {
    color: '#4da3ff',
  },
  aeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockBadge: {
    color: '#2b84ea',
    fontSize: 8,
    fontWeight: '800',
  },
  recSlot: {
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recOuterRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3.5,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recOuterRingActive: {
    borderColor: '#ff3b30',
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
  },
  recInnerCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e02424',
  },
  recInnerCoreRecording: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  recButtonDisabled: {
    opacity: 0.35,
  },
});
