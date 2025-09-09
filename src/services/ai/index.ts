import OpenAi from 'openai';
import { giveInfo } from './give-info';
import { writeTest } from './write-test';

let client: OpenAi | undefined;

export const getAiService = async () => {
  if (!client) {
    client = new OpenAi();
  }
  return {
    giveInfo: giveInfo(client),
    writeTest: writeTest(client),
  };
};
