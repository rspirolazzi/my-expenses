import { forwardExport } from "@/lib/exportProxy";

/** Export all of the user's data as CSV (ZIP) or JSON (feature 005, US2). */
export async function POST(request: Request): Promise<Response> {
  return forwardExport("/users/me/export", request);
}
