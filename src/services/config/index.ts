import { fileService } from '../files';
import {
  BaseConfig,
  ProjectConfigs,
  ProjectDetails,
} from './types';

let baseConfig: BaseConfig | undefined;
let projectConfig: ProjectConfigs = [];
export const configService = async () => {
  if (!baseConfig) {
    baseConfig = {
      model: 'gpt-5-mini-2025-08-07',
    };
  }
  if (projectConfig.length === 0) {
    const filesService = await fileService();
    const allconfigsUnparsed = await filesService.readFiles('./*.aeslick.json');

    for (const unparsedConfig of allconfigsUnparsed) {
      if (unparsedConfig) {
        const name = unparsedConfig.path.split('.')?.[0];
        const config = JSON.parse(unparsedConfig.content) as
          | ProjectDetails[]
          | BaseConfig;
        if (name) {
          if (name === 'base') {
            baseConfig = {
              ...(config as BaseConfig),
            };
          } else {
            for (const project of config as ProjectDetails[]) {
              projectConfig.push({
                configName: project.name,
                config: project,
              } as ProjectConfigs[0]);
            }
          }
        }
      }
    }
  }
  if (projectConfig.length === 0) {
    throw new Error('No project configurations found');
  }
  return {
    baseConfig: () => {
      return baseConfig;
    },
    projectConfigsAvailable: () => {
      return projectConfig.map((p) => p.configName);
    },
    getProjectConfig: (name: string) => {
      const project = projectConfig.find(
        (p) => p.configName.toLowerCase() === name.toLowerCase(),
      );
      if (!project) {
        throw new Error(`Project configuration for ${name} not found`);
      }
      return {
        ...project.config,
      } as ProjectDetails;
    },
  };
};
