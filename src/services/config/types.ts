import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';

export type BaseConfig = {
  model: ResponseCreateParamsBase['model'];
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

export type ProjectConfigWrapper = {
  configName: string;
  context?: ContextWrapper;
  repos: ProjectDetails[];
};

export type ProjectDetails = {
  name: string;
  path: string;
  details: ProjectConfig;
};

export type ProjectConfig = {
  framework: string;
  generatedCodegenTypesPath: string;
  developerConcerns: string[];
};
