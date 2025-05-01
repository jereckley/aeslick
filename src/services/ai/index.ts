import OpenAi from 'openai';
import { giveInfo } from './give-info';
import { writeTest } from './write-test';
export const getAiService = async () => {
  const client = new OpenAi();
  return {
    giveInfo: giveInfo(client),
    writeTest: writeTest(client),
  };
};
