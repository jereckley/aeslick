import { FunctionTool } from 'openai/resources/responses/responses';
import { PublishRepoInput } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ALLOWED_ENVS = new Set(['dev', 'test', 'prod']);

export const publishRepo = async (input: string) => {
  const data = JSON.parse(input) as PublishRepoInput;
  const workflowFileName = data.workflowFileName || 'launch.yml';

  if (!ALLOWED_ENVS.has(data.deployEnv)) {
    return {
      success: false,
      message: 'Invalid deployEnv. Allowed values: dev, test, prod.',
    };
  }

  try {
    const command = `gh workflow run ${workflowFileName} --field deployEnv=${data.deployEnv}`;
    const { stdout, stderr } = await execAsync(command, {
      cwd: data.pathToRepo,
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      success: true,
      command,
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

export const publishRepoTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'publish-repo',
  description:
    'Trigger a GitHub Actions workflow dispatch to publish/deploy a repository environment.',
  parameters: {
    type: 'object',
    properties: {
      pathToRepo: {
        type: 'string',
        description: 'Absolute path to the repository.',
      },
      deployEnv: {
        type: 'string',
        enum: ['dev', 'test', 'prod'],
        description: 'Deployment environment: dev, test, or prod.',
      },
      workflowFileName: {
        type: 'string',
        description:
          'Workflow file name to run (default: launch.yml), e.g. deploy.yml.',
      },
    },
    required: ['pathToRepo', 'deployEnv'],
    additionalProperties: false,
  },
};
