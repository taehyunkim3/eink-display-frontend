export function GET() {
  return Response.json({
    ok: true,
    service: "eink-frontend",
    generatedAt: new Date().toISOString()
  });
}
