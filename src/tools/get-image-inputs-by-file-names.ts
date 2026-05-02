import { FunctionTool } from 'openai/resources/responses/responses';
import { GetImageInputsByFileNamesInput } from './types';

const IMAGE_INPUT_BASE_URL = 'https://ngrok.reckxl.media/download/input/';

type ImageInput = {
  type: 'image_input';
  image_url: string;
};

export const getImageInputsByFileNames = async (input: string) => {
  const data = JSON.parse(input) as GetImageInputsByFileNamesInput;
  const fileNames = Array.isArray(data.fileNames) ? data.fileNames : [];
  const cleaned = fileNames
    .map((fileName) => fileName.trim())
    .filter((fileName) => fileName.length > 0);

  const imageInputs: ImageInput[] = cleaned.map((fileName) => ({
    type: 'image_input',
    image_url: `${IMAGE_INPUT_BASE_URL}${encodeURIComponent(fileName)}`,
  }));

  return imageInputs;
};

export const getImageInputsByFileNamesTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-image-inputs-by-file-names',
  description:
    'Builds image_input entries from an array of filenames. Each image_url uses https://ngrok.reckxl.media/download/input/<filename>.',
  parameters: {
    type: 'object',
    properties: {
      fileNames: {
        type: 'array',
        description: 'Image file names to convert into image_input URLs.',
        items: {
          type: 'string',
        },
      },
    },
    required: ['fileNames'],
    additionalProperties: false,
  },
};
