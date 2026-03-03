import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let mcpClient: Client | null = null;

export async function conectarPlaywrightMCP(cdpEndpoint: string): Promise<Client> {
  console.log(`[MCP] Conectando ao Playwright MCP via CDP: ${cdpEndpoint}`);

  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      '@playwright/mcp@latest',
      '--cdp-endpoint',
      cdpEndpoint,
    ],
  });

  mcpClient = new Client({
    name: 'job-bot',
    version: '1.0.0',
  });

  await mcpClient.connect(transport);

  console.log('[MCP] Conectado com sucesso ao Playwright MCP!');

  const { tools } = await mcpClient.listTools();
  console.log(`[MCP] ${tools.length} tools disponiveis: ${tools.map(t => t.name).join(', ')}`);

  return mcpClient;
}

export async function desconectarMCP(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    console.log('[MCP] Desconectado.');
  }
}

export function getMCPClient(): Client {
  if (!mcpClient) {
    throw new Error('MCP Client nao inicializado. Chame conectarPlaywrightMCP() primeiro.');
  }
  return mcpClient;
}
