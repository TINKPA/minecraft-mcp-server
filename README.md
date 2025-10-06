# Minecraft MCP Server

> ⚠️ **CLAUDE DESKTOP DUAL LAUNCH WARNING**: Claude Desktop may sometimes launch MCP servers twice ([known issue](https://github.com/modelcontextprotocol/servers/issues/812)), which can lead to incorrect behavior of this MCP server. If you experience issues, restart Claude Desktop application to fix the problem. Alternatively, consider using other MCP clients.

https://github.com/user-attachments/assets/6f17f329-3991-4bc7-badd-7cde9aacb92f

A Minecraft bot powered by large language models and [Mineflayer API](https://github.com/PrismarineJS/mineflayer). This bot uses the [Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) to enable Claude and other supported models to control a Minecraft character.

<a href="https://glama.ai/mcp/servers/@yuniko-software/minecraft-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@yuniko-software/minecraft-mcp-server/badge" alt="mcp-minecraft MCP server" />
</a>

## Prerequisites

- Git
- Node.js
- A running Minecraft game (the setup below was tested with Minecraft 1.21.8 Java Edition included in Microsoft Game Pass)
- An MCP-compatible client. Claude Desktop will be used as an example, but other MCP clients are also supported

## Getting started

This bot is designed to be used with Claude Desktop through the Model Context Protocol (MCP).

### Run Minecraft

Create a singleplayer world and open it to LAN (`ESC -> Open to LAN`). Bot will try to connect using port `25565` and hostname `localhost`. These parameters could be configured in `claude_desktop_config.json` on a next step. 

### MCP Configuration

Make sure that [Claude Desktop](https://claude.ai/download) is installed. Open `File -> Settings -> Developer -> Edit Config`. It should open installation directory. Find file with a name `claude_desktop_config.json` and insert the following code:

#### For Local Development

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": [
        "/Volumes/Samsung Portable SSD T5/danieltangX/Developer/minecraft-mcp-server/dist/bot.js",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "ClaudeBot"
      ]
    }
  }
}
```

**Note:** Make sure to run `npm run build` first to compile the TypeScript code to the `dist` directory.

#### For NPM Package

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:yuniko-software/minecraft-mcp-server",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "ClaudeBot"
      ]
    }
  }
}
```

Double-check that right `--port` and `--host` parameters were used. Make sure to completely reboot the Claude Desktop application (should be closed in OS tray). 

## Running

Make sure Minecraft game is running and the world is opened to LAN. Then start Claude Desktop application and the bot should join the game. 

It could take some time for Claude Desktop to boot the MCP server. The marker that the server has booted successfully:

![image](https://github.com/user-attachments/assets/39211d34-c3b3-46d6-bc80-353fd4fba690)

You can give bot any commands through any active Claude Desktop chat. You can also upload images of buildings and ask bot to build them 😁

Don't forget to mention that bot should do something in Minecraft in your prompt. Because saying this is a trigger to run MCP server. It will ask for your permissions.

Using Claude 4.0 Sonnet could give you some interesting results. The bot-agent would be really smart 🫡

Example usage: [shared Claude chat](https://claude.ai/share/535d5f69-f102-4cdb-9801-f74ea5709c0b)

## Available Commands

Once connected to a Minecraft server, Claude can use these commands:

### Movement
- `get-position` - Get the current position of the bot
- `move-to-position` - Move to specific coordinates
- `look-at` - Make the bot look at specific coordinates
- `jump` - Make the bot jump
- `move-in-direction` - Move in a specific direction for a duration

### Flight
- `fly-to` - Make the bot fly directly to specific coordinates

### Inventory
- `list-inventory` - List all items in the bot's inventory
- `find-item` - Find a specific item in inventory
- `equip-item` - Equip a specific item

### Block Interaction
- `place-block` - Place a block at specified coordinates
- `dig-block` - Dig a block at specified coordinates
- `get-block-info` - Get information about a block
- `find-block` - Find the nearest block of a specific type

### Observation
- `get-block-at` - Get detailed information about a single block at specific coordinates with all properties
- `get-blocks-in-area` - Get all blocks within a 3D rectangular area defined by two corner positions with detailed properties
- `get-blocks-in-radius` - Get all blocks within a spherical radius from a center point with detailed properties
- `scan-layers` - Scan horizontal layers at specific Y levels to find blocks with detailed properties

### Entity Interaction
- `find-entity` - Find the nearest entity of a specific type

### Communication
- `send-chat` - Send a chat message in-game
- `read-chat` - Get recent chat messages from players

### Game State
- `detect-gamemode` - Detect the gamemode on game

## Developer Setup

### Prerequisites for Development

- Node.js (>=16.0.0)
- npm or yarn
- TypeScript knowledge
- Git

### Building the Project

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TINKPA/minecraft-mcp-server.git
   cd minecraft-mcp-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the TypeScript code:**
   ```bash
   npm run build
   ```
   This compiles the TypeScript source code in `src/` to JavaScript in `dist/`.

4. **Make the binary executable:**
   ```bash
   chmod +x dist/bot.js
   ```

5. **Test the build:**
   ```bash
   node dist/bot.js --help
   ```

### Development Workflow

1. **Make changes** to TypeScript files in the `src/` directory
2. **Build the project** with `npm run build`
3. **Test your changes** by running the MCP server locally
4. **Commit and push** your changes

### Project Structure

```
minecraft-mcp-server/
├── src/
│   ├── bot.ts              # Main MCP server implementation
│   └── types.d.ts          # TypeScript type definitions
├── dist/                   # Compiled JavaScript (auto-generated)
│   └── bot.js              # Main executable file
├── package.json            # Project configuration and dependencies
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
└── README.md               # This file
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled bot.js
- `npm run lint` - Check code for linting issues
- `npm run lint:fix` - Automatically fix linting issues

### Key Features for Developers

#### Enhanced Observation Tools

The project includes comprehensive block observation tools that integrate with mineflayer's `blockAt` function:

- **`get-block-at`** - Get detailed information about a single block
- **`get-blocks-in-area`** - Scan rectangular areas with detailed properties
- **`get-blocks-in-radius`** - Find blocks within spherical radius
- **`scan-layers`** - Scan horizontal layers at specific Y levels

#### Block Properties Extracted

The `getBlockProperties()` helper function extracts:
- Basic properties (name, type, position, material)
- Block data (state properties like lit, powered, open)
- Block entity data (signs, chests, etc.)
- Active status indicators (LIT, POWERED, OPEN, EXTENDED, etc.)
- Harvest tools and biome information

#### Adding New Tools

To add a new MCP tool:

1. **Add the tool registration** in the appropriate section of `src/bot.ts`
2. **Define the schema** using Zod for parameter validation
3. **Implement the handler** function with proper error handling
4. **Test the tool** with various parameters
5. **Update documentation** in this README

Example tool structure:
```typescript
server.tool(
  "your-tool-name",
  "Description of what the tool does",
  {
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter")
  },
  async ({ param1, param2 }): Promise<McpResponse> => {
    try {
      // Your implementation here
      return createResponse("Success message");
    } catch (error) {
      return createErrorResponse(error as Error);
    }
  }
);
```

### Important Notes for Contributors

1. **Always build before committing** - The `dist/bot.js` file must be included for npx installation
2. **Keep dist/ in repository** - Unlike typical projects, this needs the built files for GitHub installation
3. **Test with MCP clients** - Ensure your changes work with Claude Desktop and other MCP clients
4. **Follow existing patterns** - Use the same error handling and response patterns as existing tools
5. **Update documentation** - Add new tools to the "Available Commands" section

### Troubleshooting

#### Build Issues
- Ensure all dependencies are installed: `npm install`
- Check TypeScript compilation: `npm run build`
- Verify file permissions: `chmod +x dist/bot.js`

#### MCP Connection Issues
- Check that the built `dist/bot.js` file exists and is executable
- Verify the correct path in your MCP configuration
- Ensure Minecraft server is running and accessible

#### Permission Denied Errors
- Make sure `dist/bot.js` has execute permissions: `chmod +x dist/bot.js`
- Verify the file was built correctly: `node dist/bot.js --help`

## Contributing

This application was made in just two days, and the code is really simple and straightforward. All refactoring commits, functional and test contributions, issues and discussion are greatly appreciated!

Feel free to submit pull requests or open issues for improvements. Some areas that could use enhancement:

- Additional documentation
- More robust error handling
- Tests for different components
- New functionality and commands
- Performance optimizations
- Better TypeScript type definitions

### Before Submitting

1. **Build the project** and ensure it works
2. **Test your changes** with a real Minecraft server
3. **Update documentation** if you add new features
4. **Follow the existing code style** and patterns

To get started with contributing, please see [CONTRIBUTING.md](CONTRIBUTING.md).
