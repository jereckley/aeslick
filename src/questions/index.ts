import { Questions } from 'inquirer';
import { DEFAULT_MODEL } from '../services/config';

export const CHAT_QUESTIONS: Questions = [
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
    name: 'projectName',
    message: 'Project Name:',
  },
  {
    type: 'input',
    name: 'repoName',
    message: 'First repo name:',
  },
  {
    type: 'input',
    name: 'projectPath',
    message: 'First repo path:',
  },
  {
    type: 'input',
    name: 'framework',
    message: 'First repo framework:',
  },
  {
    type: 'input',
    name: 'generatedCodegenTypesPath',
    message: 'First repos path to generated codegen types if relevant:',
  },
  {
    type: 'input',
    name: 'developerConcerns',
    message: 'First repos developer concerns (comma separated):',
  },
];

export const CREATE_BASE_CONFIG: Questions = [
  {
    type: 'input',
    name: 'model',
    message: 'Default model to use:',
    default: DEFAULT_MODEL,
  },
];
