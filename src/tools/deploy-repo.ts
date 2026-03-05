import { FunctionTool } from 'openai/resources/responses/responses';
import { DeployRepoInput } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ALLOWED_ENVS = new Set(['dev', 'test', 'prod']);
const quote = (value: string) => value.replaceAll('"', '\\"');
const runCommand = async (command: string, cwd: string) => {
  return execAsync(command, {
    cwd,
    maxBuffer: 1024 * 1024 * 10,
  });
};

export const deployRepo = async (input: string) => {
  const data = JSON.parse(input) as DeployRepoInput;
  const workflowFileName = data.workflowFileName || 'launch.yml';
  const logs: string[] = [];

  if (!ALLOWED_ENVS.has(data.deployEnv)) {
    return {
      success: false,
      message: 'Invalid deployEnv. Allowed values: dev, test, prod.',
    };
  }

  try {
    const { stdout: currentBranchRaw } = await runCommand(
      'git rev-parse --abbrev-ref HEAD',
      data.pathToRepo,
    );
    const branch = currentBranchRaw.trim();
    logs.push(`[deploy-repo] Current branch detected: ${branch}`);

    const { stdout: statusRaw } = await runCommand(
      'git status --porcelain',
      data.pathToRepo,
    );
    const hasChanges = statusRaw.trim().length > 0;
    logs.push(
      `[deploy-repo] Pre-deploy status: ${hasChanges ? 'changes detected' : 'no changes, creating empty commit'}.`,
    );

    const gitCommands = {
      add: 'git add -A',
      commit: hasChanges
        ? `git commit -m "${quote(data.commitMessage)}"`
        : `git commit --allow-empty -m "${quote(data.commitMessage)}"`,
      push: `git push origin ${branch}`,
    };

    if (hasChanges) {
      logs.push(`[deploy-repo] Running pre-deploy command: ${gitCommands.add}`);
      await runCommand(gitCommands.add, data.pathToRepo);
    }

    logs.push(`[deploy-repo] Running pre-deploy command: ${gitCommands.commit}`);
    await runCommand(gitCommands.commit, data.pathToRepo);
    logs.push('[deploy-repo] Commit step completed.');

    logs.push(`[deploy-repo] Running pre-deploy command: ${gitCommands.push}`);
    const { stdout: pushStdout, stderr: pushStderr } = await runCommand(
      gitCommands.push,
      data.pathToRepo,
    );
    logs.push('[deploy-repo] Push step completed.');
    if ((pushStdout || '').trim()) {
      logs.push(`[deploy-repo] git push stdout: ${pushStdout.trim()}`);
    }
    if ((pushStderr || '').trim()) {
      logs.push(`[deploy-repo] git push stderr: ${pushStderr.trim()}`);
    }

    const deployCommand = `gh workflow run ${workflowFileName} --field deployEnv=${data.deployEnv}`;
    logs.push(`[deploy-repo] Triggering workflow: ${deployCommand}`);
    const { stdout, stderr } = await runCommand(deployCommand, data.pathToRepo);
    logs.push('[deploy-repo] Workflow dispatch command completed.');

    return {
      success: true,
      preDeployCommands: gitCommands,
      deployCommand,
      output: stdout?.trim() ?? '',
      errorOutput: stderr?.trim() ?? '',
      logs,
    };
  } catch (error: any) {
    logs.push('[deploy-repo] Failed while running git pre-deploy commands or dispatching workflow.');
    if (error?.cmd) {
      logs.push(`[deploy-repo] Failed command: ${error.cmd}`);
    }
    if (error?.stdout?.toString().trim()) {
      logs.push(`[deploy-repo] error stdout: ${error.stdout.toString().trim()}`);
    }
    if (error?.stderr?.toString().trim()) {
      logs.push(`[deploy-repo] error stderr: ${error.stderr.toString().trim()}`);
    }
    return {
      success: false,
      message:
        error?.stderr?.toString().trim() ||
        error?.stdout?.toString().trim() ||
        error?.message ||
        'Unknown error running gh workflow.',
      logs,
    };
  }
};

export const deployRepoTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'deploy-repo',
  description:
    'Trigger a GitHub Actions workflow dispatch to deploy a repository environment. This command will push the changes for the current branch to github before deploying',
  parameters: {
    type: 'object',
    properties: {
      pathToRepo: {
        type: 'string',
        description: 'Absolute path to the repository.',
      },
      commitMessage: {
        type: 'string',
        description: 'Commit message used before pushing and triggering deployment.',
      },
      deployEnv: {
        type: 'string',
        enum: ['dev', 'test', 'prod'],
        description: 'Deployment environment: dev, test, or prod.',
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
      'workflowFileName',
    ],
    additionalProperties: false,
  },
};
