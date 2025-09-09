import { fileService } from '../files';
import { BaseConfig, ProjectConfig, ProjectConfigs } from './types';

let baseConfig: BaseConfig | undefined;
let projectConfig: ProjectConfigs = [];
export const configService = async () => {
  if (!baseConfig) {
    baseConfig = {
      model: 'gpt-5-mini-2025-08-07',
    };
  }
  if (!projectConfig) {
    const filesService = await fileService();
    const allconfigsUnparsed = await filesService.readFiles('./*.aeslick.json');

    for (const unparsedConfig of allconfigsUnparsed) {
      if (unparsedConfig) {
        const name = unparsedConfig.path.split('/')?.[0];
        const config = JSON.parse(unparsedConfig.content) as
          | ProjectConfig
          | BaseConfig;
        if (name) {
          if (name === 'base') {
            baseConfig = {
              ...(config as BaseConfig),
            };
          } else {
            projectConfig.push({
              configName: name,
              config: config as ProjectConfig,
            });
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
      const project = projectConfig.find((p) => p.configName === name);
      if (!project) {
        throw new Error(`Project configuration for ${name} not found`);
      }
      return {
        ...project.config,
      } as ProjectConfig;
    },
  };
};
