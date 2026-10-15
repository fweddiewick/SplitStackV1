/**
 * Model Context Protocol (MCP) Specification Types
 * Used by LLM Agents and Automation Systems to interact with SplitStack SG
 */

export interface MCPToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: {
    type: string;
  };
}

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, MCPToolParameterProperty>;
  required?: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolCallRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPToolCallSuccessResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: false;
}

export interface MCPToolCallErrorResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError: true;
}

export interface MCPListToolsResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: {
    tools: MCPTool[];
  };
}

export interface MCPToolCallResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: MCPToolCallSuccessResult | MCPToolCallErrorResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
