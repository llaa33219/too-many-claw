/**
 * Too Many Claw - Configuration Manager
 * Manages OpenClaw agent registration configuration
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export class ConfigManager {
  private openclawConfigPath: string;

  constructor() {
    const openclawDir = path.join(os.homedir(), '.openclaw');
    this.openclawConfigPath = path.join(openclawDir, 'openclaw.json');
  }

  /**
   * Check if OpenClaw config file exists
   */
  hasOpenClawConfig(): boolean {
    return fs.existsSync(this.openclawConfigPath);
  }

  /**
   * Read OpenClaw configuration file
   */
  readOpenClawConfig(): Record<string, unknown> | null {
    try {
      if (!this.hasOpenClawConfig()) {
        return null;
      }
      return fs.readJsonSync(this.openclawConfigPath);
    } catch {
      return null;
    }
  }

  /**
   * Get OpenClaw config file path
   */
  getOpenClawConfigPath(): string {
    return this.openclawConfigPath;
  }

  /**
   * Reset TMC-specific files (workspaces, skill, too-many-claw.json)
   * Does NOT modify openclaw.json as it may contain non-TMC settings
   */
  reset(): void {
    const openclawDir = path.join(os.homedir(), '.openclaw');
    const tmcConfigPath = path.join(openclawDir, 'too-many-claw.json');
    try {
      if (fs.existsSync(tmcConfigPath)) {
        fs.removeSync(tmcConfigPath);
      }
    } catch {
      // Ignore errors
    }
  }
}
