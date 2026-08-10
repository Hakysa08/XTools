import type { Metadata } from "next";

import { StaticPage } from "../StaticPage";
import { getServerDictionary } from "@/lib/i18n/server";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.footer.terms, alternates: { canonical: "/terms" } };
}

export default async function TermsPage() {
  const { locale, t } = await getServerDictionary();
  const id = locale === "id";

  return (
    <StaticPage title={t.footer.terms}>
      {id ? (
        <>
          <p>
            Dengan menggunakan {SITE.name}, kamu setuju dengan ketentuan sederhana berikut.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Penggunaan yang wajar</h2>
          <p>
            Layanan ini gratis untuk siapa saja. Jangan memakainya untuk memproses dokumen yang bukan
            milikmu atau yang tidak kamu punya izin untuk mengubahnya. Alat Buka Kunci PDF hanya
            boleh dipakai pada dokumen yang memang kamu berhak membukanya.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Batasan</h2>
          <p>
            Ada batas ukuran file dan jumlah permintaan per menit supaya layanan tetap bisa dipakai
            semua orang. Permintaan otomatis dalam jumlah besar dapat dibatasi.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Tanpa jaminan</h2>
          <p>
            Layanan diberikan apa adanya, tanpa jaminan apa pun. Beberapa alat konversi bekerja
            dengan cara menyusun ulang isi dokumen, sehingga hasilnya bisa berbeda dari file asli.
            Selalu simpan salinan dokumen aslimu, dan periksa hasilnya sebelum dipakai untuk
            keperluan penting.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Tanda tangan</h2>
          <p>
            Alat Tanda Tangan PDF menghasilkan tanda tangan visual, bukan tanda tangan digital
            bersertifikat. Keabsahan hukumnya bergantung pada aturan di wilayahmu.
          </p>
        </>
      ) : (
        <>
          <p>By using {SITE.name} you agree to these straightforward terms.</p>
          <h2 className="text-fg pt-4 text-xl font-bold">Fair use</h2>
          <p>
            The service is free for everyone. Do not use it on documents that are not yours or that
            you have no permission to modify. The Unlock PDF tool may only be used on documents you
            are entitled to open.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Limits</h2>
          <p>
            File size and per-minute request limits are in place so the service stays usable for
            everyone. Heavy automated traffic may be throttled.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">No warranty</h2>
          <p>
            The service is provided as is, without warranty of any kind. Some conversion tools work
            by reconstructing document content, so results can differ from the original. Always keep
            a copy of your original file and check the output before relying on it.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Signatures</h2>
          <p>
            The Sign PDF tool produces a visual signature, not a certificate-based digital signature.
            Its legal standing depends on the rules where you are.
          </p>
        </>
      )}
    </StaticPage>
  );
}
