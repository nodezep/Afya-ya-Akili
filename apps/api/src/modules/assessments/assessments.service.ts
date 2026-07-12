import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentType, Prisma } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitAssessmentDto } from './assessments.controller';

interface SeverityBand {
  min: number;
  max: number;
  severity: string;
  guidance: string;
}

const THERAPIST_NUDGE =
  'Consider booking a session with a licensed therapist through AKILI to talk this through.';

const SEVERITY_BANDS: Record<AssessmentType, SeverityBand[]> = {
  PHQ9: [
    { min: 0, max: 4, severity: 'minimal', guidance: 'Your responses suggest minimal depressive symptoms. Keep investing in the habits that support you.' },
    { min: 5, max: 9, severity: 'mild', guidance: 'Mild symptoms. Regular mood tracking, exercise, and the CBT course in the Learning Center can help.' },
    { min: 10, max: 14, severity: 'moderate', guidance: `Moderate symptoms. ${THERAPIST_NUDGE}` },
    { min: 15, max: 19, severity: 'moderately severe', guidance: `Moderately severe symptoms. We strongly recommend professional support. ${THERAPIST_NUDGE}` },
    { min: 20, max: 27, severity: 'severe', guidance: 'Severe symptoms. Please seek professional help promptly. If you have thoughts of self-harm, contact emergency services or Befrienders Kenya +254 722 178 177 now.' },
  ],
  GAD7: [
    { min: 0, max: 4, severity: 'minimal', guidance: 'Minimal anxiety symptoms. Breathing exercises in the meditation library can help you stay grounded.' },
    { min: 5, max: 9, severity: 'mild', guidance: 'Mild anxiety. Try the "Managing Anxiety with CBT" course and daily check-ins.' },
    { min: 10, max: 14, severity: 'moderate', guidance: `Moderate anxiety. ${THERAPIST_NUDGE}` },
    { min: 15, max: 21, severity: 'severe', guidance: `Severe anxiety. We strongly recommend professional support. ${THERAPIST_NUDGE}` },
  ],
  PSS10: [
    { min: 0, max: 13, severity: 'low', guidance: 'Low perceived stress. Your coping resources are serving you well.' },
    { min: 14, max: 26, severity: 'moderate', guidance: 'Moderate stress. Build in daily recovery: movement, meditation, and boundaries around work.' },
    { min: 27, max: 40, severity: 'high', guidance: `High perceived stress. ${THERAPIST_NUDGE}` },
  ],
  WHO5: [
    // WHO-5 raw score 0-25; below 13 indicates poor wellbeing
    { min: 0, max: 12, severity: 'low wellbeing', guidance: `Your wellbeing score is low. This is worth taking seriously. ${THERAPIST_NUDGE}` },
    { min: 13, max: 19, severity: 'moderate wellbeing', guidance: 'Moderate wellbeing. Small daily actions — sleep, sunlight, connection — compound quickly.' },
    { min: 20, max: 25, severity: 'good wellbeing', guidance: 'Good wellbeing. Keep doing what works, and check in again in two weeks.' },
  ],
  PCL5: [
    { min: 0, max: 32, severity: 'below threshold', guidance: 'Below the provisional PTSD threshold. If trauma symptoms persist, a professional evaluation is still valuable.' },
    { min: 33, max: 80, severity: 'above threshold', guidance: `Above the provisional PTSD threshold. A trauma-informed professional evaluation is recommended. ${THERAPIST_NUDGE}` },
  ],
  AUDIT: [
    { min: 0, max: 7, severity: 'low risk', guidance: 'Low-risk drinking pattern.' },
    { min: 8, max: 14, severity: 'hazardous', guidance: 'Hazardous drinking pattern. Consider setting limits and tracking your intake.' },
    { min: 15, max: 40, severity: 'harmful', guidance: `Harmful drinking pattern. Professional support significantly improves outcomes. ${THERAPIST_NUDGE}` },
  ],
};

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async templates() {
    return this.prisma.assessmentTemplate.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        description: true,
        frequencyDays: true,
        _count: { select: { questions: true } },
      },
      orderBy: { type: 'asc' },
    });
  }

  async template(type: AssessmentType) {
    const template = await this.prisma.assessmentTemplate.findUnique({
      where: { type },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Assessment not found');
    return template;
  }

  async submit(userId: string, dto: SubmitAssessmentDto) {
    const template = await this.template(dto.type);

    const questionIds = new Set(template.questions.map((q) => q.id));
    if (dto.answers.length !== template.questions.length) {
      throw new BadRequestException('All questions must be answered');
    }
    for (const answer of dto.answers) {
      if (!questionIds.has(answer.questionId)) {
        throw new BadRequestException('Answer references an unknown question');
      }
    }

    const totalScore = dto.answers.reduce((sum, a) => sum + a.value, 0);
    const bands = SEVERITY_BANDS[dto.type] ?? [];
    const band =
      bands.find((b) => totalScore >= b.min && totalScore <= b.max) ??
      bands[bands.length - 1];

    const result = await this.prisma.assessmentResult.create({
      data: {
        userId,
        templateId: template.id,
        answers: dto.answers as unknown as Prisma.InputJsonValue,
        totalScore,
        severity: band?.severity ?? 'unscored',
      },
    });

    return { ...result, guidance: band?.guidance ?? '', assessmentName: template.name };
  }

  async results(userId: string, dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assessmentResult.findMany({
        where: { userId },
        include: { template: { select: { type: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prisma.assessmentResult.count({ where: { userId } }),
    ]);
    return paginate(items, total, dto);
  }

  async latestPerType(userId: string) {
    const templates = await this.prisma.assessmentTemplate.findMany({
      select: { id: true, type: true, name: true, frequencyDays: true },
    });
    const results = await Promise.all(
      templates.map(async (t) => {
        const latest = await this.prisma.assessmentResult.findFirst({
          where: { userId, templateId: t.id },
          orderBy: { createdAt: 'desc' },
          select: { totalScore: true, severity: true, createdAt: true },
        });
        const dueAt = latest
          ? new Date(latest.createdAt.getTime() + t.frequencyDays * 86_400_000)
          : new Date();
        return { type: t.type, name: t.name, latest, dueAt, isDue: dueAt <= new Date() };
      }),
    );
    return results;
  }
}
