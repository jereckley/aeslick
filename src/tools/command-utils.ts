import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER = 1024 * 1024 * 10;
const SAFE_EXECUTABLE_PATTERN = /^[A-Za-z0-9._/-]+$/;
const SAFE_SCRIPT_PATTERN = /^[A-Za-z0-9:_-]+$/;
const SAFE_WORKFLOW_PATTERN = /^[A-Za-z0-9._/-]+$/;

const resolveExecutable = (command: string) => {
  if (process.platform === 'win32' && command === 'npm') {
    return 'npm.cmd';
  }
  return command;
};

const requireSafeValue = (
  value: string,
  fieldName: string,
  pattern: RegExp,
  message: string,
) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  if (!pattern.test(trimmed)) {
    throw new Error(message);
  }
  return trimmed;
};

export const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
) => {
  return execFileAsync(resolveExecutable(command), args, {
    cwd,
    maxBuffer: DEFAULT_MAX_BUFFER,
  });
};

export const requireSafeExecutableName = (value: string, fieldName: string) => {
  return requireSafeValue(
    value,
    fieldName,
    SAFE_EXECUTABLE_PATTERN,
    `${fieldName} contains unsupported characters.`,
  );
};

export const requireSafeScriptName = (value: string) => {
  return requireSafeValue(
    value,
    'command',
    SAFE_SCRIPT_PATTERN,
    'command must be a single npm script name.',
  );
};

export const requireSafeWorkflowFileName = (value: string) => {
  return requireSafeValue(
    value,
    'workflowFileName',
    SAFE_WORKFLOW_PATTERN,
    'workflowFileName contains unsupported characters.',
  );
};
