import { FunctionTool } from 'openai/resources/responses/responses';
import { DeployRepoInput } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ALLOWED_ENVS = new Set(['dev', 'test', 'prod']);
const DEFAULT_UPIT_COMMAND = 'upit';
const quote = (value: string) => value.replaceAll('"', '\\"');

export const deployRepo = async (input: string) => {
  const data = JSON.parse(input) as DeployRepoInput;
  const workflowFileName = data.workflowFileName || 'launch.yml';
  const upitCommand = data.upitCommand || DEFAULT_UPIT_COMMAND;

  if (!ALLOWED_ENVS.has(data.deployEnv)) {
    return {
      success: false,
      message: 'Invalid deployEnv. Allowed values: dev, test, prod.',
    };
  }

  try {
    const upitExecCommand = `${upitCommand} "${quote(data.commitMessage)}"`;
    await execAsync(upitExecCommand, {
      cwd: data.pathToRepo,
      maxBuffer: 1024 * 1024 * 10,
    });

    const deployCommand = `gh workflow run ${workflowFileName} --field deployEnv=${data.deployEnv}`;
    const { stdout, stderr } = await execAsync(deployCommand, {
      cwd: data.pathToRepo,
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      success: true,
      upitCommand: upitExecCommand,
      deployCommand,
      output: stdout?.trim() ?? '',
      errorOutput: stderr?.trim() ?? '',
    };
  } catch (error: any) {
    return {
      success: false,
      message:
        error?.stderr?.toString().trim() ||
        error?.stdout?.toString().trim() ||
        error?.message ||
        'Unknown error running gh workflow.',
    };
  }
};

export const deployRepoTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'deploy-repo',
  description:
    'Trigger a GitHub Actions workflow dispatch to publish/deploy a repository environment.',
  parameters: {
    type: 'object',
    properties: {
      pathToRepo: {
        type: 'string',
        description: 'Absolute path to the repository.',
      },
      commitMessage: {
        type: 'string',
        description: 'Commit message passed to upit before triggering deployment.',
      },
      deployEnv: {
        type: 'string',
        enum: ['dev', 'test', 'prod'],
        description: 'Deployment environment: dev, test, or prod.',
      },
      upitCommand: {
        type: ['string', 'null'],
        description:
          'Optional command used for commit/push before deployment (default: "upit").',
      },
      workflowFileName: {
        type: ['string', 'null'],
        description:
          'Workflow file name to run (default: launch.yml), e.g. deploy.yml.',
      },
    },
    required: [
      'pathToRepo',
      'commitMessage',
      'deployEnv',
      'upitCommand',
      'workflowFileName',
    ],
    additionalProperties: false,
  },
};
