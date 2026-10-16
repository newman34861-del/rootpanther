import { Inject, Injectable } from "@nestjs/common";
import type { Logger } from "pino";
import { LOGGER } from "../../config/config.module";

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Transactional email.
 *
 * The logging transport is the implementation until a provider is wired. It records
 * that a message was raised and to whom, and deliberately does not log the body, because
 * verification and reset links are bearer credentials.
 */
@Injectable()
export class EmailService {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  async send(message: OutboundEmail): Promise<void> {
    this.logger.info({ to: message.to, subject: message.subject }, "email queued");
  }
}
