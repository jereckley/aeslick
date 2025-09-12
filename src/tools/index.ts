import { getConfigByName, getConfigByNameTool } from './get-config-by-name';
import { promptForInput, promptForInputTool } from './prompt-for-input';
import { writeFile, writeFileTool } from './write-files';

export const functionMap = {
  'write-file': writeFile,
  'get-config-by-name': getConfigByName,
  'prompt-for-input': promptForInput,
};

export const functionDefinitionsMap = {
  'write-file': writeFileTool,
  'get-config-by-name': getConfigByNameTool,
  'prompt-for-input': promptForInputTool,
};
