import type { Metadata } from "next";
import Link from "next/link";

import { StaticPage } from "../StaticPage";
import { getServerDictionary } from "@/lib/i18n/server";
import { SITE } from "@/lib/site";
import { LIVE_TOOL_COUNT } from "@/lib/tools/registry";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.footer.about, alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const { locale, t } = await getServerDictionary();
  const id = locale === "id";

  return (
    <StaticPage title={t.footer.about}>
      {id ? (
        <>
          <p>
            {SITE.name} adalah kumpulan {LIVE_TOOL_COUNT} alat PDF yang bisa dipakai siapa saja,
            gratis, langsung dari peramban. Tidak ada akun, tidak ada langganan, dan tidak ada
            watermark yang dipaksakan ke hasil kerjamu.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Cara kerjanya</h2>
          <p>
            File yang kamu pilih diunggah ke server, diproses di sana, lalu hasilnya dikirim kembali
            untuk diunduh. Setelah itu file dihapus otomatis paling lama {SITE.retentionHours} jam.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Yang jujur perlu kamu tahu</h2>
          <p>
            Konversi dari PDF ke Word atau Excel bekerja dengan membaca teks beserta posisinya, lalu
            menyusunnya kembali. Hasilnya rapi untuk dokumen berbasis teks, tapi tata letaknya adalah
            perkiraan, bukan salinan persis. Begitu juga konversi Office ke PDF: hasil paling mirip
            didapat bila LibreOffice terpasang di server.
          </p>
          <p>
            Alat OCR menyisipkan lapisan teks tak terlihat sehingga hasil pindaian bisa dicari dan
            disalin. Akurasinya bergantung pada kualitas pindaian.
          </p>
          <p>
            <Link href="/" className="text-brand-600 font-semibold hover:underline">
              Lihat semua alat →
            </Link>
          </p>
        </>
      ) : (
        <>
          <p>
            {SITE.name} is a set of {LIVE_TOOL_COUNT} PDF tools anyone can use, free, straight from
            the browser. No account, no subscription, and no watermark forced onto your work.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">How it works</h2>
          <p>
            The files you choose are uploaded, processed on the server, and the result is sent back
            for you to download. Afterwards the files are deleted automatically within{" "}
            {SITE.retentionHours} hours.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">What you should honestly know</h2>
          <p>
            Converting a PDF to Word or Excel works by reading the text and its positions, then
            rebuilding the document. The result is tidy for text-based documents, but the layout is
            an approximation rather than an exact copy. The same applies to Office-to-PDF: the
            closest match comes when LibreOffice is installed on the server.
          </p>
          <p>
            The OCR tool adds an invisible text layer so scans become searchable and copyable. Its
            accuracy depends on the quality of the scan.
          </p>
          <p>
            <Link href="/" className="text-brand-600 font-semibold hover:underline">
              Browse all tools →
            </Link>
          </p>
        </>
      )}
    </StaticPage>
  );
}
