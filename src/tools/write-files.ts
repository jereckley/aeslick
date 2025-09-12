import { WriteFilesInput } from './types';
import { FunctionTool } from 'openai/resources/responses/responses';
import { fileService } from '../services/files';

export const writeFile = async (input: string) => {
  const data = JSON.parse(input) as WriteFilesInput;
  await (await fileService()).writeFile(data.pathWithFileName, data.content);
  return { success: true };
};

export const writeFileTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'write-file',
  description: 'Write content to a file at the specified path.',
  parameters: {
    type: 'object',
    properties: {
      pathWithFileName: {
        type: 'string',
        description:
          'The path (including filename) where the content should be written.',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file.',
      },
    },
    required: ['pathWithFileName', 'content'],
    additionalProperties: false,
  },
};
