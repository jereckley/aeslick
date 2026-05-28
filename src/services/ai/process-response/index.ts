import chalk from 'chalk';
import type OpenAI from 'openai';
import {
  EasyInputMessage,
  Response,
  ResponseInputItem,
  type ResponseOutputItem,
  ResponseReasoningItem,
  Tool,
} from 'openai/resources/responses/responses';
import { functionMap } from '../../../tools';
import {
  DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH,
  configService,
} from '../../config';
import { promptForInput } from '../../../tools/prompt-for-input';
import { fileService } from '../../files';
import * as fse from 'fs-extra';
import * as path from 'path';
import { StreamedResponse, streamResponseWithRetry } from '../streaming';
import { isRestartableResponse } from '../is-restartable-response';
import {
  summarizeToolArgumentsForLog,
  summarizeToolOutputForLog,
} from '../log-sanitizer';

type ImageInputToolOutput = {
  type: 'image_input';
  image_url: string;
};

export const processResponse =
  (client: OpenAI, tools: Tool[], modelOverride?: string) =>
  async (res: Response | StreamedResponse) => {
    try {
      const items = res.output || [];
      const streamed = Boolean((res as StreamedResponse).__streamed);
      const shouldLogMessages = !streamed;
      console.log(
        chalk.greenBright(`Conversation continues (response id: ${res.id})`),
      );
      const baseConfig = (await configService()).baseConfig();
      const maxFunctionOutputLength =
        baseConfig.maxFunctionOutputLength ?? DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH;
      const newList: ResponseInputItem[] = [];
      const fService = await fileService();
      const unrecognizedItems: ResponseOutputItem[] = [];
      const sorted = sortItems(items);
      console.log(
        chalk.blue(`Processing ${sorted.length} response item(s)...`),
      );
      for (const item of sorted) {
        if (item.type == 'function_call') {
          const argsLabel = summarizeToolArgumentsForLog(item.arguments);
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
            if (isImageInputToolOutput(funcRes)) {
              const imageInputOutput = safeStringify({
                attached_image_inputs: funcRes.length,
              });
              logToolOutput(item.name, imageInputOutput);
              newList.push({
                type: 'function_call_output',
                call_id: item.call_id,
                output: imageInputOutput,
              });
              newList.push({
                type: 'message',
                role: 'user',
                content: funcRes.map((image) => ({
                  type: 'input_image',
                  image_url: image.image_url,
                })) as any,
              } as ResponseInputItem);
              continue;
            }
            const formattedOutput = serializeFunctionOutput(
              funcRes,
              maxFunctionOutputLength,
            );
            logToolOutput(item.name, formattedOutput);
            newList.push({
              type: 'function_call_output',
              call_id: item.call_id,
              output: formattedOutput,
            });
          } catch (error) {
            const errorMessage = formatErrorMessage(error);
            const loggedError = summarizeToolArgumentsForLog(errorMessage);
            console.error(
              chalk.red(
                `Tool "${item.name}" failed. Returning error to OpenAI: ${loggedError}`,
              ),
            );
            newList.push({
              type: 'function_call_output',
              call_id: item.call_id,
              output: JSON.stringify({ error: errorMessage }),
            });
          }
        } else if (item.type === 'message' && shouldLogMessages) {
          item.content.forEach((content) => {
            if (content.type === 'output_text') {
              console.log(chalk.white(`Assistant: ${content.text}`));
            }
          });
        } else if (item.type === 'reasoning') {
          logReasoningItem(item);
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
            await fService.writeBase64Image('assets/output/' + fileName, img);
            console.log(chalk.cyan(`Image saved to assets/output/${fileName}`));
          }
          delete item.result;
          console.log(chalk.cyan('Image generation metadata processed.'));
        } else {
          unrecognizedItems.push(item);
          console.log(
            chalk.yellow(
              'Received unrecognized response item; requesting handling guidance from OpenAI.',
            ),
          );
        }
      }
      if (unrecognizedItems.length > 0) {
        const unrecognizedDetails = unrecognizedItems.forEach((item) => {
          console.log(
            chalk.yellow(`Unrecognized item: ${describeResponseItem(item)}`),
          );
        });
      }
      if (newList.length === 0) {
        console.log(
          chalk.yellow(
            'No assistant output received; asking for more input...',
          ),
        );
        const message = await promptForInput(JSON.stringify({ prompt: '>' }));
        newList.push({
          type: 'message',
          content: message.response,
          role: 'user',
        } satisfies EasyInputMessage);
      }
      console.log(chalk.blue('Requesting next response from OpenAI...'));
      const modelToUse = modelOverride ?? baseConfig.model;
      const nextResponse = await streamResponseWithRetry(client, {
        model: modelToUse,
        reasoning: { effort: 'medium' },
        ...(tools.length ? { tools } : {}),
        previous_response_id: res.id,
        input: newList,
      });
      if (isRestartableResponse(nextResponse)) {
        await persistConversationId(nextResponse.id);
        console.log(
          chalk.greenBright(
            `New response received (id: ${nextResponse.id}). Stored in conv.txt for resume.`,
          ),
        );
      } else {
        console.log(
          chalk.greenBright(
            `New response received (id: ${nextResponse.id}). Not stored for resume because it is not restartable.`,
          ),
        );
      }
      return nextResponse;
    } catch (error) {
      console.error(
        chalk.red('Failed to process response from OpenAI:'),
        error,
      );
      return await forwardErrorToOpenAi(
        client,
        tools,
        modelOverride,
        res,
        error,
      );
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
  return [...imageGenerations, ...remaining, ...messages, ...functionCalls];
};

const describeResponseItem = (item: ResponseOutputItem) => {
  const sanitized = { ...item };
  if ('result' in sanitized) {
    delete (sanitized as any).result;
  }
  try {
    return JSON.stringify(sanitized);
  } catch {
    return `Unserializable response item of type "${item.type}"`;
  }
};

const logReasoningItem = (item: ResponseReasoningItem) => {
  const headerParts = [
    item.id ? `id: ${item.id}` : null,
    item.status ? `status: ${item.status}` : null,
  ].filter(Boolean);
  const headerSuffix =
    headerParts.length > 0 ? ` (${headerParts.join(' | ')})` : '';
  console.log(chalk.magenta(`--- Reasoning${headerSuffix} ---`));

  const summaryText = (item.summary ?? [])
    .map((summary) => summary.text)
    .filter(Boolean)
    .join(' ')
    .trim();
  if (summaryText) {
    console.log(
      chalk.magenta(
        `summary: ${truncateForLog(summarizeToolArgumentsForLog(summaryText), 400)}`,
      ),
    );
  }

  const reasoningSteps =
    item.content?.map((content) => content.text).filter(Boolean) ?? [];
  reasoningSteps.forEach((text, index) => {
    console.log(
      chalk.magenta(
        `step ${index + 1}: ${truncateForLog(summarizeToolArgumentsForLog(text), 800)}`,
      ),
    );
  });

  if (!summaryText && reasoningSteps.length === 0) {
    console.log(chalk.magenta('no reasoning text provided.'));
  }
  console.log(chalk.magenta('--- end reasoning ---'));
};

const truncateForLog = (text: string, limit = 600) => {
  if (text.length <= limit) {
    return text;
  }
  const remaining = text.length - limit;
  return `${text.slice(0, limit)}... [truncated ${remaining} characters]`;
};

const serializeFunctionOutput = (
  output: unknown,
  maxFunctionOutputLength: number,
) => {
  const serialized = safeStringify(output);
  if (serialized.length <= maxFunctionOutputLength) {
    return serialized;
  }

  console.log(
    chalk.yellow(
      `Tool output length ${serialized.length} exceeded ${maxFunctionOutputLength} characters; truncating to avoid context window errors.`,
    ),
  );

  const truncated = serialized.slice(0, maxFunctionOutputLength);
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
  return JSON.stringify({
    note: `Unable to stringify tool output: ${formatErrorMessage(error)}`,
  });
  }
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
  modelOverride: string | undefined,
  res: Response | StreamedResponse,
  error: unknown,
) => {
  const baseConfig = (await configService()).baseConfig();
  const errorMessage = formatErrorMessage(error);
  const modelToUse = modelOverride ?? baseConfig.model;
  try {
    console.log(
      chalk.yellow('Attempting to forward the error back to OpenAI...'),
    );
    const nextResponse = await streamResponseWithRetry(client, {
      model: modelToUse,
      reasoning: { effort: 'medium' },
      ...(tools.length ? { tools } : {}),
      previous_response_id: res.id,
      input: [
        {
          type: 'message',
          role: 'developer',
          content: `An internal error occurred while processing the last response: ${errorMessage}`,
        } satisfies EasyInputMessage,
      ],
    });
    if (isRestartableResponse(nextResponse)) {
      await persistConversationId(nextResponse.id);
    }
    return nextResponse;
  } catch (forwardingError) {
    console.error(
      chalk.red('Failed to return error to OpenAI. Throwing original error.'),
      forwardingError,
    );
    throw error;
  }
};
