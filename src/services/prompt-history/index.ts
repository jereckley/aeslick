import * as fse from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type PromptHistoryKey = 'chat' | 'component-new';

type PromptHistoryState = Record<PromptHistoryKey, string[]>;

const HISTORY_FILE = '.aeslick.prompt-history.json';
const MAX_HISTORY = 200;

const defaultState = (): PromptHistoryState => ({
  chat: [],
  'component-new': [],
});

const getHistoryFilePath = () => path.join(process.cwd(), HISTORY_FILE);

const readState = async (): Promise<PromptHistoryState> => {
  const filePath = getHistoryFilePath();
  try {
    const exists = await fse.pathExists(filePath);
    if (!exists) {
      return defaultState();
    }
    const parsed = (await fse.readJson(filePath)) as Partial<PromptHistoryState>;
    return {
      chat: Array.isArray(parsed.chat) ? parsed.chat.filter(Boolean) : [],
      'component-new': Array.isArray(parsed['component-new'])
        ? parsed['component-new'].filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error(chalk.red('Failed to read prompt history:'), error);
    return defaultState();
  }
};

export const getPromptHistory = async (key: PromptHistoryKey) => {
  const state = await readState();
  return state[key];
};

export const appendPromptHistory = async (
  key: PromptHistoryKey,
  entries: string | string[],
) => {
  const list = (Array.isArray(entries) ? entries : [entries])
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!list.length) {
    return;
  }

  const state = await readState();
  const updated = [...state[key]];

  for (const entry of list) {
    const existingIndex = updated.indexOf(entry);
    if (existingIndex >= 0) {
      updated.splice(existingIndex, 1);
    }
    updated.unshift(entry);
  }

  state[key] = updated.slice(0, MAX_HISTORY);

  try {
    await fse.writeJson(getHistoryFilePath(), state, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to write prompt history:'), error);
  }
};
