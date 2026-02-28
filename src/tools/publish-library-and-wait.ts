import { FunctionTool } from 'openai/resources/responses/responses';
import { PublishLibraryAndWaitInput } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DEFAULT_UPFIX_COMMAND = 'upfix';
const DEFAULT_POLL_INTERVAL_SECONDS = 15;
const DEFAULT_TIMEOUT_MINUTES = 20;

type GhRun = {
  conclusion: string | null;
  createdAt: string;
  databaseId: number;
  displayTitle: string;
  headSha: string;
  name: string;
  status: string;
  updatedAt: string;
  url: string;
  workflowName: string;
};

const sleep = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const runCommand = async (command: string, cwd: string) => {
  return execAsync(command, {
    cwd,
    maxBuffer: 1024 * 1024 * 10,
  });
};

const quote = (value: string) => value.replaceAll('"', '\\"');

const runUpfixOrFallback = async (
  repoPath: string,
  message: string,
  upfixCommand: string,
) => {
  let strategy: 'upfix' | 'git-fallback' = 'upfix';
  let upfixError = '';

  try {
    await runCommand(`${upfixCommand} "${quote(message)}"`, repoPath);
  } catch (error: any) {
    strategy = 'git-fallback';
    upfixError =
      error?.stderr?.toString().trim() ||
      error?.stdout?.toString().trim() ||
      error?.message ||
      'Unknown upfix error';

    const { stdout: currentBranchRaw } = await runCommand(
      'git rev-parse --abbrev-ref HEAD',
      repoPath,
    );
    const branch = currentBranchRaw.trim();
    const { stdout: status } = await runCommand('git status --porcelain', repoPath);
    const hasChanges = status.trim().length > 0;

    if (hasChanges) {
      await runCommand('git add -A', repoPath);
      await runCommand(`git commit -m "${quote(message)}"`, repoPath);
    } else {
      await runCommand(`git commit --allow-empty -m "${quote(message)}"`, repoPath);
    }
    await runCommand(`git push origin ${branch}`, repoPath);
  }

  return { strategy, upfixError };
};

const getMatchingRuns = (runs: GhRun[], sha: string, packageName?: string) => {
  const bySha = runs.filter((run) => run.headSha === sha);
  if (!packageName) {
    return bySha;
  }
  const packageNameLower = packageName.toLowerCase();
  return bySha.filter((run) => {
    return (
      run.workflowName.toLowerCase().includes(packageNameLower) ||
      run.name.toLowerCase().includes(packageNameLower) ||
      run.displayTitle.toLowerCase().includes(packageNameLower)
    );
  });
};

export const publishLibraryAndWait = async (input: string) => {
  const data = JSON.parse(input) as PublishLibraryAndWaitInput;
  const upfixCommand = data.upfixCommand || DEFAULT_UPFIX_COMMAND;
  const pollIntervalSeconds = Math.max(
    2,
    data.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS,
  );
  const timeoutMinutes = Math.max(1, data.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES);
  const startedAt = Date.now();

  const publishInfo = await runUpfixOrFallback(
    data.pathToRepo,
    data.commitMessage,
    upfixCommand,
  );

  const { stdout: commitShaRaw } = await runCommand('git rev-parse HEAD', data.pathToRepo);
  const commitSha = commitShaRaw.trim();
  const timeoutAt = startedAt + timeoutMinutes * 60 * 1000;
  let attempts = 0;
  let latestRun: GhRun | undefined;

  while (Date.now() < timeoutAt) {
    attempts += 1;
    const { stdout: runsJson } = await runCommand(
      'gh run list --limit 50 --json conclusion,createdAt,databaseId,displayTitle,headSha,name,status,updatedAt,url,workflowName',
      data.pathToRepo,
    );
    const parsed = JSON.parse(runsJson) as GhRun[];
    console.log(parsed)
    const matching = getMatchingRuns(parsed, commitSha, data.packageName).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    if (matching.length > 0) {
      latestRun = matching[0];
      if (latestRun.status === 'completed') {
        break;
      }
    }
    await sleep(pollIntervalSeconds * 1000);
  }

  const { stdout: finalReleaseList } = await runCommand(
    'gh release list',
    data.pathToRepo,
  );

  if (!latestRun || latestRun.status !== 'completed') {
    return {
      success: false,
      commitSha,
      publishStrategy: publishInfo.strategy,
      upfixError: publishInfo.upfixError,
      attempts,
      timeoutMinutes,
      message:
        'Workflow did not complete before timeout. Returning latest gh release list output.',
      ghReleaseList: finalReleaseList,
    };
  }

  return {
    success: true,
    commitSha,
    publishStrategy: publishInfo.strategy,
    upfixError: publishInfo.upfixError,
    attempts,
    completedRun: latestRun,
    ghReleaseList: finalReleaseList,
  };
};

export const publishLibraryAndWaitTool: FunctionTool = {
  type: 'function',
  strict: true,
  name: 'publish-library-and-wait',
  description:
    'Publish a library by creating/pushing a fix commit (tries upfix first), wait for GitHub Actions completion, and return the full gh release list output.',
  parameters: {
    type: 'object',
    properties: {
      pathToRepo: {
        type: 'string',
        description: 'Absolute path to the repository where publishing should run.',
      },
      commitMessage: {
        type: 'string',
        description: 'Fix commit message used for upfix/fallback git commit.',
      },
      upfixCommand: {
        type: 'string',
        description:
          'Optional command used for publish commit/push (default: "upfix").',
      },
      packageName: {
        type: 'string',
        description:
          'Optional package/workflow text filter used when selecting the target run.',
      },
      pollIntervalSeconds: {
        type: 'number',
        description: 'Optional polling interval for gh run checks (default: 15).',
      },
      timeoutMinutes: {
        type: 'number',
        description: 'Optional timeout in minutes while waiting for completion (default: 20).',
      },
    },
    required: ['pathToRepo', 'commitMessage'],
    additionalProperties: false,
  },
};
