import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';
import { GetFileByPathInput } from './types';

export const getFileByPath = async (input: string) => {
  const data = JSON.parse(input) as GetFileByPathInput;
  return await (await fileService()).readFile(data.path);
};

export const getFileByPathTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-file-by-path',
  description: 'Get the content of a file by its path.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'The path of the file to retrieve, relative to the current working directory.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
};
