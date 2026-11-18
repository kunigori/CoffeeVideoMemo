import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BREW_THEME,
  CaptureWorkflowMode,
  TARGET_FPS,
} from '../constants';

export interface PlacementGuideOverlayProps {
  visible?: boolean;
  captureMode: CaptureWorkflowMode;
  isRecording: boolean;
  videoWidth?: number;
  videoHeight?: number;
}

/**
 * VIEWFINDER OVERLAY: PlacementGuideOverlay
 * 横幅を 3 : 4 : 3（30% : 40% : 30%）の比率で区分けし、3ゾーンすべてにガイド枠を表示：
 * - 左 30% (01 / MILL グラインダー): 黄色系原色 (#dbfb50) の破線枠＋4隅コーナーブラケット＋クロスヘア
 * - 中央 40% (02 / DRIPPER & SCALE): コバルトブルー (#355aff) の4隅フォーカス枠＋サークル＋クロスヘア
 * - 右 30% (03 / BEANS 豆袋): 黄色系原色 (#dbfb50) の破線枠＋4隅コーナーブラケット＋クロスヘア
 */
export function PlacementGuideOverlay({
  visible = true,
  captureMode,
  videoWidth = 3840,
  videoHeight = 2160,
}: PlacementGuideOverlayProps): React.JSX.Element {
  const isDripOnly = captureMode === 'drip-only';

  return (
    <View style={styles.overlayRoot} pointerEvents="none">
      {/* Zone Dividers (3 : 4 : 3 = 30% : 40% : 30%) & 3-Zone Guide Frames */}
      {visible ? (
        <>
          <View style={[styles.zoneDivider, styles.zoneDividerFirst]} />
          <View style={[styles.zoneDivider, styles.zoneDividerSecond]} />

          {/* 01 / LEFT (30%): MILL (グラインダー) 黄色系原色オーバーレイガイド枠 */}
          <View
            style={[
              styles.yellowGuideBox,
              styles.yellowGuideBoxLeft,
              isDripOnly && styles.dimmedSubzone,
            ]}>
            <View style={[styles.yellowCorner, styles.cornerTL]} />
            <View style={[styles.yellowCorner, styles.cornerTR]} />
            <View style={[styles.yellowCorner, styles.cornerBL]} />
            <View style={[styles.yellowCorner, styles.cornerBR]} />

            <View style={styles.subzoneCenterAnchor}>
              <View style={styles.yellowCrossTarget}>
                <View style={styles.yellowCrossVertical} />
                <View style={styles.yellowCrossHorizontal} />
              </View>
              <Text style={styles.yellowGuideCaption}>MILL / GRINDER</Text>
            </View>
          </View>

          {/* 02 / CENTER (40%): DRIPPER & SCALE コバルトブルー・フォーカス枠 */}
          <View style={styles.focusFrame}>
            <View style={[styles.cobaltCorner, styles.cornerTL]} />
            <View style={[styles.cobaltCorner, styles.cornerTR]} />
            <View style={[styles.cobaltCorner, styles.cornerBL]} />
            <View style={[styles.cobaltCorner, styles.cornerBR]} />

            <View style={styles.focusCenterAnchor}>
              <View style={styles.focusCircle}>
                <View style={styles.focusCrossVertical} />
                <View style={styles.focusCrossHorizontal} />
              </View>
            </View>
          </View>

          {/* 03 / RIGHT (30%): BEANS (豆袋) 黄色系原色オーバーレイガイド枠 */}
          <View
            style={[
              styles.yellowGuideBox,
              styles.yellowGuideBoxRight,
              isDripOnly && styles.dimmedSubzone,
            ]}>
            <View style={[styles.yellowCorner, styles.cornerTL]} />
            <View style={[styles.yellowCorner, styles.cornerTR]} />
            <View style={[styles.yellowCorner, styles.cornerBL]} />
            <View style={[styles.yellowCorner, styles.cornerBR]} />

            <View style={styles.subzoneCenterAnchor}>
              <View style={styles.yellowCrossTarget}>
                <View style={styles.yellowCrossVertical} />
                <View style={styles.yellowCrossHorizontal} />
              </View>
              <Text style={styles.yellowGuideCaption}>BEAN BAG OCR</Text>
            </View>
          </View>
        </>
      ) : null}

      {/* Top 3 Zone Header Labels (Aligned to 3 : 4 : 3 columns) */}
      <View
        style={[
          styles.zoneHeader,
          styles.zoneHeaderLeft,
          isDripOnly && styles.dimmedSubzone,
        ]}>
        <Text style={styles.zoneNum}>01 /</Text>
        <Text style={styles.zoneLabel}>MILL</Text>
        <View style={[styles.zoneChip, styles.zoneChipYellow]}>
          <Text style={[styles.zoneChipText, styles.zoneChipTextYellow]}>
            TFLite
          </Text>
        </View>
      </View>

      <View style={[styles.zoneHeader, styles.zoneHeaderMiddle]}>
        <Text style={styles.zoneNum}>02 /</Text>
        <Text style={[styles.zoneLabel, styles.zoneLabelMiddle]}>
          DRIPPER & SCALE
        </Text>
        <View style={[styles.zoneChip, styles.zoneChipYellow]}>
          <Text style={[styles.zoneChipText, styles.zoneChipTextYellow]}>
            ROI LOCKED
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.zoneHeader,
          styles.zoneHeaderRight,
          isDripOnly && styles.dimmedSubzone,
        ]}>
        <Text style={styles.zoneNum}>03 /</Text>
        <Text style={styles.zoneLabel}>BEANS</Text>
        <View style={[styles.zoneChip, styles.zoneChipYellow]}>
          <Text style={[styles.zoneChipText, styles.zoneChipTextYellow]}>
            BEAN OCR
          </Text>
        </View>
      </View>

      {/* Bottom Horizon & Frame Info */}
      <View style={styles.timecodeOverlay}>
        <Text style={styles.horizonDot}>●</Text>
        <Text style={styles.horizonText}>
          {'  SIDE-VIEW HORIZON   /   ペーパーのみ・粉あり・注湯検知'}
        </Text>
      </View>

      <View style={styles.frameInfo}>
        <Text style={styles.frameInfoStrong}>16 : 9</Text>
        <Text style={styles.frameInfoSmall}>
          {videoWidth}x{videoHeight} @ {TARGET_FPS}fps
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  zoneDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(232, 223, 209, 0.25)',
  },
  zoneDividerFirst: {
    left: '30%',
  },
  zoneDividerSecond: {
    right: '30%',
  },
  yellowGuideBox: {
    position: 'absolute',
    top: 38,
    bottom: 36,
    width: '27%',
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: 'rgba(219, 251, 80, 0.78)',
    backgroundColor: 'rgba(219, 251, 80, 0.04)',
  },
  yellowGuideBoxLeft: {
    left: '1.5%',
  },
  yellowGuideBoxRight: {
    right: '1.5%',
  },
  yellowCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: BREW_THEME.acid,
  },
  subzoneCenterAnchor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  yellowCrossTarget: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yellowCrossVertical: {
    position: 'absolute',
    width: 1.5,
    height: 20,
    backgroundColor: BREW_THEME.acid,
  },
  yellowCrossHorizontal: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: BREW_THEME.acid,
  },
  yellowGuideCaption: {
    color: BREW_THEME.acid,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dimmedSubzone: {
    opacity: 0.35,
  },
  zoneHeader: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoneHeaderLeft: {
    left: '1.5%',
  },
  zoneHeaderMiddle: {
    left: '31.5%',
  },
  zoneHeaderRight: {
    right: '1.5%',
  },
  zoneNum: {
    color: BREW_THEME.soft,
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  zoneLabel: {
    color: BREW_THEME.oatmeal,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  zoneLabelMiddle: {
    color: BREW_THEME.ivory,
  },
  zoneChip: {
    borderWidth: 1,
    borderColor: BREW_THEME.edge,
    backgroundColor: 'rgba(23, 18, 15, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  zoneChipYellow: {
    borderColor: '#a7c44d',
  },
  zoneChipText: {
    color: BREW_THEME.oatmeal,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  zoneChipTextYellow: {
    color: BREW_THEME.acid,
  },
  focusFrame: {
    position: 'absolute',
    left: '31.5%',
    width: '37%',
    top: 38,
    bottom: 36,
  },
  cobaltCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: BREW_THEME.cobalt,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
  },
  focusCenterAnchor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(125, 150, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusCrossVertical: {
    position: 'absolute',
    width: 1.5,
    height: 24,
    backgroundColor: BREW_THEME.cobalt2,
  },
  focusCrossHorizontal: {
    position: 'absolute',
    width: 24,
    height: 1.5,
    backgroundColor: BREW_THEME.cobalt2,
  },
  timecodeOverlay: {
    position: 'absolute',
    left: '31.5%',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  horizonDot: {
    color: BREW_THEME.acid,
    fontSize: 8.5,
    fontWeight: '800',
  },
  horizonText: {
    color: BREW_THEME.oatmeal,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  frameInfo: {
    position: 'absolute',
    right: '1.5%',
    bottom: 9,
    alignItems: 'flex-end',
  },
  frameInfoStrong: {
    color: BREW_THEME.oatmeal,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  frameInfoSmall: {
    color: BREW_THEME.soft,
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
