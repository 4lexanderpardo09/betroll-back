import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get()
  root() {
    return { 
      message: 'BetRoll API',
      version: '1.0.0',
      docs: '/api/health',
    };
  }
}
