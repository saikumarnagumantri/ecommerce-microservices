import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';
import { MediaController } from './media.controller';

jest.mock('fs');

function fakeFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '/tmp',
    filename: 'abc.jpg',
    path: '/tmp/abc.jpg',
    buffer: Buffer.from(''),
    stream: undefined as any,
    ...overrides,
  };
}

describe('MediaController', () => {
  const controller = new MediaController();

  it('rejects when no file is present', () => {
    expect(() => controller.upload(undefined as any)).toThrow(BadRequestException);
  });

  it('rejects an image over the 5MB limit and deletes the partial file', () => {
    const file = fakeFile({ mimetype: 'image/jpeg', size: 6 * 1024 * 1024 });
    expect(() => controller.upload(file)).toThrow(BadRequestException);
    expect(fs.unlinkSync).toHaveBeenCalledWith(file.path);
  });

  it('accepts a video up to 10MB (image limit does not apply)', () => {
    const file = fakeFile({ mimetype: 'video/mp4', size: 9 * 1024 * 1024, filename: 'clip.mp4' });
    const result = controller.upload(file);
    expect(result.type).toBe('VIDEO');
    expect(result.url).toContain('clip.mp4');
  });

  it('rejects a video over the 10MB limit', () => {
    const file = fakeFile({ mimetype: 'video/mp4', size: 12 * 1024 * 1024 });
    expect(() => controller.upload(file)).toThrow(BadRequestException);
  });

  it('returns IMAGE for an accepted image', () => {
    const file = fakeFile({ mimetype: 'image/png', size: 1024, filename: 'x.png' });
    const result = controller.upload(file);
    expect(result.type).toBe('IMAGE');
  });
});
