/**
 * Composer / socket send guards — keep these out of React so tests can
 * cover double-submit and "send while aborting" without a DOM.
 */

export function shouldBlockSend(opts: {
  sending: boolean;
  busy: boolean;
  aborting: boolean;
}): boolean {
  return opts.sending || opts.busy || opts.aborting;
}

export function shouldKeepBusyOnSocketError(message: string): boolean {
  return message === "Агент ещё отвечает…";
}

export function isEmptyAssistantBubble(m: {
  role?: string;
  streaming?: boolean;
  content?: string;
}): boolean {
  return (
    m.role === "assistant" &&
    m.streaming === true &&
    !(m.content ?? "").trim()
  );
}
