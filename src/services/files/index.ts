import * as fse from 'fs-extra';
import * as path from 'path';
import { readFiles } from './read-files';
import { getListOfFilesInPath } from './get-list-of-files-in-path';
import chalk from 'chalk';
import { writeBase64Image } from './write-base64-image';

const root = process.cwd();
const resolvePath = (targetPath: string) =>
  path.isAbsolute(targetPath) ? targetPath : path.join(root, targetPath);

export const fileService = async () => {
  return {
    writeFile: async (pathWithFileName: string, content: string) => {
      const resolvedPath = resolvePath(pathWithFileName);
      const dirPath = path.dirname(resolvedPath);
      try {
        await fse.ensureDir(dirPath);
      } catch (err) {
        console.error(chalk.red('Error creating directory:', err));
      }
      await fse.writeFile(resolvedPath, content);
    },
    readFile: async (pathWithFileName: string): Promise<string> => {
      return fse.readFileSync(resolvePath(pathWithFileName), 'utf-8');
    },
    readBase64Image: async (pathWithFileName: string): Promise<string> => {
      try {
        const fileBuffer = await fse.readFile(resolvePath(pathWithFileName));
        return fileBuffer.toString('base64');
      } catch (err) {
        console.error(chalk.red('Error reading image file:'), err);
        return '';
      }
    },
    readFiles: readFiles(),
    getListOfFilesInPath: getListOfFilesInPath(),
    writeBase64Image: writeBase64Image(),
  };
};
