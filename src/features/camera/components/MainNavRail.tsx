import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type MainNavTab = 'camera' | 'settings';

export interface MainNavRailProps {
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
}

/**
 * 1列目（最端）: MainNavRail（幅 約64px）
 * Blackmagic Camera 準拠のナビゲーションレール。
 * 「カメラ」と「設定」のみ有効、仮アイコン1・2はグレーアウト（opacity: 0.3、タップ無効）。
 */
export function MainNavRail({
  activeTab,
  onSelectTab,
}: MainNavRailProps): React.JSX.Element {
  const isCameraSelected = activeTab === 'camera';
  const isSettingsSelected = activeTab === 'settings';

  return (
    <View style={styles.railContainer}>
      {/* 1. カメラ（有効） */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="カメラ画面"
        style={[styles.navItem, isCameraSelected && styles.navItemActive]}
        onPress={() => onSelectTab('camera')}>
        <View
          style={[
            styles.cameraIconGraphic,
            isCameraSelected && styles.iconGraphicActive,
          ]}
        />
        <Text
          style={[styles.navLabel, isCameraSelected && styles.navLabelActive]}>
          カメラ
        </Text>
      </TouchableOpacity>

      {/* 2. 仮アイコン1（ダミー：グレーアウト・タップ無効） */}
      <View
        accessibilityLabel="メディア（準備中）"
        style={[styles.navItem, styles.navItemDummy]}
        pointerEvents="none">
        <View style={styles.dummyIconBox} />
        <Text style={styles.navLabel}>MEDIA</Text>
      </View>

      {/* 3. 仮アイコン2（ダミー：グレーアウト・タップ無効） */}
      <View
        accessibilityLabel="モニター（準備中）"
        style={[styles.navItem, styles.navItemDummy]}
        pointerEvents="none">
        <View style={styles.dummyIconBox} />
        <Text style={styles.navLabel}>MON</Text>
      </View>

      {/* 4. 設定（有効） */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="設定画面"
        style={[styles.navItem, isSettingsSelected && styles.navItemActive]}
        onPress={() => onSelectTab('settings')}>
        <View
          style={[
            styles.gearIconGraphic,
            isSettingsSelected && styles.iconGraphicActive,
          ]}
        />
        <Text
          style={[
            styles.navLabel,
            isSettingsSelected && styles.navLabelActive,
          ]}>
          設定
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  railContainer: {
    width: 64,
    backgroundColor: '#050505',
    borderRightWidth: 1,
    borderRightColor: '#1f1f1f',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navItem: {
    width: 50,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  navItemActive: {
    backgroundColor: '#0a2540',
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  navItemDummy: {
    opacity: 0.3,
  },
  cameraIconGraphic: {
    width: 18,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#8e8e93',
  },
  gearIconGraphic: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8e8e93',
  },
  iconGraphicActive: {
    borderColor: '#4da3ff',
  },
  dummyIconBox: {
    width: 16,
    height: 12,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#8e8e93',
  },
  navLabel: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  navLabelActive: {
    color: '#4da3ff',
    fontWeight: '700',
  },
});
