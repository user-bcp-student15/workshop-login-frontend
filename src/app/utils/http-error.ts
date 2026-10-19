function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;
}

export function httpErrorMessage(error: unknown, detailField: 'message' | 'detail', fallback: string): string {
  const response = field(error, 'response');
  const payload = field(response, 'data');
  return String(field(payload, detailField) || field(error, 'message') || fallback);
}