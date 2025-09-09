import OpenAI from 'openai';

export const startAgent = (client: OpenAI, prompt: string) => async () => {
  const res = await client.responses.create({
    model: 'gpt-5-mini-2025-08-07',
    input: prompt,
  });
  return res;
};
