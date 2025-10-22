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

- Get the latest stable release of any Maven dependency (excludes pre-releases by default)
- Verify if a Maven dependency exists
- Check if a specific version of a dependency exists
- List Maven dependency versions with optional pre-release filtering
- Intelligent pre-release detection (alpha, beta, milestone, RC, snapshot)
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

## Transport Options

The server supports two transport modes:

1. **stdio** (default) - Standard input/output communication
2. **SSE** (Server-Sent Events) - HTTP-based communication with optional remote access

To use SSE transport, you can specify both host and port:

```bash
# Local access only (default host: localhost)
npx mcp-maven-deps --port=3000

# Remote access
npx mcp-maven-deps --host=0.0.0.0 --port=3000
```

When using SSE transport in your MCP settings:

```json
{
  "mcpServers": {
    "maven-deps-server": {
      "command": "npx",
      "args": ["mcp-maven-deps", "--port=3000"]
    }
  }
}
```

For remote access, use the server's IP or hostname in your client configuration:

```json
{
  "mcpServers": {
    "maven-deps-server": {
      "command": "npx",
      "args": ["mcp-maven-deps", "--host=your-server-ip", "--port=3000"]
    }
  }
}
```

## Available Tools

### get_latest_release

Retrieves the latest stable release version of a Maven dependency. By default, this excludes pre-release versions (alpha, beta, milestone, RC, snapshot) to ensure you get production-ready versions.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dependency": {
      "type": "string",
      "description": "Maven coordinate in format \"groupId:artifactId[:version][:packaging][:classifier]\" (e.g. \"org.springframework:spring-core\" or \"org.springframework:spring-core:5.3.20:jar\")"
    },
    "excludePreReleases": {
      "type": "boolean",
      "description": "Whether to exclude pre-release versions (alpha, beta, milestone, RC, snapshot). Default: true",
      "default": true
    }
  },
  "required": ["dependency"]
}
```

**Example Usage:**
```typescript
// Get latest stable release (default behavior)
const result1 = await mcpClient.callTool("maven-deps-server", "get_latest_release", {
    dependency: "org.springframework:spring-core"
});
// Returns: "6.2.8" (latest stable, excludes "7.0.0-M6" milestone)

// Include pre-releases if needed
const result2 = await mcpClient.callTool("maven-deps-server", "get_latest_release", {
    dependency: "org.springframework:spring-core",
    excludePreReleases: false
});
// Returns: "7.0.0-M6" (includes pre-releases)
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

### list_maven_versions

Lists Maven dependency versions sorted by last updated date (most recent first) with optional pre-release filtering and depth control.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "dependency": {
      "type": "string",
      "description": "Maven coordinate in format \"groupId:artifactId[:packaging][:classifier]\" (e.g. \"org.springframework:spring-core\" or \"org.springframework:spring-core:jar\")"
    },
    "depth": {
      "type": "number",
      "description": "Number of versions to return (default: 15)",
      "minimum": 1,
      "maximum": 100
    },
    "excludePreReleases": {
      "type": "boolean",
      "description": "Whether to exclude pre-release versions (alpha, beta, milestone, RC, snapshot). Default: true",
      "default": true
    }
  },
  "required": ["dependency"]
}
```

**Example Usage:**
```typescript
// Get last 15 stable versions (default - excludes pre-releases)
const result1 = await mcpClient.callTool("maven-deps-server", "list_maven_versions", {
    dependency: "org.springframework:spring-core"
});
// Returns only stable versions: "6.2.8 (2025-06-12)\n6.1.21 (2025-06-12)\n6.2.7 (2025-05-15)\n..."

// Get last 5 versions including pre-releases
const result2 = await mcpClient.callTool("maven-deps-server", "list_maven_versions", {
    dependency: "org.springframework:spring-core",
    depth: 5,
    excludePreReleases: false
});
// Returns: "7.0.0-M6 (2025-06-12)\n6.2.8 (2025-06-12)\n6.1.21 (2025-06-12)\n7.0.0-M5 (2025-05-15)\n6.2.7 (2025-05-15)"
```

## Implementation Details

- Primary source: Maven Central's `maven-metadata.xml` for accurate and up-to-date version information
- Fallback: Maven Central's Solr Search API when metadata is unavailable
- Supports full Maven coordinates (groupId:artifactId:version:packaging:classifier)
- Intelligent pre-release detection using regex pattern matching
- Returns versions sorted by their release order (most recent first)
- Includes error handling for invalid dependencies and API issues
- Returns clean, parseable version strings for valid dependencies
- Provides boolean responses for version existence checks

**Note:** Version 0.1.8+ uses `maven-metadata.xml` as the primary source to ensure the latest versions are always returned, even if they haven't been indexed in the Solr search API yet. This fixes issues where newly released versions (like mockito-kotlin 6.1.0) were not being detected.

## Pre-release Detection

The server automatically detects pre-release versions using the following patterns:
- **Alpha**: `-alpha`, `-a`
- **Beta**: `-beta`, `-b`
- **Milestone**: `-milestone`, `-m`, `-M`
- **Release Candidate**: `-rc`, `-cr`
- **Snapshot**: `-snapshot`

Examples:
- `7.0.0-M6` → Pre-release (milestone)
- `6.2.8` → Stable release
- `3.1.0-SNAPSHOT` → Pre-release (snapshot)
- `2.5.0-RC1` → Pre-release (release candidate)

**Breaking Change Note:** The tool has been renamed from `get_maven_last_updated_version` to `get_latest_release` and now excludes pre-releases by default. This ensures production applications get stable versions by default, while still allowing access to pre-releases when needed.

## Error Handling

The server handles various error cases:
- Invalid dependency format
- Invalid version format
- Non-existent dependencies
- No stable releases found (when filtering is enabled)
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