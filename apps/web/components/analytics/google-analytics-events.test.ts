import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignUpEventTracker,
  shouldTrackPublishedServiceRequest,
  shouldTrackSubmittedProposal,
  trackGoogleAnalyticsSignUp,
  trackGoogleAnalyticsProposalSubmitted,
  trackGoogleAnalyticsServiceRequestPublished,
} from "./google-analytics-events";
import { extractPublishedServiceRequestId } from "../service-requests/new-service-request-page";

const measurementId = "G-TEST123";

interface RecordedEvent {
  command: "event";
  eventName: "sign_up" | "service_request_published" | "proposal_submitted";
  parameters:
    | {
        account_type: "customer" | "professional";
        send_to: string;
      }
    | { send_to: string };
}

function withAnalyticsEnvironment(
  callback: (events: RecordedEvent[]) => void,
  options: { disabled?: boolean; shouldThrow?: boolean } = {},
): void {
  const previousWindow = globalThis.window;
  const previousMeasurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const events: RecordedEvent[] = [];
  const fakeWindow = {
    [`ga-disable-${measurementId}`]: options.disabled === true,
    gtag(
      command: "event",
      eventName: RecordedEvent["eventName"],
      parameters: RecordedEvent["parameters"],
    ): void {
      if (options.shouldThrow) {
        throw new Error("Analytics unavailable");
      }

      events.push({ command, eventName, parameters });
    },
  } as unknown as Window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = measurementId;

  try {
    callback(events);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });

    if (previousMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousMeasurementId;
    }
  }
}

test("envia sign_up de cliente apenas com consentimento aceito", () => {
  withAnalyticsEnvironment((events) => {
    trackGoogleAnalyticsSignUp("customer", false);
    assert.deepEqual(events, []);

    trackGoogleAnalyticsSignUp("customer", true);
    assert.deepEqual(events, [
      {
        command: "event",
        eventName: "sign_up",
        parameters: {
          account_type: "customer",
          send_to: measurementId,
        },
      },
    ]);
  });
});

test("envia sign_up profissional somente com os parâmetros permitidos", () => {
  withAnalyticsEnvironment((events) => {
    trackGoogleAnalyticsSignUp("professional", true);

    assert.deepEqual(events[0]?.parameters, {
      account_type: "professional",
      send_to: measurementId,
    });
  });
});

test("não envia sign_up sem tag disponível ou quando GA4 está desabilitado", () => {
  const previousWindow = globalThis.window;
  const previousMeasurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = measurementId;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {} as Window,
    });
    trackGoogleAnalyticsSignUp("customer", true);

    withAnalyticsEnvironment(
      (events) => {
        trackGoogleAnalyticsSignUp("professional", true);
        assert.deepEqual(events, []);
      },
      { disabled: true },
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });

    if (previousMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousMeasurementId;
    }
  }
});

test("processa apenas uma vez o mesmo sucesso e absorve falhas do Analytics", () => {
  withAnalyticsEnvironment(
    (events) => {
      const tracker = createSignUpEventTracker();

      assert.doesNotThrow(() => {
        tracker.track("customer", true);
        tracker.track("customer", true);
      });
      assert.deepEqual(events, []);
    },
    { shouldThrow: true },
  );

  withAnalyticsEnvironment((events) => {
    const tracker = createSignUpEventTracker();

    tracker.track("professional", true);
    tracker.track("professional", true);
    assert.equal(events.length, 1);
  });
});

test("envia a publicação confirmada somente com consentimento e send_to", () => {
  withAnalyticsEnvironment((events) => {
    trackGoogleAnalyticsServiceRequestPublished(false);
    assert.deepEqual(events, []);

    trackGoogleAnalyticsServiceRequestPublished(true);
    assert.deepEqual(events, [
      {
        command: "event",
        eventName: "service_request_published",
        parameters: { send_to: measurementId },
      },
    ]);
  });
});

test("não envia publicação sem tag, com GA4 desabilitado ou quando a tag falha", () => {
  const previousWindow = globalThis.window;
  const previousMeasurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = measurementId;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {} as Window,
    });
    assert.doesNotThrow(() => {
      trackGoogleAnalyticsServiceRequestPublished(true);
    });

    withAnalyticsEnvironment(
      (events) => {
        trackGoogleAnalyticsServiceRequestPublished(true);
        assert.deepEqual(events, []);
      },
      { disabled: true },
    );

    withAnalyticsEnvironment(
      (events) => {
        assert.doesNotThrow(() => {
          trackGoogleAnalyticsServiceRequestPublished(true);
        });
        assert.deepEqual(events, []);
      },
      { shouldThrow: true },
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });

    if (previousMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousMeasurementId;
    }
  }
});

test("aceita apenas a resposta publicada confirmada e deduplica por ID em memória", () => {
  assert.equal(
    extractPublishedServiceRequestId({
      id: "service-request-1",
      status: "OPEN",
    }),
    "service-request-1",
  );
  assert.equal(extractPublishedServiceRequestId({ status: "OPEN" }), null);
  assert.equal(
    extractPublishedServiceRequestId({
      id: "service-request-1",
      status: "DRAFT",
    }),
    null,
  );
  assert.equal(extractPublishedServiceRequestId(null), null);

  const trackedServiceRequestIds = new Set<string>();

  assert.equal(
    shouldTrackPublishedServiceRequest(
      trackedServiceRequestIds,
      "service-request-1",
    ),
    true,
  );
  assert.equal(
    shouldTrackPublishedServiceRequest(
      trackedServiceRequestIds,
      "service-request-1",
    ),
    false,
  );
  assert.equal(
    shouldTrackPublishedServiceRequest(
      trackedServiceRequestIds,
      "service-request-2",
    ),
    true,
  );
});

test("emits confirmed proposal only with consent and send_to", () => {
  withAnalyticsEnvironment((events) => {
    trackGoogleAnalyticsProposalSubmitted(false);
    assert.deepEqual(events, []);

    trackGoogleAnalyticsProposalSubmitted(true);
    assert.deepEqual(events, [
      {
        command: "event",
        eventName: "proposal_submitted",
        parameters: { send_to: measurementId },
      },
    ]);
  });
});

test("does not emit proposal without tag, with disabled GA4, or when GA4 fails", () => {
  const previousWindow = globalThis.window;
  const previousMeasurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = measurementId;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {} as Window,
    });
    assert.doesNotThrow(() => {
      trackGoogleAnalyticsProposalSubmitted(true);
    });

    withAnalyticsEnvironment(
      (events) => {
        trackGoogleAnalyticsProposalSubmitted(true);
        assert.deepEqual(events, []);
      },
      { disabled: true },
    );

    withAnalyticsEnvironment(
      (events) => {
        assert.doesNotThrow(() => {
          trackGoogleAnalyticsProposalSubmitted(true);
        });
        assert.deepEqual(events, []);
      },
      { shouldThrow: true },
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });

    if (previousMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousMeasurementId;
    }
  }
});

test("deduplicates confirmed proposals by in-memory ID", () => {
  const trackedProposalIds = new Set<string>();

  assert.equal(
    shouldTrackSubmittedProposal(trackedProposalIds, "", "ACTIVE"),
    false,
  );
  assert.equal(
    shouldTrackSubmittedProposal(trackedProposalIds, "proposal-1", "ACCEPTED"),
    false,
  );
  assert.equal(
    shouldTrackSubmittedProposal(trackedProposalIds, "proposal-1", "ACTIVE"),
    true,
  );
  assert.equal(
    shouldTrackSubmittedProposal(trackedProposalIds, "proposal-1", "ACTIVE"),
    false,
  );
  assert.equal(
    shouldTrackSubmittedProposal(trackedProposalIds, "proposal-2", "ACTIVE"),
    true,
  );
});
