import { FunctionTool } from 'openai/resources/responses/responses';
import { RunNpmCommandInput } from './types';
import { requireConfiguredRepoPath } from '../services/security/tool-access';
import { requireSafeScriptName, runCommand } from './command-utils';

export const runNpmCommand = async (input: string) => {
  const data = JSON.parse(input) as RunNpmCommandInput;

  try {
    const repoPath = await requireConfiguredRepoPath(data.pathToRepo);
    const scriptName = requireSafeScriptName(data.command);
    const { stdout, stderr } = await runCommand(
      'npm',
      ['run', scriptName],
      repoPath,
    );

    return {
      successMessage: stdout?.trim() ?? '',
      errorMessage: stderr?.trim() ?? '',
    };
  } catch (error: any) {
    // Bubble up stderr/stdout from the failed command so callers can show real errors.
    return {
      successMessage: error?.stdout?.toString().trim() ?? '',
      errorMessage: error?.stderr?.toString().trim() || error?.message || 'Unknown error',
    };
  }
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
        description: 'The npm command to run (e.g., "install", "test", "build"). Read repos package.json scripts to see available commands. Do not update package.json, only run existing scripts.',
      },
    },
    required: ['pathToRepo', 'command'],
    additionalProperties: false,
  },
};
