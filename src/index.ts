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
      timestamp: number;
    }>;
  };
}

const isValidMavenArgs = (
  args: any
): args is { dependency: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string' &&
  args.dependency.includes(':');

const isValidVersionCheckArgs = (
  args: any
): args is { dependency: string; version: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string' &&
  args.dependency.includes(':') &&
  typeof args.version === 'string';

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
                description: 'Maven dependency in format "groupId:artifactId" (e.g. "org.springframework:spring-core")',
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
                description: 'Maven dependency in format "groupId:artifactId" (e.g. "org.springframework:spring-core")',
              },
              version: {
                type: 'string',
                description: 'Version to check (e.g. "5.3.20")',
              },
            },
            required: ['dependency', 'version'],
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
        'Invalid Maven dependency format. Expected "groupId:artifactId"'
      );
    }

    const [groupId, artifactId] = args.dependency.split(':');

    try {
      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: `g:"${groupId}" AND a:"${artifactId}"`,
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
              text: `No Maven dependency found for ${groupId}:${artifactId}`,
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
        'Invalid arguments. Expected "dependency" (groupId:artifactId) and "version"'
      );
    }

    const [groupId, artifactId] = args.dependency.split(':');
    const version = args.version;

    try {
      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: `g:"${groupId}" AND a:"${artifactId}" AND v:"${version}"`,
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
