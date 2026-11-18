/* eslint-disable no-bitwise */
import {
  buildTimemoreHandshakeCommand,
  buildTimemoreTareCommand,
  buildTimemoreTelemetryPacketForTest,
  calculateMovingAverageFlowRate,
  decodeBase64ToBytes,
  decodeTimemoreScalePacket,
  encodeBytesToBase64,
  isTimemoreScaleDevice,
  TIMEMORE_SERVICE_UUID,
  toVideoSyncedScaleSample,
} from '../src/domain/timemoreScaleProtocol';
import {
  setTimemoreScaleBleAdapter,
  TimemoreScaleBleAdapter,
  TimemoreScaleSessionController,
} from '../src/features/camera/services/timemoreScaleService';

describe('timemoreScaleProtocol & timemoreScaleService (TES017)', () => {
  afterEach(() => {
    setTimemoreScaleBleAdapter(null);
  });

  it('identifies Timemore Black Mirror Dot (TES017) by service UUID 0xFFF0 or device name', () => {
    expect(
      isTimemoreScaleDevice({
        name: null,
        serviceUUIDs: [TIMEMORE_SERVICE_UUID],
      }),
    ).toBe(true);

    expect(
      isTimemoreScaleDevice({
        name: 'TIMEMORE Dot TES017',
        serviceUUIDs: [],
      }),
    ).toBe(true);

    expect(
      isTimemoreScaleDevice({
        name: 'Other BLE Speaker',
        serviceUUIDs: ['0000180a-0000-1000-8000-00805f9b34fb'],
      }),
    ).toBe(false);
  });

  it('encodes and decodes Base64 telemetry packets and verifies CRC checksum', () => {
    const packet = buildTimemoreTelemetryPacketForTest({
      weightGrams: 46.2,
      flowRateGramsPerSec: 2.4,
      batteryPercent: 92,
      isStable: true,
    });

    const roundtripBytes = decodeBase64ToBytes(
      encodeBytesToBase64(packet.bytes),
    );
    expect(Array.from(roundtripBytes)).toEqual(Array.from(packet.bytes));

    const decoded = decodeTimemoreScalePacket(packet.base64);
    expect(decoded).not.toBeNull();
    expect(decoded?.checksumValid).toBe(true);
    expect(decoded?.weightGrams).toBe(46.2);
    expect(decoded?.deviceFlowRateGramsPerSec).toBe(2.4);
    expect(decoded?.batteryPercent).toBe(92);
    expect(decoded?.isStable).toBe(true);

    // 末尾CRCバイトを破損させたパケットは拒否されること
    const corrupted = new Uint8Array(packet.bytes);
    corrupted[corrupted.length - 1] ^= 0xff;
    expect(decodeTimemoreScalePacket(corrupted)).toBeNull();
  });

  it('decodes negative weights when sign bit is set', () => {
    const negativePacket = buildTimemoreTelemetryPacketForTest({
      weightGrams: -15.3,
      flowRateGramsPerSec: 0,
      batteryPercent: 80,
      isStable: false,
    });

    const decoded = decodeTimemoreScalePacket(negativePacket.base64);
    expect(decoded).not.toBeNull();
    expect(decoded?.weightGrams).toBe(-15.3);
    expect(decoded?.isStable).toBe(false);
  });

  it('calculates smoothed moving-average flow rate (g/s) over 800ms window', () => {
    const samples = [
      { monotonicMs: 1000, weightGrams: 10.0 },
      { monotonicMs: 1200, weightGrams: 10.8 },
      { monotonicMs: 1500, weightGrams: 12.0 },
      { monotonicMs: 1800, weightGrams: 13.2 }, // 800msで +3.2g = 4.0 g/s
    ];

    const flowRate = calculateMovingAverageFlowRate(samples, 800);
    expect(flowRate).toBe(4.0);
  });

  it('normalizes scale samples relative to REC start (t = 0)', () => {
    const beforeRec = toVideoSyncedScaleSample({
      recordingStartMonotonicMs: 5000,
      sampleMonotonicMs: 4900,
      weightGrams: 0,
      flowRateGramsPerSec: 0,
    });
    expect(beforeRec).toBeNull();

    const synced = toVideoSyncedScaleSample({
      recordingStartMonotonicMs: 5000,
      sampleMonotonicMs: 6250,
      weightGrams: 46.2,
      flowRateGramsPerSec: 3.1,
    });
    expect(synced).toEqual({
      timestampMs: 1250,
      weight: 46.2,
      flowRate: 3.1,
    });
  });

  it('scans, handshakes on 0xFFF2, receives notifications on 0xFFF1, and sends Tare command', async () => {
    const writeSpy = jest.fn().mockResolvedValue(undefined);
    let capturedNotifyCallback: ((base64: string) => void) | null = null;

    const mockAdapter: TimemoreScaleBleAdapter = {
      isAvailable: () => true,
      startScan: onDeviceFound => {
        onDeviceFound({
          id: 'tes017-device-01',
          name: 'Timemore Dot TES017',
          serviceUUIDs: [TIMEMORE_SERVICE_UUID],
        });
      },
      stopScan: jest.fn(),
      connectAndHandshake: jest.fn(
        async (_id, _handshakeBase64, onNotificationBase64) => {
          capturedNotifyCallback = onNotificationBase64;
        },
      ),
      writeCommandBase64: writeSpy,
      disconnectDevice: jest.fn().mockResolvedValue(undefined),
    };

    setTimemoreScaleBleAdapter(mockAdapter);

    const controller = new TimemoreScaleSessionController();
    const stateHistory: string[] = [];
    const receivedWeights: number[] = [];

    const connected = await controller.scanAndConnect({
      onStateChange: state => {
        stateHistory.push(state);
      },
      onPacketDecoded: pkt => {
        receivedWeights.push(pkt.weightGrams);
      },
    });

    expect(connected).toBe(true);
    expect(stateHistory).toEqual([
      'scanning',
      'connecting',
      'handshaking',
      'connected',
    ]);
    expect(mockAdapter.connectAndHandshake).toHaveBeenCalledWith(
      'tes017-device-01',
      buildTimemoreHandshakeCommand().base64,
      expect.any(Function),
      expect.any(Function),
    );

    // Notify (0xFFF1) 受信のシミュレーション
    const samplePacket = buildTimemoreTelemetryPacketForTest({
      weightGrams: 102.5,
      flowRateGramsPerSec: 3.5,
    });
    expect(capturedNotifyCallback).not.toBeNull();
    capturedNotifyCallback!(samplePacket.base64);
    expect(receivedWeights).toEqual([102.5]);

    // Tare (0xFFF2) 送信の検証
    const tareSent = await controller.sendTare();
    expect(tareSent).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith(
      'tes017-device-01',
      buildTimemoreTareCommand().base64,
    );
  });
});
