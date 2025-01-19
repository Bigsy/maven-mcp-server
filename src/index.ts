#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface MavenSearchResponse {
  response: {
    docs: Array<{
      id: string;
      g: string; // groupId
      a: string; // artifactId
      v: string; // version
      p?: string; // packaging
      timestamp: number;
    }>;
  };
}

interface MavenCoordinate {
  groupId: string;
  artifactId: string;
  version?: string;
  packaging?: string;
  classifier?: string;
}

const parseMavenCoordinate = (dependency: string): MavenCoordinate => {
  const parts = dependency.split(':');
  if (parts.length < 2) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Invalid Maven coordinate format. Minimum format is "groupId:artifactId"'
    );
  }

  return {
    groupId: parts[0],
    artifactId: parts[1],
    version: parts[2],
    packaging: parts[3],
    classifier: parts[4]
  };
};

const isValidMavenArgs = (
  args: any
): args is { dependency: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string';

const isValidVersionCheckArgs = (
  args: any
): args is { dependency: string; version?: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string' &&
  (args.version === undefined || typeof args.version === 'string');

class MavenDepsServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'maven-deps-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://search.maven.org/solrsearch/select',
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_maven_latest_version',
          description: 'Get the latest version of a Maven dependency',
          inputSchema: {
            type: 'object',
            properties: {
              dependency: {
                type: 'string',
                description: 'Maven coordinate in format "groupId:artifactId[:version][:packaging][:classifier]" (e.g. "org.springframework:spring-core" or "org.springframework:spring-core:5.3.20:jar")',
              },
            },
            required: ['dependency'],
          },
        },
        {
          name: 'check_maven_version_exists',
          description: 'Check if a specific version of a Maven dependency exists',
          inputSchema: {
            type: 'object',
            properties: {
              dependency: {
                type: 'string',
                description: 'Maven coordinate in format "groupId:artifactId[:version][:packaging][:classifier]" (e.g. "org.springframework:spring-core" or "org.springframework:spring-core:5.3.20:jar")',
              },
              version: {
                type: 'string',
                description: 'Version to check if not included in dependency string',
              },
            },
            required: ['dependency'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_maven_latest_version':
          return this.handleGetLatestVersion(request.params.arguments);
        case 'check_maven_version_exists':
          return this.handleCheckVersionExists(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGetLatestVersion(args: unknown) {
    if (!isValidMavenArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid Maven dependency format'
      );
    }

    const coord = parseMavenCoordinate(args.dependency);

    try {
      let query = `g:"${coord.groupId}" AND a:"${coord.artifactId}"`;
      if (coord.packaging) {
        query += ` AND p:"${coord.packaging}"`;
      }

      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: query,
          core: 'gav',
          rows: 1,
          wt: 'json',
          sort: 'timestamp desc',
        },
      });

      if (!response.data.response.docs.length) {
        return {
          content: [
            {
              type: 'text',
              text: `No Maven dependency found for ${coord.groupId}:${coord.artifactId}${coord.packaging ? ':' + coord.packaging : ''}`,
            },
          ],
          isError: true,
        };
      }

      const latestVersion = response.data.response.docs[0].v;
      return {
        content: [
          {
            type: 'text',
            text: latestVersion,
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Maven Central API error: ${
                error.response?.data?.error?.msg ?? error.message
              }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async handleCheckVersionExists(args: unknown) {
    if (!isValidVersionCheckArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid Maven dependency format'
      );
    }

    const coord = parseMavenCoordinate(args.dependency);
    // Use version from coordinate if available, otherwise use the version parameter
    const version = coord.version || args.version;
    
    if (!version) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Version must be provided either in dependency string or version parameter'
      );
    }

    try {
      let query = `g:"${coord.groupId}" AND a:"${coord.artifactId}" AND v:"${version}"`;
      if (coord.packaging) {
        query += ` AND p:"${coord.packaging}"`;
      }

      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: query,
          core: 'gav',
          rows: 1,
          wt: 'json',
        },
      });

      const exists = response.data.response.docs.length > 0;
      return {
        content: [
          {
            type: 'text',
            text: exists ? 'true' : 'false',
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Maven Central API error: ${
                error.response?.data?.error?.msg ?? error.message
              }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Maven Dependencies MCP server running on stdio');
  }
}

const server = new MavenDepsServer();
server.run().catch(console.error);
