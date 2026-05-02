import chalk from 'chalk';
import { engine } from './engine';
import * as readline from 'readline/promises';
import {
  appendPromptHistory,
  getPromptHistory,
} from '../../services/prompt-history';
import {
  clearComponentSessionState,
  getLastComponentResponseId,
} from '../../services/component-session';

export type CreateComponentAnswers = {
  componentDescription?: string;
  previousResponseId?: string;
};
export const createComponent = async (answers: CreateComponentAnswers) => {
  let previousResponseId = answers.previousResponseId;
  if (!previousResponseId) {
    previousResponseId = await getLastComponentResponseId();
  }

  if (previousResponseId) {
    console.log(
      chalk.cyan(
        `Session status: previous run found (response id: ${previousResponseId}).`,
      ),
    );
    console.log(
      chalk.gray('Press Enter to resume, or type /new for a fresh run.'),
    );
  } else {
    console.log(chalk.cyan('Session status: no previous run found.'));
    console.log(chalk.gray('A fresh component session will be started.'));
  }

  const input =
    answers.componentDescription ??
    (await promptForComponentDescription(Boolean(previousResponseId)));

  let componentDescription = input;
  if (input.trim() === '/new') {
    await clearComponentSessionState();
    previousResponseId = undefined;
    componentDescription = await promptForComponentDescription(false);
  } else if (!input.trim() && previousResponseId) {
    componentDescription = undefined;
  }

  if (!previousResponseId && !componentDescription?.trim()) {
    console.log(chalk.yellow('Component description is required.'));
    return;
  }
  if (previousResponseId && !componentDescription?.trim()) {
    console.log(
      chalk.cyan(`Resuming previous component session: ${previousResponseId}`),
    );
  } else if (previousResponseId) {
    console.log(
      chalk.cyan(
        `Continuing existing session ${previousResponseId} with a new prompt.`,
      ),
    );
  } else {
    console.log(chalk.cyan('Starting a fresh component session.'));
  }
  console.log(chalk.green('Creating component...'));
  try {
    await engine({ componentDescription, previousResponseId });
  } catch (e) {
    console.log(chalk.red('Error creating component:', e));
    return;
  }
  console.log(chalk.green('Component created!'));
};

const promptForComponentDescription = async (hasResumeOption = false) => {
  const history = await getPromptHistory('component-new');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200,
  });
  (rl as unknown as { history: string[] }).history = [...history];

  if (hasResumeOption) {
    console.log(
      chalk.gray(
        'Enter component request (multi-line). Type /send on its own line to submit.',
      ),
    );
    console.log(
      chalk.gray('Press Enter on an empty prompt to resume the previous run.'),
    );
    console.log(chalk.gray('Type /new on an empty prompt to start fresh.'));
  } else {
    console.log(
      chalk.gray(
        'Enter component request (multi-line). Type /send on its own line to submit.',
      ),
    );
  }

  const lines: string[] = [];
  process.stdout.write('> ');

  return await new Promise<string>((resolve) => {
    const finalize = async (value: string) => {
      rl.close();
      if (value.trim() && value.trim() !== '/new') {
        await appendPromptHistory('component-new', value);
      }
      resolve(value);
    };

    rl.on('line', (line) => {
      const normalized = line.trim();

      if (!lines.length && !normalized && hasResumeOption) {
        void finalize('');
        return;
      }
      if (!lines.length && normalized === '/new') {
        void finalize('/new');
        return;
      }
      if (normalized === '/send') {
        void finalize(lines.join('\n'));
        return;
      }

      lines.push(line);
      process.stdout.write('... ');
    });
  });
};
