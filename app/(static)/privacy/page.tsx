import type { Metadata } from "next";

import { StaticPage } from "../StaticPage";
import { getServerDictionary } from "@/lib/i18n/server";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.footer.privacy, alternates: { canonical: "/privacy" } };
}

export default async function PrivacyPage() {
  const { locale, t } = await getServerDictionary();
  const id = locale === "id";

  return (
    <StaticPage title={t.footer.privacy}>
      {id ? (
        <>
          <p>
            {SITE.name} dirancang supaya kamu bisa memakai semua alat tanpa membuat akun dan tanpa
            memberikan data pribadi apa pun.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">File yang kamu unggah</h2>
          <p>
            File diproses di server kami, lalu <strong>otomatis dihapus paling lama {SITE.retentionHours} jam</strong>{" "}
            setelah diunggah. Kami tidak membuka, membaca, membagikan, atau menyimpan salinan isi
            dokumenmu untuk keperluan lain.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Data yang kami simpan</h2>
          <p>
            Kami tidak meminta nama, email, maupun data pribadi lainnya. Alamat IP hanya dipakai
            sementara di memori untuk membatasi jumlah permintaan agar layanan tidak disalahgunakan,
            dan tidak disimpan ke basis data.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Cookie</h2>
          <p>
            Kami hanya menyimpan preferensimu sendiri di peramban: pilihan bahasa dan mode terang
            atau gelap. Tidak ada cookie pelacak dan tidak ada iklan pihak ketiga.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Dokumen sensitif</h2>
          <p>
            Meski file cepat dihapus, pertimbangkan risikonya sendiri sebelum mengunggah dokumen yang
            sangat rahasia ke layanan online mana pun.
          </p>
        </>
      ) : (
        <>
          <p>
            {SITE.name} is built so you can use every tool without creating an account or handing
            over any personal data.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Files you upload</h2>
          <p>
            Files are processed on our server and then{" "}
            <strong>automatically deleted within {SITE.retentionHours} hours</strong> of being
            uploaded. We do not open, read, share or keep copies of your documents for any other
            purpose.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Data we keep</h2>
          <p>
            We never ask for your name, email or any other personal detail. IP addresses are held
            briefly in memory only to rate-limit abuse, and are not written to a database.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Cookies</h2>
          <p>
            We store only your own preferences in the browser: your language choice and light or
            dark mode. There are no tracking cookies and no third-party advertising.
          </p>
          <h2 className="text-fg pt-4 text-xl font-bold">Sensitive documents</h2>
          <p>
            Even though files are removed quickly, use your own judgement before uploading highly
            confidential documents to any online service.
          </p>
        </>
      )}
    </StaticPage>
  );
}
