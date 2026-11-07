import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../identity/auth/guards/access-token.guard.js';
import { ChatbotOrchestratorService } from './chatbot-orchestrator.service.js';
import { ChatMessageDto } from './dto/chat-message.dto.js';
import { ChatResponseDto } from './dto/chat-response.dto.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Assistant Virtuel Souverain (Chatbot MINREX)')
@ApiBearerAuth('access-token')
@Controller('chatbot')
@UseGuards(AccessTokenGuard)
export class ChatbotController {
  constructor(private readonly orchestrator: ChatbotOrchestratorService) {}

  @Post('member/message')
  @ApiOperation({
    summary: 'Poser une question à l’assistant numérique MINREX',
    description:
      'Traite la question en langage naturel avec vérification RAG et outils sécurisés en lecture seule réservés au membre connecté.',
  })
  @ApiOkResponse({
    description:
      'Réponse administrative structurée avec sources officielles, cartes d’actions directes et suggestions',
    type: ChatResponseDto,
  })
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChatMessageDto,
  ): Promise<ChatResponseDto> {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Identité citoyenne non authentifiée.');
    }

    return this.orchestrator.handleUserMessage({
      userId,
      message: dto.message,
      conversationId: dto.conversationId,
      currentRoute: dto.currentRoute,
    });
  }

  @Get('member/suggestions')
  @ApiOperation({
    summary: 'Obtenir les suggestions d’amorçage contextuelles',
    description:
      'Fournit les suggestions pertinentes selon l’écran où se trouve le membre.',
  })
  async getSuggestions(
    @Req() req: AuthenticatedRequest,
    @Query('currentRoute') currentRoute?: string,
  ) {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Identité citoyenne non authentifiée.');
    }

    return this.orchestrator.getSuggestions(userId, currentRoute);
  }
}

