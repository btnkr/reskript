import path from 'path';
import {existsSync} from 'fs';
import fs from 'fs/promises';
import {isEqual} from 'lodash';
import {logger, findGitRoot} from '@reskript/core';
import {FeatureMatrix} from '@reskript/settings';

const toStringTag = Object.prototype.toString;

const getSchema = (obj: Record<string, any>): Array<[string, string]> => {
    const entries = Object.entries(obj);
    entries.sort(([keyX], [keyY]) => keyX.localeCompare(keyY));

    return entries.map(([key, value]) => [key, toStringTag.call(value)] as [string, string]);
};

export const checkFeatureMatrixSchema = (features: FeatureMatrix): void => {
    const featurePairs = Object.entries(features);
    // 计算每一个feature的结构是不是一样，如果有结构不一样的，则直接报错退出
    const baseSchema = getSchema(featurePairs[0][1]);
    const conflicts = featurePairs.slice(1).reduce(
        (errors, [key, value]) => {
            const currentSchema = getSchema(value);

            if (!isEqual(baseSchema, currentSchema)) {
                return [...errors, key];
            }

            return errors;
        },
        [] as string[]
    );

    if (conflicts.length > 0) {
        logger.error(`Build target ${conflicts.join(' & ')} have incompatible feature schema`);
        process.exit(21);
    }
};

export const checkPreCommitHookWhenLintDisabled = async (cwd: string) => {
    const gitRoot = await findGitRoot(cwd) ?? cwd;
    if (existsSync(path.join(gitRoot, '.husky', 'pre-commit'))) {
        return;
    }

    const packageContent = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
    const packageConfig = JSON.parse(packageContent);

    if (packageConfig?.husky?.hooks?.['pre-commit']) {
        const warning = `
            This project has reportLintErrors option disabled in reskript.config.js,
            and there is no pre-commit hook to lint your files,
            you should at least install husky to enable pre-commit hook.

            npm install --save-dev husky

            Then initialize husky hooks in your project:

            npx --no-install husky install

            And create hook in your project root:

            npx --no-install husky add .husky/pre-commit "npx --no-install skr lint --staged"
        `;
        logger.warn(warning);
        process.exit(21);
    }
};
