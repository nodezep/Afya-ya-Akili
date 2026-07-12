import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageRole, Prisma, RiskLevel } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AiService, ChatMessage } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RagService } from '../rag/rag.service';

const FREE_DAILY_MESSAGE_LIMIT = 20;
const HISTORY_WINDOW = 16; // most recent messages sent verbatim to the model
const SUMMARIZE_EVERY = 12; // refresh rolling summary every N messages

const CRISIS_FOOTER =
  '\n\nIt sounds like you are going through something very difficult right now. ' +
  'You deserve immediate support from a real person. If you are in danger or thinking about harming yourself, ' +
  'please contact emergency services now, or call Befrienders Kenya on +254 722 178 177 (24/7). ' +
  'You can also book a session with a licensed therapist right here in AKILI — would you like me to show you available therapists?';

const RISK_ORDER: Record<RiskLevel, number> = {
  NONE: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ai: AiService,
    private readonly rag: RagService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------
  // Conversations CRUD
  // ------------------------------------------------------------

  async listConversations(userId: string, dto: PaginationDto) {
    const where = { userId, isArchived: false };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          title: true,
          riskLevel: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return paginate(
      items.map((c) => ({ ...c, lastMessage: c.messages[0] ?? null, messages: undefined })),
      total,
      dto,
    );
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException();
    return conversation;
  }

  async updateConversation(
    userId: string,
    conversationId: string,
    data: { title?: string; isArchived?: boolean },
  ) {
    await this.assertOwnership(userId, conversationId);
    return this.prisma.conversation.update({ where: { id: conversationId }, data });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.assertOwnership(userId, conversationId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { message: 'Conversation deleted' };
  }

  private async assertOwnership(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException();
  }

  // ------------------------------------------------------------
  // Messaging
  // ------------------------------------------------------------

  async checkDailyQuota(userId: string): Promise<void> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
    });
    if (sub && sub.plan.tier !== 'FREE') return; // unlimited for paid tiers

    const key = `chat:quota:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const allowed = await this.redis.rateLimit(key, FREE_DAILY_MESSAGE_LIMIT, 86_400);
    if (!allowed) {
      throw new ForbiddenException(
        'Daily free message limit reached. Upgrade to Premium for unlimited AI chat.',
      );
    }
  }

  private buildSystemPrompt(context: {
    firstName?: string;
    summary?: string | null;
    retrieved: Array<{ documentTitle: string; content: string }>;
    recentMood?: { score: number; createdAt: Date } | null;
  }): string {
    let prompt = `You are Akili, a warm, emotionally intelligent mental-wellness companion built by the AKILI platform for users in Africa and beyond.

Core behaviour:
- Listen first. Validate feelings before offering suggestions.
- Use evidence-based approaches (CBT, mindfulness, behavioural activation) in plain language.
- Keep responses concise and conversational (2-4 short paragraphs max).
- Ask one gentle follow-up question when appropriate.
- You are NOT a doctor and must not diagnose or prescribe. Encourage professional help for clinical concerns and remind users they can book licensed therapists inside AKILI.
- If the user mentions self-harm or suicide, respond with warmth, take it seriously, share the crisis line (Befrienders Kenya +254 722 178 177), and encourage immediate professional support.
- Support English and Swahili; reply in the language the user writes in.`;

    if (context.firstName) {
      prompt += `\n\nThe user's name is ${context.firstName}.`;
    }
    if (context.recentMood) {
      prompt += `\nTheir most recent mood check-in scored ${context.recentMood.score}/10.`;
    }
    if (context.summary) {
      prompt += `\n\nSummary of the conversation so far (for continuity):\n${context.summary}`;
    }
    if (context.retrieved.length > 0) {
      prompt +=
        `\n\nRelevant knowledge from the AKILI clinical library — ground your suggestions in this when applicable:\n` +
        context.retrieved
          .map((r, i) => `[${i + 1}] ${r.documentTitle}: ${r.content}`)
          .join('\n');
    }
    return prompt;
  }

  /**
   * Prepares everything needed for a model call: persists the user message,
   * runs risk + sentiment analysis, retrieves RAG context and history.
   */
  async prepareTurn(userId: string, dto: { content: string; conversationId?: string }) {
    let conversation;
    if (dto.conversationId) {
      conversation = await this.getConversation(userId, dto.conversationId);
    } else {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: dto.content.slice(0, 60) + (dto.content.length > 60 ? '…' : ''),
        },
        include: { messages: true },
      });
    }

    const riskLevel = this.ai.detectRisk(dto.content);
    const sentimentScore = this.ai.lexiconSentiment(dto.content);

    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.content,
        sentimentScore,
        riskLevel,
      },
    });

    if (RISK_ORDER[riskLevel] > RISK_ORDER[conversation.riskLevel]) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { riskLevel },
      });
    }
    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      await this.recordCrisisEvent(userId, conversation.id, riskLevel, dto.content);
    }

    const [profile, recentMood, retrieved] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { firstName: true } }),
      this.prisma.moodEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { score: true, createdAt: true },
      }),
      this.rag.retrieve(dto.content, 3),
    ]);

    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt({
          firstName: profile?.firstName,
          summary: conversation.summary,
          retrieved,
          recentMood,
        }),
      },
      ...history.reverse().map((m) => ({
        role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ];

    return { conversation, userMessage, messages, riskLevel };
  }

  async finalizeTurn(params: {
    conversationId: string;
    assistantContent: string;
    riskLevel: RiskLevel;
  }) {
    const content =
      params.riskLevel === RiskLevel.CRITICAL || params.riskLevel === RiskLevel.HIGH
        ? params.assistantContent + CRISIS_FOOTER
        : params.assistantContent;

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        role: MessageRole.ASSISTANT,
        content,
      },
    });
    await this.prisma.conversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() },
    });

    void this.maybeRefreshSummary(params.conversationId);
    return assistantMessage;
  }

  /** Non-streaming send (mobile / offline-tolerant clients). */
  async sendMessage(userId: string, dto: { content: string; conversationId?: string }) {
    await this.checkDailyQuota(userId);
    const { conversation, userMessage, messages, riskLevel } = await this.prepareTurn(userId, dto);

    let assistantContent: string;
    if (this.ai.isConfigured) {
      const result = await this.ai.complete(messages);
      assistantContent = result.content;
    } else {
      assistantContent = this.fallbackReply(riskLevel);
    }

    const assistantMessage = await this.finalizeTurn({
      conversationId: conversation.id,
      assistantContent,
      riskLevel,
    });

    return {
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
    };
  }

  /** Deterministic supportive reply used when no AI provider is configured. */
  fallbackReply(riskLevel: RiskLevel): string {
    if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
      return 'Thank you for trusting me with this — what you are feeling matters, and you deserve real support right now.';
    }
    return (
      "Thank you for sharing that with me. I'm here to listen. " +
      'Could you tell me a little more about how this has been affecting your days? ' +
      'In the meantime, a slow breath in for four counts and out for six can help settle the body.'
    );
  }

  private async recordCrisisEvent(
    userId: string,
    conversationId: string,
    riskLevel: RiskLevel,
    trigger: string,
  ) {
    await this.prisma.crisisEvent.create({
      data: { userId, conversationId, riskLevel, trigger: trigger.slice(0, 500) },
    });
    // Alert the care/admin team for follow-up
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.create(admin.id, {
          type: 'SYSTEM',
          title: 'Crisis alert',
          body: `A ${riskLevel.toLowerCase()}-risk message was detected. Review the crisis queue.`,
          data: { conversationId, riskLevel },
        }),
      ),
    );
    this.logger.warn(`Crisis event (${riskLevel}) recorded for user ${userId}`);
  }

  /** Rolling conversation summary = long-term memory beyond the token window. */
  private async maybeRefreshSummary(conversationId: string) {
    try {
      const count = await this.prisma.message.count({ where: { conversationId } });
      if (count === 0 || count % SUMMARIZE_EVERY !== 0 || !this.ai.isConfigured) return;

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: SUMMARIZE_EVERY * 2 } },
      });
      if (!conversation) return;

      const transcript = conversation.messages
        .reverse()
        .map((m) => `${m.role === 'USER' ? 'User' : 'Akili'}: ${m.content}`)
        .join('\n');

      const result = await this.ai.complete(
        [
          {
            role: 'system',
            content:
              'Summarize this mental-wellness conversation in under 150 words. Capture: key concerns, emotional state, coping strategies discussed, and any commitments made. Third person, no preamble.',
          },
          {
            role: 'user',
            content: `Previous summary: ${conversation.summary ?? 'none'}\n\nRecent messages:\n${transcript}`,
          },
        ],
        { temperature: 0.3, maxTokens: 250 },
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { summary: result.content },
      });
    } catch (err) {
      this.logger.warn(`Summary refresh failed: ${(err as Error).message}`);
    }
  }

  // ------------------------------------------------------------
  // Insights
  // ------------------------------------------------------------

  async sentimentTrend(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; avg: number | null; count: bigint }>>(
      Prisma.sql`
        SELECT date_trunc('day', m."createdAt") AS day,
               AVG(m."sentimentScore") AS avg,
               COUNT(*) AS count
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
        WHERE c."userId" = ${userId}
          AND m."role" = 'USER'
          AND m."createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
    );
    return rows.map((r) => ({
      date: r.day,
      averageSentiment: r.avg === null ? null : Number(r.avg),
      messageCount: Number(r.count),
    }));
  }
}
