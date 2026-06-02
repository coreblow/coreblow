import {
  convertHeicToJpeg,
  getImageMetadata,
  hasAlphaChannel,
  normalizeExifOrientation,
  resizeToJpeg,
  resizeToPng,
  type ImageMetadata,
} from "coreblow/plugin-sdk/media-runtime";

type ResizeToJpegParams = {
  buffer: Buffer;
  maxSide: number;
  quality: number;
  withoutEnlargement?: boolean;
};

type ResizeToPngParams = {
  buffer: Buffer;
  maxSide: number;
  compressionLevel?: number;
  withoutEnlargement?: boolean;
};

type MediaUnderstandingImageOpsOptions = {
  maxInputPixels: number;
};

function normalizeMaxInputPixels(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Media attachment image ops require a positive maxInputPixels budget");
  }
  return value;
}

export function createMediaAttachmentImageOps(options: MediaUnderstandingImageOpsOptions) {
  normalizeMaxInputPixels(options.maxInputPixels);
  return {
    async getImageMetadata(buffer: Buffer): Promise<ImageMetadata | null> {
      return await getImageMetadata(buffer);
    },

    async normalizeExifOrientation(buffer: Buffer): Promise<Buffer> {
      return await normalizeExifOrientation(buffer);
    },

    async resizeToJpeg(params: ResizeToJpegParams): Promise<Buffer> {
      return await resizeToJpeg(params);
    },

    async convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
      return await convertHeicToJpeg(buffer);
    },

    async hasAlphaChannel(buffer: Buffer): Promise<boolean> {
      return await hasAlphaChannel(buffer);
    },

    async resizeToPng(params: ResizeToPngParams): Promise<Buffer> {
      return await resizeToPng(params);
    },
  };
}
