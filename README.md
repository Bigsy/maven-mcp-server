# Maven Dependencies MCP Server

An MCP (Model Context Protocol) server that provides tools for checking Maven dependency versions. This server enables LLMs to verify Maven dependencies and retrieve their latest versions from Maven Central Repository.

## Features

- Query the latest version of any Maven dependency
- Verify if a Maven dependency exists
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

## Example Responses

### Valid Dependency
```typescript
// Input: org.springframework:spring-core
"6.2.1"

// Input: org.apache.kafka:kafka-clients
"3.7.2"
```

### Invalid Dependency
```typescript
// Input: nonexistent.group:fake-artifact
"No Maven dependency found for nonexistent.group:fake-artifact"
```

## Implementation Details

- Uses Maven Central's REST API to fetch dependency information
- Sorts results by timestamp to ensure the latest version is returned
- Includes error handling for invalid dependencies and API issues
- Returns clean, parseable version strings for valid dependencies

## Error Handling

The server handles various error cases:
- Invalid dependency format
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
