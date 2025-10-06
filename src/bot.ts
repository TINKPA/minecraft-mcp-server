#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// ========== Type Definitions ==========

type TextContent = {
  type: "text";
  text: string;
};

type ContentItem = TextContent;

type McpResponse = {
  content: ContentItem[];
  _meta?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

interface InventoryItem {
  name: string;
  count: number;
  slot: number;
}

type Direction = 'forward' | 'back' | 'left' | 'right';

interface StoredMessage {
  timestamp: number;
  username: string;
  content: string;
}


// ========== Command Line Argument Parsing ==========

function parseCommandLineArgs() {
  return yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host',
      default: 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Bot username',
      default: 'LLMBot'
    })
    .help()
    .alias('help', 'h')
    .parseSync();
}

// ========== Logging and Responding ==========

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string) {
  const timestamp = new Date().toISOString();
  process.stderr.write(`${timestamp} [minecraft] [${level}] ${message}\n`);
}

function createResponse(text: string): McpResponse {
  return {
    content: [{ type: "text", text }]
  };
}

function createErrorResponse(error: Error | string): McpResponse {
  const errorMessage = formatError(error);
  log('error', errorMessage);
  return {
    content: [{ type: "text", text: `Failed: ${errorMessage}` }],
    isError: true
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// ========== Message Storage ==========

const MAX_STORED_MESSAGES = 100;

class MessageStore {
  private messages: StoredMessage[] = [];
  private maxMessages = MAX_STORED_MESSAGES;

  addMessage(username: string, content: string) {
    const message: StoredMessage = {
      timestamp: Date.now(),
      username,
      content
    };

    this.messages.push(message);

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  getRecentMessages(count: number = 10): StoredMessage[] {
    return this.messages.slice(-count);
  }
}

// Global message store instance
const messageStore = new MessageStore();

// ========== Bot Setup ==========

function setupBot(argv: any): mineflayer.Bot {
  // Configure bot options based on command line arguments
  const botOptions = {
    host: argv.host,
    port: argv.port,
    username: argv.username,
    plugins: { pathfinder },
  };

  // Create a bot instance
  const bot = mineflayer.createBot(botOptions);

  // Set up the bot when it spawns
  bot.once('spawn', async () => {

    // Set up pathfinder movements
    const mcData = minecraftData(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    bot.chat('LLM-powered bot ready to receive instructions!');
    log('info', `Server started and connected successfully. Bot: ${argv.username} on ${argv.host}:${argv.port}`);
  });

  // Register common event handlers
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    messageStore.addMessage(username, message);
  });

  bot.on('kicked', (reason) => {
    log('error', `Bot was kicked: ${formatError(reason)}`);
    bot.quit();
  });

  bot.on('error', (err) => {
    log('error', `Bot error: ${formatError(err)}`);
  });

  return bot;
}

// ========== MCP Server Configuration ==========

function createMcpServer(bot: mineflayer.Bot) {
  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "1.2.0"
  });

  // Register all tool categories
  registerPositionTools(server, bot);
  registerInventoryTools(server, bot);
  registerEntityTools(server, bot);
  registerChatTools(server, bot);
  registerFlightTools(server, bot);
  registerObservationTools(server, bot);
  registerGameStateTools(server, bot);

  return server;
}

// ========== Position and Movement Tools ==========

function registerPositionTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "get-position",
    "Get the current position of the bot",
    {},
    async (): Promise<McpResponse> => {
      try {
        const position = bot.entity.position;
        const pos = {
          x: Math.floor(position.x),
          y: Math.floor(position.y),
          z: Math.floor(position.z)
        };

        return createResponse(`Current position: (${pos.x}, ${pos.y}, ${pos.z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "move-to-position",
    "Move the bot to a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      range: z.number().optional().describe("How close to get to the target (default: 1)")
    },
    async ({ x, y, z, range = 1 }): Promise<McpResponse> => {
      try {
        const goal = new goals.GoalNear(x, y, z, range);
        await bot.pathfinder.goto(goal);

        return createResponse(`Successfully moved to position near (${x}, ${y}, ${z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "look-at",
    "Make the bot look at a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
    },
    async ({ x, y, z }): Promise<McpResponse> => {
      try {
        await bot.lookAt(new Vec3(x, y, z), true);

        return createResponse(`Looking at position (${x}, ${y}, ${z})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "jump",
    "Make the bot jump",
    {},
    async (): Promise<McpResponse> => {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 250);

        return createResponse("Successfully jumped");
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "move-in-direction",
    "Move the bot in a specific direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction to move"),
      duration: z.number().optional().describe("Duration in milliseconds (default: 1000)")
    },
    async ({ direction, duration = 1000 }: { direction: Direction, duration?: number }): Promise<McpResponse> => {
      return new Promise((resolve) => {
        try {
          bot.setControlState(direction, true);

          setTimeout(() => {
            bot.setControlState(direction, false);
            resolve(createResponse(`Moved ${direction} for ${duration}ms`));
          }, duration);
        } catch (error) {
          bot.setControlState(direction, false);
          resolve(createErrorResponse(error as Error));
        }
      });
    }
  );
}

// ========== Inventory Management Tools ==========

function registerInventoryTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "list-inventory",
    "List all items in the bot's inventory",
    {},
    async (): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const itemList: InventoryItem[] = items.map((item: any) => ({
          name: item.name,
          count: item.count,
          slot: item.slot
        }));

        if (items.length === 0) {
          return createResponse("Inventory is empty");
        }

        let inventoryText = `Found ${items.length} items in inventory:\n\n`;
        itemList.forEach(item => {
          inventoryText += `- ${item.name} (x${item.count}) in slot ${item.slot}\n`;
        });

        return createResponse(inventoryText);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "find-item",
    "Find a specific item in the bot's inventory",
    {
      nameOrType: z.string().describe("Name or type of item to find")
    },
    async ({ nameOrType }): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const item = items.find((item: any) =>
          item.name.includes(nameOrType.toLowerCase())
        );

        if (item) {
          return createResponse(`Found ${item.count} ${item.name} in inventory (slot ${item.slot})`);
        } else {
          return createResponse(`Couldn't find any item matching '${nameOrType}' in inventory`);
        }
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "equip-item",
    "Equip a specific item",
    {
      itemName: z.string().describe("Name of the item to equip"),
      destination: z.string().optional().describe("Where to equip the item (default: 'hand')")
    },
    async ({ itemName, destination = 'hand' }): Promise<McpResponse> => {
      try {
        const items = bot.inventory.items();
        const item = items.find((item: any) =>
          item.name.includes(itemName.toLowerCase())
        );

        if (!item) {
          return createResponse(`Couldn't find any item matching '${itemName}' in inventory`);
        }

        await bot.equip(item, destination as mineflayer.EquipmentDestination);
        return createResponse(`Equipped ${item.name} to ${destination}`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}


// ========== Entity Interaction Tools ==========

function registerEntityTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "find-entity",
    "Find the nearest entity of a specific type",
    {
      type: z.string().optional().describe("Type of entity to find (empty for any entity)"),
      maxDistance: z.number().optional().describe("Maximum search distance (default: 16)")
    },
    async ({ type = '', maxDistance = 16 }): Promise<McpResponse> => {
      try {
        const entityFilter = (entity: any) => {
          if (!type) return true;
          if (type === 'player') return entity.type === 'player';
          if (type === 'mob') return entity.type === 'mob';
          return entity.name && entity.name.includes(type.toLowerCase());
        };

        const entity = bot.nearestEntity(entityFilter);

        if (!entity || bot.entity.position.distanceTo(entity.position) > maxDistance) {
          return createResponse(`No ${type || 'entity'} found within ${maxDistance} blocks`);
        }

        return createResponse(`Found ${entity.name || (entity as any).username || entity.type} at position (${Math.floor(entity.position.x)}, ${Math.floor(entity.position.y)}, ${Math.floor(entity.position.z)})`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Chat Tools ==========

function registerChatTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "send-chat",
    "Send a chat message in-game",
    {
      message: z.string().describe("Message to send in chat")
    },
    async ({ message }): Promise<McpResponse> => {
      try {
        bot.chat(message);
        return createResponse(`Sent message: "${message}"`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "read-chat",
    "Get recent chat messages from players",
    {
      count: z.number().optional().describe("Number of recent messages to retrieve (default: 10, max: 100)")
    },
    async ({ count = 10 }): Promise<McpResponse> => {
      try {
        const maxCount = Math.min(count, MAX_STORED_MESSAGES);
        const messages = messageStore.getRecentMessages(maxCount);

        if (messages.length === 0) {
          return createResponse("No chat messages found");
        }

        let output = `Found ${messages.length} chat message(s):\n\n`;
        messages.forEach((msg, index) => {
          const timestamp = new Date(msg.timestamp).toISOString();
          output += `${index + 1}. ${timestamp} - ${msg.username}: ${msg.content}\n`;
        });

        return createResponse(output);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Flight Tools ==========

function registerFlightTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "fly-to",
    "Make the bot fly to a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate")
    },
    async ({ x, y, z }): Promise<McpResponse> => {
      if (!bot.creative) {
        return createResponse("Creative mode is not available. Cannot fly.");
      }

      const controller = new AbortController();
      const FLIGHT_TIMEOUT_MS = 20000;

      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }, FLIGHT_TIMEOUT_MS);

      try {
        const destination = new Vec3(x, y, z);

        await createCancellableFlightOperation(bot, destination, controller);

        return createResponse(`Successfully flew to position (${x}, ${y}, ${z}).`);
      } catch (error) {
        if (controller.signal.aborted) {
          const currentPosAfterTimeout = bot.entity.position;
          return createErrorResponse(
            `Flight timed out after ${FLIGHT_TIMEOUT_MS / 1000} seconds. The destination may be unreachable. ` +
            `Current position: (${Math.floor(currentPosAfterTimeout.x)}, ${Math.floor(currentPosAfterTimeout.y)}, ${Math.floor(currentPosAfterTimeout.z)})`
          );
        }

        log('error', `Flight error: ${formatError(error)}`);
        return createErrorResponse(error as Error);
      } finally {
        clearTimeout(timeoutId);
        bot.creative.stopFlying();
      }
    }
  );
}

function createCancellableFlightOperation(
  bot: mineflayer.Bot,
  destination: Vec3,
  controller: AbortController
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let aborted = false;

    controller.signal.addEventListener('abort', () => {
      aborted = true;
      bot.creative.stopFlying();
      reject(new Error("Flight operation cancelled"));
    });

    bot.creative.flyTo(destination)
      .then(() => {
        if (!aborted) {
          resolve(true);
        }
      })
      .catch((err: any) => {
        if (!aborted) {
          reject(err);
        }
      });
  });
}


// ========== Observation Tools ==========

// Helper function to extract all block properties
function getBlockProperties(block: any): string {
  const properties = [];
  
  // Basic properties
  properties.push(`Name: ${block.name || 'unknown'}`);
  properties.push(`Type ID: ${block.type || 'unknown'}`);
  properties.push(`Position: (${block.position.x}, ${block.position.y}, ${block.position.z})`);
  
  // Material and metadata
  if (block.material) properties.push(`Material: ${block.material}`);
  if (block.metadata !== undefined) properties.push(`Metadata: ${block.metadata}`);
  if (block.biome) properties.push(`Biome: ${block.biome}`);
  
  // Block data (state properties)
  if (block.blockData && Object.keys(block.blockData).length > 0) {
    properties.push(`Block Data: ${JSON.stringify(block.blockData)}`);
  }
  
  // Block entity data (if available)
  if (block.blockEntity) {
    properties.push(`Block Entity: ${JSON.stringify(block.blockEntity)}`);
  }
  
  // Digging properties
  if (block.digTime) {
    properties.push(`Dig Time: ${block.digTime()}ms`);
  }
  
  // Harvest tools
  if (block.harvestTools && Array.isArray(block.harvestTools)) {
    properties.push(`Harvest Tools: ${block.harvestTools.join(', ')}`);
  }
  
  // Bounding box
  if (block.boundingBox) {
    properties.push(`Bounding Box: ${block.boundingBox}`);
  }
  
  // Active status indicators
  const activeStatus = [];
  if (block.blockData?.lit === true) activeStatus.push('LIT');
  if (block.blockData?.powered === true) activeStatus.push('POWERED');
  if (block.blockData?.open === true) activeStatus.push('OPEN');
  if (block.blockData?.extended === true) activeStatus.push('EXTENDED');
  if (block.blockData?.triggered === true) activeStatus.push('TRIGGERED');
  if (block.blockData?.activated === true) activeStatus.push('ACTIVATED');
  
  if (activeStatus.length > 0) {
    properties.push(`Active Status: ${activeStatus.join(', ')}`);
  }
  
  return properties.join('\n');
}

function registerObservationTools(server: McpServer, bot: mineflayer.Bot) {
  // New tool: Get single block with all properties
  server.tool(
    "get-block-at",
    "Get detailed information about a single block at specific coordinates using blockAt function",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      includeExtraInfo: z.boolean().optional().describe("Include extra block entity information (slower)").default(true)
    },
    async ({ x, y, z, includeExtraInfo }): Promise<McpResponse> => {
      try {
        const block = bot.blockAt(new Vec3(x, y, z), includeExtraInfo);
        
        if (!block) {
          return createResponse(`No block found at coordinates (${x}, ${y}, ${z}). The block may not be loaded.`);
        }
        
        const properties = getBlockProperties(block);
        const output = `Block at (${x}, ${y}, ${z}):\n\n${properties}`;
        
        return createResponse(output);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "get-blocks-in-area",
    "Get all blocks within a 3D rectangular area defined by two corner positions with detailed properties",
    {
      x1: z.number().describe("First corner X coordinate"),
      y1: z.number().describe("First corner Y coordinate"),
      z1: z.number().describe("First corner Z coordinate"),
      x2: z.number().describe("Second corner X coordinate"),
      y2: z.number().describe("Second corner Y coordinate"),
      z2: z.number().describe("Second corner Z coordinate"),
      filterType: z.string().optional().describe("Optional: only return blocks of this type"),
      includeProperties: z.boolean().optional().describe("Include detailed block properties").default(false),
      maxBlocks: z.number().optional().describe("Maximum number of blocks to return details for").default(50)
    },
    async ({ x1, y1, z1, x2, y2, z2, filterType, includeProperties, maxBlocks }): Promise<McpResponse> => {
      try {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2);
        const maxZ = Math.max(z1, z2);

        const volumeSize = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
        const MAX_VOLUME = 10000;

        if (volumeSize > MAX_VOLUME) {
          return createResponse(`Area too large (${volumeSize} blocks). Maximum allowed: ${MAX_VOLUME} blocks.`);
        }

        const blockMap = new Map<string, any[]>();
        const detailedBlocks: any[] = [];

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              const block = bot.blockAt(new Vec3(x, y, z), includeProperties);
              if (!block) continue;

              if (filterType && block.name !== filterType) continue;

              const blockInfo = {
                position: new Vec3(x, y, z),
                block: block
              };

              if (!blockMap.has(block.name)) {
                blockMap.set(block.name, []);
              }
              blockMap.get(block.name)!.push(blockInfo);

              // Collect detailed blocks if requested
              if (includeProperties && detailedBlocks.length < maxBlocks) {
                detailedBlocks.push(blockInfo);
              }
            }
          }
        }

        if (blockMap.size === 0) {
          return createResponse(filterType
            ? `No blocks of type '${filterType}' found in the area`
            : "No blocks found in the area");
        }

        let output = `Found ${blockMap.size} different block types:\n\n`;
        
        const sortedEntries = Array.from(blockMap.entries()).sort((a, b) => b[1].length - a[1].length);
        
        sortedEntries.forEach(([blockType, blockInfos]) => {
          output += `- ${blockType}: ${blockInfos.length} blocks\n`;
          const maxPositions = 3;
          if (blockInfos.length <= maxPositions) {
            blockInfos.forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z})\n`;
            });
          } else {
            blockInfos.slice(0, maxPositions).forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z})\n`;
            });
            output += `  ... and ${blockInfos.length - maxPositions} more\n`;
          }
        });

        // Add detailed properties if requested
        if (includeProperties && detailedBlocks.length > 0) {
          output += `\n\nDetailed Properties (showing first ${detailedBlocks.length} blocks):\n`;
          output += '='.repeat(50) + '\n';
          
          detailedBlocks.forEach((blockInfo, index) => {
            output += `\nBlock ${index + 1} at (${blockInfo.position.x}, ${blockInfo.position.y}, ${blockInfo.position.z}):\n`;
            output += getBlockProperties(blockInfo.block) + '\n';
          });
        }
        
        return createResponse(output);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "get-blocks-in-radius",
    "Get all blocks within a spherical radius from a center point with detailed properties",
    {
      x: z.number().describe("Center X coordinate"),
      y: z.number().describe("Center Y coordinate"),
      z: z.number().describe("Center Z coordinate"),
      radius: z.number().describe("Search radius"),
      filterType: z.string().optional().describe("Optional: only return blocks of this type"),
      includeProperties: z.boolean().optional().describe("Include detailed block properties").default(false),
      maxBlocks: z.number().optional().describe("Maximum number of blocks to return details for").default(50)
    },
    async ({ x, y, z, radius, filterType, includeProperties, maxBlocks }): Promise<McpResponse> => {
      try {
        const MAX_RADIUS = 32;
        if (radius > MAX_RADIUS) {
          return createResponse(`Radius too large (${radius}). Maximum allowed: ${MAX_RADIUS} blocks.`);
        }

        const center = new Vec3(x, y, z);
        const blockMap = new Map<string, any[]>();
        const detailedBlocks: any[] = [];

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const pos = new Vec3(x + dx, y + dy, z + dz);
              const distance = pos.distanceTo(center);

              if (distance > radius) continue;

              const block = bot.blockAt(pos, includeProperties);
              if (!block) continue;

              if (filterType && block.name !== filterType) continue;

              const blockInfo = {
                position: pos,
                block: block,
                distance: distance
              };

              if (!blockMap.has(block.name)) {
                blockMap.set(block.name, []);
              }
              blockMap.get(block.name)!.push(blockInfo);

              // Collect detailed blocks if requested
              if (includeProperties && detailedBlocks.length < maxBlocks) {
                detailedBlocks.push(blockInfo);
              }
            }
          }
        }

        if (blockMap.size === 0) {
          return createResponse(filterType
            ? `No blocks of type '${filterType}' found within radius ${radius}`
            : `No blocks found within radius ${radius}`);
        }

        let output = `Found ${blockMap.size} different block types within radius ${radius}:\n\n`;
        
        const sortedEntries = Array.from(blockMap.entries()).sort((a, b) => b[1].length - a[1].length);
        
        sortedEntries.forEach(([blockType, blockInfos]) => {
          output += `- ${blockType}: ${blockInfos.length} blocks\n`;
          const maxPositions = 3;
          if (blockInfos.length <= maxPositions) {
            blockInfos.forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z}) [dist: ${info.distance.toFixed(1)}]\n`;
            });
          } else {
            blockInfos.slice(0, maxPositions).forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z}) [dist: ${info.distance.toFixed(1)}]\n`;
            });
            output += `  ... and ${blockInfos.length - maxPositions} more\n`;
          }
        });

        // Add detailed properties if requested
        if (includeProperties && detailedBlocks.length > 0) {
          output += `\n\nDetailed Properties (showing first ${detailedBlocks.length} blocks):\n`;
          output += '='.repeat(50) + '\n';
          
          // Sort by distance from center
          detailedBlocks.sort((a, b) => a.distance - b.distance);
          
          detailedBlocks.forEach((blockInfo, index) => {
            output += `\nBlock ${index + 1} at (${blockInfo.position.x}, ${blockInfo.position.y}, ${blockInfo.position.z}) [distance: ${blockInfo.distance.toFixed(1)}]:\n`;
            output += getBlockProperties(blockInfo.block) + '\n';
          });
        }
        
        return createResponse(output);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );

  server.tool(
    "scan-layers",
    "Scan horizontal layers at specific Y levels to find blocks with detailed properties",
    {
      centerX: z.number().describe("Center X coordinate"),
      centerZ: z.number().describe("Center Z coordinate"),
      yLevel: z.number().describe("Y level to scan"),
      radius: z.number().describe("Horizontal radius to scan"),
      filterType: z.string().optional().describe("Optional: only return blocks of this type"),
      includeProperties: z.boolean().optional().describe("Include detailed block properties").default(false),
      maxBlocks: z.number().optional().describe("Maximum number of blocks to return details for").default(50)
    },
    async ({ centerX, centerZ, yLevel, radius, filterType, includeProperties, maxBlocks }): Promise<McpResponse> => {
      try {
        const MAX_RADIUS = 32;
        if (radius > MAX_RADIUS) {
          return createResponse(`Radius too large (${radius}). Maximum allowed: ${MAX_RADIUS} blocks.`);
        }

        const blockMap = new Map<string, any[]>();
        const detailedBlocks: any[] = [];

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            if (horizontalDist > radius) continue;

            const pos = new Vec3(centerX + dx, yLevel, centerZ + dz);
            const block = bot.blockAt(pos, includeProperties);
            if (!block) continue;

            if (filterType && block.name !== filterType) continue;

            const blockInfo = {
              position: pos,
              block: block,
              horizontalDistance: horizontalDist
            };

            if (!blockMap.has(block.name)) {
              blockMap.set(block.name, []);
            }
            blockMap.get(block.name)!.push(blockInfo);

            // Collect detailed blocks if requested
            if (includeProperties && detailedBlocks.length < maxBlocks) {
              detailedBlocks.push(blockInfo);
            }
          }
        }

        if (blockMap.size === 0) {
          return createResponse(filterType
            ? `No blocks of type '${filterType}' found at Y level ${yLevel}`
            : `No blocks found at Y level ${yLevel}`);
        }

        let output = `Found ${blockMap.size} different block types at Y level ${yLevel}:\n\n`;
        
        const sortedEntries = Array.from(blockMap.entries()).sort((a, b) => b[1].length - a[1].length);
        
        sortedEntries.forEach(([blockType, blockInfos]) => {
          output += `- ${blockType}: ${blockInfos.length} blocks\n`;
          const maxPositions = 3;
          if (blockInfos.length <= maxPositions) {
            blockInfos.forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z}) [dist: ${info.horizontalDistance.toFixed(1)}]\n`;
            });
          } else {
            blockInfos.slice(0, maxPositions).forEach(info => {
              output += `  at (${info.position.x}, ${info.position.y}, ${info.position.z}) [dist: ${info.horizontalDistance.toFixed(1)}]\n`;
            });
            output += `  ... and ${blockInfos.length - maxPositions} more\n`;
          }
        });

        // Add detailed properties if requested
        if (includeProperties && detailedBlocks.length > 0) {
          output += `\n\nDetailed Properties (showing first ${detailedBlocks.length} blocks):\n`;
          output += '='.repeat(50) + '\n';
          
          // Sort by horizontal distance from center
          detailedBlocks.sort((a, b) => a.horizontalDistance - b.horizontalDistance);
          
          detailedBlocks.forEach((blockInfo, index) => {
            output += `\nBlock ${index + 1} at (${blockInfo.position.x}, ${blockInfo.position.y}, ${blockInfo.position.z}) [distance: ${blockInfo.horizontalDistance.toFixed(1)}]:\n`;
            output += getBlockProperties(blockInfo.block) + '\n';
          });
        }
        
        return createResponse(output);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Game State Tools ============

function registerGameStateTools(server: McpServer, bot: mineflayer.Bot) {
  server.tool(
    "detect-gamemode",
    "Detect the gamemode on game",
    {},
    async (): Promise<McpResponse> => {
      try {
        return createResponse(`Bot gamemode: "${bot.game.gameMode}"`);
      } catch (error) {
        return createErrorResponse(error as Error);
      }
    }
  );
}

// ========== Main Application ==========

async function main() {
  let bot: mineflayer.Bot | undefined;

  try {
    // Parse command line arguments
    const argv = parseCommandLineArgs();

    // Set up the Minecraft bot
    bot = setupBot(argv);

    // Create and configure MCP server
    const server = createMcpServer(bot);

    // Handle stdin end - this will detect when MCP Client is closed
    process.stdin.on('end', () => {
      if (bot) bot.quit();
      log('info', 'MCP Client has disconnected. Shutting down...');
      process.exit(0);
    });

    // Connect to the transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    if (bot) bot.quit();
    log('error', `Failed to start server: ${formatError(error)}`);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  log('error', `Fatal error in main(): ${formatError(error)}`);
  process.exit(1);
});