import * as fse from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

const COMPONENT_SESSION_FILE = '.aeslick.component.session.json';

type ComponentSessionState = {
  lastResponseId?: string;
  updatedAt?: string;
};

const getSessionFilePath = () =>
  path.join(process.cwd(), COMPONENT_SESSION_FILE);

const readSessionState = async (): Promise<ComponentSessionState | undefined> => {
  const filePath = getSessionFilePath();
  try {
    const exists = await fse.pathExists(filePath);
    if (!exists) {
      return undefined;
    }
    const content = await fse.readFile(filePath, 'utf-8');
    if (!content.trim()) {
      return undefined;
    }
    return JSON.parse(content) as ComponentSessionState;
  } catch (error) {
    console.error(chalk.red('Failed to read component session state:'), error);
    return undefined;
  }
};

export const getLastComponentResponseId = async () => {
  const state = await readSessionState();
  return state?.lastResponseId;
};

export const saveLastComponentResponseId = async (responseId: string) => {
  const filePath = getSessionFilePath();
  const state: ComponentSessionState = {
    lastResponseId: responseId,
    updatedAt: new Date().toISOString(),
  };
  try {
    await fse.writeJson(filePath, state, { spaces: 2 });
  } catch (error) {
    console.error(chalk.red('Failed to save component session state:'), error);
  }
};

export const clearComponentSessionState = async () => {
  const filePath = getSessionFilePath();
  try {
    const exists = await fse.pathExists(filePath);
    if (exists) {
      await fse.remove(filePath);
    }
  } catch (error) {
    console.error(chalk.red('Failed to clear component session state:'), error);
  }
};
