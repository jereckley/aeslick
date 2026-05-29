import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';
import { GetImageByPathInput } from './types';
import { resolveToolPath } from '../services/security/tool-access';

export const getImageByPath = async (input: string) => {
  const data = JSON.parse(input) as GetImageByPathInput;
  const emptyResult = {
    error: 'No image found',
    attachedImagePaths: [] as string[],
  };
  try {
    const safePath = await resolveToolPath(data.path);
    const image = await (await fileService()).readBase64Image(safePath);
    if (!image) {
      return emptyResult;
    }
    return {
      type: 'image_path',
      path: safePath,
    };
  } catch (error) {
    console.error('Error reading image:', error);
    return emptyResult;
  }
};

export const getImageByPathTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-image-by-path',
  description:
    'Resolve an image file by path so it can be attached directly in chat.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'The path of the image to retrieve, relative to the current working directory. Include the repo folder from config in path.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
};
