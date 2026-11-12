import { forwardExport } from "@/lib/exportProxy";

interface RouteContext {
  params: Promise<{ accountId: string }>;
}

/** Export one account as CSV (ZIP) or JSON; POST so other sites cannot trigger it (R12). */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const { accountId } = await params;
  return forwardExport(`/accounts/${encodeURIComponent(accountId)}/export`, request);
}
