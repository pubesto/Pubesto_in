const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");

const host = process.env.HOST || "127.0.0.1";
const nextPort = Number(process.env.PORT || 3000);
const redirectPort = Number(process.env.DEV_REDIRECT_PORT || 300);
const redirectHosts = (process.env.DEV_REDIRECT_HOSTS || "127.0.0.1,::1")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const publicNextHost = ["0.0.0.0", "::"].includes(host) ? "localhost" : host;

let redirectServers = [];
let nextProcess = null;

function isPortOpen(port, hostname) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });

    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

function startRedirectServer() {
  if (!Number.isFinite(redirectPort) || redirectPort === nextPort) return;

  for (const redirectHost of redirectHosts) {
    const redirectServer = http.createServer((request, response) => {
      const target = `http://${publicNextHost}:${nextPort}${request.url || "/"}`;

      response.writeHead(307, {
        Location: target,
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(`Redirecting to ${target}\n`);
    });

    redirectServer.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`Port ${redirectPort} is already in use on ${redirectHost}; skipping that redirect listener.`);
        return;
      }

      console.warn(`Could not start ${redirectHost}:${redirectPort} redirect: ${error.message}`);
    });

    const listenOptions = redirectHost.includes(":")
      ? { host: redirectHost, port: redirectPort, ipv6Only: true }
      : { host: redirectHost, port: redirectPort };

    redirectServer.listen(listenOptions, () => {
      redirectServers.push(redirectServer);
      console.log(`Redirecting ${redirectHost}:${redirectPort} -> http://${publicNextHost}:${nextPort}`);
    });
  }
}

function stopRedirectServer() {
  for (const redirectServer of redirectServers) {
    redirectServer.close();
  }
  redirectServers = [];
}

async function main() {
  startRedirectServer();

  if (await isPortOpen(nextPort, host)) {
    console.log(`Port ${nextPort} is already open; keeping the localhost:${redirectPort} redirect active.`);
    process.stdin.resume();
    return;
  }

  const nextBin = require.resolve("next/dist/bin/next");
  nextProcess = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", host, "--port", String(nextPort)],
    {
      env: process.env,
      stdio: "inherit",
    },
  );

  nextProcess.on("exit", (code, signal) => {
    stopRedirectServer();

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopRedirectServer();
    if (nextProcess) {
      nextProcess.kill(signal);
    } else {
      process.exit(0);
    }
  });
}

main().catch((error) => {
  stopRedirectServer();
  console.error(error);
  process.exit(1);
});
