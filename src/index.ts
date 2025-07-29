#!/usr/bin/env node
import * as fse from 'fs-extra';
import chalk from 'chalk';
import { namespaces } from './namespace';
import { commands } from './command';
import { namespace as namespaceEnum } from './namespace/namespaces.enum';
import { Command } from './command/command.enum';
import { CommandInCommands } from './command/types';
import { getCommandAndNamespace } from './getCommandAndNamespace';
import inquirer = require('inquirer');

const root = process.env.TARGET_PATH || process.cwd();

if (!fse.existsSync(root)) {
  fse.mkdirSync(root);
}

const ns = process.argv[2] as namespaceEnum | undefined;
const namespaceD = namespaces[ns];
const commandUnparsed = process.argv[3] as Command | undefined;
const [namespace, command] = getCommandAndNamespace(
  namespaceD,
  commandUnparsed,
);

async function run() {
  if (!namespace || !Object.values(namespaceEnum).includes(namespace.id)) {
    console.log(
      chalk.yellow(
        `No namespace provided. Options: ${Object.values(namespaces)
          .map((n) => n.id)
          .join(', ')}`,
      ),
    );
  } else if (!command) {
    console.log(
      chalk.yellow(
        `No command provided. Options: ${Object.values(
          commands[namespace.id] as CommandInCommands,
        )
          .map((n) => n.id)
          .join(', ')}`,
      ),
    );
  } else if (!!commands[namespace.id][command].questions) {
    const cm = commands[ns][command];
    try {
      const answers = await inquirer.prompt(cm.questions);

      await commands[ns][command].creator(answers);
    } catch (error) {
      console.error(chalk.red(`Error: ${JSON.stringify(error)}`));
    }
  } else {
    console.log(chalk.yellow('Solid miss'));
  }
}

run();
