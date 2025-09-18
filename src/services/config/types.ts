import { ResponseCreateParamsBase } from "openai/resources/responses/responses";

export type BaseConfig = {
  model: ResponseCreateParamsBase["model"];
}

export type ProjectConfigs = {
  configName: string;
  config: ProjectConfig;
}[]
export type ProjectDetails = {
  framework: string;
  developerConcerns: string[];
}
export type ProjectConfig = {
  frontEndPath: string;
  frontEndDetails: ProjectDetails;
  backEndPath: string;
  backEndDetails: ProjectDetails;
}
