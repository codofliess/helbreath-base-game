const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const outDir = path.join("src", "proto", "generated");
fs.mkdirSync(outDir, { recursive: true });

const binDir = path.join(__dirname, "..", "node_modules", ".bin");
const plugin =
  process.platform === "win32"
    ? path.join(binDir, "protoc-gen-ts_proto.CMD")
    : path.join(binDir, "protoc-gen-ts_proto");

// Use local shim — bare `grpc_tools_node_protoc` is often missing from PATH on Windows.
const protocCmd =
  process.platform === "win32"
    ? path.join(binDir, "grpc_tools_node_protoc.CMD")
    : path.join(binDir, "grpc_tools_node_protoc");

const args = [
  `--plugin=protoc-gen-ts_proto=${plugin}`,
  `--ts_proto_out=./${outDir.replace(/\\/g, "/")}`,
  "--ts_proto_opt=esModuleInterop=true,env=browser,forceLong=bigint,oneof=unions-value,outputServices=none,outputJsonMethods=false",
  "../proto/network.proto",
  "--proto_path=../proto",
];

const r = spawnSync(protocCmd, args, {
  stdio: "inherit",
  shell: true,
  cwd: path.join(__dirname, ".."),
});
process.exit(r.status ?? 1);
