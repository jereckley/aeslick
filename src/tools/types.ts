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

export type GetListOfFilesInPathInput = {
  path: string;
}

export type PromptForInputInput = {
  prompt: string;
}
