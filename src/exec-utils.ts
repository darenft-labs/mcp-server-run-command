import { exec, ExecOptions } from "child_process";
import { ObjectEncodingOptions } from "fs";

type ExecResult = {
    // FYI leave this type for now as a declaration of the expected shape of the result for BOTH success and failure (errors)
    //   do not switch to using ExecException b/c that only applies to failures
    stdout: string;
    stderr: string;

    // message is the error message from the child process, not sure I like this naming
    // - perhaps worth pushing the error logic out of messagesFor back into catch block above
    message?: string;
};

/**
 * Executes a file with the given arguments, piping input to stdin.
 * @param {string} interpreter - The file to execute.
 * @param {string} stdin - The string to pipe to stdin.
 * @returns {Promise<ExecResult>} A promise that resolves with the stdout and stderr of the command. `message` is provided on a failure to explain the error.
 */
function execFileWithInput(
    interpreter: string,
    stdin: string,
    options: ObjectEncodingOptions & ExecOptions
): Promise<ExecResult> {
    // FYI for now, using `exec()` so the interpreter can have cmd+args AIO
    //  could switch to `execFile()` to pass args array separately
    // TODO starts with fish too? "fish -..." PRN use a library to parse the command and determine this?
    if (interpreter.split(" ")[0] === "fish") {
        // PRN also check error from fish and add possible clarification to error message though there are legit ways to trigger that same error message! i.e. `fish .` which is not the same issue!
        return fishWorkaround(interpreter, stdin, options);
    }

    return new Promise((resolve, reject) => {
        const child = exec(interpreter, options, (error, stdout, stderr) => {
            if (error) {
                reject({ message: error.message, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });

        if (stdin) {
            if (child.stdin === null) {
                reject(new Error("Unexpected failure: child.stdin is null"));
                return;
            }
            child.stdin.write(stdin);
            child.stdin.end();
        }
    });
}

async function fishWorkaround(
    interpreter: string,
    stdin: string,
    options: ObjectEncodingOptions & ExecOptions
): Promise<ExecResult> {
    // fish right now chokes on piped input (STDIN) + node's exec/spawn/etc, so lets use a workaround to echo the input
    // base64 encode thee input, then decode in pipeline
    const base64stdin = Buffer.from(stdin).toString("base64");

    const command = `${interpreter} -c "echo ${base64stdin} | base64 -d | fish"`;

    return new Promise((resolve, reject) => {
        // const child = ... // careful with refactoring not to return that unused child
        exec(command, options, (error, stdout, stderr) => {
            // I like this style of error vs success handling! it's beautiful-est (prommises are underrated)
            if (error) {
                reject({ message: error.message, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

let PythonAlias: string = 'notfound';
const aliases = ['python', 'python3', 'py'];

const checkPythonAlias = (index: number) => {
    exec(`${aliases[index]} --version`, (error, stdout, stderr) => {
        if (error) {
            if (index < aliases.length - 1) {
                checkPythonAlias(index+1);
            }
        } else {
            PythonAlias = aliases[index];
        }
    });
}
checkPythonAlias(0);


export { execFileWithInput, ExecResult, PythonAlias };
