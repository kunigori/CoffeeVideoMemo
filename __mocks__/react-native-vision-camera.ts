import React from 'react';
import { View } from 'react-native';

export class Camera extends React.Component<Record<string, unknown>> {
  static getCameraPermissionStatus = jest.fn(() => 'granted');
  static getMicrophonePermissionStatus = jest.fn(() => 'granted');
  static requestCameraPermission = jest.fn(async () => 'granted');
  static requestMicrophonePermission = jest.fn(async () => 'granted');
  static getAvailableCameraDevices = jest.fn(() => []);

  startRecording = jest.fn();
  stopRecording = jest.fn(async () => {});
  cancelRecording = jest.fn(async () => {});
  pauseRecording = jest.fn(async () => {});
  resumeRecording = jest.fn(async () => {});
  takePhoto = jest.fn(async () => ({ path: '/tmp/photo.jpg' }));
  focus = jest.fn(async () => {});

  render() {
    return React.createElement(View, { testID: 'mock-vision-camera' });
  }
}

export const useCameraDevice = jest.fn(() => ({
  id: 'back-wide-1',
  position: 'back',
  name: 'Back Camera',
  hasFlash: true,
  hasTorch: true,
  minFocusDistance: 10,
  isMultiCam: false,
  minZoom: 1,
  maxZoom: 10,
  neutralZoom: 1,
  minExposure: -8,
  maxExposure: 8,
  supportsLowLightBoost: false,
  supportsRawCapture: false,
  supportsFocus: true,
  hardwareLevel: 'full',
  sensorOrientation: 'landscape-right',
  physicalDevices: ['wide-angle-camera'],
  formats: [
    {
      photoWidth: 4032,
      photoHeight: 3024,
      videoWidth: 3840,
      videoHeight: 2160,
      minISO: 50,
      maxISO: 3200,
      fieldOfView: 78,
      supportsVideoHdr: false,
      supportsPhotoHdr: false,
      supportsDepthCapture: false,
      minFps: 1,
      maxFps: 30,
      autoFocusSystem: 'phase-detection',
      videoStabilizationModes: ['off', 'standard'],
    },
    {
      photoWidth: 4032,
      photoHeight: 3024,
      videoWidth: 1920,
      videoHeight: 1080,
      minISO: 50,
      maxISO: 3200,
      fieldOfView: 78,
      supportsVideoHdr: false,
      supportsPhotoHdr: false,
      supportsDepthCapture: false,
      minFps: 1,
      maxFps: 30,
      autoFocusSystem: 'phase-detection',
      videoStabilizationModes: ['off', 'standard'],
    },
  ],
}));

export const useCameraPermission = jest.fn(() => ({
  hasPermission: true,
  requestPermission: jest.fn(async () => true),
}));

export const useMicrophonePermission = jest.fn(() => ({
  hasPermission: true,
  requestPermission: jest.fn(async () => true),
}));

export const useCameraFormat = jest.fn(
  (device?: { formats?: Array<Record<string, unknown>> }) =>
    device?.formats?.[0] ?? undefined,
);
export const useFrameProcessor = jest.fn();
export const runAtTargetFps = jest.fn((_fps: number, fn: () => void) => fn());
export const runAsync = jest.fn((_frame: unknown, fn: () => void) => fn());
