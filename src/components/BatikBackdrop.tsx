/**
 * Latar batik dekoratif.
 *
 * Satu sumber kebenaran untuk tekstur batik: dipakai di menu utama
 * (CategoryLanding) maupun di seluruh halaman kategori laporan
 * (Poskamling, Posyandu, Kebencanaan, Pelayanan Masyarakat, Lainnya,
 * Silakar) supaya tampilannya terasa sama di mana-mana.
 *
 * Sifatnya murni dekoratif:
 *  - `pointer-events: none` → tidak pernah menghalangi klik pengguna;
 *  - `aria-hidden` → dibiarkan screen reader mengabaikannya;
 *  -Absolutely positioned, jadi tidak menambah tinggi halaman.
 */
export default function BatikBackdrop() {
  return (
    <div className="batik-backdrop" aria-hidden="true">
      <div className="batik-backdrop-pattern" />
      <div className="batik-backdrop-wash" />
    </div>
  );
}
