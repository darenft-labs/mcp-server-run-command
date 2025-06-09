import os from "os";
import {
    CallToolRequestSchema,
    CallToolResult,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { verbose_log } from "./always_log.js";
import { runCommand } from "./run-command.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { PythonAlias } from "./exec-utils.js";

export function registerTools(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        verbose_log("INFO: ListTools");
        return {
            tools: [
                {
                    name: "run_command",
                    description:
                        "Run a command on this " + os.platform() + " machine",
                    inputSchema: {
                        type: "object",
                        properties: {
                            command: {
                                type: "string",
                                description: "Command with args",
                            },
                            workdir: {
                                // previous run_command calls can probe the filesystem and find paths to change to
                                type: "string",
                                description:
                                    "Optional, current working directory",
                            },
                            stdin: {
                                type: "string",
                                description:
                                    "Optional, text to pipe into the command's STDIN. For example, pass a python script to python3. Or, pass text for a new file to the cat command to create it!",
                            },
                            // args to consider:
                            // - env - obscure cases where command takes a param only via an env var?
                            // - timeout - lets just hard code this for now
                        },
                        required: ["command"],
                    },
                },
                {
                    name: "list_python_packages",
                    description:
                        "List installed python packages on this " + os.platform() + " machine",
                    inputSchema: {
                        type: "object",
                        properties: {
                            options: {
                                type: "string",
                                description: "options to pass to the 'pip list' command",
                            },  
                        },
                        required: [],
                    },
                },
                {
                    name: "install_python_packages",
                    description:
                        "Install python packages on this " + os.platform() + " machine",
                    inputSchema: {
                        type: "object",
                        properties: {
                            packages: {
                                type: "string",
                                description: "packages to install, separated by space",
                            },
                        },
                        required: ["packages"],
                    },
                },
                {
                    name: "run_python_file",
                    description:
                        "Run python script file on this " + os.platform() + " machine",
                    inputSchema: {
                        type: "object",
                        properties: {
                            python_file: {
                                type: "string",
                                description: "python script file to run",
                            },
                            workdir: {
                                type: "string",
                                description: "working directory",
                            },
                        },
                        required: ["python_file", "workdir"],
                    },
                },
            ],
        };
    });

    server.setRequestHandler(
        CallToolRequestSchema,
        async (request): Promise<CallToolResult> => {
            verbose_log("INFO: ToolRequest", request);
            switch (request.params.name) {
                case "run_command": {
                    return await runCommand(request.params.arguments);
                }
                case "list_python_packages": {
                    if (PythonAlias === 'notfound') {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "Python is not installed or not in the system's PATH" }],
                        }
                    }
                    const params = {
                        command: `${PythonAlias} -m pip list`,
                    }
                    return await runCommand(params);
                }
                case "install_python_packages": {
                    if (PythonAlias === 'notfound') {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "Python is not installed or not in the system's PATH" }],
                        }
                    }
                    const params = {
                        command: `${PythonAlias} -m pip install ${request.params.arguments?.packages}`,
                    }
                    return await runCommand(params);
                }
                case "run_python_file": {
                    if (PythonAlias === 'notfound') {
                        return {
                            isError: true,
                            content: [{ type: "text", text: "Python is not installed or not in the system's PATH" }],
                        }
                    }
                    const params = {
                        command: `${PythonAlias} ` + request.params.arguments?.python_file,
                        workdir: request.params.arguments?.workdir,
                    }
                    return await runCommand(params);
                }
                default:
                    throw new Error("Unknown tool");
            }
        }
    );
}
