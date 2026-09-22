import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { Role, Roles } from '@salescart/common';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TYPES,
  EXTENSION_BY_MIME_TYPE,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  UPLOAD_DIR,
} from './media.constants';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('media')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller()
export class MediaController {
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const extension = EXTENSION_BY_MIME_TYPE[file.mimetype];
          if (!extension) {
            cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), '');
            return;
          }
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      // The largest either type may be; the per-type limit is enforced
      // below, once we know which type this file actually is.
      limits: { fileSize: MAX_VIDEO_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiOkResponse({ type: UploadResponseDto })
  upload(@UploadedFile() file: Express.Multer.File): UploadResponseDto {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      fs.unlinkSync(file.path);
      const limitMb = (maxSize / 1024 / 1024).toFixed(0);
      throw new BadRequestException(
        `File too large: exceeds the ${limitMb}MB limit for this type`,
      );
    }

    const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3005}`;
    return {
      url: `${base}/media/${file.filename}`,
      type: isImage ? 'IMAGE' : 'VIDEO',
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
