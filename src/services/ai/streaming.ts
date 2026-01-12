import chalk from 'chalk';
import type OpenAI from 'openai';
import { Response } from 'openai/resources/responses/responses';
import { ResponseStream } from 'openai/lib/responses/ResponseStream';
import { setTimeout as delay } from 'timers/promises';

export type StreamedResponse = Response & { __streamed?: true };

type CreateStreamParams = Omit<
  Parameters<OpenAI['responses']['create']>[0],
  'stream'
> & { stream?: true };

const MAX_LOGGED_ARGS_LENGTH = 4000;

export const streamResponseWithRetry = async (
  client: OpenAI,
  params: CreateStreamParams,
): Promise<StreamedResponse> => {
  const maxRetries = 3;
  let delayMs = 1000;
  let attempt = 0;

  while (true) {
    try {
      const stream = client.responses.stream({
        ...params,
        stream: true,
      });
      logStreamEvents(stream);
      const finalResponse = await stream.finalResponse();
      return { ...finalResponse, __streamed: true };
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

const logStreamEvents = (stream: ResponseStream) => {
  let printedText = false;
  stream.on('response.output_text.delta', (event) => {
    printedText = true;
    process.stdout.write(event.delta);
  });

  stream.on('response.output_text.done', () => {
    if (printedText) {
      process.stdout.write('\n');
      printedText = false;
    }
  });

  stream.on('response.reasoning_text.delta', (event) => {
    console.log(
      chalk.magenta(
        `Reasoning: ${truncateForLog(event.delta ?? '', 800)}`,
      ),
    );
  });

  stream.on('response.function_call_arguments.delta', (event) => {
    const preview = truncateForLog(
      event.snapshot ?? event.delta,
      MAX_LOGGED_ARGS_LENGTH,
    );
    console.log(
      chalk.cyan(
        `Streaming tool arguments for item ${event.item_id}: ${preview}`,
      ),
    );
  });

  stream.on('error', (err) => {
    console.error(chalk.red(`OpenAI streaming error: ${String(err)}`));
  });
};

const truncateForLog = (text: string, limit = 600) => {
  if (text.length <= limit) {
    return text;
  }
  const remaining = text.length - limit;
  return `${text.slice(0, limit)}... [truncated ${remaining} characters]`;
};

const isRateLimitError = (error: any) => {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.cause?.status ??
    error?.response?.status;
  return status === 429;
};
