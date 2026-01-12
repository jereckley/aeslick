import OpenAI from 'openai';
import { configService } from '../../config';
import { Tool } from 'openai/resources/responses/responses';
import { streamResponseWithRetry } from '../streaming';

export const startAgent =
  (client: OpenAI, tools: Tool[]) => async (prompt: string, id?: string) => {
    const baseConfig = (await configService()).baseConfig();
    const res = await streamResponseWithRetry(client, {
      model: baseConfig.model,
      reasoning: { effort: 'medium' },
      input: prompt,
      ...(!!id && { previous_response_id: id }),
      tools,
    });
    return res;
  };
