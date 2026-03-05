import OpenAi from 'openai';
import { giveInfo } from './give-info';
import { writeTest } from './write-test';
import { startAgent } from './start-agent';
import { Tool } from 'openai/resources/responses/responses';
import { processResponse } from './process-response';

let client: OpenAi | undefined;
let toolsCache: Tool[] | undefined;

export const getAiService = async (tools?: Tool[]) => {
  if (!client) {
    client = new OpenAi();
  }
  if (!!tools) {
    toolsCache = tools;
  }
  return {
    giveInfo: giveInfo(client, toolsCache),
    writeTest: writeTest(client),
    startAgent: toolsCache
      ? startAgent(client, toolsCache)
      : async () => {
          throw new Error(
            'Tools are required to start the agent. Initialize getAiService with tools first.',
          );
        },
    processResponse: toolsCache
      ? processResponse(client, toolsCache)
      : async () => {
          throw new Error(
            'Tools are required to process an agent response. Initialize getAiService with tools first.',
          );
        },
  };
};
