const isDev = import.meta.env.DEV;

function getLocation() {
    const err = new Error();
    const stack = err.stack?.split("\n");

    // stack looks like:
    // Error
    //    at logger.log (logger.js:12:15)
    //    at MyComponent.jsx:37:10

    if (!stack || stack.length < 3) return "";

    // The caller is usually line 3 or 4 depending on bundler
    const callerLine = stack[3] || stack[2];

    // Extract just "filename:line:column"
    const match = callerLine.match(/(\w+\.jsx?:\d+:\d+|\w+\.ts?:\d+:\d+)/);
    return match ? match[1] : "";
}

const logger = {
    log: (...args) => {
        if (isDev) {
            console.log(`[LOG][${getLocation()}]`, ...args);
        }
    },
    info: (...args) => {
        if (isDev) {
            console.info(`[INFO][${getLocation()}]`, ...args);
        }
    },
    warn: (...args) => {
        if (isDev) {
            console.warn(`[WARN][${getLocation()}]`, ...args);
        }
    },
    error: (...args) => {
        console.error(`[ERROR][${getLocation()}]`, ...args);
    },
};

export default logger;
