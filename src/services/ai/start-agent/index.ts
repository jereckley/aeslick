import OpenAI from 'openai';
import { configService } from '../../config';
import { Tool } from 'openai/resources/responses/responses';

export const startAgent =
  (client: OpenAI, tools: Tool[]) => async (prompt: string) => {
    const baseConfig = (await configService()).baseConfig();
    const res = await client.responses.create({
      model: baseConfig.model,
      input: prompt,
      tools,
    });
    return res;
  };
