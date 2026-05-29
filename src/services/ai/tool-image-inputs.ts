import * as path from 'path';
import { fileService } from '../files';
import { resolveToolPath } from '../security/tool-access';

export type ImageInputToolOutput = {
  type: 'image_input';
  image_url: string;
};

type ImagePathToolOutput = {
  type: 'image_path';
  path: string;
};

type ImagePathContainerToolOutput = {
  attachedImagePaths?: string[];
  imagePath?: string;
  imagePaths?: string[];
  savedTo?: string;
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
  _toolName: string,
  output: unknown,
): Promise<ImageInputToolOutput[] | null> => {
  if (isImageInputToolOutput(output)) {
    return output;
  }

  const imagePaths = extractImagePaths(output);
  if (!imagePaths.length) {
    return null;
  }

  const imageInputs = await Promise.all(
    imagePaths.map(async (imagePath) => {
      const safePath = await resolveToolPath(imagePath);
      const mimeType = getMimeType(safePath);
      if (!mimeType) {
        return null;
      }

      const base64 = await (await fileService()).readBase64Image(safePath);
      if (!base64) {
        return null;
      }

      return {
        type: 'image_input',
        image_url: `data:${mimeType};base64,${base64}`,
      } satisfies ImageInputToolOutput;
    }),
  );

  const attachedImages = imageInputs.filter((item) => item !== null);
  return attachedImages.length ? attachedImages : null;
};

const getMimeType = (filePath: string) => {
  return IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? null;
};

const extractImagePaths = (output: unknown): string[] => {
  if (!output) {
    return [];
  }

  if (isImagePathToolOutput(output)) {
    return [output.path];
  }

  if (Array.isArray(output)) {
    return output.flatMap((item) => extractImagePaths(item));
  }

  if (typeof output !== 'object') {
    return [];
  }

  const candidate = output as ImagePathContainerToolOutput;
  const attachedImagePaths = Array.isArray(candidate.attachedImagePaths)
    ? candidate.attachedImagePaths
    : [];
  const imagePaths = Array.isArray(candidate.imagePaths)
    ? candidate.imagePaths
    : [];
  const singlePaths = [candidate.imagePath, candidate.savedTo].filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );

  return [...attachedImagePaths, ...imagePaths, ...singlePaths];
};

const isImagePathToolOutput = (
  output: unknown,
): output is ImagePathToolOutput => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return false;
  }

  const candidate = output as Partial<ImagePathToolOutput>;
  return candidate.type === 'image_path' && typeof candidate.path === 'string';
};
