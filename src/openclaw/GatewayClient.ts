/**
 * Too Many Claw - OpenClaw Gateway WebSocket Client
 * Connects to OpenClaw gateway to receive agent events and messages
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

/** Gateway connection configuration */
export interface GatewayClientConfig {
  /** Gateway WebSocket URL (default: ws://127.0.0.1:18789) */
  url?: string;
  /** Reconnection settings */
  reconnect?: {
    /** Whether to auto-reconnect (default: true) */
    enabled?: boolean;
    /** Maximum reconnection attempts (default: 10, -1 for infinite) */
    maxAttempts?: number;
    /** Base delay in ms for exponential backoff (default: 1000) */
    baseDelay?: number;
    /** Maximum delay in ms (default: 30000) */
    maxDelay?: number;
  };
  /** Heartbeat/ping interval in ms (default: 30000, 0 to disable) */
  heartbeatInterval?: number;
  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;
}

/** Gateway message types */
export enum GatewayMessageType {
  // Lifecycle events
  SHUTDOWN = 'shutdown',
  CONNECTED = 'connected',
  PING = 'ping',
  PONG = 'pong',
  
  // Agent events
  AGENT_RESPONSE = 'agent_response',
  AGENT_DELTA = 'agent_delta',
  AGENT_START = 'agent_start',
  AGENT_END = 'agent_end',
  
  // Message events
  MESSAGE = 'message',
  MESSAGE_SENT = 'message_sent',
  
  // Channel events
  CHANNEL_MESSAGE = 'channel_message',
  
  // Status events
  STATUS = 'status',
  HEALTH = 'health',
  ERROR = 'error',
  
  // OpenClaw-specific stream types
  STREAM_THINKING = 'thinking',
  STREAM_TEXT = 'text',
  STREAM_TOOL = 'tool',
}

/** Base gateway message structure */
export interface GatewayMessage {
  type: string;
  id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/** Agent response message */
export interface AgentResponseMessage extends GatewayMessage {
  type: 'agent_response' | 'agent_delta' | 'agent_end';
  agentId?: string;
  agentName?: string;
  content?: string | OpenClawContentPart[];
  delta?: string;
  channel?: string;
  guild?: string;
  complete?: boolean;
  // OpenClaw-specific fields
  role?: 'assistant' | 'user' | 'system';
  stream?: string;
  data?: {
    thinking?: string;
    text?: string;
    [key: string]: unknown;
  };
  runId?: string;
}

/** OpenClaw content part (in content array) */
export interface OpenClawContentPart {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

/** Channel message from Discord/other platforms */
export interface ChannelMessage extends GatewayMessage {
  type: 'channel_message' | 'message';
  content: string;
  author?: {
    id?: string;
    name?: string;
    bot?: boolean;
  };
  channel?: {
    id?: string;
    name?: string;
  };
  guild?: {
    id?: string;
    name?: string;
  };
}

/** Connection state */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed',
}

/** Events emitted by GatewayClient */
export interface GatewayClientEvents {
  'connect': () => void;
  'disconnect': (code: number, reason: string) => void;
  'reconnecting': (attempt: number, maxAttempts: number) => void;
  'reconnect_failed': () => void;
  'error': (error: Error) => void;
  'message': (message: GatewayMessage) => void;
  'agent_response': (message: AgentResponseMessage) => void;
  'agent_delta': (message: AgentResponseMessage) => void;
  'agent_start': (message: GatewayMessage) => void;
  'agent_end': (message: AgentResponseMessage) => void;
  'channel_message': (message: ChannelMessage) => void;
  'shutdown': () => void;
  'state_change': (state: ConnectionState) => void;
}

const DEFAULT_CONFIG: Required<GatewayClientConfig> = {
  url: 'ws://127.0.0.1:18789',
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
  },
  heartbeatInterval: 30000,
  connectionTimeout: 10000,
};

/**
 * Extract text content from OpenClaw content array or string
 */
export function extractTextContent(content: string | OpenClawContentPart[] | undefined): string {
  if (!content) {
    return '';
  }
  
  if (typeof content === 'string') {
    return content;
  }
  
  // Content is an array of parts
  const textParts: string[] = [];
  for (const part of content) {
    if (part.type === 'text' && part.text) {
      textParts.push(part.text);
    } else if (part.type === 'thinking' && part.thinking) {
      // Optionally include thinking content
      textParts.push(part.thinking);
    }
  }
  
  return textParts.join('');
}

/**
 * WebSocket client for connecting to OpenClaw Gateway
 * Handles auto-reconnection, heartbeat, and event parsing
 */
export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<GatewayClientConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimeoutTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private lastPongTime = 0;

  constructor(config: GatewayClientConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      reconnect: {
        ...DEFAULT_CONFIG.reconnect,
        ...config.reconnect,
      },
    };
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected to gateway
   */
  get isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the OpenClaw Gateway
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
      return;
    }

    this.intentionalClose = false;
    await this.doConnect();
  }

  /**
   * Disconnect from the gateway
   */
  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.clearTimers();
    this.setState(ConnectionState.CLOSED);

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a message to the gateway
   */
  send(message: GatewayMessage): boolean {
    if (!this.isConnected || !this.ws) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a ping to the gateway
   */
  ping(): boolean {
    return this.send({ type: 'ping', timestamp: new Date().toISOString() });
  }

  /**
   * Request gateway status
   */
  requestStatus(): boolean {
    return this.send({ type: 'status' });
  }

  /**
   * Request gateway health
   */
  requestHealth(): boolean {
    return this.send({ type: 'health' });
  }

  // ============================================
  // Private Methods
  // ============================================

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState(ConnectionState.CONNECTING);

      try {
        this.ws = new WebSocket(this.config.url);
      } catch (error) {
        this.setState(ConnectionState.DISCONNECTED);
        reject(error);
        return;
      }

      // Connection timeout
      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.state === ConnectionState.CONNECTING) {
          this.ws?.close();
          this.ws = null;
          this.setState(ConnectionState.DISCONNECTED);
          reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
        }
      }, this.config.connectionTimeout);

      this.ws.on('open', () => {
        this.clearConnectionTimeout();
        this.reconnectAttempts = 0;
        this.lastPongTime = Date.now();
        this.setState(ConnectionState.CONNECTED);
        this.startHeartbeat();
        this.emit('connect');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.clearTimers();
        const reasonStr = reason.toString() || 'Unknown reason';
        this.emit('disconnect', code, reasonStr);

        if (!this.intentionalClose && this.config.reconnect.enabled) {
          this.scheduleReconnect();
        } else {
          this.setState(ConnectionState.DISCONNECTED);
        }
      });

      this.ws.on('error', (error: Error) => {
        this.emit('error', error);
        // Don't reject here, let the close event handle reconnection
      });

      this.ws.on('pong', () => {
        this.lastPongTime = Date.now();
      });
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let message: GatewayMessage;

    try {
      const str = data.toString();
      message = JSON.parse(str) as GatewayMessage;
    } catch {
      // Non-JSON message, ignore or emit raw
      return;
    }

    // Emit generic message event
    this.emit('message', message);

    // First, check for OpenClaw role-based messages (no 'type' field)
    const roleBasedMessage = message as AgentResponseMessage;
    if (roleBasedMessage.role) {
      this.handleRoleBasedMessage(roleBasedMessage);
      return;
    }

    // Check for OpenClaw streaming messages (have 'stream' field)
    if (roleBasedMessage.stream) {
      this.handleStreamMessage(roleBasedMessage);
      return;
    }

    // Handle type-based message types (original format)
    switch (message.type) {
      case GatewayMessageType.SHUTDOWN:
        this.emit('shutdown');
        // Gateway is shutting down, prepare for reconnect
        break;

      case GatewayMessageType.PONG:
        this.lastPongTime = Date.now();
        break;

      case GatewayMessageType.AGENT_RESPONSE:
      case 'assistant': // OpenClaw may use 'assistant' type
        this.emit('agent_response', message as AgentResponseMessage);
        break;

      case GatewayMessageType.AGENT_DELTA:
      case 'delta':
        this.emit('agent_delta', message as AgentResponseMessage);
        break;

      case GatewayMessageType.AGENT_START:
      case 'start':
        this.emit('agent_start', message);
        break;

      case GatewayMessageType.AGENT_END:
      case 'end':
      case 'complete':
        this.emit('agent_end', message as AgentResponseMessage);
        break;

      case GatewayMessageType.MESSAGE:
      case GatewayMessageType.CHANNEL_MESSAGE:
      case 'discord': // OpenClaw may prefix with platform
        this.emit('channel_message', message as ChannelMessage);
        break;

      case GatewayMessageType.ERROR:
        this.emit('error', new Error((message as any).error || 'Unknown gateway error'));
        break;

      default:
        // Unknown message type, already emitted via generic 'message' event
        break;
    }
  }

  /**
   * Handle OpenClaw role-based messages (assistant, user, system)
   */
  private handleRoleBasedMessage(message: AgentResponseMessage): void {
    const { role, content } = message;

    // Extract text content from array or string
    const textContent = extractTextContent(content);

    switch (role) {
      case 'assistant':
        // Transform to agent_response format
        const agentResponse: AgentResponseMessage = {
          ...message,
          type: 'agent_response',
          content: textContent,
          // Try to extract agent info from message
          agentId: (message as any).agentId || (message as any).agent || 'assistant',
          agentName: (message as any).agentName || (message as any).name || 'Assistant',
        };
        this.emit('agent_response', agentResponse);
        break;

      case 'user':
        // User message from Discord or other channel
        const channelMessage: ChannelMessage = {
          type: 'channel_message',
          content: textContent,
          author: {
            id: (message as any).userId || (message as any).authorId,
            name: (message as any).userName || (message as any).authorName || 'User',
            bot: false,
          },
        };
        this.emit('channel_message', channelMessage);
        break;

      case 'system':
        // System messages, ignore or log
        break;
    }
  }

  /**
   * Handle OpenClaw streaming messages (thinking, text, tool)
   */
  private handleStreamMessage(message: AgentResponseMessage): void {
    const { stream, data, runId } = message;

    switch (stream) {
      case 'thinking':
        // Streaming thinking/reasoning content
        const thinkingDelta: AgentResponseMessage = {
          type: 'agent_delta',
          id: runId,
          delta: data?.thinking || '',
          agentId: (message as any).agentId || 'assistant',
        };
        this.emit('agent_delta', thinkingDelta);
        break;

      case 'text':
        // Streaming text content
        const textDelta: AgentResponseMessage = {
          type: 'agent_delta',
          id: runId,
          delta: data?.text || (typeof data === 'string' ? data : ''),
          agentId: (message as any).agentId || 'assistant',
        };
        this.emit('agent_delta', textDelta);
        break;

      case 'tool':
        // Tool usage events, could emit as agent_delta or special event
        break;

      case 'end':
      case 'complete':
      case 'done':
        // Stream ended
        const endMessage: AgentResponseMessage = {
          type: 'agent_end',
          id: runId,
          complete: true,
          agentId: (message as any).agentId || 'assistant',
        };
        this.emit('agent_end', endMessage);
        break;

      case 'start':
      case 'begin':
        // Stream started
        this.emit('agent_start', message);
        break;

      default:
        // Unknown stream type, already emitted via generic 'message' event
        break;
    }
  }

  private scheduleReconnect(): void {
    const { maxAttempts = 10, baseDelay = 1000, maxDelay = 30000 } = this.config.reconnect;

    // Check if we've exceeded max attempts
    if (maxAttempts !== -1 && this.reconnectAttempts >= maxAttempts) {
      this.setState(ConnectionState.DISCONNECTED);
      this.emit('reconnect_failed');
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts - 1),
      maxDelay
    );

    this.emit('reconnecting', this.reconnectAttempts, maxAttempts);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.doConnect();
      } catch {
        // Connection failed, will be handled by close event
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) {
        return;
      }

      // Check if we've received a pong recently
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > this.config.heartbeatInterval * 2) {
        // Connection seems dead, close and reconnect
        this.ws?.close(4000, 'Heartbeat timeout');
        return;
      }

      // Send WebSocket ping (not JSON ping)
      try {
        this.ws?.ping();
      } catch {
        // Ignore ping errors
      }
    }, this.config.heartbeatInterval);
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('state_change', state);
    }
  }

  private clearTimers(): void {
    this.clearConnectionTimeout();
    this.clearReconnectTimer();
    this.clearHeartbeat();
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
