import * as readline from 'readline/promises';
import chalk from 'chalk';
import {
  appendPromptHistory,
  getPromptHistory,
  PromptHistoryKey,
} from '../prompt-history';

type MultilinePromptOptions = {
  historyKey?: PromptHistoryKey;
  prompt?: string;
  submitCommand?: string;
  promptPrefix?: string;
  continuedPromptPrefix?: string;
};

const DEFAULT_SUBMIT_COMMAND = '/send';

export const promptForMultilineInput = async ({
  historyKey,
  prompt,
  submitCommand = DEFAULT_SUBMIT_COMMAND,
  promptPrefix = '> ',
  continuedPromptPrefix = '... ',
}: MultilinePromptOptions = {}) => {
  const history = historyKey ? await getPromptHistory(historyKey) : [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200,
  });

  if (history.length) {
    (rl as unknown as { history: string[] }).history = [...history];
  }

  if (prompt?.trim()) {
    console.log(chalk.gray(prompt));
  }
  console.log(
    chalk.gray(
      `Enter text (multi-line). Type ${submitCommand} on its own line to submit.`,
    ),
  );

  const lines: string[] = [];
  process.stdout.write(promptPrefix);

  return await new Promise<string>((resolve) => {
    const finalize = async (value: string) => {
      rl.close();
      if (historyKey && value.trim()) {
        await appendPromptHistory(historyKey, value);
      }
      resolve(value);
    };

    rl.on('line', (line) => {
      if (line.trim() === submitCommand) {
        void finalize(lines.join('\n'));
        return;
      }

      lines.push(line);
      process.stdout.write(continuedPromptPrefix);
    });
  });
};
