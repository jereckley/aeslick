import { FunctionTool } from 'openai/resources/responses/responses';
import { PromptForInputInput } from './types';
import { promptForMultilineInput } from '../services/multiline-prompt';

export const promptForInput = async (input: string) => {
  const data = JSON.parse(input) as PromptForInputInput;
  const response = await promptForMultilineInput({
    historyKey: 'component-new',
    prompt: data.prompt,
  });

  return { response };
};

export const promptForInputTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'prompt-for-input',
  description:
    'Prompt the user for input using the command line interface. Supports multi-line input; the user submits by typing /send on its own line.',
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
