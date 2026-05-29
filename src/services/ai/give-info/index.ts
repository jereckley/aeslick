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
import { DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH } from '../../config';
import { configService } from '../../config';
import { summarizeToolOutputForLog } from '../log-sanitizer';
import {
  getImageInputsForToolOutput,
  isImageInputToolOutput,
} from '../tool-image-inputs';

export const giveInfo =
  (client: OpenAI, tools?: Tool[], modelOverride?: string) =>
  async (text: string, responseId?: string) => {
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
      const baseConfig = (await configService()).baseConfig();
      const modelToUse = modelOverride ?? baseConfig.model;
      return streamResponseWithRetry(
        client,
        {
          model: modelToUse,
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
          const imageInputs = await getImageInputsForToolOutput(
            toolCall.name,
            output,
          );
          if (imageInputs) {
            const serializedOutput = isImageInputToolOutput(output)
              ? safeStringify({
                  attached_image_inputs: imageInputs.length,
                })
              : serializeToolOutput(output);
            logToolOutput(toolCall.name, serializedOutput);
            toolResults.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: serializedOutput,
            });
            toolResults.push({
              type: 'message',
              role: 'user',
              content: imageInputs.map((image) => ({
                type: 'input_image',
                image_url: image.image_url,
              })) as any,
            } as ResponseInputItem);
            continue;
          }
          const serializedOutput = serializeToolOutput(output);
          logToolOutput(toolCall.name, serializedOutput);
          toolResults.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: serializedOutput,
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

const serializeToolOutput = (output: unknown) => {
  const serialized = safeStringify(output);
  if (serialized.length <= DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH) {
    return serialized;
  }

  const truncated = serialized.slice(0, DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH);
  return safeStringify({
    truncated: true,
    original_length: serialized.length,
    returned_length: truncated.length,
    preview: truncated,
    note:
      'Output shortened to avoid exceeding the model context window. Ask for a smaller slice or more specific path if needed.',
  });
};

const logToolOutput = (toolName: string, serializedOutput: string) => {
  console.log(
    chalk.yellow(
      `Tool "${toolName}" response: ${summarizeToolOutputForLog(toolName, serializedOutput)}`,
    ),
  );
};

const safeStringify = (value: unknown): string => {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === 'string') {
      return serialized;
    }
    return JSON.stringify(String(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      note: `Unable to stringify tool output: ${message}`,
    });
  }
};
