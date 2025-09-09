import * as fse from 'fs-extra';
import * as path from 'path';
import { readFiles } from './read-files';

const root = process.cwd();
export const fileService = async () => {
  return {
    writeFile: async (pathWithFileName: string, content: string) => {
      await fse.writeFile(path.join(root, pathWithFileName), content);
    },
    readFile: async (pathWithFileName: string): Promise<string> => {
      return fse.readFileSync(pathWithFileName, 'utf-8');
    },
    readFiles: readFiles(),
  };
};
