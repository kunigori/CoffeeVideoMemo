import {
  captureAndRecognizeBeanInfo,
  setBeanOcrAdapter,
} from '../src/features/camera/services/beanOcrService';
import { checkPatternAEquipmentModels } from '../src/features/camera/services/equipmentInferenceService';

describe('beanOcrService & equipmentInferenceService', () => {
  afterEach(() => {
    setBeanOcrAdapter(null);
  });

  it('captures a still photo, crops right region, and matches noisy OCR lines to Glitch Ethiopia Tamiru', async () => {
    const mockCamera = {
      takePhoto: jest.fn().mockResolvedValue({
        path: '/tmp/test_bean_photo.jpg',
        width: 3840,
        height: 2160,
      }),
    };

    const recognizeSpy = jest.fn().mockResolvedValue({
      engine: 'mlkit-japanese',
      lines: ['GL1TCH', 'ETH10P1A', 'TAMIRU'],
      fullText: 'GL1TCH\nETH10P1A\nTAMIRU',
    });

    setBeanOcrAdapter({
      recognizeTextInRegion: recognizeSpy,
    });

    const result = await captureAndRecognizeBeanInfo(mockCamera);

    expect(mockCamera.takePhoto).toHaveBeenCalledWith({
      enableShutterSound: false,
    });
    expect(recognizeSpy).toHaveBeenCalledWith('/tmp/test_bean_photo.jpg', {
      x: 0.69,
      y: 0.14,
      width: 0.28,
      height: 0.64,
    });
    expect(result.state).toBe('matched');
    expect(result.matchOutput?.bestMatch?.bean.id).toBe(
      'glitch-ethiopia-tamiru',
    );
    expect(result.matchOutput?.bestMatch?.bean.displaySummary).toBe(
      'Glitch / エチオピア・タミル (Natural)',
    );
  });

  it('returns no-text when right region OCR detects no text lines', async () => {
    const mockCamera = {
      takePhoto: jest.fn().mockResolvedValue({
        path: '/tmp/empty_photo.jpg',
      }),
    };

    setBeanOcrAdapter({
      recognizeTextInRegion: jest.fn().mockResolvedValue({
        engine: 'ios-vision',
        lines: [],
        fullText: '',
      }),
    });

    const result = await captureAndRecognizeBeanInfo(mockCamera);
    expect(result.state).toBe('no-text');
    expect(result.matchOutput).toBeNull();
  });

  it('returns error when camera reference is null', async () => {
    const result = await captureAndRecognizeBeanInfo(null);
    expect(result.state).toBe('error');
    expect(result.errorMessage).toContain('カメラ参照');
  });

  it('reports model-not-bundled when Pattern A .tflite files are not yet placed', async () => {
    const snapshot = await checkPatternAEquipmentModels();
    expect(snapshot.millModelFile).toBe('mill_classifier.tflite');
    expect(snapshot.dripperModelFile).toBe('dripper_classifier.tflite');
    expect(snapshot.readiness).toBe('model-not-bundled');
  });
});
