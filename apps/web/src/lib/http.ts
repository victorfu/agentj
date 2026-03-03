import { NextResponse } from 'next/server';

export function jsonNoStore<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store'
    }
  });
}

export function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    {
      status,
      headers: {
        'cache-control': 'no-store'
      }
    }
  );
}
