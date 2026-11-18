/* eslint-disable no-bitwise */
/**
 * Timemore Black Mirror Dot (型番: TES017) — Open Scale Protocol 純粋ドメインロジック
 *
 * 公式仕様 (TIMEMORE-COFFEE/open-scale-protocol) および OSS実装 (MateuxLucax/caparao) に基づく:
 * - BLE GATT Service UUID: 0xFFF0 (0000fff0-0000-1000-8000-00805f9b34fb)
 * - Notify Characteristic (Uplink): 0xFFF1 (0000fff1-0000-1000-8000-00805f9b34fb)
 * - Write Characteristic (Downlink): 0xFFF2 (0000fff2-0000-1000-8000-00805f9b34fb)
 */

export const TIMEMORE_SERVICE_UUID =
  '0000fff0-0000-1000-8000-00805f9b34fb' as const;
export const TIMEMORE_SERVICE_SHORT_UUID = 'fff0' as const;

export const TIMEMORE_NOTIFY_CHAR_UUID =
  '0000fff1-0000-1000-8000-00805f9b34fb' as const;
export const TIMEMORE_NOTIFY_SHORT_UUID = 'fff1' as const;

export const TIMEMORE_WRITE_CHAR_UUID =
  '0000fff2-0000-1000-8000-00805f9b34fb' as const;
export const TIMEMORE_WRITE_SHORT_UUID = 'fff2' as const;

/** デバイス名フィルタ用キーワード（大文字小文字非区別） */
export const TIMEMORE_DEVICE_NAME_KEYWORDS = [
  'timemore',
  'tes017',
  'black mirror',
  'dot',
] as const;

/** フレームヘッダ・オペコード定数 (open-scale-protocol) */
export const TIMEMORE_FRAME_HEADER = 0x55 as const;
export const TIMEMORE_ALT_HEADER = 0xaa as const;

export const TIMEMORE_OPCODE_NOTIFY = 0x01 as const;
export const TIMEMORE_OPCODE_READ = 0x02 as const;
export const TIMEMORE_OPCODE_WRITE = 0x03 as const;

export const TIMEMORE_CMD_HANDSHAKE = 0x01 as const;
export const TIMEMORE_CMD_TARE = 0x02 as const;
export const TIMEMORE_CMD_TIMER_START = 0x03 as const;
export const TIMEMORE_CMD_TIMER_RESET = 0x04 as const;

/** UI表示更新のスロットリング間隔（ミリ秒: 5〜10fps相当 = 150ms） */
export const SCALE_UI_THROTTLE_INTERVAL_MS = 150 as const;

/** 流速（g/s）移動平均のデフォルト計算窓（ミリ秒: 800ms） */
export const DEFAULT_FLOW_RATE_WINDOW_MS = 800 as const;

export interface DecodedScalePacket {
  /** 重量（グラム、0.1g単位、マイナス値対応） */
  readonly weightGrams: number;
  /** スケール本体側が報告した流速（g/s、未格納フレームの場合は null） */
  readonly deviceFlowRateGramsPerSec: number | null;
  /** バッテリー残量（0〜100%、未格納フレームの場合は null） */
  readonly batteryPercent: number | null;
  /** 重量値が安定しているか */
  readonly isStable: boolean;
  /** 風袋引き（Tare）完了応答フレームか */
  readonly isTareAck: boolean;
  /** パケットのCRC/チェックサムが有効か */
  readonly checksumValid: boolean;
  /** 生バイト配列 */
  readonly rawBytes: Uint8Array;
}

export interface TimestampedWeightSample {
  /** 単調増加時刻（ms） */
  readonly monotonicMs: number;
  /** 重量（g） */
  readonly weightGrams: number;
}

/**
 * 録画開始時点（t = 0）を基準として動画ファイルと一緒に保存する同期データ点
 */
export interface VideoSyncedScaleSample {
  /** 録画開始（REC押下時）からの経過ミリ秒 (t >= 0) */
  readonly timestampMs: number;
  /** 重量 (g, 0.1g単位) */
  readonly weight: number;
  /** 移動平均流速 (g/s, 0.1g/s単位) */
  readonly flowRate: number;
}

export interface VideoSyncedPourMarker {
  /** 投数ステージ (1 = 1投目, 2 = 2投目, 3 = 3投目) */
  readonly stageNumber: 1 | 2 | 3;
  /** 録画開始からの経過ミリ秒 */
  readonly timestampMs: number;
  /** その時点の重量 (g) */
  readonly weightAtMarker: number;
}

export interface VideoSyncedScaleLog {
  readonly deviceModel: 'TES017';
  readonly recordingStartedAtEpochMs: number;
  readonly pourMarkers: readonly VideoSyncedPourMarker[];
  readonly samples: readonly VideoSyncedScaleSample[];
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 外部Bufferポリフィルに依存しない純粋な Base64 -> Uint8Array デコーダ
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  const padding = cleaned.endsWith('==')
    ? 2
    : cleaned.endsWith('=')
      ? 1
      : 0;
  const byteLength = Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
  const output = new Uint8Array(byteLength);

  let outIdx = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const c0 = Math.max(0, BASE64_ALPHABET.indexOf(cleaned[i] ?? 'A'));
    const c1 = Math.max(0, BASE64_ALPHABET.indexOf(cleaned[i + 1] ?? 'A'));
    const c2 =
      cleaned[i + 2] === '=' || i + 2 >= cleaned.length
        ? 0
        : Math.max(0, BASE64_ALPHABET.indexOf(cleaned[i + 2] ?? 'A'));
    const c3 =
      cleaned[i + 3] === '=' || i + 3 >= cleaned.length
        ? 0
        : Math.max(0, BASE64_ALPHABET.indexOf(cleaned[i + 3] ?? 'A'));

    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIdx < byteLength) {
      output[outIdx++] = (triplet >> 16) & 0xff;
    }
    if (outIdx < byteLength) {
      output[outIdx++] = (triplet >> 8) & 0xff;
    }
    if (outIdx < byteLength) {
      output[outIdx++] = triplet & 0xff;
    }
  }

  return output;
}

/**
 * 純粋な Uint8Array -> Base64 エンコーダ（BLE Write送信ペイロード生成用）
 */
export function encodeBytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? (bytes[i + 1] ?? 0) : 0;
    const b2 = hasB2 ? (bytes[i + 2] ?? 0) : 0;

    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    result += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    result += hasB1 ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : '=';
    result += hasB2 ? BASE64_ALPHABET[triplet & 0x3f] : '=';
  }

  return result;
}

/**
 * BLEスキャンで見つかったデバイスが Timemore Black Mirror Dot (TES017) かどうかを判定する
 */
export function isTimemoreScaleDevice(params: {
  name?: string | null;
  localName?: string | null;
  serviceUUIDs?: readonly string[] | null;
}): boolean {
  const uuids = params.serviceUUIDs ?? [];
  for (const uuid of uuids) {
    const normalized = uuid.toLowerCase().trim();
    if (
      normalized === TIMEMORE_SERVICE_UUID ||
      normalized === TIMEMORE_SERVICE_SHORT_UUID ||
      normalized.includes('fff0')
    ) {
      return true;
    }
  }

  const combinedName = `${params.name ?? ''} ${params.localName ?? ''}`
    .toLowerCase()
    .trim();
  if (!combinedName) {
    return false;
  }

  return TIMEMORE_DEVICE_NAME_KEYWORDS.some(keyword =>
    combinedName.includes(keyword),
  );
}

/**
 * パケット末尾の1バイトチェックサム（XOR または 8bit加算）を計算・検証する
 * open-scale-protocol のフレームは先頭から (length - 1) バイトまでの XOR または SUM8 を末尾1バイトに格納する。
 */
export function calculateXorChecksum(
  bytes: Uint8Array,
  endExclusive: number = bytes.length,
): number {
  let xor = 0;
  const limit = Math.min(bytes.length, Math.max(0, endExclusive));
  for (let i = 0; i < limit; i++) {
    xor ^= bytes[i] ?? 0;
  }
  return xor & 0xff;
}

export function calculateSum8Checksum(
  bytes: Uint8Array,
  endExclusive: number = bytes.length,
): number {
  let sum = 0;
  const limit = Math.min(bytes.length, Math.max(0, endExclusive));
  for (let i = 0; i < limit; i++) {
    sum = (sum + (bytes[i] ?? 0)) & 0xff;
  }
  return sum;
}

export function verifyTimemorePacketChecksum(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }
  const expected = bytes[bytes.length - 1] ?? 0;
  const xorAll = calculateXorChecksum(bytes, bytes.length - 1);
  if (xorAll === expected) {
    return true;
  }
  // ヘッダを除いたペイロードXOR / SUM8 バリアントにも対応
  const xorWithoutHeader = calculateXorChecksum(
    bytes.subarray(1),
    bytes.length - 2,
  );
  if (xorWithoutHeader === expected) {
    return true;
  }
  const sumAll = calculateSum8Checksum(bytes, bytes.length - 1);
  return sumAll === expected;
}

/**
 * 初期ハンドシェイク用バイト配列を生成（0xFFF2 Write用）
 */
export function buildTimemoreHandshakeCommand(): {
  bytes: Uint8Array;
  base64: string;
} {
  const frame = new Uint8Array([
    TIMEMORE_FRAME_HEADER,
    TIMEMORE_OPCODE_WRITE,
    TIMEMORE_CMD_HANDSHAKE,
    0x01,
    0x00,
    0x00,
  ]);
  frame[frame.length - 1] = calculateXorChecksum(frame, frame.length - 1);
  return {
    bytes: frame,
    base64: encodeBytesToBase64(frame),
  };
}

/**
 * 風袋引き（Tare / 0.0g ゼロリセット）コマンド用バイト配列を生成（0xFFF2 Write用）
 */
export function buildTimemoreTareCommand(): {
  bytes: Uint8Array;
  base64: string;
} {
  const frame = new Uint8Array([
    TIMEMORE_FRAME_HEADER,
    TIMEMORE_OPCODE_WRITE,
    TIMEMORE_CMD_TARE,
    0x01,
    0x00,
    0x00,
  ]);
  frame[frame.length - 1] = calculateXorChecksum(frame, frame.length - 1);
  return {
    bytes: frame,
    base64: encodeBytesToBase64(frame),
  };
}

/**
 * 0xFFF1 Notification で受信したバイト列（またはBase64文字列）をデコードし、
 * 重量（0.1g単位・符号付き）、流速（g/s）、バッテリー残量（%）、安定フラグを抽出する。
 *
 * フレーム構造 (open-scale-protocol / TES017):
 * - Byte 0: Header (0x55 or 0xAA)
 * - Byte 1: Opcode (0x01 = Notify, 0x03 = Write Ack)
 * - Byte 2: Sub-command / Flags (bit0 = stable, bit1 = negative sign, 0x02 = Tare Ack)
 * - Byte 3..4 (or 3..5): Weight raw integer (0.1g or 0.01g scale, big-endian or little-endian)
 * - Byte 5..6: Flow rate raw (0.1g/s unit, optional)
 * - Byte 7: Battery percentage (0..100, optional)
 * - Last Byte: CRC / Checksum
 */
export function decodeTimemoreScalePacket(
  input: Uint8Array | string,
): DecodedScalePacket | null {
  const bytes =
    typeof input === 'string' ? decodeBase64ToBytes(input) : input;

  if (bytes.length < 5) {
    return null;
  }

  const header = bytes[0] ?? 0;
  if (header !== TIMEMORE_FRAME_HEADER && header !== TIMEMORE_ALT_HEADER) {
    return null;
  }

  const checksumValid = verifyTimemorePacketChecksum(bytes);
  if (!checksumValid) {
    return null;
  }

  const opcode = bytes[1] ?? 0;
  const statusOrCmd = bytes[2] ?? 0;

  if (opcode === TIMEMORE_OPCODE_WRITE && statusOrCmd === TIMEMORE_CMD_TARE) {
    return {
      weightGrams: 0.0,
      deviceFlowRateGramsPerSec: 0.0,
      batteryPercent: null,
      isStable: true,
      isTareAck: true,
      checksumValid: true,
      rawBytes: bytes,
    };
  }

  const isStable = (statusOrCmd & 0x01) !== 0;
  const isNegative = (statusOrCmd & 0x02) !== 0 || (statusOrCmd & 0x80) !== 0;

  // 重量値: Big-Endian 16bit (0.1g単位)
  const weightHigh = bytes[3] ?? 0;
  const weightLow = bytes[4] ?? 0;
  const rawWeightDeciGrams = (weightHigh << 8) | weightLow;
  const signedWeight = isNegative
    ? -rawWeightDeciGrams / 10
    : rawWeightDeciGrams / 10;
  const weightGrams = Math.round(signedWeight * 10) / 10;

  // 流速 (Byte 5..6、存在する場合 0.1g/s 単位)
  let deviceFlowRateGramsPerSec: number | null = null;
  if (bytes.length >= 8) {
    const flowRaw = ((bytes[5] ?? 0) << 8) | (bytes[6] ?? 0);
    deviceFlowRateGramsPerSec = Math.round((flowRaw / 10) * 10) / 10;
  }

  // バッテリー残量 (Byte 7、存在する場合 0〜100%)
  let batteryPercent: number | null = null;
  if (bytes.length >= 9) {
    const rawBatt = bytes[7] ?? 0;
    if (rawBatt >= 0 && rawBatt <= 100) {
      batteryPercent = rawBatt;
    }
  }

  return {
    weightGrams,
    deviceFlowRateGramsPerSec,
    batteryPercent,
    isStable,
    isTareAck: false,
    checksumValid: true,
    rawBytes: bytes,
  };
}

/**
 * テストおよびエンコード検証用: 指定した重量・流速・バッテリー値から有効なテレメトリパケットを生成する
 */
export function buildTimemoreTelemetryPacketForTest(params: {
  weightGrams: number;
  flowRateGramsPerSec?: number;
  batteryPercent?: number;
  isStable?: boolean;
}): { bytes: Uint8Array; base64: string } {
  const isNegative = params.weightGrams < 0;
  const absDeciGrams = Math.round(Math.abs(params.weightGrams) * 10);
  const flowDeci = Math.round(Math.max(0, params.flowRateGramsPerSec ?? 0) * 10);
  const battery = Math.max(0, Math.min(100, Math.round(params.batteryPercent ?? 85)));

  let statusFlags = 0;
  if (params.isStable ?? true) {
    statusFlags |= 0x01;
  }
  if (isNegative) {
    statusFlags |= 0x02;
  }

  const frame = new Uint8Array([
    TIMEMORE_FRAME_HEADER,
    TIMEMORE_OPCODE_NOTIFY,
    statusFlags,
    (absDeciGrams >> 8) & 0xff,
    absDeciGrams & 0xff,
    (flowDeci >> 8) & 0xff,
    flowDeci & 0xff,
    battery,
    0x00,
  ]);
  frame[frame.length - 1] = calculateXorChecksum(frame, frame.length - 1);

  return {
    bytes: frame,
    base64: encodeBytesToBase64(frame),
  };
}

/**
 * 直近 windowMs（デフォルト800ms、500ms〜1000ms推奨）の重量サンプル列から
 * 移動平均流速（g/s）を計算し、UI上の数値の暴れを抑える。
 */
export function calculateMovingAverageFlowRate(
  samples: readonly TimestampedWeightSample[],
  windowMs: number = DEFAULT_FLOW_RATE_WINDOW_MS,
): number {
  if (samples.length < 2) {
    return 0.0;
  }

  const latest = samples[samples.length - 1];
  if (!latest) {
    return 0.0;
  }

  const cutoffMs = latest.monotonicMs - Math.max(200, windowMs);
  let anchor = samples[0]!;
  for (let i = samples.length - 2; i >= 0; i--) {
    const candidate = samples[i]!;
    anchor = candidate;
    if (candidate.monotonicMs <= cutoffMs) {
      break;
    }
  }

  const dtMs = latest.monotonicMs - anchor.monotonicMs;
  if (dtMs < 80) {
    return 0.0;
  }

  const deltaGrams = latest.weightGrams - anchor.weightGrams;
  // 器を持ち上げた際などの急激なマイナス変化は注湯流速としては0.0g/sにクランプする
  if (deltaGrams <= 0.05) {
    return 0.0;
  }

  const rawRate = (deltaGrams * 1000) / dtMs;
  return Math.round(rawRate * 10) / 10;
}

/**
 * 録画開始時刻（recordingStartMonotonicMs）を t = 0 として正規化した同期データ点を生成する
 */
export function toVideoSyncedScaleSample(params: {
  recordingStartMonotonicMs: number;
  sampleMonotonicMs: number;
  weightGrams: number;
  flowRateGramsPerSec: number;
}): VideoSyncedScaleSample | null {
  if (
    !Number.isFinite(params.recordingStartMonotonicMs) ||
    !Number.isFinite(params.sampleMonotonicMs)
  ) {
    return null;
  }
  const elapsed = Math.round(
    params.sampleMonotonicMs - params.recordingStartMonotonicMs,
  );
  if (elapsed < 0) {
    return null;
  }
  return {
    timestampMs: elapsed,
    weight: Math.round(params.weightGrams * 10) / 10,
    flowRate: Math.round(params.flowRateGramsPerSec * 10) / 10,
  };
}
