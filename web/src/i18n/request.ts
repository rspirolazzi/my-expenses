import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { auth } from "@/auth";

import { negotiateLocale, type Locale } from "./config";

export default getRequestConfig(async () => {
  const session = await auth();
  const locale: Locale =
    session?.user?.preferences.language ??
    negotiateLocale((await headers()).get("accept-language"));
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
