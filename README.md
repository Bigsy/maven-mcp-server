<a href="https://www.npmjs.com/package/mcp-maven-deps"><img src="https://img.shields.io/npm/v/mcp-maven-deps.svg" alt="npm version" /></a>
# Maven Dependencies MCP Server

An MCP (Model Context Protocol) server that provides tools for checking Maven dependency versions. This server enables LLMs to verify Maven dependencies and retrieve their latest versions from Maven Central Repository.

<a href="https://glama.ai/mcp/servers/juuo2ye0qi"><img width="380" height="200" src="https://glama.ai/mcp/servers/juuo2ye0qi/badge" alt="maven-mcp-server MCP server" /></a> 


## Installation

You can install this MCP server globally using npm:

```bash
npm install -g mcp-maven-deps
```

Or run it directly using npx:

```bash
npx mcp-maven-deps
```

### Installing via Smithery

To install Maven Dependencies Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/maven-deps-server):

```bash
npx -y @smithery/cli install maven-deps-server --client claude
```

## Features

- Query the latest version of any Maven dependency
- Verify if a Maven dependency exists
- Check if a specific version of a dependency exists
- Support for full Maven coordinates including packaging and classifier
- Real-time access to Maven Central Repository data
- Compatible with multiple build tool formats (Maven, Gradle, SBT, Mill)



For development:

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the server: `npm run build`

## Configuration

Add the server to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "maven-deps-server": {
      "command": "npx",
      "args": ["mcp-maven-deps"]
    }
  }
}
```

If installed globally, you can also use:

```json
{
  "mcpServers": {
    "maven-deps-server": {
      "command": "mcp-maven-deps"
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
      "description": "Maven coordinate in format \"groupId:artifactId[:version][:packaging][:classifier]\" (e.g. \"org.springframework:spring-core\" or \"org.springframework:spring-core:5.3.20:jar\")"
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
// Returns: "6.2.2"
```

### check_maven_version_exists

Checks if a specific version of a Maven dependency exists. The version can be provided either in the dependency string or as a separate parameter.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dependency": {
      "type": "string",
      "description": "Maven coordinate in format \"groupId:artifactId[:version][:packaging][:classifier]\" (e.g. \"org.springframework:spring-core\" or \"org.springframework:spring-core:5.3.20:jar\")"
    },
    "version": {
      "type": "string",
      "description": "Version to check if not included in dependency string"
    }
  },
  "required": ["dependency"]
}
```

**Example Usage:**
```typescript
// Using version in dependency string
const result1 = await mcpClient.callTool("maven-deps-server", "check_maven_version_exists", {
  dependency: "org.springframework:spring-core:5.3.20"
});

// Using separate version parameter
const result2 = await mcpClient.callTool("maven-deps-server", "check_maven_version_exists", {
  dependency: "org.springframework:spring-core",
  version: "5.3.20"
});
```

## Implementation Details

- Uses Maven Central's REST API to fetch dependency information
- Supports full Maven coordinates (groupId:artifactId:version:packaging:classifier)
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
- Missing version information

## Development

To modify or extend the server:

1. Make changes to `src/index.ts`
2. Rebuild using `npm run build`
3. Restart the MCP server to apply changes

## License

MIT
