import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';
import { GetImageByPathInput } from './types';
import { resolveToolPath } from '../services/security/tool-access';

export const getImageByPath = async (input: string) => {
  const data = JSON.parse(input) as GetImageByPathInput;
  let image = '';
  try {
    const safePath = await resolveToolPath(data.path);
    image = await (await fileService()).readBase64Image(safePath);
  } catch (error) {
    console.error('Error reading image:', error);
    image = 'No image found';
  }
  return image || 'No image found';
};

export const getImageByPathTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-image-by-path',
  description: 'Get the base64 encoded content of an image by its path.',
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
