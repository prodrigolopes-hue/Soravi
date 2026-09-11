import { AuthSessionsRevokedNotifier } from "./auth-sessions-revoked.notifier";

describe("AuthSessionsRevokedNotifier", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  let notifier: AuthSessionsRevokedNotifier;

  beforeEach(() => {
    notifier = new AuthSessionsRevokedNotifier();
  });

  it("entrega o userId revogado ao subscriber", () => {
    const listener = jest.fn();
    notifier.subscribe(listener);

    notifier.publish(userId);

    expect(listener).toHaveBeenCalledWith(userId);
  });

  it("deixa de entregar eventos depois do unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = notifier.subscribe(listener);

    unsubscribe();
    notifier.publish(userId);

    expect(listener).not.toHaveBeenCalled();
  });

  it("mantem listeners independentes", () => {
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const unsubscribeFirst = notifier.subscribe(firstListener);
    notifier.subscribe(secondListener);

    unsubscribeFirst();
    notifier.publish(userId);

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledWith(userId);
  });
});
