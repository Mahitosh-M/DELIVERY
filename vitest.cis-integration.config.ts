import {mergeConfig,defineConfig} from 'vitest/config';
import base from './vitest.config';
// Targets the isolated CISapp development worktree under D:/DELIVERY/.release/cisapp.
const config=mergeConfig(base,defineConfig({resolve:{dedupe:["react","react-dom","lucide-react","react-router","react-router-dom"]}}));
config.test!.include=['integration-tests/**/*.test.tsx'];
export default config;
