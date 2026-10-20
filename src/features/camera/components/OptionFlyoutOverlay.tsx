import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CaptureWorkflowMode,
  EXPOSURE_COMPENSATION_OPTIONS,
  SHUTTER_SPEED_OPTIONS,
  ShutterSpeedLabel,
} from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';
import type { FlyoutType } from './CameraToolColumn';

export interface OptionFlyoutOverlayProps {
  activeFlyout: FlyoutType;
  captureMode: CaptureWorkflowMode;
  aeLockState: ExposureLockState;
  exposureEv: number;
  shutterSpeed: ShutterSpeedLabel;
  canOperateAeLock: boolean;
  onSelectCaptureMode: (mode: CaptureWorkflowMode) => void;
  onToggleAeLock: () => void;
  onSelectExposureEv: (ev: number) => void;
  onSelectShutterSpeed: (shutter: ShutterSpeedLabel) => void;
  onClose: () => void;
}

/**
 * 3列目オーバーレイ: OptionFlyoutOverlay
 * 2列目の「モード」または「AE」をタップした時、プレビューの左端（2列目のすぐ隣）に
 * 半透明の縦帯メニューを表示する。選択中の項目は青いピル型ボタン（#2b84ea）でハイライトする。
 */
export function OptionFlyoutOverlay({
  activeFlyout,
  captureMode,
  aeLockState,
  exposureEv,
  shutterSpeed,
  canOperateAeLock,
  onSelectCaptureMode,
  onToggleAeLock,
  onSelectExposureEv,
  onSelectShutterSpeed,
  onClose,
}: OptionFlyoutOverlayProps): React.JSX.Element | null {
  if (!activeFlyout) {
    return null;
  }

  const isLocked = aeLockState === 'locked';

  return (
    <View style={styles.flyoutStrip}>
      <View style={styles.headerRow}>
        <Text style={styles.flyoutTitle}>
          {activeFlyout === 'mode' ? 'CAPTURE MODE' : 'AE / EXPOSURE'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="メニューを閉じる"
          style={styles.closePill}
          onPress={onClose}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {activeFlyout === 'mode' ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>工程モード選択</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.pillButton,
                captureMode === 'full-process' && styles.pillButtonSelected,
              ]}
              onPress={() => onSelectCaptureMode('full-process')}>
              <Text
                style={[
                  styles.pillText,
                  captureMode === 'full-process' && styles.pillTextSelected,
                ]}>
                フル工程（豆＋抽出）
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.pillButton,
                captureMode === 'drip-only' && styles.pillButtonSelected,
              ]}
              onPress={() => onSelectCaptureMode('drip-only')}>
              <Text
                style={[
                  styles.pillText,
                  captureMode === 'drip-only' && styles.pillTextSelected,
                ]}>
                抽出のみ（ドリップ）
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* AEロック ON/OFF 切替 */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>AE LOCK（自動露出固定）</Text>
              <View style={styles.dualPillRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="AEロックON"
                  disabled={!canOperateAeLock || isLocked}
                  style={[
                    styles.halfPillButton,
                    isLocked && styles.pillButtonSelected,
                    !canOperateAeLock && !isLocked && styles.pillDisabled,
                  ]}
                  onPress={onToggleAeLock}>
                  <Text
                    style={[
                      styles.pillText,
                      isLocked && styles.pillTextSelected,
                    ]}>
                    LOCK ON
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="AEロックOFF"
                  disabled={!canOperateAeLock || !isLocked}
                  style={[
                    styles.halfPillButton,
                    !isLocked && styles.pillButtonSelected,
                    !canOperateAeLock && isLocked && styles.pillDisabled,
                  ]}
                  onPress={onToggleAeLock}>
                  <Text
                    style={[
                      styles.pillText,
                      !isLocked && styles.pillTextSelected,
                    ]}>
                    LOCK OFF
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.subHintText}>
                ※REC開始時に現在の露出を自動ロックします
              </Text>
            </View>

            {/* 露出補正 EV (-2.0 〜 +2.0) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>
                EXPOSURE BIAS (-2.0 〜 +2.0)
              </Text>
              <View style={styles.evGrid}>
                {EXPOSURE_COMPENSATION_OPTIONS.map(ev => {
                  const selected = Math.abs(exposureEv - ev) < 0.01;
                  const label = ev > 0 ? `+${ev.toFixed(1)}` : ev.toFixed(1);
                  return (
                    <TouchableOpacity
                      key={ev}
                      accessibilityRole="button"
                      style={[
                        styles.evPillButton,
                        selected && styles.pillButtonSelected,
                      ]}
                      onPress={() => onSelectExposureEv(ev)}>
                      <Text
                        style={[
                          styles.pillText,
                          selected && styles.pillTextSelected,
                        ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* フリッカー対策シャッター表記 (1/50, 1/60, 1/100) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>SHUTTER (フリッカー対策)</Text>
              <View style={styles.evGrid}>
                {SHUTTER_SPEED_OPTIONS.map(item => {
                  const selected = shutterSpeed === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      accessibilityRole="button"
                      style={[
                        styles.evPillButton,
                        selected && styles.pillButtonSelected,
                      ]}
                      onPress={() => onSelectShutterSpeed(item)}>
                      <Text
                        style={[
                          styles.pillText,
                          selected && styles.pillTextSelected,
                        ]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flyoutStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 196,
    backgroundColor: 'rgba(12, 12, 14, 0.88)',
    borderRightWidth: 1,
    borderRightColor: '#2c2c2e',
    paddingHorizontal: 10,
    paddingVertical: 10,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#262629',
  },
  flyoutTitle: {
    color: '#aeaeb2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  closePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#e5e5ea',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionLabel: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pillButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    alignItems: 'center',
  },
  dualPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  halfPillButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    alignItems: 'center',
  },
  evGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  evPillButton: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    alignItems: 'center',
  },
  pillButtonSelected: {
    backgroundColor: '#2b84ea',
    borderColor: '#5aa6ff',
  },
  pillText: {
    color: '#d1d1d6',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pillTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  pillDisabled: {
    opacity: 0.4,
  },
  subHintText: {
    color: '#8e8e93',
    fontSize: 9,
  },
});
