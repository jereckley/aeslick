import { getAiService } from '../../services/ai';
import chalk from 'chalk';
import * as readline from 'readline/promises';
import {
  clearChatSessionState,
  getLastChatResponseId,
  saveLastChatResponseId,
} from '../../services/chat-session';
import { functionDefinitionsMap } from '../../tools';

export type ChatAnswers = {
  prompt?: string;
};
export const chat = async (arg: ChatAnswers) => {
  const service = await getAiService([functionDefinitionsMap['write-file']]);
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
    const responseIdNext = await service.giveInfo(
      prompt,
      activeResponseId,
    );
    await saveLastChatResponseId(responseIdNext);
    activeResponseId = responseIdNext;
  }
};

const promptForMultiline = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log(chalk.gray('Enter message (multi-line). Type /send on its own line to submit.'));
  console.log(chalk.gray('Type /exit on an empty prompt to quit.'));
  console.log(chalk.gray('Type /new on an empty prompt to start a new thread.'));

  const lines: string[] = [];
  process.stdout.write('> ');
  return await new Promise<string>((resolve) => {
    rl.on('line', (line) => {
      const normalized = line.trim();
      if (!lines.length && normalized === '/exit') {
        rl.close();
        resolve('exit');
        return;
      }
      if (!lines.length && normalized === '/new') {
        rl.close();
        resolve('new');
        return;
      }
      if (normalized === '/send') {
        rl.close();
        resolve(lines.join('\n'));
        return;
      }
      lines.push(line);
      process.stdout.write('... ');
    });
  });
};
