import { fileService } from '../files';
import {
  BaseConfig,
  ContextConfig,
  ProjectConfigWrapper,
  ProjectDetails,
} from './types';

let baseConfig: BaseConfig | undefined;
let projectConfigWrappers: ProjectConfigWrapper[] = [];
export const configService = async () => {
  if (!baseConfig) {
    baseConfig = {
      model: 'gpt-5-mini-2025-08-07',
    };
  }
  if (projectConfigWrappers.length === 0) {
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
            const parsed = config as unknown;
            const parsedArray = Array.isArray(parsed) ? parsed : undefined;
            const parsedObject =
              !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : undefined;

            const arrayIsWrapper =
              parsedArray &&
              parsedArray.length > 0 &&
              typeof parsedArray[0] === 'object' &&
              !!parsedArray[0] &&
              ('repos' in (parsedArray[0] as Record<string, unknown>) ||
                'projects' in (parsedArray[0] as Record<string, unknown>));

            if (arrayIsWrapper && parsedArray) {
              for (const entry of parsedArray) {
                const entryObj = entry as Record<string, unknown>;
                const repos = Array.isArray(entryObj.repos)
                  ? (entryObj.repos as ProjectDetails[])
                  : Array.isArray(entryObj.projects)
                    ? (entryObj.projects as ProjectDetails[])
                    : [];
                const context = entryObj.context as
                  | { input?: ContextConfig }
                  | undefined;

                projectConfigWrappers.push({
                  configName: name,
                  context,
                  repos,
                });
              }
            } else {
              const repos: ProjectDetails[] = parsedArray
                ? (parsedArray as ProjectDetails[])
                : Array.isArray(parsedObject?.repos)
                  ? ((parsedObject?.repos as ProjectDetails[]) ?? [])
                  : Array.isArray(parsedObject?.projects)
                    ? ((parsedObject?.projects as ProjectDetails[]) ?? [])
                    : [];

              const context = parsedObject
                ? (parsedObject.context as { input?: ContextConfig } | undefined)
                : undefined;

              projectConfigWrappers.push({
                configName: name,
                context,
                repos,
              });
            }
          }
        }
      }
    }
  }
  if (projectConfigWrappers.length === 0) {
    throw new Error('No project configurations found');
  }
  return {
    baseConfig: () => {
      return baseConfig;
    },
    projectConfigsAvailable: () => {
      return projectConfigWrappers.map((p) => p.configName);
    },
    getProjectConfig: (name: string) => {
      const project = projectConfigWrappers.find(
        (p) => p.configName.toLowerCase() === name.toLowerCase(),
      );
      if (!project) {
        throw new Error(`Project configuration for ${name} not found`);
      }
      return [...project.repos] as ProjectDetails[];
    },
    getProjectContextConfig: (name?: string): ContextConfig | undefined => {
      const nameToUse =
        name ??
        (projectConfigWrappers.length > 0
          ? projectConfigWrappers[0].configName
          : '');
      if (!nameToUse) {
        return undefined;
      }
      const project = projectConfigWrappers.find(
        (p) => p.configName.toLowerCase() === nameToUse.toLowerCase(),
      );

      return project?.context?.input;
    },
  };
};
