import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto, UpdatePreferencesDto, UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { dateOfBirth, ...rest } = dto;
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...rest,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.device.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: { userId, platform: dto.platform, lastSeenAt: new Date() },
      create: { userId, expoPushToken: dto.expoPushToken, platform: dto.platform },
    });
  }

  async removeDevice(userId: string, expoPushToken: string) {
    await this.prisma.device.deleteMany({ where: { userId, expoPushToken } });
    return { message: 'Device removed' };
  }

  /** GDPR-style soft delete: anonymise and deactivate. */
  async deleteAccount(userId: string) {
    const suffix = userId.slice(0, 8);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${suffix}@deleted.akili.health`,
          phone: null,
          passwordHash: null,
          supabaseId: null,
          isActive: false,
          deletedAt: new Date(),
        },
      }),
      this.prisma.profile.updateMany({
        where: { userId },
        data: {
          firstName: 'Deleted',
          lastName: 'User',
          displayName: null,
          avatarUrl: null,
          bio: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.device.deleteMany({ where: { userId } }),
    ]);
    return { message: 'Account deleted' };
  }

  /** Data export for portability requests. */
  async exportData(userId: string) {
    const [user, moods, journals, assessments, conversations] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, preferences: true },
      }),
      this.prisma.moodEntry.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.journalEntry.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.assessmentResult.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.conversation.findMany({
        where: { userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _ignored, ...safeUser } = user;
    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      moodEntries: moods,
      journalEntries: journals,
      assessmentResults: assessments,
      conversations,
    };
  }
}
