# Dockerfile for the ActionProof MCP server (stdio).
# Used by Glama to start the server and run an introspection (list-tools) check.
# Builds from source in this repo so it doesn't depend on npm propagation.
FROM node:22-slim

WORKDIR /app

# Install deps first (better layer caching). package-lock.json is committed.
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

# Build the TypeScript -> dist/ (also fixes the bin shebang).
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# The MCP server speaks JSON-RPC over stdio on stdin/stdout. Glama connects to
# this process and issues an introspection request. The server persists its
# Ed25519 identity under $HOME/.actionproof on first run.
CMD ["node", "dist/mcp.js"]
