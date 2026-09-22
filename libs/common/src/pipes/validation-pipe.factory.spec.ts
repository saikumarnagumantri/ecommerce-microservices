import { BadRequestException } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { buildValidationPipe } from './validation-pipe.factory';

class SampleDto {
  @IsEmail()
  name!: string;
}

describe('buildValidationPipe', () => {
  const metadata = { type: 'body' as const, metatype: SampleDto };

  it('defaults to permissive: an undecorated extra field is not rejected', async () => {
    const pipe = buildValidationPipe();
    const result = await pipe.transform({ name: 'a@b.com', extra: 'field' }, metadata);
    expect(result.name).toBe('a@b.com');
  });

  it('in strict mode, rejects a field with no class-validator decorator', async () => {
    const pipe = buildValidationPipe({ strict: true });
    await expect(pipe.transform({ name: 'a@b.com', extra: 'field' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('still reports a genuine validation failure in the default (non-strict) mode', async () => {
    const pipe = buildValidationPipe();
    await expect(pipe.transform({ name: 'not-an-email' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
