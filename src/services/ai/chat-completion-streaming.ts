import chalk from 'chalk';
import type OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/chat/completions/completions';
import { ChatCompletionStream } from 'openai/lib/ChatCompletionStream';
import { setTimeout as delay } from 'timers/promises';

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

type CreateChatStreamParams = Omit<
  Parameters<OpenAI['chat']['completions']['create']>[0],
  'stream'
> & { stream?: true };

export const streamChatCompletionWithRetry = async (
  client: OpenAI,
  params: CreateChatStreamParams,
  hooks?: StreamUiHooks,
): Promise<ChatCompletion> => {
  const maxRetries = 3;
  let delayMs = 1000;
  let attempt = 0;

  while (true) {
    const startedAt = Date.now();
    hooks?.onAttemptStart?.(attempt + 1);
    try {
      const stream = client.chat.completions.stream({
        ...params,
        stream: true,
      });
      const state = logChatCompletionStreamEvents(stream, hooks);
      const finalCompletion = await stream.finalChatCompletion();
      hooks?.onComplete?.(Date.now() - startedAt, {
        hadOutputText: state.hadOutputText(),
        attemptNumber: attempt + 1,
      });
      return finalCompletion;
    } catch (error: any) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.log(
          chalk.yellow(
            `Rate limit hit from Claude (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`,
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

const logChatCompletionStreamEvents = (
  stream: ChatCompletionStream,
  hooks?: StreamUiHooks,
) => {
  let sawOutputText = false;
  let lineOpen = false;
  let firstTokenSeen = false;
  const loggedToolArgumentItems = new Set<string>();

  stream.on('content.delta', (event) => {
    if (!firstTokenSeen) {
      firstTokenSeen = true;
      hooks?.onFirstToken?.();
    }
    sawOutputText = true;
    lineOpen = true;
    process.stdout.write(event.delta);
  });

  stream.on('content.done', () => {
    if (lineOpen) {
      process.stdout.write('\n');
      lineOpen = false;
    }
  });

  stream.on('tool_calls.function.arguments.delta', (event) => {
    const key = `${event.index}:${event.name}`;
    if (loggedToolArgumentItems.has(key)) {
      return;
    }
    loggedToolArgumentItems.add(key);
    console.log(chalk.cyan(`Streaming tool arguments for "${event.name}".`));
  });

  stream.on('error', (err) => {
    console.error(chalk.red(`Claude streaming error: ${String(err)}`));
  });

  return {
    hadOutputText: () => sawOutputText,
  };
};

const isRateLimitError = (error: any) => {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.cause?.status ??
    error?.response?.status;
  return status === 429;
};
