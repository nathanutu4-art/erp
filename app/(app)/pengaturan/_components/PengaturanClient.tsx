"use client";

import { useState, useTransition } from "react";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  saveCompanyProfile,
  updateCostingMethod,
  updateDepreciationMethod,
  updateApprovalSettings,
  togglePrintTemplate,
} from "../actions";

type CompanyData = {
  name: string;
  address: string;
  phone: string;
  email: string;
  npwp: string;
};

type SettingsData = {
  costingMethod: string;
  depreciationMethod: string;
  approverType: string;
  hrTakeoverEnabled: boolean;
};

export type TemplateItem = {
  id: string;
  name: string;
  code: string;
  template_key?: string;
  is_active: boolean;
  description: string;
};

type ToastMsg = {
  id: number;
  title: string;
  message: string;
};

export function PengaturanClient({
  company,
  settings,
  templates: initialTemplates,
}: {
  company: CompanyData;
  settings: SettingsData;
  templates: TemplateItem[];
}) {
  const [activeTab, setActiveTab] = useState<"profil" | "aturan" | "template">("profil");

  // Profil Perusahaan state
  const [coName, setCoName] = useState(company.name || "PT Maju Bersama");
  const [coAddr, setCoAddr] = useState(
    company.address || "Jl. Raya Pasar Minggu No. 88, Jakarta Selatan 12520"
  );
  const [coPhone, setCoPhone] = useState(company.phone || "(021) 7888-4455");
  const [coEmail, setCoEmail] = useState(company.email || "admin@majubersama.co.id");
  const [coNpwp, setCoNpwp] = useState(company.npwp || "01.845.322.9-015.000");

  // Persetujuan & Metode state
  const [hrTakeover, setHrTakeover] = useState(settings.hrTakeoverEnabled);
  const [poDir, setPoDir] = useState(true);
  const [stockMethod, setStockMethod] = useState(settings.costingMethod || "average");
  const [depMethod, setDepMethod] = useState(
    settings.depreciationMethod || "straight_line"
  );

  // Templates list state
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);

  // Feedback & UI state
  const [savedNotice, setSavedNotice] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; npwp?: string }>({});
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [isPending, startTransition] = useTransition();

  // Preview Document Modal state
  const [previewDoc, setPreviewDoc] = useState<{
    open: boolean;
    title: string;
    key: string;
  }>({
    open: false,
    title: "",
    key: "",
  });

  const showToast = (title: string, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const logoInitial = coName.slice(0, 2).toUpperCase() || "MB";

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { name?: string; npwp?: string } = {};
    if (coName.trim().length < 3) {
      errors.name = "Nama perusahaan wajib diisi (minimal 3 karakter).";
    }
    if (coNpwp.trim() && !/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/.test(coNpwp.trim())) {
      errors.npwp = "Format NPWP tidak valid (contoh: 01.845.322.9-015.000).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const res = await saveCompanyProfile({
        name: coName,
        address: coAddr,
        phone: coPhone,
        email: coEmail,
        npwp: coNpwp,
      });

      if (res.ok) {
        setSavedNotice(true);
        showToast(
          "Profil perusahaan disimpan",
          "Kop surat pada seluruh dokumen kini memakai identitas terbaru."
        );
        setTimeout(() => setSavedNotice(false), 5000);
      } else {
        showToast("Gagal menyimpan profil", res.error);
      }
    });
  };

  const handleToggleHrTakeover = () => {
    const nextVal = !hrTakeover;
    setHrTakeover(nextVal);
    startTransition(async () => {
      const res = await updateApprovalSettings({ hrTakeoverEnabled: nextVal });
      if (res.ok) {
        showToast(
          nextVal ? "Pengaturan diaktifkan" : "Pengaturan dinonaktifkan",
          nextVal
            ? "HR kini dapat melakukan takeover persetujuan atasan langsung."
            : "Takeover HR dinonaktifkan — persetujuan hanya oleh atasan langsung."
        );
      } else {
        setHrTakeover(!nextVal);
        showToast("Gagal memperbarui pengaturan", res.error);
      }
    });
  };

  const handleTogglePoDir = () => {
    const nextVal = !poDir;
    setPoDir(nextVal);
    showToast(
      nextVal ? "Pengaturan diaktifkan" : "Pengaturan dinonaktifkan",
      nextVal
        ? "PO di atas Rp 50.000.000 memerlukan persetujuan Direktur."
        : "Persetujuan Direktur untuk PO besar dinonaktifkan."
    );
  };

  const handleSaveStockMethod = () => {
    startTransition(async () => {
      const res = await updateCostingMethod(stockMethod as "average" | "fifo");
      if (res.ok) {
        showToast(
          "Metode stok disimpan",
          `Penilaian persediaan memakai metode ${stockMethod.toUpperCase()} mulai periode berikutnya.`
        );
      } else {
        showToast("Gagal menyimpan metode stok", res.error);
      }
    });
  };

  const handleSaveDeprMethod = () => {
    startTransition(async () => {
      const res = await updateDepreciationMethod(
        depMethod as "straight_line" | "declining_balance"
      );
      if (res.ok) {
        const label =
          depMethod === "straight_line" ? "Garis Lurus" : "Saldo Menurun";
        showToast(
          "Metode depresiasi disimpan",
          `Aset baru akan disusutkan dengan metode ${label} sebagai default.`
        );
      } else {
        showToast("Gagal menyimpan metode depresiasi", res.error);
      }
    });
  };

  const handleToggleTemplate = (tpl: TemplateItem) => {
    const nextActive = !tpl.is_active;
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, is_active: nextActive } : t))
    );

    startTransition(async () => {
      const res = await togglePrintTemplate(tpl.id, nextActive);
      if (res.ok) {
        showToast(
          "Template diperbarui",
          `Template ${tpl.name} kini ${nextActive ? "Aktif" : "Non-aktif"}.`
        );
      } else {
        // Rollback
        setTemplates((prev) =>
          prev.map((t) => (t.id === tpl.id ? { ...t, is_active: !nextActive } : t))
        );
        showToast("Gagal memperbarui template", res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="subtabs">
        <button
          type="button"
          onClick={() => setActiveTab("profil")}
          className={`subtab ${activeTab === "profil" ? "active" : ""}`}
        >
          Profil Perusahaan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("aturan")}
          className={`subtab ${activeTab === "aturan" ? "active" : ""}`}
        >
          Persetujuan &amp; Metode
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("template")}
          className={`subtab ${activeTab === "template" ? "active" : ""}`}
        >
          Template Cetak
        </button>
      </div>

      {savedNotice && (
        <div className="flow-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <b>Pengaturan tersimpan</b> — perubahan profil langsung tercermin di seluruh dokumen.
          </div>
        </div>
      )}

      {/* TAB 1: Profil Perusahaan */}
      {activeTab === "profil" && (
        <div className="dash-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Profil Perusahaan</h3>
                <p>Identitas yang tampil pada seluruh dokumen</p>
              </div>
            </div>
            <form onSubmit={handleSaveProfile} noValidate>
              <div className="card-pad">
                <div className={`field ${fieldErrors.name ? "invalid" : ""}`}>
                  <label htmlFor="coName">Nama Perusahaan</label>
                  <input
                    id="coName"
                    value={coName}
                    onChange={(e) => setCoName(e.target.value)}
                    required
                  />
                  {fieldErrors.name && <div className="err-msg">{fieldErrors.name}</div>}
                </div>
                <div className="field">
                  <label htmlFor="coAddr">Alamat</label>
                  <textarea
                    id="coAddr"
                    rows={2}
                    value={coAddr}
                    onChange={(e) => setCoAddr(e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <div className={`field ${fieldErrors.npwp ? "invalid" : ""}`}>
                    <label htmlFor="coNpwp">NPWP</label>
                    <input
                      id="coNpwp"
                      className="mono"
                      value={coNpwp}
                      onChange={(e) => setCoNpwp(e.target.value)}
                    />
                    {fieldErrors.npwp && <div className="err-msg">{fieldErrors.npwp}</div>}
                  </div>
                  <div className="field">
                    <label htmlFor="coPhone">Telepon</label>
                    <input
                      id="coPhone"
                      value={coPhone}
                      onChange={(e) => setCoPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="coEmail">Email</label>
                  <input
                    id="coEmail"
                    type="email"
                    value={coEmail}
                    onChange={(e) => setCoEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-foot" style={{ borderRadius: "0 0 16px 16px" }}>
                <GlassButton type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Menyimpan..." : "Simpan Profil"}
                </GlassButton>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h3>Pratinjau Kop Surat</h3>
                <p>Logo, nama, alamat, dan NPWP pada dokumen cetak</p>
              </div>
            </div>
            <div className="card-pad">
              <div className="paper" style={{ padding: "26px 28px" }}>
                <div className="p-head" style={{ marginBottom: 0 }}>
                  <div className="p-logo">{logoInitial}</div>
                  <div>
                    <div className="p-co">{coName}</div>
                    <div className="p-addr">{coAddr}</div>
                    <div className="p-addr">
                      Telp. {coPhone} · {coEmail} · NPWP {coNpwp}
                    </div>
                  </div>
                </div>
              </div>
              <p className="fin-note">
                Perubahan pada profil langsung tercermin pada kop Invoice, PO, Surat Jalan,
                Kuitansi, dan Slip Gaji (keputusan D10).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Persetujuan & Metode */}
      {activeTab === "aturan" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Pengaturan Persetujuan</h3>
                <p>Alur approval untuk cuti, izin, dan purchase order (keputusan D9)</p>
              </div>
            </div>
            <div className="set-row">
              <div className="sr-txt">
                <b>Approver default: Atasan Langsung</b>
                <p>Setiap pengajuan diteruskan ke atasan langsung pengaju sebagai penyetuju pertama.</p>
              </div>
              <span className="badge b-green">
                <i />
                Aktif
              </span>
            </div>
            <div className="set-row">
              <div className="sr-txt">
                <b>HR dapat takeover persetujuan</b>
                <p>
                  Apabila atasan langsung berhalangan lebih dari 2 hari kerja, HR dapat memproses
                  pengajuan atas nama atasan.
                </p>
              </div>
              <button
                type="button"
                className={`toggle ${hrTakeover ? "on" : ""}`}
                role="switch"
                aria-checked={hrTakeover}
                aria-label="HR dapat takeover persetujuan"
                onClick={handleToggleHrTakeover}
                disabled={isPending}
              />
            </div>
            <div className="set-row">
              <div className="sr-txt">
                <b>Persetujuan PO di atas Rp 50.000.000 oleh Direktur</b>
                <p>PO bernilai besar memerlukan satu tingkat persetujuan tambahan dari Direktur Operasional.</p>
              </div>
              <button
                type="button"
                className={`toggle ${poDir ? "on" : ""}`}
                role="switch"
                aria-checked={poDir}
                aria-label="Persetujuan PO oleh Direktur"
                onClick={handleTogglePoDir}
              />
            </div>
          </div>

          <div className="dash-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Metode Penilaian Stok</h3>
                  <p>Berlaku untuk HPP dan nilai persediaan (keputusan D6)</p>
                </div>
              </div>
              <div className="card-pad">
                <div className="field">
                  <label htmlFor="setStockMethod">Metode aktif</label>
                  <select
                    id="setStockMethod"
                    className="select"
                    style={{ width: "100%" }}
                    value={stockMethod}
                    onChange={(e) => setStockMethod(e.target.value)}
                  >
                    <option value="average">Average</option>
                    <option value="fifo">FIFO</option>
                  </select>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Average adalah default perusahaan: HPP dihitung dari rata-rata tertimbang seluruh stok masuk.
                  FIFO tersedia untuk barang yang mudah rusak. Mengubah metode berlaku mulai periode berikutnya dan tercatat di log perubahan.
                </p>
                <div style={{ marginTop: 14 }}>
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handleSaveStockMethod}
                    disabled={isPending}
                  >
                    {isPending ? "Menyimpan..." : "Simpan Metode Stok"}
                  </GlassButton>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Metode Depresiasi Default</h3>
                  <p>Berlaku untuk aset tetap baru (keputusan D7)</p>
                </div>
              </div>
              <div className="card-pad">
                <div className="field">
                  <label htmlFor="setDepMethod">Metode aktif</label>
                  <select
                    id="setDepMethod"
                    className="select"
                    style={{ width: "100%" }}
                    value={depMethod}
                    onChange={(e) => setDepMethod(e.target.value)}
                  >
                    <option value="straight_line">Garis Lurus</option>
                    <option value="declining_balance">Saldo Menurun</option>
                  </select>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Garis Lurus adalah default: beban penyusutan sama setiap bulan selama umur ekonomis.
                  Saldo Menurun dapat dipilih per kategori aset untuk pembebanan lebih besar di awal masa manfaat.
                </p>
                <div style={{ marginTop: 14 }}>
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handleSaveDeprMethod}
                    disabled={isPending}
                  >
                    {isPending ? "Menyimpan..." : "Simpan Metode Depresiasi"}
                  </GlassButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Template Cetak */}
      {activeTab === "template" && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Template Dokumen Cetak</h3>
                <p>Template baku Indonesia dengan kop perusahaan (keputusan D10)</p>
              </div>
            </div>
            <div>
              {templates.map((tpl) => (
                <div className="set-row" key={tpl.id}>
                  <div className="sr-txt">
                    <b>{tpl.name}</b>
                    <p>{tpl.description}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      className={`toggle ${tpl.is_active ? "on" : ""}`}
                      role="switch"
                      aria-checked={tpl.is_active}
                      aria-label={`Aktifkan template ${tpl.name}`}
                      title={tpl.is_active ? "Nonaktifkan template" : "Aktifkan template"}
                      onClick={() => handleToggleTemplate(tpl)}
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setPreviewDoc({
                          open: true,
                          title: tpl.name,
                          key: tpl.template_key || tpl.code,
                        })
                      }
                    >
                      Pratinjau
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="fin-note">
            Klik Pratinjau untuk melihat dokumen contoh lengkap dengan kop {coName}.
          </p>
        </div>
      )}

      {/* ================= MODAL PRATINJAU DOKUMEN CETAK ================= */}
      {previewDoc.open && (
        <div className="overlay" onClick={() => setPreviewDoc({ open: false, title: "", key: "" })}>
          <div
            className="modal doc-modal"
            style={{ maxWidth: 860 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>{previewDoc.title}</h3>
                <p>Pratinjau cetak dengan kop perusahaan {coName}</p>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="icon-btn"
                aria-label="Tutup"
                onClick={() => setPreviewDoc({ open: false, title: "", key: "" })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="paper" style={{ padding: "28px 32px" }}>
                {/* Kop Surat Dokumen */}
                <div className="p-head">
                  <div className="p-logo">{logoInitial}</div>
                  <div>
                    <div className="p-co">{coName}</div>
                    <div className="p-addr">{coAddr}</div>
                    <div className="p-addr">
                      Telp. {coPhone} · {coEmail} · NPWP {coNpwp}
                    </div>
                  </div>
                </div>

                {/* Konten Dokumen Berdasarkan Template Key */}
                {previewDoc.key === "invoice" && (
                  <>
                    <h4 className="p-title">Invoice Penjualan</h4>
                    <div className="p-no">No. INV-2026-1043 · Tanggal 18 Oktober 2026</div>
                    <div className="p-meta">
                      <table>
                        <tbody>
                          <tr><td>Ditagihkan kepada</td><td><b>PT Cakra Distribusi</b></td></tr>
                          <tr><td>Alamat</td><td>Kawasan Industri Pulogadung Blok B4, Jakarta Timur</td></tr>
                          <tr><td>NPWP</td><td>01.992.441.8-003.000</td></tr>
                        </tbody>
                      </table>
                      <table>
                        <tbody>
                          <tr><td>Jatuh tempo</td><td>17 November 2026 (30 hari)</td></tr>
                          <tr><td>Status bayar</td><td><b>Belum Lunas</b></td></tr>
                          <tr><td>Sudah dibayar</td><td>Rp 0</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Barang</th>
                          <th className="num">Qty</th>
                          <th className="num">Harga Jual</th>
                          <th className="num">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Kopi Arabika Java Preanger 1kg</td>
                          <td className="num">50</td>
                          <td className="num">150.000</td>
                          <td className="num">7.500.000</td>
                        </tr>
                        <tr>
                          <td>Kopi Robusta Temanggung 1kg</td>
                          <td className="num">100</td>
                          <td className="num">85.000</td>
                          <td className="num">8.500.000</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="p-tot">
                      <tbody>
                        <tr><td>Subtotal</td><td className="num">16.000.000</td></tr>
                        <tr><td>Sudah dibayar</td><td className="num">(0)</td></tr>
                        <tr className="grand"><td>SISA TAGIHAN</td><td className="num">16.000.000</td></tr>
                      </tbody>
                    </table>
                    <div className="p-faktur">
                      <b>Faktur Pajak</b> · No. Seri: 010.000-26.00000143 · DPP: Rp 14.414.414 · PPN 11%: Rp 1.585.586 (harga jual sudah termasuk PPN). Faktur pajak diterbitkan melalui e-Faktur DJP.
                    </div>
                    <p className="p-note">
                      Pembayaran: transfer ke Bank BCA 8841 2093 00 a.n. {coName}. Mohon cantumkan nomor invoice pada berita transfer.
                    </p>
                    <div className="p-sign">
                      <div className="sg">
                        <div>Hormat kami,</div>
                        <div className="nm">Sari Wulandari — Finance Manager</div>
                      </div>
                      <div className="sg">
                        <div>Diterima oleh,</div>
                        <div className="nm">PT Cakra Distribusi</div>
                      </div>
                    </div>
                  </>
                )}

                {previewDoc.key === "purchase_order" && (
                  <>
                    <h4 className="p-title">Purchase Order</h4>
                    <div className="p-no">No. PO-2026-0141 · Tanggal 15 Oktober 2026</div>
                    <div className="p-meta">
                      <table>
                        <tbody>
                          <tr><td>Kepada Supplier</td><td><b>PT Sumber Tani Lestari</b></td></tr>
                          <tr><td>Alamat</td><td>Jl. Perkebunan Raya No. 12, Subang</td></tr>
                          <tr><td>Kontak</td><td>Agus Santoso — 0812-3344-5566</td></tr>
                        </tbody>
                      </table>
                      <table>
                        <tbody>
                          <tr><td>Kirim ke</td><td>Gudang Pusat — {coAddr}</td></tr>
                          <tr><td>Syarat pembayaran</td><td>30 hari setelah barang diterima</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Barang</th>
                          <th className="num">Qty</th>
                          <th className="num">Harga Beli</th>
                          <th className="num">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Green Bean Arabika Preanger (Grade 1)</td>
                          <td className="num">200 kg</td>
                          <td className="num">95.000</td>
                          <td className="num">19.000.000</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="p-tot">
                      <tbody>
                        <tr className="grand"><td>TOTAL PO</td><td className="num">19.000.000</td></tr>
                      </tbody>
                    </table>
                    <p className="p-note">
                      Harga belum termasuk PPN 11% kecuali dinyatakan lain. Cantumkan nomor PO pada invoice dan surat jalan supplier.
                    </p>
                    <div className="p-sign">
                      <div className="sg">
                        <div>Diajukan oleh,</div>
                        <div className="nm">Bima Aditya — Kepala Gudang</div>
                      </div>
                      <div className="sg">
                        <div>Disetujui oleh,</div>
                        <div className="nm">Hendra Wijaya — Direktur Operasional</div>
                      </div>
                    </div>
                  </>
                )}

                {previewDoc.key === "delivery_note" && (
                  <>
                    <h4 className="p-title">Surat Jalan</h4>
                    <div className="p-no">No. SJ-2026-0312 · Tanggal 18 Oktober 2026</div>
                    <div className="p-meta">
                      <table>
                        <tbody>
                          <tr><td>Dikirim kepada</td><td><b>PT Cakra Distribusi</b></td></tr>
                          <tr><td>Alamat kirim</td><td>Kawasan Industri Pulogadung Blok B4, Jakarta Timur</td></tr>
                        </tbody>
                      </table>
                      <table>
                        <tbody>
                          <tr><td>Ref. Invoice</td><td>INV-2026-1043</td></tr>
                          <tr><td>Kendaraan</td><td>Mitsubishi L300 Box — B 9073 MB</td></tr>
                          <tr><td>Pengemudi</td><td>Tim Pengiriman — Gudang Pusat</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Barang</th>
                          <th className="num">Qty</th>
                          <th>Satuan</th>
                          <th>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Kopi Arabika Java Preanger 1kg</td>
                          <td className="num">50</td>
                          <td>Pack</td>
                          <td>Baik, tersegel rapi</td>
                        </tr>
                        <tr>
                          <td>Kopi Robusta Temanggung 1kg</td>
                          <td className="num">100</td>
                          <td>Pack</td>
                          <td>Baik, tersegel rapi</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="p-note">
                      Barang telah diterima dalam keadaan baik dan lengkap. Lembar ini ditandatangani penerima dan dikembalikan ke gudang pengirim.
                    </p>
                    <div className="p-sign">
                      <div className="sg">
                        <div>Pengirim,</div>
                        <div className="nm">Bima Aditya — Kepala Gudang</div>
                      </div>
                      <div className="sg">
                        <div>Penerima,</div>
                        <div className="nm">PT Cakra Distribusi</div>
                      </div>
                    </div>
                  </>
                )}

                {previewDoc.key === "receipt" && (
                  <>
                    <h4 className="p-title">Kuitansi</h4>
                    <div className="p-no">No. KW-2026-0218 · Jakarta, 18 Oktober 2026</div>
                    <div className="p-meta">
                      <table>
                        <tbody>
                          <tr><td>Telah diterima dari</td><td><b>PT Cakra Distribusi</b></td></tr>
                          <tr><td>Jumlah</td><td><b>Rp 16.000.000</b></td></tr>
                          <tr><td>Terbilang</td><td><i>Enam belas juta Rupiah</i></td></tr>
                          <tr><td>Untuk pembayaran</td><td>Pelunasan Invoice INV-2026-1043 tanggal 18 Oktober 2026</td></tr>
                          <tr><td>Metode</td><td>Transfer Bank BCA — ref. BKM-2026-220</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="p-sign">
                      <div className="sg">
                        <div>Yang menerima,</div>
                        <div className="nm">Rani Puspita — Staff Finance</div>
                      </div>
                    </div>
                  </>
                )}

                {previewDoc.key === "pay_slip" && (
                  <>
                    <h4 className="p-title">Slip Gaji</h4>
                    <div className="p-no">Periode Oktober 2026 · No. SLIP-2026-10-002</div>
                    <div className="p-meta">
                      <table>
                        <tbody>
                          <tr><td>Nama</td><td><b>Rani Puspita</b></td></tr>
                          <tr><td>Jabatan</td><td>Staff Keuangan — Finance</td></tr>
                          <tr><td>Status PTKP</td><td>TK/0</td></tr>
                        </tbody>
                      </table>
                      <table>
                        <tbody>
                          <tr><td>NPWP</td><td>02.345.678.9-012.000</td></tr>
                          <tr><td>Rekening</td><td>BCA 8841 9022 11</td></tr>
                          <tr><td>Tanggal Bayar</td><td>25 Oktober 2026</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="slip-sec">Pendapatan</div>
                    <div className="slip-row"><span>Gaji Pokok</span><b>Rp 6.500.000</b></div>
                    <div className="slip-row"><span>Tunjangan Tetap</span><b>Rp 1.000.000</b></div>
                    <div className="slip-row"><span><b>Total Pendapatan (Bruto)</b></span><b>Rp 7.500.000</b></div>
                    <div className="slip-sec">Potongan</div>
                    <div className="slip-row"><span>BPJS Kesehatan (1%)</span><b>(Rp 75.000)</b></div>
                    <div className="slip-row"><span>BPJS Ketenagakerjaan JHT (2%)</span><b>(Rp 150.000)</b></div>
                    <div className="slip-row"><span>BPJS Ketenagakerjaan JP (1%)</span><b>(Rp 75.000)</b></div>
                    <div className="slip-row"><span>PPh 21 TER (Kategori A 1.5%)</span><b>(Rp 112.500)</b></div>
                    <div className="slip-take">
                      <span>GAJI BERSIH (TAKE HOME PAY)</span>
                      <b>Rp 7.087.500</b>
                    </div>
                    <p className="p-note">
                      Dokumen ini dihasilkan secara otomatis oleh sistem ERP dan sah tanpa tanda tangan basah.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn"
                onClick={() => setPreviewDoc({ open: false, title: "", key: "" })}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                  <path d="M6 9V3h12v6" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="7" />
                </svg>
                Cetak / PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toasts container */}
      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <div className="t-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <b>{t.title}</b>
                <span>{t.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
