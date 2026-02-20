import * as vscode from 'vscode';
import { GeminiService } from './geminiService';

/** Lightweight model descriptor safe for serialization to the webview. */
export interface AiModelInfo {
    id: string;
    name: string;
    vendor: string;
    family: string;
}

/** Which AI provider is active. */
export type AiProvider = 'copilot' | 'gemini' | 'none';

/** Which purpose a model is assigned to. */
export type AiModelPurpose = 'summary' | 'chat' | 'agent';

/**
 * AiService — uses the VS Code Language Model API (Copilot) or the Gemini REST
 * API to generate summaries and answer questions about workspace data.
 *
 * Provider priority:
 *   1. `vscode.lm` (GitHub Copilot) — preferred, zero-config
 *   2. Gemini API key — fallback for Cursor / Windsurf / Antigravity
 */
export class AiService {
    private readonly _outputChannel: vscode.OutputChannel;
    private readonly _geminiService: GeminiService;

    /** Per-purpose model overrides. Key = purpose, value = model id. */
    private _modelOverrides: Record<string, string> = {};

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this._geminiService = new GeminiService(outputChannel);

        // Load persisted model overrides from VS Code settings
        const aiConfig = vscode.workspace.getConfiguration('superprompt-forge.ai');
        for (const purpose of ['summary', 'chat', 'agent'] as const) {
            const saved = aiConfig.get<string>(`modelOverride.${purpose}`, '');
            if (saved) {
                this._modelOverrides[purpose] = saved;
            }
        }
    }

    // ─── Provider detection ───────────────────────────────────────

    /**
     * Check whether the VS Code Language Model API is available.
     * This is false in editors like Cursor / Windsurf that don't implement `vscode.lm`.
     */
    static isCopilotAvailable(): boolean {
        try {
            return typeof vscode.lm !== 'undefined' && typeof vscode.lm.selectChatModels === 'function';
        } catch {
            return false;
        }
    }

    /** Legacy alias for isCopilotAvailable(). */
    static isAvailable(): boolean {
        return AiService.isCopilotAvailable() || GeminiService.isConfigured();
    }

    /** Determine which provider is active, respecting the user's preference. */
    static activeProvider(): AiProvider {
        const preference = vscode.workspace
            .getConfiguration('superprompt-forge.ai')
            .get<string>('provider', 'auto');

        if (preference === 'copilot') {
            return AiService.isCopilotAvailable() ? 'copilot' : 'none';
        }
        if (preference === 'gemini') {
            return GeminiService.isConfigured() ? 'gemini' : 'none';
        }

        // 'auto': prefer Copilot, fall back to Gemini
        if (AiService.isCopilotAvailable()) { return 'copilot'; }
        if (GeminiService.isConfigured()) { return 'gemini'; }
        return 'none';
    }

    // ─── Model management ─────────────────────────────────────────

    /** List all available chat models. */
    async listModels(): Promise<AiModelInfo[]> {
        const provider = AiService.activeProvider();

        if (provider === 'copilot') {
            try {
                const models = await vscode.lm.selectChatModels();
                return models.map((m) => ({
                    id: m.id,
                    name: m.name,
                    vendor: m.vendor,
                    family: m.family,
                }));
            } catch (e: unknown) {
                this._outputChannel.appendLine(
                    `[AI] Failed to list Copilot models: ${e instanceof Error ? e.message : e}`,
                );
                return [];
            }
        }

        if (provider === 'gemini') {
            return this._geminiService.listModels().map((m) => ({
                id: m.id,
                name: m.name,
                vendor: 'google',
                family: 'gemini',
            }));
        }

        return [];
    }

    /** Set a model override for a specific purpose. Pass empty string to clear. Persisted to VS Code settings. */
    setModel(purpose: AiModelPurpose, modelId: string): void {
        if (modelId) {
            this._modelOverrides[purpose] = modelId;
            this._outputChannel.appendLine(`[AI] Model for ${purpose} set to: ${modelId}`);
        } else {
            delete this._modelOverrides[purpose];
            this._outputChannel.appendLine(`[AI] Model for ${purpose} reset to default`);
        }
        // Persist to VS Code settings
        vscode.workspace
            .getConfiguration('superprompt-forge.ai')
            .update(`modelOverride.${purpose}`, modelId || undefined, vscode.ConfigurationTarget.Global);
    }

    /** Get the current model assignments. */
    getModelAssignments(): Record<string, string> {
        return { ...this._modelOverrides };
    }

    /** Get the currently selected Gemini model id for a purpose. */
    private _getGeminiModel(purpose?: AiModelPurpose): string {
        const overrideId = purpose ? this._modelOverrides[purpose] : undefined;
        if (overrideId && this._geminiService.listModels().some((m) => m.id === overrideId)) {
            return overrideId;
        }
        // Fall back to the user's configured default, then 'gemini-2.5-flash'
        return vscode.workspace.getConfiguration('superprompt-forge.ai').get<string>('geminiModel', 'gemini-2.5-flash');
    }

    /**
     * Select a Copilot chat model for a specific purpose.
     * Uses the per-purpose override if set, otherwise falls back to gpt-4o → any copilot.
     */
    private async _selectCopilotModel(purpose?: AiModelPurpose): Promise<vscode.LanguageModelChat | undefined> {
        try {
            // Check for per-purpose override
            const overrideId = purpose ? this._modelOverrides[purpose] : undefined;
            if (overrideId) {
                const byId = await vscode.lm.selectChatModels({ id: overrideId });
                if (byId.length > 0) {
                    this._outputChannel.appendLine(`[AI] Using override model for ${purpose}: ${byId[0].name}`);
                    return byId[0];
                }
                this._outputChannel.appendLine(`[AI] Override model ${overrideId} not found, falling back`);
            }

            // Try gpt-4o first
            const preferred = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o',
            });
            if (preferred.length > 0) {
                return preferred[0];
            }

            // Fall back to any copilot model
            const fallback = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            if (fallback.length > 0) {
                return fallback[0];
            }

            this._outputChannel.appendLine('[AI] No Copilot language models available');
            return undefined;
        } catch (e: unknown) {
            this._outputChannel.appendLine(
                `[AI] Failed to select Copilot model: ${e instanceof Error ? e.message : e}`,
            );
            return undefined;
        }
    }

    /**
     * Find the Copilot web search tool from available LM tools.
     * Looks for tools with common web search names/tags.
     */
    private _findWebSearchTool(): vscode.LanguageModelChatTool | undefined {
        const tools = vscode.lm.tools;
        // Look for the Copilot web search tool by known name patterns
        const webSearchTool = tools.find(
            (t) =>
                t.name.toLowerCase().includes('websearch') ||
                t.name.toLowerCase().includes('web_search') ||
                t.name.toLowerCase() === 'copilot_websearch',
        );
        if (webSearchTool) {
            return webSearchTool;
        }
        // Fallback: look by tags
        const byTag = tools.find(
            (t) => t.tags.some((tag) => tag.includes('search') || tag.includes('web')),
        );
        return byTag;
    }

    /**
     * Generate a summary for a specific tab's data.
     */
    async summarize(
        tabKey: string,
        contextData: string,
        customSystemPrompt?: string,
        token?: vscode.CancellationToken,
    ): Promise<string> {
        const provider = AiService.activeProvider();
        if (provider === 'none') {
            throw new Error('No AI provider available. Install GitHub Copilot or configure a Gemini API key.');
        }

        const systemPrompt = customSystemPrompt?.trim() ||
            `You are a concise agile coach embedded in a VS Code extension called Superprompt Forge.
Your job is to summarize workspace data into a brief, agile-focused status card.
Apply Agile Manifesto thinking: prioritize working software, people & interactions, and responding to change.
Use short, scannable bullet points — not full sentences. Use emoji sparingly for visual cues.
Highlight: flow blockers, items needing collaboration, stale work, and what delivers the most value now.
You may use **bold** for emphasis and bullet lists. Keep it under 150 words.
Do NOT use markdown headers (##) in brief summaries.`;

        const userPrompt = this._buildSummaryPrompt(tabKey, contextData);

        if (provider === 'gemini') {
            return this._geminiService.generateContent(
                this._getGeminiModel('summary'),
                [
                    { role: 'user', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                token,
            );
        }

        // Copilot path
        const model = await this._selectCopilotModel('summary');
        if (!model) {
            throw new Error('No AI model available. Make sure GitHub Copilot is installed and signed in.');
        }

        const messages = [
            vscode.LanguageModelChatMessage.User(systemPrompt),
            vscode.LanguageModelChatMessage.User(userPrompt),
        ];

        try {
            const response = await model.sendRequest(messages, {}, token);
            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
            }
            return result.trim();
        } catch (e: unknown) {
            if (e instanceof vscode.LanguageModelError) {
                this._outputChannel.appendLine(`[AI] LM error: ${e.message} (${e.code})`);
                throw new Error(`AI request failed: ${e.message}`);
            }
            throw e;
        }
    }

    /**
     * Chat: answer a user question using all available workspace context.
     * Streams the response back via a callback.
     * When `webSearch` is true, the web search tool is offered to the model (Copilot only).
     */
    async chat(
        question: string,
        contextData: string,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        onChunk: (chunk: string) => void,
        token?: vscode.CancellationToken,
        webSearch?: boolean,
    ): Promise<string> {
        const provider = AiService.activeProvider();
        if (provider === 'none') {
            throw new Error('No AI provider available. Install GitHub Copilot or configure a Gemini API key.');
        }

        const systemPrompt = `You are a helpful development assistant embedded in a VS Code extension called Superprompt Forge.
You have access to the user's workspace data: git stashes, GitHub PRs, Issues, Projects, Gist notes, and Mattermost chat.
Answer questions about this data concisely and accurately. Reference specific items by number/name when relevant.
If the data doesn't contain the answer, say so. Use markdown formatting for readability.
Keep answers focused and under 300 words unless the user asks for detail.${webSearch && provider === 'copilot' ? '\nYou also have access to a web search tool. Use it when the user asks about external information, documentation, or anything not in the workspace data.' : ''}`;

        // ─── Gemini path ─────────────────────────────────────
        if (provider === 'gemini') {
            const messages: Array<{ role: 'user' | 'model'; content: string }> = [
                { role: 'user', content: systemPrompt },
                { role: 'user', content: `Here is the current workspace data:\n\n${contextData}\n\nUse this data to answer the user's questions.` },
            ];
            for (const msg of history.slice(-10)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    content: msg.content,
                });
            }
            messages.push({ role: 'user', content: question });

            return this._geminiService.streamContent(
                this._getGeminiModel('chat'),
                messages,
                onChunk,
                token,
            );
        }

        // ─── Copilot path ────────────────────────────────────
        const model = await this._selectCopilotModel('chat');
        if (!model) {
            throw new Error('No AI model available. Make sure GitHub Copilot is installed and signed in.');
        }

        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(systemPrompt),
            vscode.LanguageModelChatMessage.User(
                `Here is the current workspace data:\n\n${contextData}\n\nUse this data to answer the user's questions.`,
            ),
        ];

        // Add conversation history
        for (const msg of history.slice(-10)) {
            if (msg.role === 'user') {
                messages.push(vscode.LanguageModelChatMessage.User(msg.content));
            } else {
                messages.push(vscode.LanguageModelChatMessage.Assistant(msg.content));
            }
        }

        // Add current question
        messages.push(vscode.LanguageModelChatMessage.User(question));

        // Resolve web search tool if enabled
        const requestOptions: vscode.LanguageModelChatRequestOptions = {};
        if (webSearch) {
            const webSearchTool = this._findWebSearchTool();
            if (webSearchTool) {
                requestOptions.tools = [webSearchTool];
                this._outputChannel.appendLine(`[AI] Web search tool enabled: ${webSearchTool.name}`);
            } else {
                this._outputChannel.appendLine('[AI] Web search requested but no web search tool found');
            }
        }

        try {
            let result = '';
            const maxToolRounds = 5;

            for (let round = 0; round <= maxToolRounds; round++) {
                const response = await model.sendRequest(messages, requestOptions, token);
                const toolCalls: vscode.LanguageModelToolCallPart[] = [];
                let responseStr = '';

                for await (const part of response.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        responseStr += part.value;
                        result += part.value;
                        onChunk(part.value);
                    } else if (part instanceof vscode.LanguageModelToolCallPart) {
                        toolCalls.push(part);
                    }
                }

                // If no tool calls, we're done
                if (toolCalls.length === 0) {
                    break;
                }

                this._outputChannel.appendLine(`[AI] Model requested ${toolCalls.length} tool call(s) in round ${round + 1}`);

                // Add assistant message with tool calls
                messages.push(
                    vscode.LanguageModelChatMessage.Assistant([
                        ...(responseStr ? [new vscode.LanguageModelTextPart(responseStr)] : []),
                        ...toolCalls,
                    ]),
                );

                // Invoke each tool and add results
                for (const toolCall of toolCalls) {
                    try {
                        this._outputChannel.appendLine(`[AI] Invoking tool: ${toolCall.name} (${toolCall.callId})`);
                        const toolResult = await vscode.lm.invokeTool(
                            toolCall.name,
                            { input: toolCall.input, toolInvocationToken: undefined },
                            token ?? new vscode.CancellationTokenSource().token,
                        );

                        messages.push(
                            vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, toolResult.content),
                            ]),
                        );
                    } catch (toolErr: unknown) {
                        const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool invocation failed';
                        this._outputChannel.appendLine(`[AI] Tool error: ${errMsg}`);
                        messages.push(
                            vscode.LanguageModelChatMessage.User([
                                new vscode.LanguageModelToolResultPart(toolCall.callId, [
                                    new vscode.LanguageModelTextPart(`Error: ${errMsg}`),
                                ]),
                            ]),
                        );
                    }
                }
            }

            return result.trim();
        } catch (e: unknown) {
            if (e instanceof vscode.LanguageModelError) {
                this._outputChannel.appendLine(`[AI] LM error: ${e.message} (${e.code})`);
                throw new Error(`AI request failed: ${e.message}`);
            }
            throw e;
        }
    }

    /**
     * Build a tab-specific summary prompt.
     */
    private _buildSummaryPrompt(tabKey: string, contextData: string): string {
        const tabPrompts: Record<string, string> = {
            stashes: `Summarize the user's Git Stashes through an agile lens.
Focus on: how many stashes exist (WIP indicators), stale stashes that may represent forgotten work, and whether too much work-in-progress is piling up. Flag anything that suggests incomplete delivery or context-switching overhead.`,
            prs: `Summarize the user's Pull Requests through an agile lens.
Focus on: PRs ready to merge (working software waiting to ship), PRs needing review (collaboration bottlenecks), stale or aging PRs (flow impediments), and draft PRs (work in progress). Highlight what unblocks delivery fastest.`,
            issues: `Summarize the user's Issues through an agile lens.
Focus on: open issue count and recent changes (responding to change), blocked or stale issues (impediments to flow), issues needing collaboration or assignment, and which issues deliver the most customer/user value.`,
            projects: `Summarize the user's Projects through an agile lens.
Focus on: board health (WIP limits, column distribution), items stuck in a single status too long (flow blockers), overall velocity signals, and whether work aligns with value delivery goals.`,
            notes: `Summarize the user's Gist Notes through an agile lens.
Focus on: recently updated notes (active documentation), notes that may be stale or outdated, and whether notes support team knowledge-sharing and collaboration.`,
            mattermost: `Summarize the user's Mattermost Chat through an agile lens.
Focus on: unread messages and threads needing response (collaboration & interactions), urgent or blocking discussions, channels with high activity, and action items that may be buried in conversation.`,
            drive: `Summarize the user's Google Drive data through an agile lens.
Focus on: recently modified documents (active collaboration), shared files needing attention, and documents that support or block current delivery efforts.`,
            calendar: `Summarize the user's Google Calendar through an agile lens.
Focus on: upcoming meetings and whether they support delivery or create interruptions, potential scheduling conflicts, time available for focused work, and deadlines that require the team to adapt.`,
            wiki: `Summarize the user's Wiki data through an agile lens.
Focus on: recently updated pages (living documentation), coverage gaps, pages that support onboarding or knowledge transfer, and whether documentation reflects current practices.`,
        };

        const prompt = tabPrompts[tabKey] ?? `Summarize the user's ${tabKey} data. Focus on what needs attention, what's actionable, and key counts.`;

        return `${prompt}\n\nData:\n${contextData}`;
    }

    // ─── Agent templates ──────────────────────────────────────────

    static readonly AGENT_TEMPLATES: Record<string, string> = {
        agile: `You are an agile coach and delivery lead guided by the four values of the Agile Manifesto:
1. Individuals and interactions over processes and tools
2. Working software over comprehensive documentation
3. Customer collaboration over contract negotiation
4. Responding to change over following a plan

Analyze ALL the workspace data provided and produce an Agile Status Report with these sections:

## Delivery Health
- Are we shipping working software? Assess PRs merged vs. open, stale work, and flow efficiency.
- Highlight anything blocking the delivery of working software.

## People & Interactions
- Team communication patterns from Mattermost — unread threads, unresolved questions, collaboration gaps.
- Identify where individuals may need support or where silos are forming.

## Responding to Change
- New or re-prioritized issues, scope changes in project boards, shifted deadlines.
- Calendar conflicts or upcoming meetings that may require adaptation.
- Recently modified documents or wiki pages signaling evolving requirements.

## Customer & Stakeholder Focus
- Issues or PRs linked to customer-facing work or external feedback.
- Items that directly impact end-user value delivery.

## Work in Progress
- Active stashes (uncommitted work), draft PRs, issues in progress.
- WIP limits — flag if too many items are in-flight simultaneously.

## Impediments & Risks
- Blockers across issues, PRs, and project boards.
- Stale PRs or issues that haven't moved — potential bottlenecks.
- Overdue items or missed deadlines from calendar data.

## Recommended Actions
- Top 3–5 concrete actions the team should take now, prioritized by value delivery impact.
- Frame each recommendation through an Agile lens: does it help us deliver working software, improve collaboration, or respond to change?

Use markdown formatting. Be specific — reference PR numbers, issue titles, project names, calendar events, channel names, and document titles. Keep it scannable and action-oriented.`,

        review: `You are an agile-minded code review facilitator. Reviews exist to deliver working software faster through collaboration — not as gatekeeping.
Apply Agile Manifesto thinking: individuals and interactions over processes, working software over perfection.

Produce a code review report with these sections:

## Flow & Delivery Bottlenecks
- PRs awaiting review — these block working software from shipping (list each with age, author, size)
- PRs with unresolved comments — where is collaboration stalling?
- PRs with requested changes — what's preventing resolution?

## Collaboration Health
- Are reviews well-distributed or concentrated on one person?
- PRs where the author may need pairing or support (large diffs, long-open drafts)
- Opportunities for knowledge sharing through review

## Risk & Complexity
- Large PRs that should be broken down (smaller = faster feedback loops)
- PRs open longest — why haven't they merged? What's the impediment?
- Draft PRs that signal work-in-progress needing guidance

## Suggested Review Order
- Prioritized by value delivery impact: which PRs unblock the most work?
- Quick wins first (small, low-risk PRs that can ship immediately)

## Connected Work
- Link PRs to their related issues, project board items, or customer-facing impact

Be specific with PR numbers and issue references. Frame suggestions around unblocking delivery and improving team collaboration.`,

        activity: `You are an agile team facilitator reviewing workspace activity through the lens of the Agile Manifesto.
Focus on flow, collaboration, and the team's ability to respond to change.

Produce a team activity report with these sections:

## Delivery Pulse
- What working software was shipped recently? (merged PRs, closed issues)
- What's actively moving toward delivery? (open PRs, in-progress issues)
- Are we finishing work before starting new work, or accumulating WIP?

## Work in Progress
- Active stashes — uncommitted work that may represent context-switching
- Draft PRs — early-stage work that may need collaboration
- Issues in progress — is the team focused or spread thin?

## People & Interactions
- Mattermost activity — unread threads, mentions, questions awaiting answers
- Notes recently updated — is knowledge being shared?
- Collaboration patterns — are people working together or in silos?

## Responding to Change
- New or re-prioritized issues and project board changes
- Calendar events — upcoming meetings, deadlines, schedule pressure
- Recently modified documents or wiki pages signaling evolving requirements

## Impediments
- Blocked or stale items across all sources
- Anything that looks unusual, stuck, or needs follow-up
- Items where someone may need help but hasn't asked

Keep it scannable with bullet points. Reference specific items by name/number.`,

        custom: `You are an agile-minded development assistant with deep knowledge of software workflows and the Agile Manifesto.
Analyze the workspace data provided and respond to the user's custom prompt.
Apply agile thinking: prioritize working software, collaboration, and responding to change.
Be thorough, specific, and reference actual data items by name/number.
Use markdown formatting with clear sections.`,
    };

    /**
     * Agent: deep analysis using a template or custom prompt.
     * Streams the response back via a callback.
     */
    async agentAnalysis(
        template: string,
        customPrompt: string,
        contextData: string,
        onChunk: (chunk: string) => void,
        token?: vscode.CancellationToken,
        customSystemPrompt?: string,
    ): Promise<string> {
        const provider = AiService.activeProvider();
        if (provider === 'none') {
            throw new Error('No AI provider available. Install GitHub Copilot or configure a Gemini API key.');
        }

        const systemPrompt = customSystemPrompt?.trim() ||
            AiService.AGENT_TEMPLATES[template] ||
            AiService.AGENT_TEMPLATES['custom'];

        // ─── Gemini path ─────────────────────────────────────
        if (provider === 'gemini') {
            const messages: Array<{ role: 'user' | 'model'; content: string }> = [
                { role: 'user', content: systemPrompt },
                { role: 'user', content: `Here is the complete workspace data to analyze:\n\n${contextData}` },
            ];
            if (customPrompt.trim()) {
                messages.push({ role: 'user', content: `Additional instructions from the user:\n${customPrompt}` });
            }

            return this._geminiService.streamContent(
                this._getGeminiModel('agent'),
                messages,
                onChunk,
                token,
            );
        }

        // ─── Copilot path ────────────────────────────────────
        const model = await this._selectCopilotModel('agent');
        if (!model) {
            throw new Error('No AI model available. Make sure GitHub Copilot is installed and signed in.');
        }

        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(systemPrompt),
            vscode.LanguageModelChatMessage.User(
                `Here is the complete workspace data to analyze:\n\n${contextData}`,
            ),
        ];

        if (customPrompt.trim()) {
            messages.push(
                vscode.LanguageModelChatMessage.User(
                    `Additional instructions from the user:\n${customPrompt}`,
                ),
            );
        }

        try {
            const response = await model.sendRequest(messages, {}, token);
            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
                onChunk(chunk);
            }
            return result.trim();
        } catch (e: unknown) {
            if (e instanceof vscode.LanguageModelError) {
                this._outputChannel.appendLine(`[AI] Agent LM error: ${e.message} (${e.code})`);
                throw new Error(`AI request failed: ${e.message}`);
            }
            throw e;
        }
    }
}
