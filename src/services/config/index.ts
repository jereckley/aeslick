import { fileService } from '../files';
import {
  BaseConfig,
  ContextConfig,
  RepoConfigWrapper,
  ProjectWrapper,
} from './types';

let baseConfig: BaseConfig | undefined;
let repoConfigs: RepoConfigWrapper[] = [];
let projects: ProjectWrapper[] = [];
export const configService = async () => {
  if (!baseConfig) {
    baseConfig = {
      model: 'gpt-5-mini-2025-08-07',
    };
  }
  if (repoConfigs.length === 0) {
    const filesService = await fileService();
    const allconfigsUnparsed = await filesService.readFiles('./*.aeslick.json');

    for (const unparsedConfig of allconfigsUnparsed) {
      if (unparsedConfig) {
        const name = unparsedConfig.path.split('.')?.[0];
        const config = JSON.parse(unparsedConfig.content) as
          | ProjectWrapper
          | BaseConfig;
        if (name) {
          if (name === 'base') {
            baseConfig = {
              ...(config as BaseConfig),
            };
          } else {
            const parsed = config as ProjectWrapper;
            projects.push(parsed);

            if (parsed) {
              for (const repo of parsed.repos) {
                repoConfigs.push({
                  projectName: parsed.projectName,
                  repoName: repo.name,
                  repo,
                });
              }
            }
          }
        }
      }
    }
  }
  if (repoConfigs.length === 0) {
    throw new Error('No project configurations found');
  }
  return {
    baseConfig: () => {
      return baseConfig;
    },
    projectRepoConfigsAvailable: () => {
      return repoConfigs.map((p) => p.repoName);
    },
    getProjectRepoConfig: (name: string) => {
      const project = repoConfigs.find(
        (p) => p.repoName.toLowerCase() === name.toLowerCase(),
      );
      if (!project) {
        throw new Error(`Project configuration for ${name} not found`);
      }
      return project.repo;
    },
    getNamesOfProjectsAvailable: () => {
      return projects.map((p) => p.projectName);
    },
    getProjectContextConfig: (name?: string): ContextConfig | undefined => {
      const nameToUse =
        name ?? (projects.length > 0 ? projects[0].projectName : '');
      if (!nameToUse) {
        return undefined;
      }
      const project = projects.find(
        (p) => p.projectName.toLowerCase() === nameToUse.toLowerCase(),
      );

      return project?.context?.input;
    },
  };
};
