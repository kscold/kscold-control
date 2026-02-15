import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class SpaFallbackController {
  @Get('*')
  serveSpa(@Res() res: Response) {
    // API 경로는 이미 다른 컨트롤러에서 처리되므로 여기 도달하지 않음
    // 여기 도달한 경로는 모두 React Router 경로이므로 index.html 반환
    res.sendFile(
      join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
    );
  }
}
