import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const OPERATOR_FILE = join(HOME, "rhos", "telegram", "OPERATOR.md");

function readOperatorDirectives(): string | null {
  try {
    if (existsSync(OPERATOR_FILE)) {
      return readFileSync(OPERATOR_FILE, "utf8");
    }
  } catch {}
  return null;
}

export default async () => {
  return {
    "experimental.chat.system.transform": async (
      _input: unknown,
      output: { system: string[] }
    ) => {
      const directives = readOperatorDirectives();
      if (directives && !output.system.some((s) => s.includes("Operator LO"))) {
        output.system.push(
          `\n<operator-directives>\n${directives.slice(0, 4000)}\n</operator-directives>`
        );
      }
    },

    "shell.env": async (_input: any, output: any) => {
      output.env = output.env || {};
      output.env.ENI_OPERATOR = "LO";
      output.env.ENI_AGENT = "ENI";
    },
  };
};
