# TMC Webhook Plugin for OpenClaw

This OpenClaw channel plugin enables Too Many Claw to deliver AI responses via Discord webhooks with agent-specific usernames and avatars.

## How It Works

1. **Discord receives messages** - The standard OpenClaw Discord channel handles incoming messages
2. **TMC Webhook delivers responses** - Instead of Discord bot sending replies directly, this plugin sends them via webhook with the correct agent identity

## Installation

The plugin is automatically installed when you run `tmc setup` or `npm install -g too-many-claw`.

The plugin is installed to: `~/.openclaw/extensions/tmc-webhook/`

## Configuration

The plugin is configured in `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "tmc-webhook": {
      "enabled": true,
      "webhookUrl": "https://discord.com/api/webhooks/..."
    },
    "discord": {
      "replyToMode": "off",
      "actions": {
        "messages": false
      }
    }
  },
  "defaults": {
    "replyChannel": "tmc-webhook"
  }
}
```

### Configuration Options

- `channels.tmc-webhook.webhookUrl` - Discord webhook URL for message delivery
- `channels.tmc-webhook.enabled` - Enable/disable the plugin
- `channels.discord.actions.messages` - Set to `false` to disable Discord bot direct messages
- `defaults.replyChannel` - Set to `tmc-webhook` to route all replies through this plugin

## Agent Detection

The plugin automatically detects which TMC agent is sending a message by:

1. Looking for emoji + name prefix in the message (e.g., "🏠 Base: ...")
2. Using the configured default agent ID
3. Falling back to the Base agent

## Manual Installation

If automatic installation fails, you can manually install:

```bash
# Create the extensions directory
mkdir -p ~/.openclaw/extensions/tmc-webhook

# Copy plugin files
cp -r <tmc-install-path>/openclaw-plugin/* ~/.openclaw/extensions/tmc-webhook/

# Restart OpenClaw gateway
openclaw gateway restart
```

## Troubleshooting

### Messages not appearing in Discord

1. Check that `webhookUrl` is correctly configured
2. Verify the webhook URL is valid and the webhook exists in Discord
3. Check OpenClaw logs for errors: `openclaw channels logs --channel tmc-webhook`

### Duplicate messages (bot + webhook)

Ensure Discord direct messages are disabled:
```json
"discord": {
  "actions": {
    "messages": false
  }
}
```

### Plugin not loading

1. Check plugin exists: `ls ~/.openclaw/extensions/tmc-webhook/`
2. Restart OpenClaw gateway: `openclaw gateway restart`
3. Check logs: `openclaw logs`
