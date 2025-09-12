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
  if (!toolsCache) {
    throw new Error('Tools are required for the first initialization');
  }
  return {
    giveInfo: giveInfo(client),
    writeTest: writeTest(client),
    startAgent: startAgent(client, toolsCache),
    processResponse: processResponse(client, toolsCache),
  };
};
