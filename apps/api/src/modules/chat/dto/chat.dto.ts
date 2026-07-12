import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ description: 'Omit to start a new conversation' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
