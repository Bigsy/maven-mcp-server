#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from 'http';
import express, { Request, Response } from 'express';
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

const isPreReleaseVersion = (version: string): boolean => {
  // Maven pre-release qualifiers: alpha, beta, milestone, rc/cr, snapshot
  const preReleasePattern = /-(alpha|a|beta|b|milestone|m|rc|cr|snapshot)/i;
  return preReleasePattern.test(version);
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

const isValidReleaseArgs = (
  args: any
): args is { dependency: string; excludePreReleases?: boolean } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string' &&
  (args.excludePreReleases === undefined || typeof args.excludePreReleases === 'boolean');

const isValidListVersionsArgs = (
  args: any
): args is { dependency: string; depth?: number; excludePreReleases?: boolean } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.dependency === 'string' &&
  (args.depth === undefined || (typeof args.depth === 'number' && args.depth > 0)) &&
  (args.excludePreReleases === undefined || typeof args.excludePreReleases === 'boolean');

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
          name: 'get_latest_release',
          description: 'Get the latest release version of a Maven dependency (excludes pre-releases by default)',
          inputSchema: {
            type: 'object',
            properties: {
              dependency: {
                type: 'string',
                description: 'Maven coordinate in format "groupId:artifactId[:version][:packaging][:classifier]" (e.g. "org.springframework:spring-core" or "org.springframework:spring-core:5.3.20:jar")',
              },
              excludePreReleases: {
                type: 'boolean',
                description: 'Whether to exclude pre-release versions (alpha, beta, milestone, RC, snapshot). Default: true',
                default: true,
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
        {
          name: 'list_maven_versions',
          description: 'List Maven dependency versions sorted by last updated date (most recent first)',
          inputSchema: {
            type: 'object',
            properties: {
              dependency: {
                type: 'string',
                description: 'Maven coordinate in format "groupId:artifactId[:packaging][:classifier]" (e.g. "org.springframework:spring-core" or "org.springframework:spring-core:jar")',
              },
              depth: {
                type: 'number',
                description: 'Number of versions to return (default: 15)',
                minimum: 1,
                maximum: 100,
              },
              excludePreReleases: {
                type: 'boolean',
                description: 'Whether to exclude pre-release versions (alpha, beta, milestone, RC, snapshot). Default: true',
                default: true,
              },
            },
            required: ['dependency'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_latest_release':
          return this.handleGetLatestRelease(request.params.arguments);
        case 'check_maven_version_exists':
          return this.handleCheckVersionExists(request.params.arguments);
        case 'list_maven_versions':
          return this.handleListVersions(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGetLatestRelease(args: unknown) {
    if (!isValidReleaseArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid Maven dependency format'
      );
    }

    const coord = parseMavenCoordinate(args.dependency);
    const excludePreReleases = args.excludePreReleases ?? true; // Default to true

    try {
      let query = `g:"${coord.groupId}" AND a:"${coord.artifactId}"`;
      if (coord.packaging) {
        query += ` AND p:"${coord.packaging}"`;
      }

      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: query,
          core: 'gav',
          rows: 100, // Get more results for filtering
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

      // Filter versions if needed
      let versions = response.data.response.docs;
      if (excludePreReleases) {
        versions = versions.filter(doc => !isPreReleaseVersion(doc.v));
        if (versions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No stable releases found for ${coord.groupId}:${coord.artifactId}${coord.packaging ? ':' + coord.packaging : ''}. All available versions are pre-releases.`,
              },
            ],
            isError: true,
          };
        }
      }

      // Return the most recently updated version (after filtering)
      const latestVersion = versions[0].v;
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

  private async handleListVersions(args: unknown) {
    if (!isValidListVersionsArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid Maven dependency format'
      );
    }

    const coord = parseMavenCoordinate(args.dependency);
    const depth = args.depth || 15;
    const excludePreReleases = args.excludePreReleases ?? true; // Default to true

    try {
      let query = `g:"${coord.groupId}" AND a:"${coord.artifactId}"`;
      if (coord.packaging) {
        query += ` AND p:"${coord.packaging}"`;
      }

      const response = await this.axiosInstance.get<MavenSearchResponse>('', {
        params: {
          q: query,
          core: 'gav',
          rows: 100,
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

      // Filter versions if needed
      let filteredDocs = response.data.response.docs;
      if (excludePreReleases) {
        filteredDocs = filteredDocs.filter(doc => !isPreReleaseVersion(doc.v));
      }

      if (filteredDocs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: excludePreReleases 
                ? `No stable releases found for ${coord.groupId}:${coord.artifactId}${coord.packaging ? ':' + coord.packaging : ''}. All available versions are pre-releases.`
                : `No Maven dependency found for ${coord.groupId}:${coord.artifactId}${coord.packaging ? ':' + coord.packaging : ''}`,
            },
          ],
          isError: true,
        };
      }

      const versions = filteredDocs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, depth)
        .map(doc => `${doc.v} (${new Date(doc.timestamp).toISOString().split('T')[0]})`);

      return {
        content: [
          {
            type: 'text',
            text: versions.join('\n'),
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

  async run(opts?: { port?: number; host?: string }) {
    let transport: StdioServerTransport | SSEServerTransport | undefined;
    
    if (opts?.port) {
      const app = express();
      const httpServer = createServer(app);
      let currentTransport: SSEServerTransport | undefined;

      app.get('/sse', (req: Request, res: Response) => {
        currentTransport = new SSEServerTransport('/mcp', res);
        transport = currentTransport;
        this.server.connect(transport).catch(console.error);
        res.on('close', () => {
          console.error('SSE connection closed');
          if (currentTransport) {
            this.server.close();
            currentTransport = undefined;
            transport = undefined;
          }
        });
      });

      app.post('/mcp', express.json(), (req: Request, res: Response) => {
        if (!currentTransport) {
          res.status(400).send('No active SSE connection');
          return;
        }
        res.json({ message: 'Message received' });
      });

      const host = opts.host || 'localhost';
      await new Promise<void>((resolve) => {
        httpServer.listen(opts.port, host, () => {
          console.error(`Maven Dependencies MCP server running on SSE at http://${host}:${opts.port}`);
          resolve();
        });
      });
    } else {
      transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Maven Dependencies MCP server running on stdio');
    }
  }
}

const server = new MavenDepsServer();

// Check if port is provided as command line argument
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1]) : undefined;
const hostArg = process.argv.find(arg => arg.startsWith('--host='));
const host = hostArg ? hostArg.split('=')[1] : undefined;

server.run({ port, host }).catch(console.error);
