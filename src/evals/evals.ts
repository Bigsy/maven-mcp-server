//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { grade, EvalFunction } from "mcp-evals";

const get_maven_latest_versionEval: EvalFunction = {
    name: 'get_maven_latest_version Tool Evaluation',
    description: 'Evaluates the tool that retrieves the latest Maven dependency version',
    run: async () => {
        const result = await grade(openai("gpt-4"), "What is the latest version of org.springframework:spring-core?");
        return JSON.parse(result);
    }
};

const check_maven_version_existsEval: EvalFunction = {
    name: 'check_maven_version_exists Evaluation',
    description: 'Evaluates if the check_maven_version_exists tool can confirm version existence of a Maven dependency',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Check if version 5.3.20 of org.springframework:spring-core exists in Maven Central.");
        return JSON.parse(result);
    }
};

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: [get_maven_latest_versionEval, check_maven_version_existsEval]
};
  
export default config;
  
export const evals = [get_maven_latest_versionEval, check_maven_version_existsEval];