import { Questions } from 'inquirer';

export const CHAT_QUESTIONS: Questions = [
  {
    type: 'input',
    name: 'prompt',
    message: 'Yes?',
  },
];
export const CHAT_CONVERSATION: Questions = [
  {
    type: 'input',
    name: 'prompt',
    message: '>',
  },
];

export const WRITE_TEST: Questions = [
  {
    type: 'input',
    name: 'pathToFolder',
    message: 'Path to folder that needs tests:',
  },
  {
    type: 'input',
    name: 'pathToRelevantTypes',
    message: 'Path to relevant types not in the folder (separated by a comma):',
  },
  {
    type: 'input',
    name: 'exampleTests',
    message: 'Global example tests (separated by a comma):',
  },
];

export const CREATE_COMPONENT: Questions = [
  {
    type: 'input',
    name: 'componentDescription',
    message: 'Let\'s get started: ',
  },
];

export const CREATE_PROJECT_CONFIG: Questions = [
  {
    type: 'input',
    name: 'configFileName',
    message: 'Project config file name (without extension):',
  },
  {
    type: 'input',
    name: 'projectName',
    message: 'Project name:',
  },
  {
    type: 'input',
    name: 'projectPath',
    message: 'Path to the project root:',
  },
  {
    type: 'input',
    name: 'framework',
    message: 'Framework:',
  },
  {
    type: 'input',
    name: 'generatedCodegenTypesPath',
    message: 'Path to generated codegen types:',
  },
  {
    type: 'input',
    name: 'developerConcerns',
    message: 'Developer concerns (comma separated):',
  },
];
