/**
 * Model Context Protocol (MCP) Server for SplitStack SG
 * Conforms to JSON-RPC 2.0 and MCP specification.
 */
import {
  MCPListToolsResponse,
  MCPToolCallRequest,
  MCPToolCallResponse,
} from './types';
import { SPLITSTACK_MCP_TOOLS, executeRecommendCard } from './tools';
import { CardMethod, HouseholdMember } from '../types';

export class SplitStackMCPServer {
  private cards: CardMethod[] = [];
  private members: HouseholdMember[] = [];

  constructor(initialCards: CardMethod[] = [], initialMembers: HouseholdMember[] = []) {
    this.cards = initialCards;
    this.members = initialMembers;
  }

  public updateContext(cards: CardMethod[], members: HouseholdMember[]) {
    this.cards = cards;
    this.members = members;
  }

  public handleRequest(request: { method: string; params?: any; id?: string | number }): any {
    if (request.method === 'tools/list') {
      const response: MCPListToolsResponse = {
        jsonrpc: '2.0',
        id: request.id ?? 1,
        result: {
          tools: SPLITSTACK_MCP_TOOLS,
        },
      };
      return response;
    }

    if (request.method === 'tools/call') {
      const toolCall = request as MCPToolCallRequest;
      const { name, arguments: args } = toolCall.params;

      try {
        if (name === 'recommend_optimal_card') {
          const merchant = String(args.merchant || '');
          const amount = Number(args.amount || 100);
          const category = args.category ? String(args.category) : undefined;

          // Pull directly from current user-added cards!
          const result = executeRecommendCard(this.cards, merchant, amount, category);

          return {
            jsonrpc: '2.0',
            id: toolCall.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          };
        }

        if (name === 'get_card_limits') {
          const limits = this.cards.map((c) => ({
            id: c.id,
            name: c.name,
            bank: c.bank,
            currentSpend: c.currentSpend,
            bonusCap: c.bonusCap,
            remainingHeadroom: c.bonusCap > 0 ? Math.max(0, c.bonusCap - c.currentSpend) : 'Uncapped',
            status: c.bonusCap > 0 && c.currentSpend >= c.bonusCap ? 'CAPPED_OUT' : 'ACTIVE',
            bonusRate: c.bonusRate,
          }));

          return {
            jsonrpc: '2.0',
            id: toolCall.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(limits, null, 2),
                },
              ],
            },
          };
        }

        if (name === 'manage_household_members') {
          return {
            jsonrpc: '2.0',
            id: toolCall.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      totalMembers: this.members.length,
                      members: this.members,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id: toolCall.id,
          error: {
            code: -32601,
            message: `Tool '${name}' not found.`,
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id: toolCall.id,
          error: {
            code: -32000,
            message: err?.message || 'Internal MCP execution error',
          },
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id: request.id ?? 1,
      error: {
        code: -32600,
        message: 'Invalid or unsupported MCP request method',
      },
    };
  }
}
