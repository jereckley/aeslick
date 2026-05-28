import OpenAi from 'openai';
import { giveInfo } from './give-info';
import { writeTest } from './write-test';
import { startAgent } from './start-agent';
import { processResponse } from './process-response';
import { AiService, AiServiceOptions } from './types';

let client: OpenAi | undefined;

export const getOpenAiService = async (
  options?: AiServiceOptions,
): Promise<AiService> => {
  if (!client) {
    client = new OpenAi();
  }
  const tools = options?.tools;
  const hasTools = Array.isArray(tools);
  const model = options?.model;

  return {
    giveInfo: giveInfo(client, tools, model),
    writeTest: writeTest(client, model),
    startAgent: hasTools
      ? startAgent(client, tools, model)
      : async () => {
          throw new Error(
            'Tools are required to start the agent. Initialize getOpenAiService with tools first.',
          );
        },
    processResponse: hasTools
      ? async (res) => processResponse(client!, tools, model)(res as any)
      : async () => {
          throw new Error(
            'Tools are required to process an agent response. Initialize getOpenAiService with tools first.',
          );
        },
  };
};
