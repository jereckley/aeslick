import { getAiService } from '../../services/ai';
import chalk from 'chalk';
import * as readline from 'readline/promises';
import {
  clearChatSessionState,
  getLastChatResponseId,
  saveLastChatResponseId,
} from '../../services/chat-session';
import {
  appendPromptHistory,
  getPromptHistory,
} from '../../services/prompt-history';
import { isRestartableResponse } from '../../services/ai/is-restartable-response';
import { configService } from '../../services/config';
import {
  CHAT_COMMAND_CONFIG_KEY,
  getModelForCommand,
  getToolsForCommand,
} from '../../services/config/command-settings';

export type ChatAnswers = {
  prompt?: string;
};
export const chat = async (arg: ChatAnswers) => {
  const configSvc = await configService();
  const baseConfig = configSvc.baseConfig();
  const service = await getAiService({
    model: getModelForCommand(baseConfig, CHAT_COMMAND_CONFIG_KEY),
    tools: getToolsForCommand(baseConfig, CHAT_COMMAND_CONFIG_KEY),
  });
  let activeResponseId = await getLastChatResponseId();

  if (activeResponseId) {
    console.log(
      chalk.gray(
        'Resuming previous chat thread. Type /new to start a fresh thread.',
      ),
    );
  }

  let seededPrompt = arg.prompt;
  while (true) {
    const prompt = seededPrompt ?? (await promptForMultiline());
    seededPrompt = undefined;

    if (prompt === 'exit') {
      console.log(chalk.bgMagentaBright('Exiting chat...'));
      return;
    }
    if (prompt === 'new') {
      await clearChatSessionState();
      activeResponseId = undefined;
      console.log(chalk.bgBlueBright('Started a fresh chat thread.'));
      continue;
    }
    if (!prompt.trim()) {
      console.log(chalk.yellow('Message was empty. Add text and send again.'));
      continue;
    }
    const response = await service.giveInfo(
      prompt,
      activeResponseId,
    );
    activeResponseId = response.id;
    if (isRestartableResponse(response)) {
      await saveLastChatResponseId(response.id);
    }
  }
};

const promptForMultiline = async () => {
  const history = await getPromptHistory('chat');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200,
  });
  (rl as unknown as { history: string[] }).history = [...history];
  console.log(chalk.gray('Enter message (multi-line). Type /send on its own line to submit.'));
  console.log(chalk.gray('Type /exit on an empty prompt to quit.'));
  console.log(chalk.gray('Type /new on an empty prompt to start a new thread.'));

  const lines: string[] = [];
  process.stdout.write('> ');
  return await new Promise<string>((resolve) => {
    const finalize = async (value: string, entriesToSave?: string[]) => {
      rl.close();
      if (entriesToSave?.length) {
        await appendPromptHistory('chat', entriesToSave);
      }
      resolve(value);
    };

    rl.on('line', (line) => {
      const normalized = line.trim();
      if (!lines.length && normalized === '/exit') {
        void finalize('exit');
        return;
      }
      if (!lines.length && normalized === '/new') {
        void finalize('new');
        return;
      }
      if (normalized === '/send') {
        void finalize(lines.join('\n'), lines);
        return;
      }
      lines.push(line);
      process.stdout.write('... ');
    });
  });
};
