// Postbuild: the compiled MCP entry inherits the source shebang, which requests
// --experimental-strip-types (only on Node 22.6+). Compiled JS runs on plain
// node, so rewrite it to a portable shebang that works on Node >=20.
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

const path = new URL("../dist/mcp.js", import.meta.url);
const src = readFileSync(path, "utf8").split("\n");
if (src[0].startsWith("#!")) src.shift();
writeFileSync(path, "#!/usr/bin/env node\n" + src.join("\n"));
chmodSync(path, 0o755); // ensure the bin is executable
console.log("fixed dist/mcp.js shebang -> #!/usr/bin/env node");
