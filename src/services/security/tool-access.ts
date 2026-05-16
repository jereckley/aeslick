import * as fse from 'fs-extra';
import * as path from 'path';
import { configService } from '../config';

const workspaceRoot = () =>
  path.resolve(process.env.TARGET_PATH || process.cwd());

const unique = (values: string[]) => Array.from(new Set(values));

const isWithinRoot = (candidate: string, root: string) => {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
};

const resolveRealPath = async (inputPath: string) => {
  let current = path.resolve(inputPath);
  const missingSegments: string[] = [];

  while (!(await fse.pathExists(current))) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    missingSegments.unshift(path.basename(current));
    current = parent;
  }

  const existingPath = (await fse.pathExists(current))
    ? await fse.realpath(current)
    : path.resolve(current);

  return path.join(existingPath, ...missingSegments);
};

const resolveInputPath = async (inputPath: string, fieldName: string) => {
  const trimmed = inputPath?.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return resolveRealPath(path.resolve(workspaceRoot(), trimmed));
};

const configuredRepoRoots = async () => {
  try {
    return (await configService()).repoRootPathsAvailable();
  } catch {
    return [];
  }
};

const normalizeRoots = async (roots: string[]) => {
  return unique(await Promise.all(roots.map((root) => resolveRealPath(root))));
};

export const resolveToolPath = async (inputPath: string, fieldName = 'path') => {
  const candidate = await resolveInputPath(inputPath, fieldName);
  const allowedRoots = await normalizeRoots([
    workspaceRoot(),
    ...(await configuredRepoRoots()),
  ]);

  if (!allowedRoots.some((root) => isWithinRoot(candidate, root))) {
    throw new Error(
      `${fieldName} must stay inside the workspace or a configured repo root.`,
    );
  }

  return candidate;
};

export const requireConfiguredRepoPath = async (repoPath: string) => {
  const candidate = await resolveInputPath(repoPath, 'pathToRepo');
  const repoRoots = await normalizeRoots(await configuredRepoRoots());
  const workspace = await resolveRealPath(workspaceRoot());

  if (repoRoots.length > 0) {
    if (!repoRoots.includes(candidate)) {
      throw new Error(
        'pathToRepo must exactly match one of the configured repo paths.',
      );
    }
    return candidate;
  }

  if (!isWithinRoot(candidate, workspace)) {
    throw new Error(
      'pathToRepo must stay inside the workspace when no repo configs are loaded.',
    );
  }

  return candidate;
};

export const resolveWorkspacePath = async (
  inputPath: string,
  fieldName = 'path',
) => {
  const candidate = await resolveInputPath(inputPath, fieldName);
  const root = await resolveRealPath(workspaceRoot());

  if (!isWithinRoot(candidate, root)) {
    throw new Error(`${fieldName} must stay inside the workspace.`);
  }

  return candidate;
};
