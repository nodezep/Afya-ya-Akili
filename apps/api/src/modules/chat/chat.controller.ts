import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AiService } from '../ai/ai.service';
import { ChatService } from './chat.service';
import { SendMessageDto, UpdateConversationDto } from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly ai: AiService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations' })
  listConversations(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.chat.listConversations(user.id, pagination);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with all messages' })
  getConversation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.getConversation(user.id, id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename or archive a conversation' })
  updateConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chat.updateConversation(user.id, id, dto);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  deleteConversation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.deleteConversation(user.id, id);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message and get the full AI reply (non-streaming)' })
  sendMessage(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(user.id, dto);
  }

  @Post('messages/stream')
  @ApiOperation({ summary: 'Send a message and stream the AI reply as Server-Sent Events' })
  async streamMessage(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    await this.chat.checkDailyQuota(user.id);
    const { conversation, userMessage, messages, riskLevel } = await this.chat.prepareTurn(
      user.id,
      dto,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('start', { conversationId: conversation.id, userMessageId: userMessage.id });

    let assistantContent = '';
    try {
      if (this.ai.isConfigured) {
        assistantContent = await this.ai.streamComplete(messages, (delta) => {
          send('delta', { content: delta });
        });
      } else {
        assistantContent = this.chat.fallbackReply(riskLevel);
        send('delta', { content: assistantContent });
      }

      const assistantMessage = await this.chat.finalizeTurn({
        conversationId: conversation.id,
        assistantContent,
        riskLevel,
      });
      send('done', { assistantMessage });
    } catch (err) {
      send('error', { message: (err as Error).message });
    } finally {
      res.end();
    }
  }

  @Get('insights/sentiment')
  @ApiOperation({ summary: 'Daily average sentiment of my messages' })
  sentimentTrend(@CurrentUser() user: AuthUser, @Query('days') days?: number) {
    return this.chat.sentimentTrend(user.id, days ? Number(days) : 30);
  }
}
