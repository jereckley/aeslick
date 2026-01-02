import chalk from 'chalk';
import * as fse from 'fs-extra';
import * as path from 'path';
import { defaultContextConfig } from '../create-component/context-input';
import { ContextConfig } from '../../services/config/types';
export type CreateProjectConfigAnswers = {
  configFileName: string;
  projectName: string;
  projectPath: string;
  framework: string;
  generatedCodegenTypesPath: string;
  developerConcerns?: string;
};

export const createProjectConfig = async (
  answers: CreateProjectConfigAnswers,
) => {
  const {
    configFileName,
    projectName,
    projectPath,
    framework,
    generatedCodegenTypesPath,
    developerConcerns,
  } = answers;

  const fileName = configFileName.endsWith('.aeslick.json')
    ? configFileName
    : `${configFileName}.aeslick.json`;
  const writePath = path.join(process.cwd(), fileName);

  if (fse.existsSync(writePath)) {
    console.log(
      chalk.yellow(
        `Project config ${fileName} already exists. Aborting creation.`,
      ),
    );
    return;
  }

  const concerns = (developerConcerns ?? '')
    .split(',')
    .map((concern) => concern.trim())
    .filter((concern) => concern.length > 0);

  const content = [
    {
      context: {
        input: defaultContextConfig as ContextConfig,
      },
      repos: [
        {
          name: projectName,
          path: projectPath,
          details: {
            framework,
            generatedCodegenTypesPath,
            developerConcerns: concerns,
          },
        },
      ],
    },
  ];

  await fse.writeJson(writePath, content, { spaces: 2 });

  console.log(chalk.green(`Created project config at ${writePath}`));
};
