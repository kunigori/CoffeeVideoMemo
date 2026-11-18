import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CaptureWorkflowMode } from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';

export type FlyoutType = 'mode' | 'bright' | 'flicker' | null;

export interface CameraToolColumnProps {
  captureMode: CaptureWorkflowMode;
  activeFlyout: FlyoutType;
  isRecording: boolean;
  isStopping: boolean;
  canRecord: boolean;
  aeLockState: ExposureLockState;
  onToggleFlyout: (flyout: Exclude<FlyoutType, null>) => void;
  onToggleRecording: () => void;
}

/**
 * 2列目: CameraToolColumn（幅 約76px）
 * 1列目のすぐ隣に独立した列として配置。背景は #0f0f0f。
 * 上から順に：
 *  1. MODE / フル工程（または抽出のみ）
 *  2. Bright / 明るさ
 *  3. flicker / ちらつき防止
 *  4. RECボタン（大型の白い外枠＋赤丸）
 */
export function CameraToolColumn({
  captureMode,
  activeFlyout,
  isRecording,
  isStopping,
  canRecord,
  aeLockState,
  onToggleFlyout,
  onToggleRecording,
}: CameraToolColumnProps): React.JSX.Element {
  const isModeOpen = activeFlyout === 'mode';
  const isBrightOpen = activeFlyout === 'bright';
  const isFlickerOpen = activeFlyout === 'flicker';
  const isAeLocked = aeLockState === 'locked';
  const recDisabled = isStopping || (!isRecording && !canRecord);

  return (
    <View style={styles.columnContainer}>
      <View style={styles.topButtonsGroup}>
        {/* 1. MODE / フル工程 */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="モード切替"
          style={[styles.toolButton, isModeOpen && styles.toolButtonActive]}
          onPress={() => onToggleFlyout('mode')}>
          <Text style={styles.toolCaption}>MODE</Text>
          <Text
            style={[styles.toolValue, isModeOpen && styles.toolValueActive]}
            numberOfLines={1}>
            {captureMode === 'full-process' ? 'フル工程' : '抽出のみ'}
          </Text>
        </TouchableOpacity>

        {/* 2. Bright / 明るさ */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="明るさの自動調整・固定メニュー"
          style={[
            styles.toolButton,
            isBrightOpen && styles.toolButtonActive,
            isAeLocked && !isBrightOpen && styles.toolButtonLocked,
          ]}
          onPress={() => onToggleFlyout('bright')}>
          <View style={styles.captionRow}>
            <Text style={styles.toolCaption}>Bright</Text>
            {isAeLocked ? <Text style={styles.lockedDot}>●</Text> : null}
          </View>
          <Text
            style={[
              styles.toolValue,
              isBrightOpen && styles.toolValueActive,
              isAeLocked && !isBrightOpen && styles.toolValueLocked,
            ]}>
            明るさ
          </Text>
        </TouchableOpacity>

        {/* 3. flicker / ちらつき防止 */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="画面のちらつき防止メニュー"
          style={[
            styles.toolButton,
            styles.toolButtonTall,
            isFlickerOpen && styles.toolButtonActive,
          ]}
          onPress={() => onToggleFlyout('flicker')}>
          <Text style={styles.toolCaption}>flicker</Text>
          <Text
            style={[
              styles.toolValueMultiline,
              isFlickerOpen && styles.toolValueActive,
            ]}>
            {'ちらつき\n防止'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 中央〜下部: 大型の白い外枠＋赤丸の「RECボタン」（有効：録画開始/停止） */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  columnContainer: {
    width: 76,
    backgroundColor: '#0f0f0f',
    borderRightWidth: 1,
    borderRightColor: '#1f1f1f',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topButtonsGroup: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  toolButton: {
    width: 64,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
    gap: 2,
  },
  toolButtonTall: {
    minHeight: 56,
  },
  toolButtonActive: {
    backgroundColor: '#0a2540',
    borderColor: '#2b84ea',
  },
  toolButtonLocked: {
    borderColor: '#30d158',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lockedDot: {
    color: '#30d158',
    fontSize: 7,
  },
  toolCaption: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  toolValue: {
    color: '#f2f2f7',
    fontSize: 11,
    fontWeight: '700',
  },
  toolValueMultiline: {
    color: '#f2f2f7',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  toolValueActive: {
    color: '#4da3ff',
  },
  toolValueLocked: {
    color: '#30d158',
  },
  recSlot: {
    paddingVertical: 6,
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
