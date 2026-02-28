import { getConfigByName, getConfigByNameTool } from './get-config-by-name';
import { getFileByPath, getFileByPathTool } from './get-file-by-path';
import { getImageByPath, getImageByPathTool } from './get-image-by-path';
import {
  getListOfFilesInPath,
  getListOfFilesInPathTool,
} from './get-list-of-files-in-path';
import { promptForInput, promptForInputTool } from './prompt-for-input';
import {
  publishLibraryAndWait,
  publishLibraryAndWaitTool,
} from './publish-library-and-wait';
import { deployRepo, deployRepoTool } from './deploy-repo';
import { runNpmCommand, runNpmCommandTool } from './run-npm-command';
import { writeFile, writeFileTool } from './write-files';

export const functionMap = {
  'write-file': writeFile,
  'get-config-by-name': getConfigByName,
  'prompt-for-input': promptForInput,
  'get-list-of-files-in-path': getListOfFilesInPath,
  'get-file-by-path': getFileByPath,
  'get-image-by-path': getImageByPath,
  'run-npm-command': runNpmCommand,
  'publish-library-and-wait': publishLibraryAndWait,
  'deploy-repo': deployRepo,
};

export const functionDefinitionsMap = {
  'write-file': writeFileTool,
  'get-config-by-name': getConfigByNameTool,
  'prompt-for-input': promptForInputTool,
  'get-list-of-files-in-path': getListOfFilesInPathTool,
  'get-file-by-path': getFileByPathTool,
  'get-image-by-path': getImageByPathTool,
  'run-npm-command': runNpmCommandTool,
  'publish-library-and-wait': publishLibraryAndWaitTool,
  'deploy-repo': deployRepoTool,
};
