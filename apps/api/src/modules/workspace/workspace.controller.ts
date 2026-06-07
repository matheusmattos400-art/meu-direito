import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@app/db';
import {
  createKanbanStageSchema,
  moveKanbanCardSchema,
  type CreateKanbanStageInput,
  type MoveKanbanCardInput,
} from '@app/validation';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspace')
@ApiBearerAuth()
@Roles('LAWYER')
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('board')
  @ApiOperation({ summary: 'Board Kanban do advogado (etapas + casos aceitos).' })
  board(@CurrentUser() user: User) {
    return this.workspace.board(user).then((data) => ({ data }));
  }

  @Get('stages')
  @ApiOperation({ summary: 'Lista as etapas configuráveis do Kanban.' })
  stages(@CurrentUser() user: User) {
    return this.workspace.listStages(user).then((data) => ({ data }));
  }

  @Post('stages')
  @ApiOperation({ summary: 'Cria uma nova etapa no Kanban.' })
  createStage(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createKanbanStageSchema)) dto: CreateKanbanStageInput,
  ) {
    return this.workspace.createStage(user, dto).then((data) => ({ data }));
  }

  @Patch('cards/:assignmentId')
  @ApiOperation({ summary: 'Move um card para outra etapa do Kanban.' })
  moveCard(
    @CurrentUser() user: User,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body(new ZodValidationPipe(moveKanbanCardSchema)) dto: MoveKanbanCardInput,
  ) {
    return this.workspace.moveCard(user, assignmentId, dto).then((data) => ({ data }));
  }
}
