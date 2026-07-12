import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsInt()
  @IsOptional()
  API_PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsInt()
  @IsOptional()
  JWT_ACCESS_TTL: number = 900;

  @IsInt()
  @IsOptional()
  JWT_REFRESH_TTL: number = 2_592_000;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return { ...config, ...validated };
}
