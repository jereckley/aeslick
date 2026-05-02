import chalk from 'chalk';
import type OpenAI from 'openai';
import { streamResponseWithRetry } from '../streaming';
import {
  Response,
  ResponseInputItem,
  ResponseOutputItem,
  Tool,
} from 'openai/resources/responses/responses';
import { functionMap } from '../../../tools';

type ImageInputToolOutput = {
  type: 'image_input';
  image_url: string;
};

export const giveInfo =
  (client: OpenAI, tools?: Tool[]) => async (text: string, responseId?: string) => {
    let thinkingTimer: NodeJS.Timeout | undefined;
    let thinkingInterval: NodeJS.Timeout | undefined;
    let thinkingShown = false;
    let firstTokenSeen = false;
    let dotCount = 0;

    const stopThinking = (withNewline = false) => {
      if (thinkingTimer) {
        clearTimeout(thinkingTimer);
        thinkingTimer = undefined;
      }
      if (thinkingInterval) {
        clearInterval(thinkingInterval);
        thinkingInterval = undefined;
      }
      if (withNewline && thinkingShown) {
        process.stdout.write('\n');
      }
      thinkingShown = false;
    };

    const createResponse = async (
      input: string | ResponseInputItem[],
      previousResponseId?: string,
    ) => {
      return streamResponseWithRetry(
        client,
        {
          model: 'gpt-5.4',
          reasoning: {
            effort: 'high',
          },
          input,
          ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
          ...(tools?.length ? { tools } : {}),
        },
        {
          onAttemptStart: () => {
            thinkingTimer = setTimeout(() => {
              thinkingShown = true;
              process.stdout.write(chalk.gray('\nAssistant is thinking'));
              thinkingInterval = setInterval(() => {
                dotCount = (dotCount + 1) % 4;
                process.stdout.write(
                  chalk.gray(`\rAssistant is thinking${'.'.repeat(dotCount)}   `),
                );
              }, 500);
            }, 350);
          },
          onFirstToken: () => {
            firstTokenSeen = true;
            stopThinking(true);
          },
          onComplete: (durationMs) => {
            stopThinking(!firstTokenSeen);
            console.log(
              chalk.gray(`\nFinished in ${(durationMs / 1000).toFixed(1)}s`),
            );
          },
          onError: () => {
            stopThinking(!firstTokenSeen);
          },
        },
      );
    };

    let res: Response = await createResponse(text, responseId);

    while (true) {
      const toolCalls = (res.output ?? []).filter(
        (item): item is Extract<ResponseOutputItem, { type: 'function_call' }> =>
          item.type === 'function_call',
      );
      if (!toolCalls.length) {
        break;
      }
      const toolResults: ResponseInputItem[] = [];
      for (const toolCall of toolCalls) {
        try {
          const fn = functionMap[toolCall.name as keyof typeof functionMap];
          if (!fn) {
            throw new Error(`Tool "${toolCall.name}" is not registered.`);
          }
          const output = await fn(toolCall.arguments);
          if (isImageInputToolOutput(output)) {
            toolResults.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify({
                attached_image_inputs: output.length,
              }),
            });
            toolResults.push({
              type: 'message',
              role: 'user',
              content: output.map((image) => ({
                type: 'input_image',
                image_url: image.image_url,
              })) as any,
            } as ResponseInputItem);
            continue;
          }
          toolResults.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify(output),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          toolResults.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify({ error: message }),
          });
        }
      }
      res = await createResponse(toolResults, res.id);
    }

    if (!res.output?.length) {
      console.log(chalk.yellow('No output received from OpenAI.'));
    }
    return res;
  };

const isImageInputToolOutput = (
  output: unknown,
): output is ImageInputToolOutput[] => {
  if (!Array.isArray(output)) {
    return false;
  }
  return output.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const candidate = item as Partial<ImageInputToolOutput>;
    return (
      candidate.type === 'image_input' &&
      typeof candidate.image_url === 'string'
    );
  });
};
