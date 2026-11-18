import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function videoTool(tool: 'ffmpeg' | 'ffprobe') {
  const configured = process.env[tool === 'ffmpeg' ? 'ATLAS_FFMPEG_PATH' : 'ATLAS_FFPROBE_PATH'];
  if (configured) return configured;
  const portable = resolve('.atlas/tools', tool + '.exe');
  return process.platform === 'win32' && existsSync(portable) ? portable : tool;
}
