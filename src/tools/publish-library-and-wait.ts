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
  const logs: string[] = [];

  try {
    const upfixExecCommand = `${upfixCommand} "${quote(message)}"`;
    logs.push(`[publish-library-and-wait] Running upfix command: ${upfixExecCommand}`);
    const { stdout, stderr } = await runCommand(upfixExecCommand, repoPath);
    logs.push('[publish-library-and-wait] upfix command completed successfully.');
    if ((stdout || '').trim()) {
      logs.push(`[publish-library-and-wait] upfix stdout: ${stdout.trim()}`);
    }
    if ((stderr || '').trim()) {
      logs.push(`[publish-library-and-wait] upfix stderr: ${stderr.trim()}`);
    }
  } catch (error: any) {
    strategy = 'git-fallback';
    upfixError =
      error?.stderr?.toString().trim() ||
      error?.stdout?.toString().trim() ||
      error?.message ||
      'Unknown upfix error';
    logs.push('[publish-library-and-wait] upfix failed. Falling back to raw git commands.');
    if (error?.cmd) {
      logs.push(`[publish-library-and-wait] upfix failed command: ${error.cmd}`);
    }
    if (error?.stdout?.toString().trim()) {
      logs.push(
        `[publish-library-and-wait] upfix failure stdout: ${error.stdout.toString().trim()}`,
      );
    }
    if (error?.stderr?.toString().trim()) {
      logs.push(
        `[publish-library-and-wait] upfix failure stderr: ${error.stderr.toString().trim()}`,
      );
    }

    const { stdout: currentBranchRaw } = await runCommand(
      'git rev-parse --abbrev-ref HEAD',
      repoPath,
    );
    const branch = currentBranchRaw.trim();
    logs.push(`[publish-library-and-wait] Fallback branch detected: ${branch}`);
    const { stdout: status } = await runCommand('git status --porcelain', repoPath);
    const hasChanges = status.trim().length > 0;
    logs.push(
      `[publish-library-and-wait] Fallback status: ${hasChanges ? 'changes detected' : 'no changes, creating empty commit'}.`,
    );

    if (hasChanges) {
      await runCommand('git add -A', repoPath);
      await runCommand(`git commit -m "${quote(message)}"`, repoPath);
      logs.push('[publish-library-and-wait] Fallback commit created from staged changes.');
    } else {
      await runCommand(`git commit --allow-empty -m "${quote(message)}"`, repoPath);
      logs.push('[publish-library-and-wait] Fallback empty commit created.');
    }
    await runCommand(`git push origin ${branch}`, repoPath);
    logs.push('[publish-library-and-wait] Fallback push completed.');
  }

  return { strategy, upfixError, logs };
};

const getMatchingRuns = (runs: GhRun[], sha: string, packageName?: string) => {
  const bySha = runs.filter((run) => run.headSha === sha);
  if (!packageName) {
    return bySha;
  }
  const packageNameLower = packageName.toLowerCase();
  const byPackage = bySha.filter((run) => {
    return (
      run.workflowName.toLowerCase().includes(packageNameLower) ||
      run.name.toLowerCase().includes(packageNameLower) ||
      run.displayTitle.toLowerCase().includes(packageNameLower)
    );
  });
  return byPackage.length > 0 ? byPackage : bySha;
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
  let matchedRun: GhRun | undefined;
  const waitLogs = [...publishInfo.logs];

  while (Date.now() < timeoutAt) {
    attempts += 1;
    const { stdout: runsJson } = await runCommand(
      'gh run list --limit 50 --json conclusion,createdAt,databaseId,displayTitle,headSha,name,status,updatedAt,url,workflowName',
      data.pathToRepo,
    );
    const parsed = JSON.parse(runsJson) as GhRun[];

    const matchingRuns = getMatchingRuns(parsed, commitSha, data.packageName || undefined);
    if (matchingRuns.length > 0) {
      matchedRun = matchingRuns[0];
      waitLogs.push(
        `[publish-library-and-wait] Attempt ${attempts}: matched run ${matchedRun.databaseId} (${matchedRun.status}${matchedRun.conclusion ? `/${matchedRun.conclusion}` : ''}).`,
      );
      if (matchedRun.status === 'completed') {
        break;
      }
    } else {
      waitLogs.push(
        `[publish-library-and-wait] Attempt ${attempts}: no matching run yet for commit ${commitSha}.`,
      );
    }
    await sleep(pollIntervalSeconds * 1000);
  }

  const { stdout: finalReleaseList } = await runCommand(
    'gh release list',
    data.pathToRepo,
  );

  if (!matchedRun || matchedRun.status !== 'completed') {
    return {
      success: false,
      commitSha,
      publishStrategy: publishInfo.strategy,
      upfixError: publishInfo.upfixError,
      publishLogs: waitLogs,
      attempts,
      timeoutMinutes,
      message:
        'Matching workflow run for pushed commit did not complete before timeout. Returning latest gh release list output.',
      ghReleaseList: finalReleaseList,
    };
  }

  if (matchedRun.conclusion !== 'success') {
    return {
      success: false,
      commitSha,
      publishStrategy: publishInfo.strategy,
      upfixError: publishInfo.upfixError,
      publishLogs: waitLogs,
      attempts,
      completedRun: matchedRun,
      message: `Matching workflow completed with conclusion: ${matchedRun.conclusion || 'unknown'}.`,
      ghReleaseList: finalReleaseList,
    };
  }

  return {
    success: true,
    commitSha,
    publishStrategy: publishInfo.strategy,
    upfixError: publishInfo.upfixError,
    publishLogs: waitLogs,
    attempts,
    completedRun: matchedRun,
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
        type: ['string', 'null'],
        description:
          'Optional command used for publish commit/push (default: "upfix").',
      },
      packageName: {
        type: ['string', 'null'],
        description:
          'Optional package/workflow text filter used when selecting the target run.',
      },
      pollIntervalSeconds: {
        type: ['number', 'null'],
        description: 'Optional polling interval for gh run checks (default: 15).',
      },
      timeoutMinutes: {
        type: ['number', 'null'],
        description: 'Optional timeout in minutes while waiting for completion (default: 20).',
      },
    },
    required: [
      'pathToRepo',
      'commitMessage',
      'upfixCommand',
      'packageName',
      'pollIntervalSeconds',
      'timeoutMinutes',
    ],
    additionalProperties: false,
  },
};
