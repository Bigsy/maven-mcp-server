# Maven Dependencies MCP Server

An MCP (Model Context Protocol) server that provides tools for checking Maven dependency versions. This server enables LLMs to verify Maven dependencies and retrieve their latest versions from Maven Central Repository.

<a href="https://glama.ai/mcp/servers/juuo2ye0qi"><img width="380" height="200" src="https://glama.ai/mcp/servers/juuo2ye0qi/badge" alt="maven-mcp-server MCP server" /></a>

## Features

- Query the latest version of any Maven dependency
- Verify if a Maven dependency exists
- Check if a specific version of a dependency exists
- Real-time access to Maven Central Repository data

## Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```
3. Build the server:
```bash
npm run build
```

## Configuration

Add the server to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "maven-deps-server": {
      "command": "node",
      "args": ["/path/to/maven-deps-server/build/index.js"]
    }
  }
}
```

## Available Tools

### get_maven_latest_version

Retrieves the latest version of a Maven dependency.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dependency": {
      "type": "string",
      "description": "Maven dependency in format \"groupId:artifactId\" (e.g. \"org.springframework:spring-core\")"
    }
  },
  "required": ["dependency"]
}
```

**Example Usage:**
```typescript
const result = await mcpClient.callTool("maven-deps-server", "get_maven_latest_version", {
  dependency: "org.springframework:spring-core"
});
// Returns: "6.2.1"
```

### check_maven_version_exists

Checks if a specific version of a Maven dependency exists.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dependency": {
      "type": "string",
      "description": "Maven dependency in format \"groupId:artifactId\" (e.g. \"org.springframework:spring-core\")"
    },
    "version": {
      "type": "string",
      "description": "Version to check (e.g. \"5.3.20\")"
    }
  },
  "required": ["dependency", "version"]
}
```

**Example Usage:**
```typescript
const result = await mcpClient.callTool("maven-deps-server", "check_maven_version_exists", {
  dependency: "org.springframework:spring-core",
  version: "5.3.20"
});
// Returns: "true" or "false"
```

## Example Responses

### Latest Version Check
```typescript
// Input: org.springframework:spring-core
"6.2.1"

// Input: org.apache.kafka:kafka-clients
"3.7.2"

// Input: nonexistent.group:fake-artifact
"No Maven dependency found for nonexistent.group:fake-artifact"
```

### Version Existence Check
```typescript
// Input: { dependency: "org.springframework:spring-core", version: "5.3.20" }
"true"

// Input: { dependency: "org.springframework:spring-core", version: "0.0.1" }
"false"
```

## Implementation Details

- Uses Maven Central's REST API to fetch dependency information
- Sorts results by timestamp to ensure the latest version is returned
- Includes error handling for invalid dependencies and API issues
- Returns clean, parseable version strings for valid dependencies
- Provides boolean responses for version existence checks

## Error Handling

The server handles various error cases:
- Invalid dependency format
- Invalid version format
- Non-existent dependencies
- API connection issues
- Malformed responses

## Development

To modify or extend the server:

1. Make changes to `src/index.ts`
2. Rebuild using `npm run build`
3. Restart the MCP server to apply changes

## License

MIT
