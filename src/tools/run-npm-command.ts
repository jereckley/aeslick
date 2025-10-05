import { FunctionTool } from 'openai/resources/responses/responses';
import { RunNpmCommandInput } from './types';
import { exec } from 'child_process';

export const runNpmCommand = async (input: string) => {
  const data = JSON.parse(input) as RunNpmCommandInput;
  let errorMessage = '';
  let successMessage = '';
  exec(`cd ${data.pathToRepo}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
  exec(`npm run ${data.command}`, (error, stdout, stderr) => {
    if (error) {
      errorMessage = `exec error: ${error}`;
      return;
    }
    successMessage = `stdout: ${stdout}`;
    errorMessage = `stderr: ${stderr}`;
  });
  exec(`cd ..`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
  return { successMessage, errorMessage };
};

export const runNpmCommandTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'run-npm-command',
  description: 'Run an npm command in a specified repository path.',
  parameters: {
    type: 'object',
    properties: {
      pathToRepo: {
        type: 'string',
        description: 'The file path to the repository where the npm command should be run. The path found in the config.',
      },
      command: {
        type: 'string',
        description: 'The npm command to run (e.g., "install", "test", "build"). Read repos package.json scripts to see available commands.',
      },
    },
    required: ['pathToRepo', 'command'],
    additionalProperties: false,
  },
};
