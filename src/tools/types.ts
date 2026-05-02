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

export type GetImageInputsByFileNamesInput = {
  fileNames: string[];
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

export type DeployRepoInput = {
  pathToRepo: string;
  commitMessage: string;
  deployEnv: 'dev' | 'test' | 'prod';
  workflowFileName?: string;
}

export type InspectWebpageInput = {
  url: string;
  maxChars?: number;
}

export type ChromeHeadlessBrowserAction =
  | 'open'
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'evaluate'
  | 'snapshot'
  | 'console'
  | 'screenshot'
  | 'close'

export type ChromeHeadlessBrowserInput = {
  action: ChromeHeadlessBrowserAction;
  sessionId?: string;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  timeoutMs?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  width?: number;
  height?: number;
  executablePath?: string;
  disableSandbox?: boolean;
  acceptInsecureCerts?: boolean;
  maxTextChars?: number;
  sinceEventId?: number;
  path?: string;
  fullPage?: boolean;
  delayMs?: number;
  clearExisting?: boolean;
  pressEnter?: boolean;
  waitForNavigation?: boolean;
  button?: 'left' | 'middle' | 'right';
  visible?: boolean;
  hidden?: boolean;
}
