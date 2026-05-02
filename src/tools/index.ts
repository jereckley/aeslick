import { getConfigByName, getConfigByNameTool } from './get-config-by-name';
import { getFileByPath, getFileByPathTool } from './get-file-by-path';
import { getImageByPath, getImageByPathTool } from './get-image-by-path';
import {
  getImageInputsByFileNames,
  getImageInputsByFileNamesTool,
} from './get-image-inputs-by-file-names';
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
import { inspectWebpage, inspectWebpageTool } from './inspect-webpage';
import {
  chromeHeadlessBrowser,
  chromeHeadlessBrowserTool,
} from './chrome-headless-browser';

export const functionMap = {
  'write-file': writeFile,
  'get-config-by-name': getConfigByName,
  'prompt-for-input': promptForInput,
  'get-list-of-files-in-path': getListOfFilesInPath,
  'get-file-by-path': getFileByPath,
  'get-image-by-path': getImageByPath,
  'get-image-inputs-by-file-names': getImageInputsByFileNames,
  'run-npm-command': runNpmCommand,
  'publish-library-and-wait': publishLibraryAndWait,
  'deploy-repo': deployRepo,
  'inspect-webpage': inspectWebpage,
  'chrome-headless-browser': chromeHeadlessBrowser,
};

export const functionDefinitionsMap = {
  'write-file': writeFileTool,
  'get-config-by-name': getConfigByNameTool,
  'prompt-for-input': promptForInputTool,
  'get-list-of-files-in-path': getListOfFilesInPathTool,
  'get-file-by-path': getFileByPathTool,
  'get-image-by-path': getImageByPathTool,
  'get-image-inputs-by-file-names': getImageInputsByFileNamesTool,
  'run-npm-command': runNpmCommandTool,
  'publish-library-and-wait': publishLibraryAndWaitTool,
  'deploy-repo': deployRepoTool,
  'inspect-webpage': inspectWebpageTool,
  'chrome-headless-browser': chromeHeadlessBrowserTool,
};
