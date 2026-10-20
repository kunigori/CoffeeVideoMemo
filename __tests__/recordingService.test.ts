import type { RecordVideoOptions, VideoFile } from 'react-native-vision-camera';
import {
  buildRecordedVideoInfo,
  calculateElapsedMs,
  CameraRecorderHandle,
  createNativePhotoLibraryPersistenceAdapter,
  formatElapsedDuration,
  formatTimecode30Fps,
  persistRecordedVideo,
  setVideoPersistenceAdapter,
  startRecordingSession,
  stopRecordingSession,
} from '../src/features/camera/services/recordingService';

describe('recordingService', () => {
  afterEach(() => {
    setVideoPersistenceAdapter(null);
  });

  test('calculateElapsedMs は単調増加時刻から経過時間を算出し、時刻逆転時も負の値を返さない', () => {
    expect(calculateElapsedMs(1000, 3450)).toBe(2450);
    expect(calculateElapsedMs(5000, 4000)).toBe(0);
  });

  test('formatElapsedDuration は MM:SS.d 形式でフォーマットする', () => {
    expect(formatElapsedDuration(0)).toBe('00:00.0');
    expect(formatElapsedDuration(12340)).toBe('00:12.3');
    expect(formatElapsedDuration(125890)).toBe('02:05.8');
  });

  test('formatTimecode30Fps は 30fps 基準の HH:MM:SS:FF タイムコードを返す', () => {
    expect(formatTimecode30Fps(0)).toBe('00:00:00:00');
    expect(formatTimecode30Fps(500)).toBe('00:00:00:15');
    expect(formatTimecode30Fps(1000)).toBe('00:00:01:00');
    expect(formatTimecode30Fps(65500)).toBe('00:01:05:15');
  });

  test('buildRecordedVideoInfo は空パスの場合にエラーを送出し、成功扱いしない', () => {
    expect(() =>
      buildRecordedVideoInfo({
        videoFile: { path: '   ', duration: 5, width: 1920, height: 1080 },
        startedAtEpochMs: 1000,
        finishedAtEpochMs: 6000,
        measuredDurationMs: 5000,
        aeLockStateAtStart: 'locked',
        autoPourDetectionEnabled: true,
      }),
    ).toThrow('出力ファイルパスが空です');
  });

  test('startRecordingSession は録画完了時に temporary 状態の RecordedVideoInfo を返す', () => {
    let capturedOptions: RecordVideoOptions | null = null;
    const mockRecorder: CameraRecorderHandle = {
      startRecording: jest.fn(options => {
        capturedOptions = options;
      }),
      stopRecording: jest.fn(async () => {}),
      cancelRecording: jest.fn(async () => {}),
    };

    const onFinished = jest.fn();
    const onError = jest.fn();

    startRecordingSession({
      recorder: mockRecorder,
      aeLockState: 'unavailable',
      requireAeLockForAutoDetection: false,
      callbacks: { onFinished, onError },
    });

    expect(mockRecorder.startRecording).toHaveBeenCalledTimes(1);
    expect(capturedOptions).not.toBeNull();

    const sampleVideo: VideoFile = {
      path: '/tmp/vision-camera-rec-001.mp4',
      duration: 4.2,
      width: 1920,
      height: 1080,
    };
    capturedOptions!.onRecordingFinished(sampleVideo);

    expect(onError).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
    const result = onFinished.mock.calls[0][0];
    expect(result.path).toBe('/tmp/vision-camera-rec-001.mp4');
    expect(result.storageStatus).toBe('temporary');
    expect(result.requestedFps).toBe(30);
    expect(result.autoPourDetectionEnabled).toBe(false);
  });

  test('自動注湯検出が要求されているのにAEロックがlockedでない場合、録画開始を拒否する', () => {
    const mockRecorder: CameraRecorderHandle = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(async () => {}),
      cancelRecording: jest.fn(async () => {}),
    };

    expect(() =>
      startRecordingSession({
        recorder: mockRecorder,
        aeLockState: 'unlocked',
        requireAeLockForAutoDetection: true,
        callbacks: {
          onFinished: jest.fn(),
          onError: jest.fn(),
        },
      }),
    ).toThrow('自動注湯検出付き録画にはAEロックの成立が必要');

    expect(mockRecorder.startRecording).not.toHaveBeenCalled();
  });

  test('persistRecordedVideo は一時ファイルと永続保存済みファイルを明確に区別する', async () => {
    const tempInfo = buildRecordedVideoInfo({
      videoFile: {
        path: '/tmp/temp-video.mp4',
        duration: 10,
        width: 1920,
        height: 1080,
      },
      startedAtEpochMs: 1000,
      finishedAtEpochMs: 11000,
      measuredDurationMs: 10000,
      aeLockStateAtStart: 'locked',
      autoPourDetectionEnabled: true,
      storageStatus: 'temporary',
    });

    expect(tempInfo.storageStatus).toBe('temporary');

    // 永続化アダプター未設定時はエラーとする
    await expect(persistRecordedVideo(tempInfo)).rejects.toThrow(
      '永続保存アダプターが未構成',
    );

    // 永続化アダプター設定時は persisted へ遷移する
    setVideoPersistenceAdapter({
      persistTemporaryVideo: jest.fn(
        async () => '/Documents/persisted-video.mp4',
      ),
      deleteTemporaryVideo: jest.fn(async () => {}),
    });

    const persistedInfo = await persistRecordedVideo(tempInfo);
    expect(persistedInfo.storageStatus).toBe('persisted');
    expect(persistedInfo.path).toBe('/Documents/persisted-video.mp4');
  });

  test('createNativePhotoLibraryPersistenceAdapter は写真ライブラリ保存成功時に ph:// または content:// パスで persisted に遷移する', async () => {
    const tempInfo = buildRecordedVideoInfo({
      videoFile: {
        path: '/tmp/temp-iphone-video.mp4',
        duration: 6,
        width: 1920,
        height: 1080,
      },
      startedAtEpochMs: 1000,
      finishedAtEpochMs: 7000,
      measuredDurationMs: 6000,
      aeLockStateAtStart: 'locked',
      autoPourDetectionEnabled: true,
      storageStatus: 'temporary',
    });

    const mockSave = jest.fn(async () => 'ABCD-1234/L0/001');
    setVideoPersistenceAdapter(
      createNativePhotoLibraryPersistenceAdapter({
        saveVideoToPhotoLibrary: mockSave,
      }),
    );

    const persisted = await persistRecordedVideo(tempInfo);
    expect(mockSave).toHaveBeenCalledWith('/tmp/temp-iphone-video.mp4');
    expect(persisted.storageStatus).toBe('persisted');
    expect(persisted.path).toBe('ph://ABCD-1234/L0/001');
  });

  test('createNativePhotoLibraryPersistenceAdapter は写真ライブラリ権限拒否時に偽の成功を返さずエラーを送出する', async () => {
    const tempInfo = buildRecordedVideoInfo({
      videoFile: {
        path: '/tmp/temp-iphone-video.mp4',
        duration: 6,
        width: 1920,
        height: 1080,
      },
      startedAtEpochMs: 1000,
      finishedAtEpochMs: 7000,
      measuredDurationMs: 6000,
      aeLockStateAtStart: 'locked',
      autoPourDetectionEnabled: true,
      storageStatus: 'temporary',
    });

    setVideoPersistenceAdapter(
      createNativePhotoLibraryPersistenceAdapter({
        saveVideoToPhotoLibrary: jest.fn(async () => {
          throw new Error('写真ライブラリへの保存権限が許可されていません。');
        }),
      }),
    );

    await expect(persistRecordedVideo(tempInfo)).rejects.toThrow(
      '写真ライブラリへの保存権限が許可されていません。',
    );
  });

  test('stopRecordingSession はカメラ停止失敗時に RecordingServiceError を送出する', async () => {
    const mockRecorder: CameraRecorderHandle = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(async () => {
        throw new Error('エンコーダ停止エラー');
      }),
      cancelRecording: jest.fn(async () => {}),
    };

    await expect(stopRecordingSession(mockRecorder)).rejects.toThrow(
      'エンコーダ停止エラー',
    );
  });
});
