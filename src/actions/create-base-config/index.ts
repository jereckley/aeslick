import chalk from 'chalk';
import * as fse from 'fs-extra';
import * as path from 'path';
import { BaseConfig } from '../../services/config/types';
import { DEFAULT_MODEL } from '../../services/config';

export type CreateBaseConfigAnswers = {
  model?: string;
};

export const createBaseConfig = async (answers: CreateBaseConfigAnswers) => {
  const modelToUse = answers.model?.trim() || DEFAULT_MODEL;
  const writePath = path.join(process.cwd(), 'base.aeslick.json');

  if (fse.existsSync(writePath)) {
    console.log(
      chalk.yellow('base.aeslick.json already exists. Aborting creation.'),
    );
    return;
  }

  const content: BaseConfig = {
    model: modelToUse,
  };

  try {
    await fse.writeJson(writePath, content, { spaces: 2 });
    console.log(chalk.green(`Created base config at ${writePath}`));
  } catch (error) {
    console.error(chalk.red('Error creating base config:'), error);
    throw error;
  }
};
