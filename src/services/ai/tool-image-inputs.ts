import * as path from 'path';
import { fileService } from '../files';

export type ImageInputToolOutput = {
  type: 'image_input';
  image_url: string;
};

type ScreenshotToolOutput = {
  action?: string;
  savedTo?: string;
  success?: boolean;
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const isImageInputToolOutput = (
  output: unknown,
): output is ImageInputToolOutput[] => {
  if (!Array.isArray(output)) {
    return false;
  }

  return output.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const candidate = item as Partial<ImageInputToolOutput>;
    return (
      candidate.type === 'image_input' &&
      typeof candidate.image_url === 'string'
    );
  });
};

export const getImageInputsForToolOutput = async (
  toolName: string,
  output: unknown,
): Promise<ImageInputToolOutput[] | null> => {
  if (isImageInputToolOutput(output)) {
    return output;
  }

  if (!isChromeScreenshotOutput(toolName, output)) {
    return null;
  }

  const mimeType = getMimeType(output.savedTo);
  if (!mimeType) {
    return null;
  }

  const base64 = await (await fileService()).readBase64Image(output.savedTo);
  if (!base64) {
    return null;
  }

  return [
    {
      type: 'image_input',
      image_url: `data:${mimeType};base64,${base64}`,
    },
  ];
};

const isChromeScreenshotOutput = (
  toolName: string,
  output: unknown,
): output is ScreenshotToolOutput & { action: 'screenshot'; savedTo: string } => {
  if (toolName !== 'chrome-headless-browser' || !output || typeof output !== 'object') {
    return false;
  }

  const candidate = output as ScreenshotToolOutput;
  return (
    candidate.action === 'screenshot' &&
    candidate.success === true &&
    typeof candidate.savedTo === 'string' &&
    candidate.savedTo.length > 0
  );
};

const getMimeType = (filePath: string) => {
  return IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? null;
};
