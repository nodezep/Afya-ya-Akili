import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async courses(dto: PaginationDto, category?: string) {
    const where = { status: 'PUBLISHED' as const, ...(category ? { category } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: { _count: { select: { lessons: true, enrollments: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  async course(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, title: true, durationMin: true },
        },
      },
    });
    if (!course || course.status !== 'PUBLISHED') throw new NotFoundException('Course not found');
    return course;
  }

  async enroll(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== 'PUBLISHED') throw new NotFoundException('Course not found');
    return this.prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
  }

  async myCourses(userId: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: { include: { lessons: { select: { id: true } } } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return Promise.all(
      enrollments.map(async (enrollment) => {
        const lessonIds = enrollment.course.lessons.map((l) => l.id);
        const completed = await this.prisma.lessonProgress.count({
          where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
        });
        return {
          ...enrollment,
          progress: {
            completedLessons: completed,
            totalLessons: lessonIds.length,
            percent: lessonIds.length ? Math.round((completed / lessonIds.length) * 100) : 0,
          },
        };
      }),
    );
  }

  async lesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { id: true, title: true, slug: true, status: true } } },
    });
    if (!lesson || lesson.course.status !== 'PUBLISHED') throw new NotFoundException('Lesson not found');

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.course.id } },
    });
    if (!enrollment) throw new ForbiddenException('Enroll in the course to read its lessons');

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return { ...lesson, completed: Boolean(progress?.completedAt) };
  }

  async completeLesson(userId: string, lessonId: string) {
    await this.lesson(userId, lessonId); // enrollment + existence check

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completedAt: new Date() },
      create: { userId, lessonId, completedAt: new Date() },
    });

    // Mark the course complete when every lesson is done
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { courseId: true },
    });
    const [totalLessons, completedLessons] = await this.prisma.$transaction([
      this.prisma.lesson.count({ where: { courseId: lesson.courseId } }),
      this.prisma.lessonProgress.count({
        where: {
          userId,
          completedAt: { not: null },
          lesson: { courseId: lesson.courseId },
        },
      }),
    ]);
    if (completedLessons >= totalLessons) {
      await this.prisma.courseEnrollment.updateMany({
        where: { userId, courseId: lesson.courseId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
    return progress;
  }
}
