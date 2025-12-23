import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';

export type BaseConfig = {
  model: ResponseCreateParamsBase['model'];
};

export type ProjectConfigs = {
  configName: string;
  config: ProjectDetails;
}[];
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
