import { configService } from '../services/config';
import { GetConfigByNameInput } from './types';
import { FunctionTool } from 'openai/resources/responses/responses';

export const getConfigByName = async (input: string) => {
  const data = JSON.parse(input) as GetConfigByNameInput;
  const config = (await configService()).getProjectConfig(data.name);
  return config;
};

export const getConfigByNameTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'get-config-by-name',
  description:
    'Get the configuration (list of repos) for a project config by its name.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'The name of the project to retrieve the configuration for.',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
};
