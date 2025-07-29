import chalk from 'chalk';
import type OpenAI from 'openai';

export const giveInfo = (client: OpenAI) => async (text: string, responseId?: string) => {
  const res = await client.responses.create({
    model: 'o3-pro-2025-06-10',
    input: text,
    previous_response_id: responseId,
  });
  res.output.forEach((item) => {
    if (item.type === 'message') {
      item.content.forEach((content) => {
        if (content.type === 'output_text') {
          console.log(chalk.white(content.text));
        }
      });
    }
  });
  return res.id;
};
