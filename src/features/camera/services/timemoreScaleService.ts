import { PermissionsAndroid, Platform } from 'react-native';
import {
  buildTimemoreHandshakeCommand,
  buildTimemoreTareCommand,
  DecodedScalePacket,
  decodeTimemoreScalePacket,
  isTimemoreScaleDevice,
  TIMEMORE_NOTIFY_CHAR_UUID,
  TIMEMORE_SERVICE_UUID,
  TIMEMORE_WRITE_CHAR_UUID,
} from '../../../domain/timemoreScaleProtocol';

export type TimemoreScaleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'ble-unavailable'
  | 'permission-denied'
  | 'error';

export interface DiscoveredBleScaleDevice {
  readonly id: string;
  readonly name: string | null;
  readonly localName?: string | null;
  readonly serviceUUIDs?: readonly string[] | null;
}

export interface TimemoreScaleBleAdapter {
  isAvailable: () => boolean;
  startScan: (
    onDeviceFound: (device: DiscoveredBleScaleDevice) => void,
    onError: (error: Error) => void,
  ) => void;
  stopScan: () => void;
  connectAndHandshake: (
    deviceId: string,
    handshakeBase64: string,
    onNotificationBase64: (base64Payload: string) => void,
    onDisconnected: (error: Error | null) => void,
  ) => Promise<void>;
  writeCommandBase64: (deviceId: string, base64Payload: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
}

/**
 * Android 12+ (API 31+) の BLUETOOTH_SCAN / BLUETOOTH_CONNECT ランタイム権限要求
 */
export async function requestBleRuntimePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const apiLevel =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (apiLevel >= 31) {
      const scanPerm = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
      const connectPerm = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
      if (!scanPerm || !connectPerm) {
        return true;
      }
      const results = await PermissionsAndroid.requestMultiple([
        scanPerm,
        connectPerm,
      ]);
      return (
        results[scanPerm] === PermissionsAndroid.RESULTS.GRANTED &&
        results[connectPerm] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const fineLoc = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (!fineLoc) {
      return true;
    }
    const status = await PermissionsAndroid.request(fineLoc);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

interface DynamicBlePlxDevice {
  id: string;
  name: string | null;
  localName?: string | null;
  serviceUUIDs?: string[] | null;
  discoverAllServicesAndCharacteristics: () => Promise<DynamicBlePlxDevice>;
  writeCharacteristicWithoutResponseForService: (
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ) => Promise<unknown>;
  monitorCharacteristicForService: (
    serviceUUID: string,
    characteristicUUID: string,
    listener: (
      error: Error | null,
      characteristic: { value?: string | null } | null,
    ) => void,
  ) => { remove: () => void };
}

interface DynamicBlePlxManager {
  startDeviceScan: (
    uuids: string[] | null,
    options: { allowDuplicates?: boolean } | null,
    listener: (error: Error | null, device: DynamicBlePlxDevice | null) => void,
  ) => void;
  stopDeviceScan: () => void;
  connectToDevice: (
    deviceId: string,
    options?: { autoConnect?: boolean },
  ) => Promise<DynamicBlePlxDevice>;
  onDeviceDisconnected: (
    deviceId: string,
    listener: (error: Error | null, device: DynamicBlePlxDevice | null) => void,
  ) => { remove: () => void };
  writeCharacteristicWithoutResponseForDevice: (
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ) => Promise<unknown>;
  cancelDeviceConnection: (deviceId: string) => Promise<unknown>;
}

declare const require: (moduleId: string) => unknown;

function tryCreateBlePlxManager(): DynamicBlePlxManager | null {
  try {
    // react-native-ble-plx が導入されている場合のみ動的にインスタンス化する
    const blePlx = require('react-native-ble-plx') as {
      BleManager?: new () => DynamicBlePlxManager;
    };
    if (blePlx && typeof blePlx.BleManager === 'function') {
      return new blePlx.BleManager();
    }
    return null;
  } catch {
    return null;
  }
}

export function createDefaultBlePlxScaleAdapter(): TimemoreScaleBleAdapter {
  let managerInstance: DynamicBlePlxManager | null = null;
  let notifySubscription: { remove: () => void } | null = null;
  let disconnectSubscription: { remove: () => void } | null = null;

  const getManager = (): DynamicBlePlxManager | null => {
    if (!managerInstance) {
      managerInstance = tryCreateBlePlxManager();
    }
    return managerInstance;
  };

  return {
    isAvailable(): boolean {
      return getManager() !== null;
    },

    startScan(onDeviceFound, onError): void {
      const mgr = getManager();
      if (!mgr) {
        onError(
          new Error(
            'react-native-ble-plx がまだリンクされていません。npm i react-native-ble-plx 後に再ビルドしてください。',
          ),
        );
        return;
      }

      // サービスUUIDまたはデバイス名（TES017 / Timemore / dot）の両方で検出できるよう全スキャン＋フィルタを行う
      mgr.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, scannedDevice) => {
          if (error) {
            onError(error);
            return;
          }
          if (!scannedDevice) {
            return;
          }
          if (
            isTimemoreScaleDevice({
              name: scannedDevice.name,
              localName: scannedDevice.localName,
              serviceUUIDs: scannedDevice.serviceUUIDs,
            })
          ) {
            onDeviceFound({
              id: scannedDevice.id,
              name: scannedDevice.name ?? scannedDevice.localName ?? 'TES017',
              localName: scannedDevice.localName,
              serviceUUIDs: scannedDevice.serviceUUIDs,
            });
          }
        },
      );
    },

    stopScan(): void {
      getManager()?.stopDeviceScan();
    },

    async connectAndHandshake(
      deviceId,
      handshakeBase64,
      onNotificationBase64,
      onDisconnected,
    ): Promise<void> {
      const mgr = getManager();
      if (!mgr) {
        throw new Error('BLEマネージャーが利用できません。');
      }

      notifySubscription?.remove();
      disconnectSubscription?.remove();

      const connectedDevice = await mgr.connectToDevice(deviceId, {
        autoConnect: false,
      });
      await connectedDevice.discoverAllServicesAndCharacteristics();

      disconnectSubscription = mgr.onDeviceDisconnected(deviceId, err => {
        onDisconnected(err);
      });

      // 1. 0xFFF1 (Notify) の購読を開始
      notifySubscription = connectedDevice.monitorCharacteristicForService(
        TIMEMORE_SERVICE_UUID,
        TIMEMORE_NOTIFY_CHAR_UUID,
        (err, characteristic) => {
          if (err || !characteristic?.value) {
            return;
          }
          onNotificationBase64(characteristic.value);
        },
      );

      // 2. 0xFFF2 (Write) へ open-scale-protocol の初期ハンドシェイクを書き込み
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        TIMEMORE_SERVICE_UUID,
        TIMEMORE_WRITE_CHAR_UUID,
        handshakeBase64,
      );
    },

    async writeCommandBase64(deviceId, base64Payload): Promise<void> {
      const mgr = getManager();
      if (!mgr) {
        throw new Error('BLEマネージャーが利用できません。');
      }
      await mgr.writeCharacteristicWithoutResponseForDevice(
        deviceId,
        TIMEMORE_SERVICE_UUID,
        TIMEMORE_WRITE_CHAR_UUID,
        base64Payload,
      );
    },

    async disconnectDevice(deviceId): Promise<void> {
      notifySubscription?.remove();
      notifySubscription = null;
      disconnectSubscription?.remove();
      disconnectSubscription = null;
      await getManager()?.cancelDeviceConnection(deviceId);
    },
  };
}

let activeScaleBleAdapter: TimemoreScaleBleAdapter =
  createDefaultBlePlxScaleAdapter();

export function setTimemoreScaleBleAdapter(
  adapter: TimemoreScaleBleAdapter | null,
): void {
  activeScaleBleAdapter = adapter ?? createDefaultBlePlxScaleAdapter();
}

export function getTimemoreScaleBleAdapter(): TimemoreScaleBleAdapter {
  return activeScaleBleAdapter;
}

export interface TimemoreScaleSessionCallbacks {
  onStateChange: (
    state: TimemoreScaleConnectionState,
    deviceName: string | null,
    diagnosticMessage: string,
  ) => void;
  onPacketDecoded: (packet: DecodedScalePacket) => void;
}

/**
 * Timemore Black Mirror Dot (TES017) のスキャン・接続・ハンドシェイク・Tare送信を管理するセッションコントローラ
 */
export class TimemoreScaleSessionController {
  private connectedDeviceId: string | null = null;
  private connectedDeviceName: string | null = null;
  private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  public async scanAndConnect(
    callbacks: TimemoreScaleSessionCallbacks,
    scanTimeoutMs: number = 10000,
  ): Promise<boolean> {
    const adapter = getTimemoreScaleBleAdapter();

    if (!adapter.isAvailable()) {
      callbacks.onStateChange(
        'ble-unavailable',
        null,
        'BLE未リンク (npm i react-native-ble-plx 要) / 底面3秒長押しで白LED高速点滅',
      );
      return false;
    }

    const granted = await requestBleRuntimePermissions();
    if (!granted) {
      callbacks.onStateChange(
        'permission-denied',
        null,
        'Bluetooth権限が拒否されました。設定から許可してください。',
      );
      return false;
    }

    this.clearScanTimeout();
    this.isConnecting = false;
    callbacks.onStateChange(
      'scanning',
      null,
      'TES017 (0xFFF0) をスキャン中... 底面3秒長押しで白LED高速点滅にしてください',
    );

    return new Promise<boolean>(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          this.clearScanTimeout();
          resolve(ok);
        }
      };

      this.scanTimeoutId = setTimeout(() => {
        adapter.stopScan();
        callbacks.onStateChange(
          'disconnected',
          null,
          'TES017が見つかりません。底面ボタンを3秒長押しして白LED高速点滅（ペアリングモード）を確認してください。',
        );
        finish(false);
      }, scanTimeoutMs);

      adapter.startScan(
        device => {
          if (this.isConnecting) {
            return;
          }
          this.isConnecting = true;
          adapter.stopScan();
          this.clearScanTimeout();

          const displayName = device.name ?? 'Timemore TES017';
          callbacks.onStateChange(
            'connecting',
            displayName,
            `${displayName} へ接続中...`,
          );

          const handshake = buildTimemoreHandshakeCommand();
          callbacks.onStateChange(
            'handshaking',
            displayName,
            `${displayName} とハンドシェイク中 (0xFFF2 / 0xFFF1)...`,
          );

          adapter
            .connectAndHandshake(
              device.id,
              handshake.base64,
              base64Payload => {
                const decoded = decodeTimemoreScalePacket(base64Payload);
                if (decoded) {
                  callbacks.onPacketDecoded(decoded);
                }
              },
              () => {
                this.connectedDeviceId = null;
                this.connectedDeviceName = null;
                callbacks.onStateChange(
                  'disconnected',
                  null,
                  'スケールとのBLE接続が切断されました。',
                );
              },
            )
            .then(() => {
              this.connectedDeviceId = device.id;
              this.connectedDeviceName = displayName;
              callbacks.onStateChange(
                'connected',
                displayName,
                `${displayName} 接続完了 (タップで 0.0g Tare リセット)`,
              );
              finish(true);
            })
            .catch(err => {
              this.connectedDeviceId = null;
              this.connectedDeviceName = null;
              const msg =
                err instanceof Error ? err.message : 'BLE接続に失敗しました。';
              callbacks.onStateChange('error', null, msg);
              finish(false);
            });
        },
        err => {
          adapter.stopScan();
          callbacks.onStateChange('error', null, err.message);
          finish(false);
        },
      );
    });
  }

  /**
   * 0xFFF2 (Write) へ風袋引き（Tare / 0.0gリセット）コマンドを送信する
   */
  public async sendTare(): Promise<boolean> {
    if (!this.connectedDeviceId) {
      return false;
    }
    const adapter = getTimemoreScaleBleAdapter();
    const tareCmd = buildTimemoreTareCommand();
    await adapter.writeCommandBase64(this.connectedDeviceId, tareCmd.base64);
    return true;
  }

  public async disconnect(): Promise<void> {
    this.clearScanTimeout();
    const adapter = getTimemoreScaleBleAdapter();
    adapter.stopScan();
    if (this.connectedDeviceId) {
      const targetId = this.connectedDeviceId;
      this.connectedDeviceId = null;
      this.connectedDeviceName = null;
      try {
        await adapter.disconnectDevice(targetId);
      } catch {
        // 切断時の例外は無視
      }
    }
  }

  public getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  private clearScanTimeout(): void {
    if (this.scanTimeoutId !== null) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }
  }
}
