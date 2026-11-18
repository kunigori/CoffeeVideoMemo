import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BREW_THEME,
  CaptureWorkflowMode,
  FLICKER_PRESET_OPTIONS,
  ShutterSpeedLabel,
} from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';
import type { FlyoutType } from './CameraToolColumn';

export type MainNavTab = 'camera' | 'media' | 'record' | 'map' | 'settings';

export interface MainNavRailProps {
  activeTab: MainNavTab;
  captureMode: CaptureWorkflowMode;
  activeFlyout: FlyoutType;
  aeLockState: ExposureLockState;
  shutterSpeed: ShutterSpeedLabel;
  isRecording: boolean;
  isStopping: boolean;
  canRecord: boolean;
  onSelectTab: (tab: MainNavTab) => void;
  onToggleFlyout: (flyout: Exclude<FlyoutType, null>) => void;
  onToggleRecording: () => void;
}

const NAV_TABS: readonly { id: MainNavTab; label: string }[] = [
  { id: 'camera', label: 'CAMERA' },
  { id: 'media', label: 'MEDIA' },
  { id: 'record', label: 'RECORD' },
  { id: 'map', label: 'MAP' },
  { id: 'settings', label: 'SETTINGS' },
] as const;

function NavTabIcon({
  id,
  active,
}: {
  id: MainNavTab;
  active: boolean;
}): React.JSX.Element {
  const strokeColor = active ? BREW_THEME.ivory : BREW_THEME.soft;

  switch (id) {
    case 'camera':
      return (
        <View style={styles.iconCanvas}>
          <View
            style={[styles.cameraTopBump, { borderColor: strokeColor }]}
          />
          <View style={[styles.cameraBody, { borderColor: strokeColor }]}>
            <View style={[styles.cameraLens, { borderColor: strokeColor }]} />
          </View>
        </View>
      );
    case 'media':
      return (
        <View style={styles.iconCanvas}>
          <View style={[styles.mediaFrame, { borderColor: strokeColor }]}>
            <View
              style={[
                styles.mediaTopBar,
                { backgroundColor: strokeColor },
              ]}
            />
            <View
              style={[
                styles.mediaLeftColDivider,
                { backgroundColor: strokeColor },
              ]}
            />
          </View>
        </View>
      );
    case 'record':
      return (
        <View style={styles.iconCanvas}>
          <View style={[styles.docFrame, { borderColor: strokeColor }]}>
            <View
              style={[styles.docLineLong, { backgroundColor: strokeColor }]}
            />
            <View
              style={[styles.docLineShort, { backgroundColor: strokeColor }]}
            />
          </View>
        </View>
      );
    case 'map':
      return (
        <View style={styles.iconCanvas}>
          <View style={[styles.mapFrame, { borderColor: strokeColor }]}>
            <View
              style={[
                styles.mapFoldLeft,
                { backgroundColor: strokeColor },
              ]}
            />
            <View
              style={[
                styles.mapFoldRight,
                { backgroundColor: strokeColor },
              ]}
            />
          </View>
        </View>
      );
    case 'settings':
      return (
        <View style={styles.iconCanvas}>
          <View
            style={[
              styles.gearToothVertical,
              { backgroundColor: strokeColor },
            ]}
          />
          <View
            style={[
              styles.gearToothHorizontal,
              { backgroundColor: strokeColor },
            ]}
          />
          <View style={[styles.gearOuterRing, { borderColor: strokeColor }]}>
            <View
              style={[styles.gearInnerHole, { borderColor: strokeColor }]}
            />
          </View>
        </View>
      );
  }
}

/**
 * SINGLE LEFT RAIL: MainNavRail
 * - 上部5タブ: CAMERA, MEDIA, RECORD, MAP, SETTINGS（各専用アイコン付き）
 * - 中央コンパクトボックス: MODE, BRIGHT, FLICKER
 *   - 非選択時: レール背景とは系統の違う濃い茶色 (#362317 / border #5c3f2c)
 *   - 選択時: 白系オートミール色 (#e8dfd1 / text #1e1713)
 * - 下部: シャッターボタン (.shutter) + ● REC / ■ STOP ラベル
 */
export function MainNavRail({
  activeTab,
  captureMode,
  activeFlyout,
  aeLockState,
  shutterSpeed,
  isRecording,
  isStopping,
  canRecord,
  onSelectTab,
  onToggleFlyout,
  onToggleRecording,
}: MainNavRailProps): React.JSX.Element {
  const isAeLocked = aeLockState === 'locked';
  const recDisabled = isStopping || (!isRecording && !canRecord);

  const isModeSelected = activeFlyout === 'mode';
  const isBrightSelected = activeFlyout === 'bright';
  const isFlickerSelected = activeFlyout === 'flicker';

  const flickerPreset =
    FLICKER_PRESET_OPTIONS.find(item => item.shutter === shutterSpeed) ??
    FLICKER_PRESET_OPTIONS[0];

  return (
    <View style={styles.rail}>
      {/* Top 5 Navigation Tabs */}
      <View style={styles.navTabsGroup}>
        {NAV_TABS.map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              activeOpacity={0.78}
              style={[styles.railTab, isSelected && styles.railTabActive]}
              onPress={() => onSelectTab(tab.id)}>
              <NavTabIcon id={tab.id} active={isSelected} />
              <Text
                style={[
                  styles.railTabLabel,
                  isSelected && styles.railTabLabelActive,
                ]}
                numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.railRule} />

      {/* Compact Boxed Controls (MODE, BRIGHT, FLICKER) */}
      <View style={styles.ctrlBoxesGroup}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="MODE切替"
          activeOpacity={0.8}
          style={[
            styles.ctrlBoxDarkBrown,
            isModeSelected && styles.ctrlBoxSelectedOatmeal,
          ]}
          onPress={() => onToggleFlyout('mode')}>
          <Text
            style={[
              styles.ctrlKey,
              isModeSelected && styles.ctrlKeySelectedOatmeal,
            ]}>
            MODE
          </Text>
          <Text
            style={[
              styles.ctrlVal,
              isModeSelected && styles.ctrlValSelectedOatmeal,
            ]}
            numberOfLines={1}>
            {captureMode === 'full-process' ? 'フル工程' : 'ドリップのみ'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="明るさ・AEロック切替"
          activeOpacity={0.8}
          style={[
            styles.ctrlBoxDarkBrown,
            isAeLocked && !isBrightSelected && styles.ctrlBoxAcidBorder,
            isBrightSelected && styles.ctrlBoxSelectedOatmeal,
          ]}
          onPress={() => onToggleFlyout('bright')}>
          <Text
            style={[
              styles.ctrlKey,
              isBrightSelected && styles.ctrlKeySelectedOatmeal,
            ]}>
            BRIGHT
          </Text>
          <Text
            style={[
              styles.ctrlVal,
              isAeLocked && !isBrightSelected && styles.ctrlValAcid,
              isBrightSelected && styles.ctrlValSelectedOatmeal,
            ]}
            numberOfLines={1}>
            {isAeLocked ? 'AE LOCK' : 'AUTO'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ちらつき防止切替"
          activeOpacity={0.8}
          style={[
            styles.ctrlBoxDarkBrown,
            isFlickerSelected && styles.ctrlBoxSelectedOatmeal,
          ]}
          onPress={() => onToggleFlyout('flicker')}>
          <Text
            style={[
              styles.ctrlKey,
              isFlickerSelected && styles.ctrlKeySelectedOatmeal,
            ]}>
            FLICKER
          </Text>
          <Text
            style={[
              styles.ctrlVal,
              isFlickerSelected && styles.ctrlValSelectedOatmeal,
            ]}
            numberOfLines={1}>
            {flickerPreset.shortHzLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.railSpacer} />
      <View style={styles.railRule} />

      {/* Bottom Shutter Button + REC Label */}
      <View style={styles.shutterSection}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRecording ? '録画停止' : '30fps録画開始'}
          activeOpacity={0.82}
          disabled={recDisabled}
          style={[
            styles.shutterOuter,
            recDisabled && styles.shutterDisabled,
          ]}
          onPress={onToggleRecording}>
          <View
            style={[
              styles.shutterInner,
              isRecording && styles.shutterInnerRecording,
            ]}
          />
        </TouchableOpacity>
        <Text style={styles.railRecLabel}>
          {isRecording ? '■ STOP' : '● REC'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 82,
    backgroundColor: BREW_THEME.railBg,
    borderRightWidth: 1,
    borderRightColor: BREW_THEME.edge,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navTabsGroup: {
    alignItems: 'center',
    gap: 2,
  },
  railTab: {
    width: 66,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  railTabActive: {
    backgroundColor: BREW_THEME.cobalt,
  },
  iconCanvas: {
    width: 16,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraTopBump: {
    width: 6,
    height: 2.5,
    borderTopWidth: 1.4,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
    marginBottom: -1,
  },
  cameraBody: {
    width: 14,
    height: 10,
    borderWidth: 1.4,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLens: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.3,
  },
  mediaFrame: {
    width: 13,
    height: 12,
    borderWidth: 1.4,
    borderRadius: 1.5,
    position: 'relative',
  },
  mediaTopBar: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 1.3,
  },
  mediaLeftColDivider: {
    position: 'absolute',
    top: 3,
    bottom: 0,
    left: 4,
    width: 1.3,
  },
  docFrame: {
    width: 11,
    height: 13,
    borderWidth: 1.4,
    borderRadius: 1.5,
    paddingHorizontal: 2,
    justifyContent: 'center',
    gap: 2.5,
  },
  docLineLong: {
    width: '100%',
    height: 1.3,
  },
  docLineShort: {
    width: '65%',
    height: 1.3,
  },
  mapFrame: {
    width: 14,
    height: 11,
    borderWidth: 1.4,
    borderRadius: 1.5,
    position: 'relative',
  },
  mapFoldLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 4,
    width: 1.2,
  },
  mapFoldRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 4,
    width: 1.2,
  },
  gearOuterRing: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    backgroundColor: BREW_THEME.railBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearInnerHole: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    borderWidth: 1.3,
  },
  gearToothVertical: {
    position: 'absolute',
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  gearToothHorizontal: {
    position: 'absolute',
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  railTabLabel: {
    color: BREW_THEME.soft,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  railTabLabelActive: {
    color: BREW_THEME.ivory,
  },
  railRule: {
    width: 38,
    height: 1,
    backgroundColor: BREW_THEME.edge,
    marginVertical: 4,
  },
  ctrlBoxesGroup: {
    alignItems: 'center',
    gap: 4,
  },
  ctrlBoxDarkBrown: {
    width: 66,
    minHeight: 33,
    backgroundColor: '#362317',
    borderWidth: 1,
    borderColor: '#5c3f2c',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBoxSelectedOatmeal: {
    backgroundColor: BREW_THEME.oatmeal,
    borderColor: BREW_THEME.oatmealEdge,
  },
  ctrlBoxAcidBorder: {
    borderColor: 'rgba(219, 251, 80, 0.65)',
  },
  ctrlKey: {
    color: '#c4af9a',
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ctrlKeySelectedOatmeal: {
    color: '#645344',
  },
  ctrlVal: {
    color: BREW_THEME.ivory,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  ctrlValSelectedOatmeal: {
    color: BREW_THEME.oatmealInk,
  },
  ctrlValAcid: {
    color: BREW_THEME.acid,
  },
  railSpacer: {
    flex: 1,
    minHeight: 2,
  },
  shutterSection: {
    alignItems: 'center',
    gap: 2,
  },
  shutterOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: BREW_THEME.oatmeal,
    backgroundColor: '#14100d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BREW_THEME.verm,
  },
  shutterInnerRecording: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: BREW_THEME.verm,
  },
  shutterDisabled: {
    opacity: 0.35,
  },
  railRecLabel: {
    color: BREW_THEME.oatmeal,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'Courier',
  },
});
