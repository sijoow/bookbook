// 마지막 것만 저장 — 빠르게 여러 번 고르면 저장 요청이 겹쳐 늦게 끝난 옛 값이 이길 수 있다(11-12 시험에서 실제로 일어남).
// 한 번에 하나만 보내고, 보내는 동안 바뀐 값은 끝난 뒤 마지막 것 하나만 다시 보낸다. 늘 '전체 값'을 보낸다.

export function makeSaver<T>(send: (value: T) => Promise<unknown>, onError?: (e: Error) => void): (value: T) => void {
  let next: { value: T } | null = null;
  let running = false;
  async function run() {
    running = true;
    while (next) {
      const { value } = next;
      next = null;
      try {
        await send(value);
      } catch (e) {
        onError?.(e as Error);
      }
    }
    running = false;
  }
  return (value: T) => {
    next = { value };
    if (!running) void run();
  };
}
