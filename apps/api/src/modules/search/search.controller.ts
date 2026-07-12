import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search: therapists, meditations, courses, my journal & conversations' })
  global(@CurrentUser() user: AuthUser, @Query('q') q: string) {
    return this.search.global(user.id, q ?? '');
  }
}
