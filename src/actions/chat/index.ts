import inquirer = require('inquirer');
import { getAiService } from '../../services/ai';
import { CHAT_CONVERSATION } from '../../questions';
import chalk from 'chalk';

export type ChatAnswers = {
  prompt: string;
};
export const chat = async (arg: ChatAnswers) => {
  const responseId = await (await getAiService()).giveInfo(arg.prompt);
  keepAsking(responseId);
};

const keepAsking = async (responseId: string) => {
  const answers = await inquirer.prompt(CHAT_CONVERSATION);
  const responseIdNext = await (await getAiService()).giveInfo(answers.prompt, responseId);
  if(answers.prompt === 'exit') {
    console.log(chalk.bgMagentaBright('Exiting chat...'));
    return;
  }
  keepAsking(responseIdNext);
};
