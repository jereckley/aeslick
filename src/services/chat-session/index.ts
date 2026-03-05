import * as fse from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

const CHAT_SESSION_FILE = '.aeslick.chat.session.json';

type ChatSessionState = {
  lastResponseId?: string;
  updatedAt?: string;
};

const getSessionFilePath = () => path.join(process.cwd(), CHAT_SESSION_FILE);

const readSessionState = async (): Promise<ChatSessionState | undefined> => {
  const filePath = getSessionFilePath();
  try {
    const exists = await fse.pathExists(filePath);
    if (!exists) {
      return undefined;
    }
    const content = await fse.readFile(filePath, 'utf-8');
    if (!content.trim()) {
      return undefined;
    }
    return JSON.parse(content) as ChatSessionState;
  } catch (error) {
    console.error(chalk.red('Failed to read chat session state:'), error);
    return undefined;
  }
};

export const getLastChatResponseId = async () => {
  const state = await readSessionState();
  return state?.lastResponseId;
};

export const saveLastChatResponseId = async (responseId: string) => {
  const filePath = getSessionFilePath();
  const state: ChatSessionState = {
    lastResponseId: responseId,
    updatedAt: new Date().toISOString(),
  };
  try {
    await fse.writeJson(filePath, state, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to save chat session state:'), error);
  }
};

export const clearChatSessionState = async () => {
  const filePath = getSessionFilePath();
  try {
    const exists = await fse.pathExists(filePath);
    if (exists) {
      await fse.remove(filePath);
    }
  } catch (error) {
    console.error(chalk.red('Failed to clear chat session state:'), error);
  }
};
