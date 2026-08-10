import Link from "next/link";

import { getServerDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerDictionary();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="brand-text text-7xl font-extrabold tracking-tight">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t.common.notFoundTitle}</h1>
      <p className="text-fg-muted mt-3 leading-relaxed">{t.common.notFoundBody}</p>
      <Link href="/" className="btn brand-gradient mt-8 h-12 px-7 text-white hover:opacity-90">
        {t.common.backHome}
      </Link>
    </div>
  );
}
