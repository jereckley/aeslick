import { globSync } from 'glob';
import * as path from 'path';

export const getListOfFilesInPath =
  () =>
  async (pattern: string): Promise<{ fileContents: string }> => {
    const searchPattern = pattern.includes('*')
      ? pattern
      : path.join(pattern, '**/*'); // list all files under the provided directory
    const filePaths = globSync(searchPattern, { nodir: true }) as string[];

    return { fileContents: filePaths.join('\n') };
  };
