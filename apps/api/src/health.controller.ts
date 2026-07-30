import { Controller, Get } from "@nestjs/common";

interface HealthResponse {
  status: "ok";
  service: "soravi-api";
  timestamp: string;
}

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "soravi-api",
      timestamp: new Date().toISOString(),
    };
  }
}