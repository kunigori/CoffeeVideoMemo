import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BREW_THEME,
  FLICKER_PRESET_OPTIONS,
  ShutterSpeedLabel,
  TARGET_FPS,
} from '../constants';
import type { ExposureLockState } from '../services/exposureLockService';
import { formatTimecode30Fps } from '../services/recordingService';

export interface TopStatusHudProps {
  elapsedMs: number;
  isRecording: boolean;
  activeStageIndex: 0 | 1 | 2;
  shutterSpeed: ShutterSpeedLabel;
  aeLockState: ExposureLockState;
  videoWidth?: number;
  videoHeight?: number;
  onCycleBrewPhase?: () => void;
  onPressBrightnessBadge?: () => void;
  onPressFlickerBadge?: () => void;
}

/**
 * TOP HEADER: TopStatusHud
 * pour_frame_side_view_edition (2).html の <header class="top"> を忠実に再現：
 * - 左: Brand (Oatmeal Mark + COFFEE VIDEO MEMO / BREW MOTION SYSTEM • 01)
 * - 中央: State Pill (● 抽出 : 1投目 / ● REC : 1投目) + Timecode (00:00:00:00)
 * - 右: Synchronized Camera Specs (BRIGHT / FLICKER / FRAME RATE: 30 FPS / FORMAT: 4K / 16:9)
 */
export function TopStatusHud({
  elapsedMs,
  shutterSpeed,
  aeLockState,
  onPressBrightnessBadge,
  onPressFlickerBadge,
}: TopStatusHudProps): React.JSX.Element {
  const fullTimecode = formatTimecode30Fps(elapsedMs);
  const mainTime = fullTimecode.slice(0, 8);
  const subFrames = fullTimecode.slice(8);

  const isLocked = aeLockState === 'locked';

  const flickerPreset =
    FLICKER_PRESET_OPTIONS.find(item => item.shutter === shutterSpeed) ??
    FLICKER_PRESET_OPTIONS[0];

  return (
    <View style={styles.topHeader}>
      {/* Left: Brand Title (アイコンなし) */}
      <View style={styles.brand}>
        <View>
          <Text style={styles.brandName} numberOfLines={1}>
            COFFEE VIDEO MEMO
          </Text>
          <Text style={styles.brandSub} numberOfLines={1}>
            BREW MOTION SYSTEM  •  01
          </Text>
        </View>
      </View>

      {/* Center: Timer Only (何投目かのピルは右インスペクターで確認できるため非表示) */}
      <View style={styles.timerBar}>
        <View style={styles.timeWrapper}>
          <Text style={styles.timeMain}>{mainTime}</Text>
          <Text style={styles.timeSmall}>{subFrames}</Text>
        </View>
      </View>

      {/* Right: Synchronized Camera Specs */}
      <View style={styles.specs}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="BRIGHT 切替"
          activeOpacity={0.75}
          style={styles.specPill}
          onPress={onPressBrightnessBadge}>
          <Text style={styles.specKey}>BRIGHT</Text>
          <Text
            style={[
              styles.specVal,
              isLocked && styles.specValSpecial,
            ]}>
            {isLocked ? '☀ AE LOCK' : '☀ AUTO'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="FLICKER 切替"
          activeOpacity={0.75}
          style={styles.specPill}
          onPress={onPressFlickerBadge}>
          <Text style={styles.specKey}>FLICKER</Text>
          <Text style={styles.specVal}>💡 {flickerPreset.shortHzLabel}</Text>
        </TouchableOpacity>

        <View style={styles.separator} />

        <View style={styles.specPlain}>
          <Text style={styles.specKey}>FRAME RATE</Text>
          <Text style={styles.specVal}>{TARGET_FPS} FPS</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.specPlain}>
          <Text style={styles.specKey}>FORMAT</Text>
          <Text style={[styles.specVal, styles.specValSpecial]}>4K / 16:9</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BREW_THEME.topBarBg,
    borderBottomWidth: 1,
    borderBottomColor: BREW_THEME.edge,
    paddingHorizontal: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    color: BREW_THEME.ivory,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  brandSub: {
    color: BREW_THEME.soft,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeMain: {
    color: BREW_THEME.ivory,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Courier',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.5,
  },
  timeSmall: {
    color: BREW_THEME.soft,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
    fontVariant: ['tabular-nums'],
    marginLeft: 4,
  },
  specs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specPill: {
    backgroundColor: BREW_THEME.panel2,
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  specPlain: {
    justifyContent: 'center',
  },
  specKey: {
    color: BREW_THEME.soft,
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 1,
  },
  specVal: {
    color: BREW_THEME.ivory,
    fontSize: 10.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  specValSpecial: {
    color: BREW_THEME.acid,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: BREW_THEME.edge,
  },
});
