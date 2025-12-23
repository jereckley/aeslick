import * as fse from 'fs-extra';
import * as path from 'path';
import { readFiles } from './read-files';
import { getListOfFilesInPath } from './get-list-of-files-in-path';
import chalk from 'chalk';
import { writeBase64Image } from './write-base64-image';

const root = process.cwd();
export const fileService = async () => {
  return {
    writeFile: async (pathWithFileName: string, content: string) => {
      const dirPath = path.dirname(pathWithFileName);
      try {
        await fse.ensureDir(path.join(root, dirPath));
      } catch (err) {
        console.error(chalk.red('Error creating directory:', err));
      }
      await fse.writeFile(path.join(root, pathWithFileName), content);
    },
    readFile: async (pathWithFileName: string): Promise<string> => {
      return fse.readFileSync(pathWithFileName, 'utf-8');
    },
    readBase64Image: async (pathWithFileName: string): Promise<string> => {
      try {
        const fileBuffer = await fse.readFile(path.join(root, pathWithFileName));
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
