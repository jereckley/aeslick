import chalk from 'chalk';
import type OpenAI from 'openai';
import { streamResponseWithRetry } from '../streaming';

export const giveInfo =
  (client: OpenAI) => async (text: string, responseId?: string) => {
    const res = await streamResponseWithRetry(client, {
      model: 'o3-pro-2025-06-10',
      input: text,
      previous_response_id: responseId,
    });
    if (!res.output?.length) {
      console.log(chalk.yellow('No output received from OpenAI.'));
    }
    return res.id;
  };
