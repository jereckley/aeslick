import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';
import { GetListOfFilesInPathInput } from './types';

export const getListOfFilesInPath = async (input: string) => {
  return await (
    await fileService()
  ).getListOfFilesInPath((JSON.parse(input) as GetListOfFilesInPathInput).path);
};

export const getListOfFilesInPathTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-list-of-files-in-path',
  description: 'get a list of files in a given path.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'path to get the list of files from, relative to the current working directory.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
};
