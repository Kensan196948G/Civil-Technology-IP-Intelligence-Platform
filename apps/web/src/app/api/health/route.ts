
export async function GET() {
  return Response.json({ status: 'ok', env: 'mvp', time: new Date().toISOString() });
}
