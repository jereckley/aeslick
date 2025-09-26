import inquirer = require('inquirer');
import { FunctionTool } from 'openai/resources/responses/responses';
import { RunNpmCommandInput } from './types';

export const runNpmCommand = async (input: string) => {
  const data = JSON.parse(input) as RunNpmCommandInput;
  return await inquirer.prompt<{ response: string }>([
    { message: data.prompt, name: 'response' },
  ]);
};

export const runNpmCommandTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'prompt-for-input',
  description: 'Prompt the user for input using the command line interface.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The prompt message to display to the user.',
      },
    },
    required: ['prompt'],
    additionalProperties: false,
  },
};
