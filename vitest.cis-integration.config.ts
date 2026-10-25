import {mergeConfig,defineConfig} from 'vitest/config';
import base from './vitest.config';
// Requires the existing sibling CISapp checkout at D:/CISapp in this workspace.
export default mergeConfig(base,defineConfig({test:{include:['integration-tests/**/*.test.tsx']}}));
