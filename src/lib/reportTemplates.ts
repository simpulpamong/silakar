export type ReportTemplateKind = 'kebakaran' | 'odnk';

export const REPORT_TEMPLATES: Record<ReportTemplateKind, string> = {
  kebakaran: `Kepada,Yth. Kepala Satuan Polisi Pamong Praja Kabupaten Ponorogo di - *PONOROGO* .

*Mohon ijin Melaporkan Hasil Pelaksanaan Kegiatan,* • Pemadaman Kebakaran ( [OBJEK KEBAKARAN] )

*HARI DAN TANGGAL PELAKSANAAN :*• [Hari], [Tanggal] [Bulan] [Tahun].

*LAPORAN MASUK :* • [HH.MM] Wib.
*WAKTU BERANGKAT :*• [HH.MM] Wib.
*TIBA DILOKASI :*• [HH.MM] Wib.
*MULAI KEGIATAN :*  • [HH.MM] Wib.
*SELESAI KEGIATAN :*• [HH.MM] Wib.
*TIBA KEMBALI DI MAKO :*• [HH.MM] Wib.

*LOKASI :*• [Alamat lengkap lokasi].
GPS [Lintang]⁰S, [Bujur]⁰E

*JARAK TEMPUH PERJALANAN :* • [Jarak] Km
*ESTIMASI WAKTU PERJALANAN :*• [Durasi] Menit
*PEMBERI INFORMASI ( PELAPOR / PEMOHON ) :*• [Nama]
*PEMILIK :*• [Nama / Umum]
*JUMLAH PENGHUNI RUMAH YANG TERDAMPAK :* • [Jumlah / -]
*LUAS AREA:*• [Luas]
*KORBAN :*• [Nihil / Keterangan]
*KENDALA :*• [Nihil / Keterangan]

*PENYEBAB:*• [Penyebab]
*Kronologi* [Uraian kronologi]
*PERKIRAAN KERUGIAN:*• [Kerugian]
*PERKIRAAN HARTA BENDA YANG TERSELAMATKAN:*• [Harta benda]
*Areal yang terbakar*: • [Luas]

*TINDAKAN* [Uraian tindakan]
 *RINCIAN KEGIATAN :*• Menindak lanjuti laporan, Regu [A/B/C/D/E] Damkar Ponorogo melaksanakan pemadaman [uraian].

*JUMLAH UNIT KENDARAKAN YANG DIGUNAKAN :* [Jumlah] unit
• [Kendaraan dan nomor]
*PERSONIL YANG TERLIBAT :*• Personil Regu [A/B/C/D/E] Damkar.
• [Personil lainnya]

Pelaksanaan kegiatan tersebut sampai dengan selesai berjalan aman dan lancar.
*DOKUMENTASI TERLAMPIR*

Demikian yang dapat kami laporkan untuk menjadikan periksa, dan apabila ada perkembangan informasi dilapangan dapat dilaporkan kembali.

*YANG MELAPORKAN :*_*[NAMA PELAPOR]*_Komandan Regu [A/B/C/D/E] Damkar Ponorogo.
 *TEMBUSAN*1. Dir Pol PP Kemendagri.2. Kasatpol PP Prov. Jatim.`,
  odnk: `Kepada,Yth. Kepala Satuan Polisi Pamong Praja Kabupaten Ponorogo di - *PONOROGO* .

*Mohon ijin Melaporkan Hasil Pelaksanaan Kegiatan Sebagai Berikut :* *OBJEK :*• [Jenis kejadian/objek non-kebakaran]

*HARI DAN TANGGAL PELAKSANAAN :*• [Hari], [Tanggal] [Bulan] [Tahun].

*LOKASI :*• [Alamat lengkap lokasi].
*PELAPOR / PEMOHON :*• [Nama]
*KRONOLOGI* [Uraian kronologi]
*TINDAKAN* [Uraian tindakan]
*RINCIAN KEGIATAN :*• [Uraian kegiatan]
*KENDALA :*• [Nihil / Keterangan]
*PERSONIL YANG TERLIBAT :*• [Personil]

*DOKUMENTASI TERLAMPIR*`
};

/* Template ODNK lengkap dipertahankan di bawah untuk kompatibilitas format WhatsApp. */
REPORT_TEMPLATES.odnk = `Kepada,Yth. Kepala Satuan Polisi Pamong Praja Kabupaten Ponorogo di - *PONOROGO* .

*Mohon ijin Melaporkan Hasil Pelaksanaan Kegiatan Sebagai Berikut :* *OBJEK :*• [Jenis kejadian/objek non-kebakaran]

*HARI DAN TANGGAL PELAKSANAAN :*• [Hari], [Tanggal] [Bulan] [Tahun].

*LAPORAN MASUK :* • [HH.MM] Wib.
*WAKTU BERANGKAT :*• [HH.MM] Wib.
*TIBA DILOKASI :*• [HH.MM] Wib.
*MULAI KEGIATAN :*  • [HH.MM] Wib.
*SELESAI KEGIATAN :*• [HH.MM] Wib.
*TIBA KEMBALI DI MAKO :*• [HH.MM] Wib.

*LOKASI :*• [Alamat lengkap lokasi].
GPS [Lintang]⁰S, [Bujur]⁰E

*JARAK TEMPUH PERJALANAN :* • [Jarak] Km
*ESTIMASI WAKTU PERJALANAN :*• [Durasi] Menit
*PELAPOR / PEMOHON :*• [Nama]
*PEMILIK :*• [Nama / Umum]
*JUMLAH PENGHUNI :*• [Jumlah / -]
*KORBAN :*• [Nihil / Keterangan]

*PENYEBAB:*• [Penyebab / -]
*Kronologi* [Uraian kronologi]

*RINCIAN KEGIATAN :*• Menindak lanjuti laporan, Regu [A/B/C/D/E] Damkar Ponorogo melaksanakan [evakuasi/rescue/penanganan].
*TINDAKAN* [Uraian tindakan]

*JUMLAH UNIT KENDARAKAN YANG DIGUNAKAN :* [Jumlah] unit
• [Kendaraan dan nomor]
*KENDALA :*• [Nihil / Keterangan]
*PERSONIL YANG TERLIBAT :*• Personil Regu [A/B/C/D/E] Damkar.
• [Personil lainnya]

Pelaksanaan kegiatan tersebut sampai dengan selesai berjalan aman dan lancar.
*DOKUMENTASI TERLAMPIR*

Demikian yang dapat kami laporkan untuk menjadikan periksa, dan apabila ada perkembangan informasi dilapangan dapat dilaporkan kembali.

*YANG MELAPORKAN :*_*[NAMA PELAPOR]*_Komandan Regu [A/B/C/D/E] Damkar Ponorogo.
 *TEMBUSAN*1. Dir Pol PP Kemendagri.2. Kasatpol PP Prov. Jatim.`;
