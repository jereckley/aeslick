import chalk from 'chalk';
import * as fse from 'fs-extra';
import inquirer = require('inquirer');
import * as path from 'path';
import {
  getCommandConfigLabel,
  getConfiguredToolNamesForCommand,
  getDefaultCommandToolsConfig,
} from '../../services/config/command-settings';
import { DEFAULT_MODEL } from '../../services/config';
import { BaseConfig, CommandConfigKey } from '../../services/config/types';
import { configurableToolChoices } from '../../tools';

export type ConfigureCommandToolsAnswers = {
  commandKey: CommandConfigKey;
};

type ConfigureCommandToolsPromptAnswers = {
  toolNames: string[];
};

const BASE_CONFIG_FILE_NAME = 'base.aeslick.json';

export const configureCommandTools = async (
  answers: ConfigureCommandToolsAnswers,
) => {
  const writePath = path.join(process.cwd(), BASE_CONFIG_FILE_NAME);
  const existing = await readExistingBaseConfig(writePath);
  const baseConfig: BaseConfig & Record<string, unknown> = {
    ...existing,
    model:
      typeof existing.model === 'string' && existing.model.trim()
        ? existing.model.trim()
        : DEFAULT_MODEL,
    chatModel:
      typeof existing.chatModel === 'string' && existing.chatModel.trim()
        ? existing.chatModel.trim()
        : typeof existing.model === 'string' && existing.model.trim()
          ? existing.model.trim()
          : DEFAULT_MODEL,
    commandTools: {
      ...getDefaultCommandToolsConfig(),
      ...(existing.commandTools ?? {}),
    },
  };

  const commandKey = answers.commandKey;
  const label = getCommandConfigLabel(commandKey);
  const currentSelection = getConfiguredToolNamesForCommand(
    baseConfig,
    commandKey,
  );

  const promptAnswers = (await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'toolNames',
      message: `Tools available for ${label}:`,
      choices: configurableToolChoices,
      default: currentSelection,
      pageSize: Math.min(configurableToolChoices.length, 15),
    },
  ])) as ConfigureCommandToolsPromptAnswers;

  baseConfig.commandTools = {
    ...(baseConfig.commandTools ?? {}),
    [commandKey]: promptAnswers.toolNames,
  };

  try {
    await fse.writeJson(writePath, baseConfig, { spaces: 2 });
    console.log(chalk.green(`Updated ${label} tools in ${writePath}`));
  } catch (error) {
    console.error(chalk.red('Error updating base config:'), error);
    throw error;
  }
};

const readExistingBaseConfig = async (
  readPath: string,
): Promise<Partial<BaseConfig> & Record<string, unknown>> => {
  const exists = await fse.pathExists(readPath);
  if (!exists) {
    return {};
  }
  const content = await fse.readJson(readPath);
  return (content ?? {}) as Partial<BaseConfig> & Record<string, unknown>;
};
