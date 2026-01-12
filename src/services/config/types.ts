import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';

export type BaseConfig = {
  model: ResponseCreateParamsBase['model'];
  /**
   * Maximum number of characters from tool output to return to the model.
   * Defaults to 12000 if not specified in base config.
   */
  maxFunctionOutputLength?: number;
};

export type ContextKeys =
  | 'init'
  | 'interaction'
  | 'configurations'
  | 'style'
  | 'authentication'
  | 'graphql';

export type ContextConfig = Partial<Record<ContextKeys, string>>;

export type ContextWrapper = {
  input?: ContextConfig;
};

export type RepoConfigWrapper = {
  projectName: string;
  repoName: string;
  repo: Repo;
};

export type ProjectWrapper = {
  projectName: string;
  context?: ContextWrapper;
  repos: Repo[];
};
export type Repo = {
  name: string;
  path: string;
  details: RepoConfig;
};
export type AgentConfig = {
  notes: string;
};

export type RepoConfig = {
  framework: string;
  generatedCodegenTypesPath: string;
  developerConcerns: string[];
};
