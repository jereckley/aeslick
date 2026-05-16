import { configService } from '../services/config';
import { GetConfigByNameInput } from './types';
import { FunctionTool } from 'openai/resources/responses/responses';

export const getConfigByName = async (input: string) => {
  const data = JSON.parse(input) as GetConfigByNameInput;
  const config = (await configService()).getProjectRepoConfig(data.name);
  return config;
};

export const getConfigByNameTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-config-by-name',
  description:
    'Get the repo configuration.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'The name of the repo to retrieve the configuration for. Asking for the project name is not a repo.',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
};
