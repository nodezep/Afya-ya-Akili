import { ConfigService } from '@nestjs/config';
import { RiskLevel } from '@prisma/client';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    const config = new ConfigService({
      AI_BASE_URL: 'https://api.openai.com/v1',
      AI_API_KEY: '', // unconfigured: exercise fallbacks
    });
    service = new AiService(config);
  });

  describe('lexiconSentiment', () => {
    it('scores clearly negative text below zero', () => {
      expect(service.lexiconSentiment('I feel sad, hopeless and exhausted')).toBeLessThan(0);
    });

    it('scores clearly positive text above zero', () => {
      expect(service.lexiconSentiment('I feel happy, grateful and calm today')).toBeGreaterThan(0);
    });

    it('returns 0 for empty text', () => {
      expect(service.lexiconSentiment('')).toBe(0);
    });

    it('is clamped to [-1, 1]', () => {
      const score = service.lexiconSentiment('sad sad sad sad sad sad sad sad');
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('detectRisk', () => {
    it('flags explicit suicidal ideation as CRITICAL', () => {
      expect(service.detectRisk('sometimes I want to kill myself')).toBe(RiskLevel.CRITICAL);
      expect(service.detectRisk('I have been thinking about suicide')).toBe(RiskLevel.CRITICAL);
    });

    it('flags self-harm as CRITICAL', () => {
      expect(service.detectRisk('I keep hurting myself when it gets bad')).toBe(RiskLevel.CRITICAL);
    });

    it('flags hopelessness patterns as HIGH', () => {
      expect(service.detectRisk("I can't go on like this")).toBe(RiskLevel.HIGH);
    });

    it('returns NONE for neutral text', () => {
      expect(service.detectRisk('I went to the market and bought vegetables')).toBe(RiskLevel.NONE);
    });
  });

  describe('analyzeSentiment', () => {
    it('falls back to the lexicon when AI is not configured', async () => {
      const score = await service.analyzeSentiment('I feel wonderful and happy');
      expect(score).toBeGreaterThan(0);
    });
  });
});
