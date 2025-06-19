import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir } from 'fs/promises';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployCommands() {
  const commands = [];

  try {
    // Load all command files
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = await readdir(commandsPath);

    for (const file of commandFiles.filter(file => file.endsWith('.js'))) {
      const filePath = join(commandsPath, file);
      const command = await import(`file://${filePath}`);
      
      if ('data' in command.default && 'execute' in command.default) {
        commands.push(command.default.data.toJSON());
        console.log(`✅ Loaded command: ${command.default.data.name}`);
      } else {
        console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    // Deploy commands globally
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`✨ Successfully reloaded ${data.length} application (/) commands globally.`);

    // If you want to deploy to a specific guild for testing, use this instead:
    // const data = await rest.put(
    //   Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, 'YOUR_GUILD_ID'),
    //   { body: commands },
    // );
    // console.log(`✨ Successfully reloaded ${data.length} application (/) commands for guild.`);

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

// Verify required environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN is required in environment variables');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID is required in environment variables');
  process.exit(1);
}

deployCommands(); 