import * as fse from 'fs-extra';
import * as path from 'path';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions/completions';

const CLAUDE_CONVERSATION_FILE = '.aeslick.claude.conversations.json';

type ClaudeConversationState = {
  model: string;
  messages: ChatCompletionMessageParam[];
  updatedAt: string;
};

type ClaudeConversationStore = Record<string, ClaudeConversationState>;

const getStorePath = () => path.join(process.cwd(), CLAUDE_CONVERSATION_FILE);

const readStore = async (): Promise<ClaudeConversationStore> => {
  const storePath = getStorePath();
  const exists = await fse.pathExists(storePath);
  if (!exists) {
    return {};
  }
  const content = await fse.readFile(storePath, 'utf-8');
  if (!content.trim()) {
    return {};
  }
  return JSON.parse(content) as ClaudeConversationStore;
};

const writeStore = async (store: ClaudeConversationStore) => {
  await fse.writeJson(getStorePath(), store, { spaces: 2 });
};

export const getClaudeConversation = async (responseId: string) => {
  const store = await readStore();
  return store[responseId];
};

export const saveClaudeConversation = async (
  responseId: string,
  state: Omit<ClaudeConversationState, 'updatedAt'>,
) => {
  const store = await readStore();
  store[responseId] = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
};
