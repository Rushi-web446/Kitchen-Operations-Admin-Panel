import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CutoffProcessorService } from './cutoff-processor.service';

@Injectable()
export class CutoffSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CutoffSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly processor: CutoffProcessorService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processDueOrders(), 60_000);
    void this.processDueOrders();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async processDueOrders() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.processor.process();
      if (result.cancelledDrafts || result.confirmedOrders) {
        this.logger.log(
          `Cut-off processed: ${result.confirmedOrders} confirmed, ${result.cancelledDrafts} drafts cancelled`,
        );
      }
    } catch (error) {
      this.logger.error('Automatic cut-off processing failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
