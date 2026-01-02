import * as path from 'path';
import * as fse from 'fs-extra';

export const getListOfFilesInPath =
  () =>
  async (pattern: string): Promise<{ fileContents: string }> => {
    const root = path.resolve(process.cwd(), pattern);
    const entries = await fse.readdir(root);
    const relativeNames = await Promise.all(
      entries
        .filter((entry) => entry !== 'node_modules')
        .map(async (entry) => {
          const fullPath = path.join(root, entry);
          const stats = await fse.stat(fullPath);
          return stats.isDirectory() ? `${entry}/` : entry;
        }),
    );

    return { fileContents: relativeNames.join('\n') };
  };
