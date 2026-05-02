import { readFiles } from './read-files';
import inquirer = require('inquirer');
import { CHAT_CONVERSATION } from '../../questions';
import { getAiService } from '../../services/ai';
import chalk from 'chalk';
import { fileList } from './file-list';
import { filesNeeded } from './files-that-need-tests';

export type TestsAnswers = {
  pathToFolder: string;
  pathToRelevantTypes?: string;
  exampleTests?: string;
};
const root = process.cwd();
export const tests = async (answers: TestsAnswers) => {
  const rt = answers.pathToRelevantTypes;
  const searchPath = answers.pathToFolder.split('/').slice(0, -1).join('/');
  let context = [
    `./${answers.pathToFolder}/**/*.ts`,
    `./${searchPath}/**/*.types.ts`,
    `./${searchPath}/**/*.fixture.ts`,
    `./**/*.mock.ts`,
    ...(rt ? rt.split(',').map((file) => file) : []),
  ]
    .map((glob) => readFiles(glob))
    .join('\n');

  const et = answers.exampleTests;
  let exampleTests = (
    et ? [...(et ? et.split(',').map((file) => file) : [])] : []
  )
    .map((glob) => readFiles(glob))
    .join('\n');
  //console.log(context)
  const fileNames = fileList(`./src/**/*.ts`);
  context += fileNames;

  const files = filesNeeded(`./${answers.pathToFolder}/**/*.ts`);
  console.log(files);
  let responseId: undefined | string;
  const service = await getAiService();
  for (const file of files) {
    const prep = file.replace('.ts', '');
    const writePath = prep + '.test.ts';
    responseId = await service.writeTest(
      file,
      context,
      writePath,
      exampleTests,
      responseId,
    );
  }
};

const keepAsking = async (responseId: string) => {
  const answers = await inquirer.prompt(CHAT_CONVERSATION);
  const response = await (
    await getAiService()
  ).giveInfo(answers.prompt, responseId);
  if (answers.prompt === 'exit') {
    console.log(chalk.bgMagentaBright('Exiting chat...'));
    return;
  }
  keepAsking(response.id);
};
