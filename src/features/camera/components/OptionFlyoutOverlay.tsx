import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BREW_THEME,
  CaptureWorkflowMode,
  FLICKER_PRESET_OPTIONS,
  ShutterSpeedLabel,
} from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';
import type { FlyoutType } from './CameraToolColumn';

export interface OptionFlyoutOverlayProps {
  activeFlyout: FlyoutType;
  captureMode: CaptureWorkflowMode;
  showPlacementGuide?: boolean;
  aeLockState: ExposureLockState;
  shutterSpeed: ShutterSpeedLabel;
  canOperateAeLock: boolean;
  onSelectCaptureMode: (mode: CaptureWorkflowMode) => void;
  onTogglePlacementGuide?: () => void;
  onSelectAutoBrightness: () => void;
  onSelectLockBrightness: () => void;
  onSelectShutterSpeed: (shutter: ShutterSpeedLabel) => void;
  onClose: () => void;
}

/**
 * 左レールのコンパクトボックス（MODE / BRIGHT / FLICKER）または上部バーのピルをタップした時に開く設定パネル
 * Earth-Tone Palette (BREW_THEME) 準拠
 */
export function OptionFlyoutOverlay({
  activeFlyout,
  captureMode,
  showPlacementGuide = true,
  aeLockState,
  shutterSpeed,
  canOperateAeLock,
  onSelectCaptureMode,
  onTogglePlacementGuide,
  onSelectAutoBrightness,
  onSelectLockBrightness,
  onSelectShutterSpeed,
  onClose,
}: OptionFlyoutOverlayProps): React.JSX.Element | null {
  if (!activeFlyout) {
    return null;
  }

  const isLocked = aeLockState === 'locked';
  const areaAPresets = FLICKER_PRESET_OPTIONS.filter(
    item => item.areaGroup === 'area-a-60hz',
  );
  const areaBPresets = FLICKER_PRESET_OPTIONS.filter(
    item => item.areaGroup === 'area-b-50hz',
  );

  const panelTitle =
    activeFlyout === 'bright'
      ? '明るさの自動調整'
      : activeFlyout === 'flicker'
        ? '画面のちらつき（縞模様）防止'
        : '撮影モード・ガイド枠設定';

  return (
    <View style={styles.panelCard}>
      <View style={styles.headerRow}>
        <Text style={styles.panelTitle}>{panelTitle}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="パネルを閉じる"
          style={styles.closePill}
          onPress={onClose}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {activeFlyout === 'bright' ? (
          <View style={styles.contentSection}>
            <Text style={styles.descriptionText}>
              照明が安定している場合、オフ（固定）にするとドリップ中の画面のチラつきや明るさのブレを防いで、綺麗な映像が残せます。
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="自動で調整する"
                disabled={!canOperateAeLock && isLocked}
                style={[
                  styles.actionButton,
                  !isLocked && styles.actionButtonSelected,
                  !canOperateAeLock && isLocked && styles.buttonDisabled,
                ]}
                onPress={onSelectAutoBrightness}>
                <Text
                  style={[
                    styles.actionButtonText,
                    !isLocked && styles.actionButtonTextSelected,
                  ]}>
                  自動で調整する
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="今の明るさで固定"
                disabled={!canOperateAeLock && !isLocked}
                style={[
                  styles.actionButton,
                  isLocked && styles.actionButtonSelected,
                  !canOperateAeLock && !isLocked && styles.buttonDisabled,
                ]}
                onPress={onSelectLockBrightness}>
                <Text
                  style={[
                    styles.actionButtonText,
                    isLocked && styles.actionButtonTextSelected,
                  ]}>
                  今の明るさで固定 (AE LOCK)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : activeFlyout === 'flicker' ? (
          <View style={styles.contentSection}>
            <Text style={styles.descriptionText}>
              部屋のライトのせいで画面がチカチカする場合はここを切り替えてみてください。
            </Text>

            {/* [area A] 60Hz */}
            <View style={styles.areaBlock}>
              <View style={styles.areaTagBadge}>
                <Text style={styles.areaTagText}>area A（西日本・60Hz）</Text>
              </View>
              <View style={styles.radioRow}>
                {areaAPresets.map(preset => {
                  const selected = shutterSpeed === preset.shutter;
                  return (
                    <TouchableOpacity
                      key={preset.shutter}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[
                        styles.radioOptionCard,
                        selected && styles.radioOptionCardSelected,
                      ]}
                      onPress={() => onSelectShutterSpeed(preset.shutter)}>
                      <View
                        style={[
                          styles.radioOuterCircle,
                          selected && styles.radioOuterCircleSelected,
                        ]}>
                        {selected ? (
                          <View style={styles.radioInnerDot} />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.radioLabelText,
                          selected && styles.radioLabelTextSelected,
                        ]}>
                        {preset.radioLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* [area B] 50Hz */}
            <View style={styles.areaBlock}>
              <View style={styles.areaTagBadge}>
                <Text style={styles.areaTagText}>area B（東日本・50Hz）</Text>
              </View>
              <View style={styles.radioRow}>
                {areaBPresets.map(preset => {
                  const selected = shutterSpeed === preset.shutter;
                  return (
                    <TouchableOpacity
                      key={preset.shutter}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[
                        styles.radioOptionCard,
                        selected && styles.radioOptionCardSelected,
                      ]}
                      onPress={() => onSelectShutterSpeed(preset.shutter)}>
                      <View
                        style={[
                          styles.radioOuterCircle,
                          selected && styles.radioOuterCircleSelected,
                        ]}>
                        {selected ? (
                          <View style={styles.radioInnerDot} />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.radioLabelText,
                          selected && styles.radioLabelTextSelected,
                        ]}>
                        {preset.radioLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.contentSection}>
            <Text style={styles.descriptionText}>
              豆袋・ミル・ドリッパーの3分割配置ガイドと、撮影する工程の範囲を切り替えられます。
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.actionButton,
                  captureMode === 'full-process' && styles.actionButtonSelected,
                ]}
                onPress={() => onSelectCaptureMode('full-process')}>
                <Text
                  style={[
                    styles.actionButtonText,
                    captureMode === 'full-process' &&
                      styles.actionButtonTextSelected,
                  ]}>
                  フル工程（豆＋ミル＋抽出）
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.actionButton,
                  captureMode === 'drip-only' && styles.actionButtonSelected,
                ]}
                onPress={() => onSelectCaptureMode('drip-only')}>
                <Text
                  style={[
                    styles.actionButtonText,
                    captureMode === 'drip-only' &&
                      styles.actionButtonTextSelected,
                  ]}>
                  ドリップのみ（抽出）
                </Text>
              </TouchableOpacity>
            </View>

            {onTogglePlacementGuide ? (
              <View style={styles.areaBlock}>
                <View style={styles.areaTagBadge}>
                  <Text style={styles.areaTagText}>
                    OVERLAY GUIDES（01 MILL / 02 DRIPPER / 03 BEANS）
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.actionButton,
                      showPlacementGuide && styles.actionButtonSelected,
                    ]}
                    onPress={() => {
                      if (!showPlacementGuide) {
                        onTogglePlacementGuide();
                      }
                    }}>
                    <Text
                      style={[
                        styles.actionButtonText,
                        showPlacementGuide && styles.actionButtonTextSelected,
                      ]}>
                      GUIDES ON
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.actionButton,
                      !showPlacementGuide && styles.actionButtonSelected,
                    ]}
                    onPress={() => {
                      if (showPlacementGuide) {
                        onTogglePlacementGuide();
                      }
                    }}>
                    <Text
                      style={[
                        styles.actionButtonText,
                        !showPlacementGuide && styles.actionButtonTextSelected,
                      ]}>
                      GUIDES OFF
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panelCard: {
    position: 'absolute',
    left: 12,
    top: 10,
    maxHeight: '92%',
    width: 410,
    maxWidth: '92%',
    backgroundColor: 'rgba(33, 26, 21, 0.96)',
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 25,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BREW_THEME.edge,
  },
  panelTitle: {
    color: BREW_THEME.oatmeal,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BREW_THEME.taupe,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: BREW_THEME.ivory,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  contentSection: {
    gap: 10,
  },
  descriptionText: {
    color: BREW_THEME.oatmeal,
    fontSize: 11,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: BREW_THEME.panel2,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSelected: {
    backgroundColor: BREW_THEME.cobalt,
    borderColor: BREW_THEME.cobalt2,
  },
  actionButtonText: {
    color: BREW_THEME.oatmeal,
    fontSize: 11,
    fontWeight: '700',
  },
  actionButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  areaBlock: {
    gap: 5,
  },
  areaTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: BREW_THEME.panel2,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
  },
  areaTagText: {
    color: BREW_THEME.soft,
    fontSize: 9.5,
    fontWeight: '800',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radioOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 5,
    backgroundColor: BREW_THEME.panel2,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
  },
  radioOptionCardSelected: {
    backgroundColor: 'rgba(53, 90, 255, 0.22)',
    borderColor: BREW_THEME.cobalt2,
  },
  radioOuterCircle: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    borderColor: BREW_THEME.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterCircleSelected: {
    borderColor: BREW_THEME.cobalt2,
  },
  radioInnerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BREW_THEME.cobalt2,
  },
  radioLabelText: {
    flex: 1,
    color: BREW_THEME.oatmeal,
    fontSize: 10.5,
    fontWeight: '600',
  },
  radioLabelTextSelected: {
    color: BREW_THEME.ivory,
    fontWeight: '800',
  },
});
