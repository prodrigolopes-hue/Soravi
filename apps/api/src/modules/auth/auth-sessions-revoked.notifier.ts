import { Injectable, Logger } from "@nestjs/common";

export type AuthSessionsRevokedListener = (userId: string) => void;

@Injectable()
export class AuthSessionsRevokedNotifier {
  private readonly logger = new Logger(AuthSessionsRevokedNotifier.name);
  private readonly listeners = new Set<AuthSessionsRevokedListener>();

  subscribe(listener: AuthSessionsRevokedListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(userId: string): void {
    for (const listener of this.listeners) {
      try {
        listener(userId);
      } catch {
        this.logger.error(
          "Falha ao processar notificacao local de sessoes revogadas.",
        );
      }
    }
  }
}
