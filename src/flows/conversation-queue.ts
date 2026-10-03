const queues = new Map<string, Promise<void>>();

/** Serializes outgoing flow work for one WhatsApp conversation. */
export async function enqueueConversationAction<T>(
  conversationId: string,
  action: () => Promise<T>
): Promise<T> {
  const previous = queues.get(conversationId) ?? Promise.resolve();
  let complete!: () => void;
  const current = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const chain = previous.catch(() => undefined).then(() => current);
  queues.set(conversationId, chain);

  await previous.catch(() => undefined);
  try {
    return await action();
  } finally {
    complete();
    if (queues.get(conversationId) === chain) {
      queues.delete(conversationId);
    }
  }
}
