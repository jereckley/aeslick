import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';
import { GetFileByPathInput } from './types';
import { resolveToolPath } from '../services/security/tool-access';

export const getFileByPath = async (input: string) => {
  const data = JSON.parse(input) as GetFileByPathInput;
  let file: string;
  try {
    const safePath = await resolveToolPath(data.path);
    file = await (await fileService()).readFile(safePath);
  } catch (error) {
    console.error('Error reading file:', error);
    file = 'No file found';
  }
  return file;
};

export const getFileByPathTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-file-by-path',
  description: 'Get the string content of a file by its path.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'The path of the file to retrieve, relative to the current working directory. Include the repo folder from config in path.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
};
