import { ResponseCreateParamsBase } from "openai/resources/responses/responses";

export type BaseConfig = {
  model: ResponseCreateParamsBase["model"];
}

export type ProjectConfigs = {
  configName: string;
  config: ProjectConfig;
}[]
export type ProjectConfig = {
  frontEndPath: string;
  backEndPath: string;
}
