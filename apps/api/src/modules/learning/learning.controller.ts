import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LearningService } from './learning.service';

@ApiTags('learning')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Public()
  @Get('courses')
  @ApiOperation({ summary: 'Browse published courses' })
  courses(@Query() pagination: PaginationDto, @Query('category') category?: string) {
    return this.learning.courses(pagination, category);
  }

  @Public()
  @Get('courses/:slug')
  @ApiOperation({ summary: 'Get a course with its lesson list' })
  course(@Param('slug') slug: string) {
    return this.learning.course(slug);
  }

  @Post('courses/:id/enroll')
  @ApiOperation({ summary: 'Enroll in a course' })
  enroll(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.learning.enroll(user.id, id);
  }

  @Get('my-courses')
  @ApiOperation({ summary: 'My enrolled courses with progress' })
  myCourses(@CurrentUser() user: AuthUser) {
    return this.learning.myCourses(user.id);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Read a lesson (requires enrollment)' })
  lesson(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.learning.lesson(user.id, id);
  }

  @Post('lessons/:id/complete')
  @ApiOperation({ summary: 'Mark a lesson complete' })
  completeLesson(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.learning.completeLesson(user.id, id);
  }
}
