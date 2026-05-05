import type { Env } from './index';
import { matchTemplate } from './planner/match';
import { parameterize } from './planner/parameterize';
import { loadTemplates } from './planner/load';
import { readMemory, writeMemory } from './memory/d1';
import { ToolRegistry } from './tools/registry';
import { incrementTemplateStats, isTemplateBlessed, getTemplateStats } from './stats';

/**
 * Singleton Durable Object that coordinates the supervisor run loop.
 *
 * Phase 1 (SUP-3.4 scaffold): handles `GET /health`, `GET /state`,
 * `POST /scheduled` (noop log), `POST /plan` (dry-run matchTemplate +
 * parameterize without execution), and `GET /template-stats/:id`.
 *
 * `POST /run` returns 501 until SUP-3.5 scaffolds the execution leg.
 *
 * SUP-4 additions:
 *   - `GET /template-stats/:id` — surfaces quality metrics per template.
 *   - `POST /plan` response now includes `requires_plan_approval` based on
 *     the blessing threshold (§5.9), so callers know whether to await a ✅.
 */
export class SupervisorDO {
  private state: DurableObjectState;
  private env: Env;
  private tools: ToolRegistry;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.tools = new ToolRegistry();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      switch (`${request.method} ${url.pathname}`) {
        case 'GET /health':
          return this.handleHealth();
        case 'GET /state':
          return this.handleState();
        case 'POST /scheduled':
          return this.handleScheduled();
        case 'POST /plan':
          return this.handlePlan(request);
        case 'POST /run':
          return new Response(
            JSON.stringify({ error: 'NOT_IMPLEMENTED', phase: 'SUP-3.4 scaffold', next: 'SUP-3.5 wires execution' }),
            { status: 501, headers: { 'content-type': 'application/json' } },
          );
        default: {
          // GET /template-stats/:id
          const statsMatch = url.pathname.match(/^\/template-stats\/([^/]+)$/);
          if (request.method === 'GET' && statsMatch) {
            return this.handleTemplateStats(statsMatch[1]!, url.searchParams);
          }
          return new Response('not found', { status: 404 });
        }
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  private handleHealth(): Response {
    return Response.json({
      ok: true,
      phase: 'SUP-4',
      tools_registered: this.tools.list().length,
    });
  }

  private async handleState(): Promise<Response> {
    const lastRun = await readMemory(this.env.MEMORY, 'last_run');
    const templates = await loadTemplates();
    return Response.json({
      lastRun,
      toolCount: this.tools.list().length,
      toolNames: this.tools.list().map((t) => t.name),
      templateCount: templates.length,
      greenTemplateCount: templates.filter((t) => t.tier === 'green').length,
    });
  }

  private async handleScheduled(): Promise<Response> {
    // Phase 1: just log a heartbeat into memory so we can see cron is firing.
    await writeMemory(this.env.MEMORY, 'last_scheduled_tick', { at: Date.now() });
    return Response.json({ ok: true, phase: 'heartbeat only' });
  }

  private async handlePlan(request: Request): Promise<Response> {
    const body = (await request.json()) as { description?: string; source?: string };
    if (!body.description) {
      return Response.json({ error: 'description required' }, { status: 422 });
    }

    const templates = await loadTemplates();
    const match = matchTemplate(body.description, templates);
    if (!match) {
      return Response.json({
        matched: false,
        reason: 'no template matched',
        template_count: templates.length,
      });
    }

    const plan = parameterize(match, { description: body.description, source: body.source ?? 'human' });

    // Record the attempt and determine if plan-approval is required (§5.9).
    const templateVersion = match.version ?? 1;
    await incrementTemplateStats(this.env.MEMORY, match.id, templateVersion, 'runs_attempted');
    const blessed = await isTemplateBlessed(this.env.MEMORY, match.id, templateVersion);
    const requiresPlanApproval = !blessed || match.tier !== 'green';

    return Response.json({
      matched: true,
      template: match.id,
      tier: match.tier,
      requires_plan_approval: requiresPlanApproval,
      plan,
    });
  }

  /** GET /template-stats/:id — returns quality metrics for a template.
   *  Optional query param: ?version=N (defaults to 1). */
  private async handleTemplateStats(templateId: string, searchParams: URLSearchParams): Promise<Response> {
    const version = parseInt(searchParams.get('version') ?? '1', 10);
    const stats = await getTemplateStats(this.env.MEMORY, templateId, isNaN(version) ? 1 : version);
    if (!stats) {
      return Response.json({ template_id: templateId, runs_attempted: 0, message: 'no runs recorded yet' });
    }
    return Response.json(stats);
  }
}
