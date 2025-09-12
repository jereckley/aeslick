import inquirer = require('inquirer');
import { FunctionTool } from 'openai/resources/responses/responses';
import { PromptForInputInput } from './types';

export const promptForInput = async (input: string) => {
  const data = JSON.parse(input) as PromptForInputInput;
  return await inquirer.prompt<{ response: string }>([
    { message: data.prompt, name: 'response' },
  ]);
};

export const promptForInputTool: FunctionTool = {
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
