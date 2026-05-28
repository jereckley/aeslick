import chalk from 'chalk';
import * as fse from 'fs-extra';
import type OpenAI from 'openai';
import * as path from 'path';
import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions/completions';
import {
  ResponseFunctionToolCall,
  ResponseOutputItem,
  ResponseOutputRefusal,
  ResponseOutputText,
  Tool,
} from 'openai/resources/responses/responses';
import { functionMap } from '../../tools';
import {
  DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH,
  configService,
} from '../config';
import { promptForInput } from '../../tools/prompt-for-input';
import { summarizeToolOutputForLog } from './log-sanitizer';
import { streamChatCompletionWithRetry } from './chat-completion-streaming';
import {
  getClaudeConversation,
  saveClaudeConversation,
} from './claude-conversation-store';
import { createAnthropicCompatibleClient, getResolvedBaseConfig } from './provider';
import { AiResponse, AiService, AiServiceOptions } from './types';

type ImageInputToolOutput = {
  type: 'image_input';
  image_url: string;
};

let client: OpenAI | undefined;

export const getClaudeAiService = async (
  options?: AiServiceOptions,
): Promise<AiService> => {
  const tools = options?.tools;
  const model = options?.model;
  const hasTools = Array.isArray(tools);
  const baseConfig = await getResolvedBaseConfig(model);
  if (baseConfig.provider !== 'anthropic') {
    throw new Error('Claude service requested without an Anthropic provider.');
  }
  if (!client) {
    client = await createAnthropicCompatibleClient();
  }

  const chatTools = buildChatCompletionTools(tools);
  logUnsupportedTools(tools);

  return {
    giveInfo: giveInfo(client, chatTools, model),
    writeTest: writeTest(client, model),
    startAgent: hasTools
      ? startAgent(client, chatTools, model)
      : async () => {
          throw new Error(
            'Tools are required to start the agent. Initialize getClaudeAiService with tools first.',
          );
        },
    processResponse: hasTools
      ? processResponse(client, chatTools, model)
      : async () => {
          throw new Error(
            'Tools are required to process an agent response. Initialize getClaudeAiService with tools first.',
          );
        },
  };
};

const giveInfo =
  (client: OpenAI, tools: ChatCompletionTool[], modelOverride?: string) =>
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

    const createResponse = async (messages: ChatCompletionMessageParam[]) => {
      const response = await requestClaudeResponse(client, messages, tools, {
        modelOverride,
        reasoningEffort: 'high',
        hooks: {
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
      });
      firstTokenSeen = false;
      return response;
    };

    let messages = responseId
      ? [...(await loadConversationOrThrow(responseId)).messages]
      : [];
    messages.push({
      role: 'user',
      content: text,
    });

    let res = await createResponse(messages);

    while (true) {
      const toolCalls = getFunctionCalls(res);
      if (!toolCalls.length) {
        break;
      }
      const baseConfig = (await configService()).baseConfig();
      const maxFunctionOutputLength =
        baseConfig.maxFunctionOutputLength ?? DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH;
      const persisted = await loadConversationOrThrow(res.id);
      const toolResults = await executeToolCalls(
        toolCalls,
        maxFunctionOutputLength,
      );
      messages = [...persisted.messages, ...toolResults];
      res = await createResponse(messages);
    }

    if (!res.output?.length) {
      console.log(chalk.yellow('No output received from Claude.'));
    }
    return res;
  };

const writeTest =
  (client: OpenAI, modelOverride?: string) =>
  async (
    filePath: string,
    context: string,
    writePath: string,
    exampleTests: string,
    responseId?: string,
  ) => {
    const prompt = ` *Please write unit tests for the following TypeScript code using Jest. Cover:*

- *Normal cases*
- *Edge cases*
- *Error cases (invalid inputs, exceptions)*

*Please follow these instructions:*
- *Use fixtures from the .fixtures.ts files and mocks from the .mock.ts files. Match by looking at the type in the types folder*
- *Use the file paths listed to figure out relative imports. Test files should go next to the file it is testing. Files in the same directory should use ./ while if you need to go up a directory use ../*
- *If type doesn't match the arg type you are passing data into add "as any" to the end*
- *Do not add any comments in the test*
- *any fixture data you create should have a type*
- *do not require files in the tests code. import at the top*
- *Use the DBMock class when mocking the db and get the import path correct*
- *Should have 90 percent confidence test will run*

* look at these files for fixtures, types, mocks:*
${context}

* Example tests:*
${exampleTests ? exampleTests : 'none'}

*file to write test for:*
${filePath}

`;
    const followUpPrompt =
      'Now write tests for this file using the same instructions an the original prompt: ' +
      filePath;

    const messages = responseId
      ? [...(await loadConversationOrThrow(responseId)).messages]
      : [];
    messages.push({
      role: 'user',
      content: responseId ? followUpPrompt : prompt,
    });

    const response = await requestClaudeResponse(client, messages, [], {
      modelOverride,
      reasoningEffort: 'high',
    });
    const responseText = extractTextFromResponse(response);
    await writeResponseTextToFile(writePath, responseText);
    return response.id;
  };

const startAgent =
  (client: OpenAI, tools: ChatCompletionTool[], modelOverride?: string) =>
  async (prompt: string, id?: string) => {
    const messages = id
      ? [...(await loadConversationOrThrow(id)).messages]
      : [];
    messages.push({
      role: 'user',
      content: prompt,
    });
    return requestClaudeResponse(client, messages, tools, {
      modelOverride,
      reasoningEffort: 'medium',
    });
  };

const processResponse =
  (client: OpenAI, tools: ChatCompletionTool[], modelOverride?: string) =>
  async (res: AiResponse) => {
    try {
      const items = res.output || [];
      const shouldLogMessages = !Boolean(res.__streamed);
      console.log(
        chalk.greenBright(`Conversation continues (response id: ${res.id})`),
      );

      const baseConfig = (await configService()).baseConfig();
      const maxFunctionOutputLength =
        baseConfig.maxFunctionOutputLength ?? DEFAULT_MAX_FUNCTION_OUTPUT_LENGTH;
      const sorted = sortItems(items);
      const newMessages: ChatCompletionMessageParam[] = [];

      console.log(
        chalk.blue(`Processing ${sorted.length} response item(s)...`),
      );

      for (const item of sorted) {
        if (item.type === 'function_call') {
          console.log(chalk.cyan(`Calling tool "${item.name}"...`));
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
              newMessages.push({
                role: 'tool',
                tool_call_id: item.call_id,
                content: imageInputOutput,
              });
              newMessages.push({
                role: 'user',
                content: funcRes.map((image) => ({
                  type: 'image_url',
                  image_url: {
                    url: image.image_url,
                  },
                })),
              });
              continue;
            }
            const formattedOutput = serializeFunctionOutput(
              funcRes,
              maxFunctionOutputLength,
            );
            logToolOutput(item.name, formattedOutput);
            newMessages.push({
              role: 'tool',
              tool_call_id: item.call_id,
              content: formattedOutput,
            });
          } catch (error) {
            const errorMessage = formatErrorMessage(error);
            console.error(
              chalk.red(`Tool "${item.name}" failed: ${errorMessage}`),
            );
            newMessages.push({
              role: 'tool',
              tool_call_id: item.call_id,
              content: JSON.stringify({ error: errorMessage }),
            });
          }
        } else if (item.type === 'message' && shouldLogMessages) {
          item.content.forEach((content) => {
            if (content.type === 'output_text') {
              console.log(chalk.white(`Assistant: ${content.text}`));
            }
          });
        }
      }

      if (newMessages.length === 0) {
        console.log(
          chalk.yellow(
            'No assistant output received; asking for more input...',
          ),
        );
        const message = await promptForInput(JSON.stringify({ prompt: '>' }));
        newMessages.push({
          role: 'user',
          content: message.response,
        });
      }

      console.log(chalk.blue('Requesting next response from Claude...'));
      const persisted = await loadConversationOrThrow(res.id);
      return requestClaudeResponse(
        client,
        [...persisted.messages, ...newMessages],
        tools,
        {
          modelOverride,
          reasoningEffort: 'medium',
        },
      );
    } catch (error) {
      console.error(chalk.red('Failed to process response from Claude:'), error);
      throw error;
    }
  };

const requestClaudeResponse = async (
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  options: {
    modelOverride?: string;
    reasoningEffort: 'medium' | 'high';
    hooks?: Parameters<typeof streamChatCompletionWithRetry>[2];
  },
) => {
  const baseConfig = await getResolvedBaseConfig();
  const modelToUse = options.modelOverride ?? baseConfig.model;
  const completion = await streamChatCompletionWithRetry(
    client,
    {
      model: modelToUse,
      reasoning_effort: options.reasoningEffort,
      messages,
      ...(tools.length
        ? {
            tools,
            parallel_tool_calls: true,
          }
        : {}),
    },
    options.hooks,
  );

  const assistantMessage = toAssistantMessage(completion);
  await saveClaudeConversation(completion.id, {
    model: modelToUse,
    messages: [...messages, assistantMessage],
  });

  return mapChatCompletionToResponse(completion);
};

const buildChatCompletionTools = (tools?: Tool[]): ChatCompletionTool[] => {
  return (tools ?? [])
    .filter((tool): tool is Extract<Tool, { type: 'function' }> => {
      return tool.type === 'function';
    })
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        ...(tool.parameters ? { parameters: tool.parameters } : {}),
        ...(tool.strict === undefined || tool.strict === null
          ? {}
          : { strict: tool.strict }),
      },
    }));
};

const logUnsupportedTools = (tools?: Tool[]) => {
  const unsupportedTypes = Array.from(
    new Set(
      (tools ?? [])
        .filter((tool) => tool.type !== 'function')
        .map((tool) => tool.type),
    ),
  );

  if (!unsupportedTypes.length) {
    return;
  }

  console.log(
    chalk.yellow(
      `Claude mode ignores unsupported tool types: ${unsupportedTypes.join(', ')}.`,
    ),
  );
};

const toAssistantMessage = (
  completion: ChatCompletion,
): ChatCompletionAssistantMessageParam => {
  const assistant = completion.choices[0]?.message;
  if (!assistant) {
    throw new Error('Claude did not return an assistant message.');
  }

  const message: ChatCompletionAssistantMessageParam = {
    role: 'assistant',
  };

  if (assistant.content !== null) {
    message.content = assistant.content;
  }
  if (assistant.refusal !== null) {
    message.refusal = assistant.refusal;
  }
  if (assistant.tool_calls?.length) {
    message.tool_calls = assistant.tool_calls;
  }
  if (
    message.content === undefined &&
    message.refusal === undefined &&
    !message.tool_calls?.length
  ) {
    message.content = '';
  }

  return message;
};

const mapChatCompletionToResponse = (completion: ChatCompletion): AiResponse => {
  const assistant = completion.choices[0]?.message;
  if (!assistant) {
    throw new Error('Claude did not return an assistant message.');
  }

  const output: ResponseOutputItem[] = [];
  const messageContent: Array<ResponseOutputText | ResponseOutputRefusal> = [];

  if (assistant.content) {
    messageContent.push({
      type: 'output_text',
      text: assistant.content,
      annotations: [],
    });
  }

  if (assistant.refusal) {
    messageContent.push({
      type: 'refusal',
      refusal: assistant.refusal,
    });
  }

  if (messageContent.length) {
    output.push({
      id: `${completion.id}-message`,
      content: messageContent,
      role: 'assistant',
      status: 'completed',
      type: 'message',
    });
  }

  for (const toolCall of assistant.tool_calls ?? []) {
    if (toolCall.type !== 'function') {
      continue;
    }
    output.push({
      id: toolCall.id,
      call_id: toolCall.id,
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
      status: 'completed',
      type: 'function_call',
    });
  }

  return {
    __streamed: true,
    created_at: completion.created,
    error: null,
    id: completion.id,
    output,
    output_text: assistant.content ?? assistant.refusal ?? '',
    provider: 'anthropic',
  };
};

const getFunctionCalls = (response: AiResponse) =>
  (response.output ?? []).filter(
    (item): item is ResponseFunctionToolCall => item.type === 'function_call',
  );

const executeToolCalls = async (
  toolCalls: ResponseFunctionToolCall[],
  maxFunctionOutputLength: number,
) => {
  const toolResults: ChatCompletionMessageParam[] = [];

  for (const toolCall of toolCalls) {
    try {
      const fn = functionMap[toolCall.name as keyof typeof functionMap];
      if (!fn) {
        throw new Error(`Tool "${toolCall.name}" is not registered.`);
      }
      const output = await fn(toolCall.arguments);
      if (isImageInputToolOutput(output)) {
        const imageInputOutput = safeStringify({
          attached_image_inputs: output.length,
        });
        logToolOutput(toolCall.name, imageInputOutput);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.call_id,
          content: imageInputOutput,
        });
        toolResults.push({
          role: 'user',
          content: output.map((image) => ({
            type: 'image_url',
            image_url: {
              url: image.image_url,
            },
          })),
        });
        continue;
      }
      const serializedOutput = serializeFunctionOutput(
        output,
        maxFunctionOutputLength,
      );
      logToolOutput(toolCall.name, serializedOutput);
      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.call_id,
        content: serializedOutput,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      toolResults.push({
        role: 'tool',
        tool_call_id: toolCall.call_id,
        content: JSON.stringify({ error: message }),
      });
    }
  }

  return toolResults;
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

const loadConversationOrThrow = async (responseId: string) => {
  const conversation = await getClaudeConversation(responseId);
  if (!conversation) {
    throw new Error(
      `Claude conversation state for response "${responseId}" was not found. Start a new session if you recently switched providers.`,
    );
  }
  return conversation;
};

const sortItems = (items: ResponseOutputItem[]) => {
  const functionCalls = items.filter((i) => i.type === 'function_call');
  const messages = items.filter((i) => i.type === 'message');
  const remaining = items.filter(
    (i) => i.type !== 'function_call' && i.type !== 'message',
  );
  return [...remaining, ...messages, ...functionCalls];
};

const extractTextFromResponse = (response: AiResponse) => {
  for (const item of response.output ?? []) {
    if (item.type !== 'message') {
      continue;
    }
    return item.content
      .map((content) => {
        if (content.type === 'output_text') {
          return content.text;
        }
        if (content.type === 'refusal') {
          return content.refusal;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return response.output_text ?? '';
};

const writeResponseTextToFile = async (
  writePath: string,
  responseText: string,
) => {
  const root = process.cwd();
  const splitTs = responseText.split('```typescript');
  if (splitTs.length === 2) {
    const secondPart = splitTs[1].split('```')[0];
    if (secondPart) {
      await fse.writeFile(path.join(root, writePath), secondPart);
      return;
    }
  }
  const splitShortTs = responseText.split('```ts');
  if (splitShortTs.length === 2) {
    const secondPart = splitShortTs[1].split('```')[0];
    if (secondPart) {
      await fse.writeFile(path.join(root, writePath), secondPart);
      return;
    }
  }
  await fse.writeFile(path.join(root, writePath), responseText);
};
