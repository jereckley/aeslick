import chalk from 'chalk';
import type OpenAI from 'openai';
import { Response } from 'openai/resources/responses/responses';
import { ResponseStream } from 'openai/lib/responses/ResponseStream';
import { setTimeout as delay } from 'timers/promises';

export type StreamedResponse = Response & { __streamed?: true };
type StreamUiHooks = {
  onAttemptStart?: (attemptNumber: number) => void;
  onFirstToken?: () => void;
  onRetry?: (attemptNumber: number, delayMs: number) => void;
  onComplete?: (
    durationMs: number,
    meta: { hadOutputText: boolean; attemptNumber: number },
  ) => void;
  onError?: (error: unknown) => void;
};

type CreateStreamParams = Omit<
  Parameters<OpenAI['responses']['create']>[0],
  'stream'
> & { stream?: true };

const MAX_LOGGED_ARGS_LENGTH = 4000;

export const streamResponseWithRetry = async (
  client: OpenAI,
  params: CreateStreamParams,
  hooks?: StreamUiHooks,
): Promise<StreamedResponse> => {
  const maxRetries = 3;
  let delayMs = 1000;
  let attempt = 0;

  while (true) {
    const startedAt = Date.now();
    hooks?.onAttemptStart?.(attempt + 1);
    try {
      const stream = client.responses.stream({
        ...params,
        stream: true,
      });
      const state = logStreamEvents(stream, hooks);
      const finalResponse = await stream.finalResponse();
      hooks?.onComplete?.(Date.now() - startedAt, {
        hadOutputText: state.hadOutputText(),
        attemptNumber: attempt + 1,
      });
      return { ...finalResponse, __streamed: true };
    } catch (error: any) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.log(
          chalk.yellow(
            `Rate limit hit from OpenAI (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`,
          ),
        );
        hooks?.onRetry?.(attempt + 1, delayMs);
        await delay(delayMs);
        attempt += 1;
        delayMs *= 2;
        continue;
      }
      hooks?.onError?.(error);
      throw error;
    }
  }
};

const logStreamEvents = (stream: ResponseStream, hooks?: StreamUiHooks) => {
  let printedText = false;
  let firstTokenSeen = false;
  stream.on('response.output_text.delta', (event) => {
    if (!firstTokenSeen) {
      firstTokenSeen = true;
      hooks?.onFirstToken?.();
    }
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

  return {
    hadOutputText: () => printedText,
  };
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
