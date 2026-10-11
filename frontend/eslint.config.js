import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config({ignores:['dist/**','node_modules/**','test-results/**']},js.configs.recommended,...ts.configs.recommended,{files:['src/**/*.{ts,tsx}'],languageOptions:{globals:globals.browser},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}});
