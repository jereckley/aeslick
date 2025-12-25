import chalk from 'chalk';
import type OpenAI from 'openai';
import {
  EasyInputMessage,
  Response,
  ResponseInputItem,
  type ResponseOutputItem,
  Tool,
} from 'openai/resources/responses/responses';
import { functionMap } from '../../../tools';
import { configService } from '../../config';
import { promptForInput } from '../../../tools/prompt-for-input';
import { fileService } from '../../files';
import { setTimeout as delay } from 'timers/promises';
import * as fse from 'fs-extra';
import * as path from 'path';

export const processResponse =
  (client: OpenAI, tools: Tool[]) => async (res: Response) => {
    try {
      const items = res.output || [];
      console.log(chalk.greenBright(`Conversation continues (response id: ${res.id})`));
      const newList: ResponseInputItem[] = [];
      const fService = await fileService();
      const sorted = sortItems(items);
      console.log(chalk.blue(`Processing ${sorted.length} response item(s)...`));
      for (const item of sorted) {
        if (item.type == 'function_call') {
          const argsLabel =
            typeof item.arguments === 'string'
              ? item.arguments
              : JSON.stringify(item.arguments);
          console.log(
            chalk.cyan(
              `Calling tool "${item.name}" with args: ${argsLabel || '<none>'}`,
            ),
          );
          try {
            const funcRes = await functionMap[
              item.name as keyof typeof functionMap
            ](item.arguments);
            console.log(chalk.cyan(`Tool "${item.name}" completed.`));
            newList.push({
              type: 'function_call_output',
              call_id: item.call_id,
              output: JSON.stringify(funcRes),
            });
          } catch (error) {
            const errorMessage = formatErrorMessage(error);
            console.error(
              chalk.red(`Tool "${item.name}" failed. Returning error to OpenAI: ${errorMessage}`),
            );
            newList.push({
              type: 'function_call_output',
              call_id: item.call_id,
              output: JSON.stringify({ error: errorMessage }),
            });
          }
        } else if (item.type === 'message') {
          item.content.forEach((content) => {
            if (content.type === 'output_text') {
              console.log(chalk.white(`Assistant: ${content.text}`));
            }
          });
        } else if (item.type === 'image_generation_call') {
          const img = item.result;
          if (img) {
            const fileName =
              new Date()
                .toISOString()
                .replaceAll('/', '-')
                .replaceAll('.', '--')
                .replaceAll(',', '')
                .replaceAll(' ', '_') +
              `.` +
              (item as any).output_format;
            await fService.writeBase64Image('assets/' + fileName, img);
            console.log(chalk.cyan(`Image saved to assets/${fileName}`));
          }
          delete item.result;
          console.log(chalk.cyan('Image generation metadata processed.'));
        } else {
          console.log(chalk.yellow('Received unrecognized response item; skipping.'));
        }
      }
      if (newList.length === 0) {
        console.log(chalk.yellow('No assistant output received; asking for more input...'));
        const message = await promptForInput(JSON.stringify({ prompt: '>' }));
        newList.push({
          type: 'message',
          content: message.response,
          role: 'user',
        } satisfies EasyInputMessage);
      }
      const baseConfig = (await configService()).baseConfig();
      console.log(chalk.blue('Requesting next response from OpenAI...'));
      const nextResponse = await createResponseWithRetry(client, {
        model: baseConfig.model,
        reasoning: { effort: 'medium' },
        tools,
        previous_response_id: res.id,
        input: newList,
      });
      await persistConversationId(nextResponse.id);
      console.log(
        chalk.greenBright(
          `New response received (id: ${nextResponse.id}). Stored in conv.txt for resume.`,
        ),
      );
      return nextResponse;
    } catch (error) {
      console.error(chalk.red('Failed to process response from OpenAI:'), error);
      return await forwardErrorToOpenAi(client, tools, res, error);
    }
  };

type CreateResponseParams = Omit<
  Parameters<OpenAI['responses']['create']>[0],
  'stream'
> & { stream?: false };

const createResponseWithRetry = async (
  client: OpenAI,
  params: CreateResponseParams,
): Promise<Response> => {
  const maxRetries = 3;
  let delayMs = 1000;
  let attempt = 0;

  while (true) {
    try {
      const response = await client.responses.create(params);
      return response as Response;
    } catch (error: any) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.log(
          chalk.yellow(
            `Rate limit hit from OpenAI (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`,
          ),
        );
        await delay(delayMs);
        attempt += 1;
        delayMs *= 2;
        continue;
      }

      throw error;
    }
  }
};

const sortItems = (items: ResponseOutputItem[]) => {
  const functionCalls = items.filter((i) => i.type === 'function_call');
  const messages = items.filter((i) => i.type === 'message');
  const imageGenerations = items.filter(
    (i) => i.type === 'image_generation_call',
  );
  const remaining = items.filter(
    (i) =>
      i.type !== 'function_call' &&
      i.type !== 'message' &&
      i.type !== 'image_generation_call',
  );
  return [
    ...imageGenerations,
    ...remaining,
    ...messages,
    ...functionCalls,
  ];
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

const isRateLimitError = (error: any) => {
  const status = error?.status ?? error?.statusCode ?? error?.cause?.status ?? error?.response?.status;
  return status === 429;
};

const persistConversationId = async (responseId: string) => {
  const filePath = path.join(process.cwd(), 'conv.txt');
  const line = `${new Date().toISOString()} - ${responseId}\n`;
  try {
    await fse.ensureFile(filePath);
    await fse.appendFile(filePath, line, { encoding: 'utf-8' });
  } catch (err) {
    console.error(chalk.red('Failed to record conversation id:', err));
  }
};

const forwardErrorToOpenAi = async (
  client: OpenAI,
  tools: Tool[],
  res: Response,
  error: unknown,
) => {
  const baseConfig = (await configService()).baseConfig();
  const errorMessage = formatErrorMessage(error);
  try {
    console.log(chalk.yellow('Attempting to forward the error back to OpenAI...'));
    const nextResponse = await createResponseWithRetry(client, {
      model: baseConfig.model,
      reasoning: { effort: 'medium' },
      tools,
      previous_response_id: res.id,
      input: [
        {
          type: 'message',
          role: 'developer',
          content: `An internal error occurred while processing the last response: ${errorMessage}`,
        } satisfies EasyInputMessage,
      ],
    });
    await persistConversationId(nextResponse.id);
    return nextResponse;
  } catch (forwardingError) {
    console.error(
      chalk.red('Failed to return error to OpenAI. Throwing original error.'),
      forwardingError,
    );
    throw error;
  }
};
