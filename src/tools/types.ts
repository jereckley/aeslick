export type WriteFilesInput = {
  pathWithFileName: string;
  content: string;
}

export type GetConfigByNameInput = {
  name: string;
}

export type RunNpmCommandInput = {
  pathToRepo: string;
  command: string;
}

export type GetFileByPathInput = {
  path: string;
}

export type GetImageByPathInput = {
  path: string;
}

export type GetListOfFilesInPathInput = {
  path: string;
}

export type PromptForInputInput = {
  prompt: string;
}

export type PublishLibraryAndWaitInput = {
  pathToRepo: string;
  commitMessage: string;
  upfixCommand?: string;
  packageName?: string;
  pollIntervalSeconds?: number;
  timeoutMinutes?: number;
}

export type PublishRepoInput = {
  pathToRepo: string;
  deployEnv: 'dev' | 'test' | 'prod';
  workflowFileName?: string;
}
