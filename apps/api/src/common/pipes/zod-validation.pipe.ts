import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Pipe que valida o payload usando um schema Zod compartilhado (@app/validation).
 * Uso: @Body(new ZodValidationPipe(meuSchema)) dto: MeuTipo
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Falha de validação.',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
