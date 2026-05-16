import { FunctionTool } from 'openai/resources/responses/responses';
import { DeployRepoInput } from './types';
import { requireConfiguredRepoPath } from '../services/security/tool-access';
import { requireSafeWorkflowFileName, runCommand } from './command-utils';

const ALLOWED_ENVS = new Set(['dev', 'test', 'prod']);

export const deployRepo = async (input: string) => {
  const data = JSON.parse(input) as DeployRepoInput;
  const workflowFileName = requireSafeWorkflowFileName(
    data.workflowFileName || 'launch.yml',
  );
  const repoPath = await requireConfiguredRepoPath(data.pathToRepo);
  const logs: string[] = [];

  if (!ALLOWED_ENVS.has(data.deployEnv)) {
    return {
      success: false,
      message: 'Invalid deployEnv. Allowed values: dev, test, prod.',
    };
  }

  try {
    const { stdout: currentBranchRaw } = await runCommand(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      repoPath,
    );
    const branch = currentBranchRaw.trim();
    logs.push(`[deploy-repo] Current branch detected: ${branch}`);

    const { stdout: statusRaw } = await runCommand(
      'git',
      ['status', '--porcelain'],
      repoPath,
    );
    const hasChanges = statusRaw.trim().length > 0;
    logs.push(
      `[deploy-repo] Pre-deploy status: ${hasChanges ? 'changes detected' : 'no changes, creating empty commit'}.`,
    );

    const commitArgs = hasChanges
      ? ['commit', '-m', data.commitMessage]
      : ['commit', '--allow-empty', '-m', data.commitMessage];

    if (hasChanges) {
      logs.push('[deploy-repo] Running pre-deploy command: git add -A');
      await runCommand('git', ['add', '-A'], repoPath);
    }

    logs.push('[deploy-repo] Running pre-deploy command: git commit -m <commit-message>');
    await runCommand('git', commitArgs, repoPath);
    logs.push('[deploy-repo] Commit step completed.');

    logs.push(`[deploy-repo] Running pre-deploy command: git push origin ${branch}`);
    const { stdout: pushStdout, stderr: pushStderr } = await runCommand(
      'git',
      ['push', 'origin', branch],
      repoPath,
    );
    logs.push('[deploy-repo] Push step completed.');
    if ((pushStdout || '').trim()) {
      logs.push(`[deploy-repo] git push stdout: ${pushStdout.trim()}`);
    }
    if ((pushStderr || '').trim()) {
      logs.push(`[deploy-repo] git push stderr: ${pushStderr.trim()}`);
    }

    const deployCommand = [
      'gh',
      'workflow',
      'run',
      workflowFileName,
      '--field',
      `deployEnv=${data.deployEnv}`,
    ];
    logs.push(`[deploy-repo] Triggering workflow: ${deployCommand.join(' ')}`);
    const { stdout, stderr } = await runCommand(
      'gh',
      ['workflow', 'run', workflowFileName, '--field', `deployEnv=${data.deployEnv}`],
      repoPath,
    );
    logs.push('[deploy-repo] Workflow dispatch command completed.');

    return {
      success: true,
      preDeployCommands: {
        add: 'git add -A',
        commit: 'git commit -m <commit-message>',
        push: `git push origin ${branch}`,
      },
      deployCommand: deployCommand.join(' '),
      output: stdout?.trim() ?? '',
      errorOutput: stderr?.trim() ?? '',
      logs,
    };
  } catch (error: any) {
    logs.push('[deploy-repo] Failed while running git pre-deploy commands or dispatching workflow.');
    if (error?.cmd) {
      logs.push('[deploy-repo] Failed command: <omitted>');
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
