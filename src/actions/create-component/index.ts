import chalk from 'chalk';
import { engine } from './engine';

export type CreateComponentAnswers = {};
export const createComponent = async (answers: CreateComponentAnswers) => {
  console.log(chalk.green('Creating component...'));
  try {
    await engine();
  } catch (e) {
    console.log(chalk.red('Error creating component:', e));
    return;
  }
  console.log(chalk.green('Component created!'));
};
