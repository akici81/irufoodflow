"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type TableData = {
  name: string;
  data: any[];
  error: string | null;
  loading: boolean;
};

type ImportStatus = {
  table: string;
  status: "pending" | "importing" | "success" | "error";
  count: number;
  message?: string;
};

// Projede kullanılan TÜM tablolar (11 tablo)
const TABLES = [
  "kullanicilar",        // Kullanıcılar (admin, ogretmen, bolum_baskani, satin_alma, stok)
  "dersler",             // Dersler listesi
  "urunler",             // Ürün havuzu (635 ürün)
  "siparisler",          // Siparişler (97 adet)
  "ders_programi",       // Haftalık ders programı
  "etkinlik_takvimi",    // Etkinlik takvimi
  "receteler",           // Ortak reçete havuzu
  "recete_malzemeleri",  // Reçete malzemeleri
  "demirbaslar",         // Demirbaş/envanter
  "envanter_sayimlar",   // Envanter sayım ana kayıtları
  "envanter_sayim_detay" // Envanter sayım detayları
];

// Import sırası (foreign key bağımlılıklarına göre)
const IMPORT_ORDER = [
  "kullanicilar",
  "dersler", 
  "urunler",
  "receteler",
  "recete_malzemeleri",
  "siparisler",
  "ders_programi",
  "etkinlik_takvimi",
  "demirbaslar",
  "envanter_sayimlar",
  "envanter_sayim_detay"
];

// Tablo açıklamaları
const TABLE_INFO: Record<string, { icon: string; description: string; color: string }> = {
  kullanicilar: { 
    icon: "👥", 
    description: "Admin, Öğretmen, Bölüm Başkanı, Satın Alma, Stok rolleri", 
    color: "#3b82f6" 
  },
  dersler: { 
    icon: "📚", 
    description: "Ders kodları ve isimleri (ASC, OLH, vb.)", 
    color: "#8b5cf6" 
  },
  urunler: { 
    icon: "🛒", 
    description: "Tüm ürün havuzu (marka, fiyat, kategori)", 
    color: "#10b981" 
  },
  siparisler: { 
    icon: "📦", 
    description: "Öğretmen siparişleri ve durumları", 
    color: "#f59e0b" 
  },
  ders_programi: { 
    icon: "📅", 
    description: "Haftalık ders programı verileri", 
    color: "#ef4444" 
  },
  etkinlik_takvimi: { 
    icon: "🎉", 
    description: "Etkinlikler ve önemli tarihler", 
    color: "#ec4899" 
  },
  receteler: { 
    icon: "📝", 
    description: "Ortak reçete havuzu", 
    color: "#14b8a6" 
  },
  recete_malzemeleri: { 
    icon: "🥗", 
    description: "Reçete malzeme detayları", 
    color: "#06b6d4" 
  },
  demirbaslar: { 
    icon: "🔧", 
    description: "Demirbaş ve envanter listesi", 
    color: "#6366f1" 
  },
  envanter_sayimlar: { 
    icon: "📊", 
    description: "Envanter sayım ana kayıtları", 
    color: "#f97316" 
  },
  envanter_sayim_detay: { 
    icon: "📋", 
    description: "Envanter sayım detayları", 
    color: "#84cc16" 
  },
};

export default function SupabaseDebugPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking");
  const [connectionError, setConnectionError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("kullanicilar");
  const [customQuery, setCustomQuery] = useState<string>("");
  const [customResult, setCustomResult] = useState<any>(null);
  const [customError, setCustomError] = useState<string>("");
  
  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<Record<string, any[]> | null>(null);
  const [importStatuses, setImportStatuses] = useState<ImportStatus[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // JSON dosyası seçildiğinde
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setImportData(json);
        
        // Her tablo için başlangıç durumu
        const statuses: ImportStatus[] = IMPORT_ORDER
          .filter(table => json[table] && json[table].length > 0)
          .map(table => ({
            table,
            status: "pending",
            count: json[table]?.length || 0
          }));
        setImportStatuses(statuses);
        setShowImportModal(true);
      } catch (err) {
        alert("JSON dosyası okunamadı! Geçerli bir yedek dosyası seçin.");
      }
    };
    reader.readAsText(file);
    
    // Input'u resetle (aynı dosya tekrar seçilebilsin)
    e.target.value = "";
  };

  // Tüm verileri import et
  const handleImport = async () => {
    if (!importData) return;
    
    setIsImporting(true);
    
    for (const tableName of IMPORT_ORDER) {
      const tableData = importData[tableName];
      if (!tableData || tableData.length === 0) continue;
      
      // Durumu "importing" yap
      setImportStatuses(prev => prev.map(s => 
        s.table === tableName ? { ...s, status: "importing" } : s
      ));
      
      try {
        // Önce mevcut verileri sil
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq("id", tableName === "kullanicilar" ? 0 : "");
        
        if (deleteError) {
          throw new Error(`Silme hatası: ${deleteError.message}`);
        }
        
        // Verileri ekle (100'lük batch'ler halinde)
        const batchSize = 100;
        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(batch);
          
          if (insertError) {
            throw new Error(`Ekleme hatası: ${insertError.message}`);
          }
        }
        
        // Başarılı
        setImportStatuses(prev => prev.map(s => 
          s.table === tableName ? { ...s, status: "success", message: `${tableData.length} kayıt eklendi` } : s
        ));
        
      } catch (err: any) {
        setImportStatuses(prev => prev.map(s => 
          s.table === tableName ? { ...s, status: "error", message: err.message } : s
        ));
      }
      
      // Bir sonraki tabloya geçmeden önce kısa bekle
      await new Promise(r => setTimeout(r, 300));
    }
    
    setIsImporting(false);
    
    // Tabloları yeniden yükle
    loadAllTables();
  };

  // Supabase bağlantısını test et
  const checkConnection = async () => {
    setConnectionStatus("checking");
    try {
      // Basit bir sorgu ile bağlantıyı test et
      const { error } = await supabase.from("kullanicilar").select("count").limit(1);
      if (error) {
        setConnectionStatus("error");
        setConnectionError(error.message);
      } else {
        setConnectionStatus("connected");
        setConnectionError("");
      }
    } catch (err: any) {
      setConnectionStatus("error");
      setConnectionError(err.message || "Bilinmeyen hata");
    }
  };

  // Tüm tabloları yükle
  const loadAllTables = async () => {
    const results: TableData[] = [];
    
    for (const tableName of TABLES) {
      try {
        const { data, error } = await supabase.from(tableName).select("*");
        results.push({
          name: tableName,
          data: data || [],
          error: error?.message || null,
          loading: false,
        });
      } catch (err: any) {
        results.push({
          name: tableName,
          data: [],
          error: err.message || "Hata oluştu",
          loading: false,
        });
      }
    }
    
    setTables(results);
  };

  // Özel SQL sorgusu çalıştır (RPC ile)
  const runCustomQuery = async () => {
    if (!customQuery.trim()) return;
    
    setCustomError("");
    setCustomResult(null);
    
    try {
      // Basit select sorgusu için tablo adını parse et
      const match = customQuery.match(/from\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        const { data, error } = await supabase.from(tableName).select("*");
        if (error) {
          setCustomError(error.message);
        } else {
          setCustomResult(data);
        }
      } else {
        setCustomError("Sorgu formatı: SELECT * FROM tablo_adi");
      }
    } catch (err: any) {
      setCustomError(err.message);
    }
  };

  // JSON olarak indir
  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tüm verileri tek dosyada indir
  const downloadAllData = () => {
    const allData: Record<string, any[]> = {};
    tables.forEach((t) => {
      allData[t.name] = t.data;
    });
    downloadAsJson(allData, `supabase-backup-${new Date().toISOString().split("T")[0]}`);
  };

  // SQL Schema oluştur
  const generateSchema = () => {
    let schema = "-- Supabase Tablo Şemaları (tahminî)\n\n";
    
    tables.forEach((table) => {
      if (table.data.length > 0) {
        const sample = table.data[0];
        schema += `-- ${table.name}\n`;
        schema += `CREATE TABLE ${table.name} (\n`;
        
        const columns = Object.entries(sample).map(([key, value]) => {
          let type = "TEXT";
          if (typeof value === "number") type = Number.isInteger(value) ? "INTEGER" : "NUMERIC";
          else if (typeof value === "boolean") type = "BOOLEAN";
          else if (Array.isArray(value)) type = "JSONB";
          else if (value && typeof value === "object") type = "JSONB";
          
          return `  ${key} ${type}`;
        });
        
        schema += columns.join(",\n");
        schema += "\n);\n\n";
      }
    });
    
    const blob = new Blob([schema], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supabase-schema.sql";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    checkConnection();
    loadAllTables();
  }, []);

  const activeTable = tables.find((t) => t.name === activeTab);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, borderBottom: "2px solid #e5e7eb", paddingBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
          🔧 Supabase Debug Panel
        </h1>
        <p style={{ color: "#6b7280" }}>Tüm tabloları görüntüle, verileri indir, şema oluştur</p>
      </div>

      {/* Connection Status */}
      <div style={{
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        backgroundColor: connectionStatus === "connected" ? "#d1fae5" : 
                        connectionStatus === "error" ? "#fee2e2" : "#fef3c7",
        border: `1px solid ${connectionStatus === "connected" ? "#10b981" : 
                            connectionStatus === "error" ? "#ef4444" : "#f59e0b"}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>
            {connectionStatus === "connected" ? "✅" : 
             connectionStatus === "error" ? "❌" : "⏳"}
          </span>
          <div>
            <strong style={{ color: connectionStatus === "connected" ? "#065f46" : 
                                   connectionStatus === "error" ? "#991b1b" : "#92400e" }}>
              {connectionStatus === "connected" ? "Supabase Bağlantısı Başarılı" : 
               connectionStatus === "error" ? "Bağlantı Hatası" : "Bağlantı Kontrol Ediliyor..."}
            </strong>
            {connectionError && (
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#991b1b" }}>{connectionError}</p>
            )}
          </div>
          <button
            onClick={() => { checkConnection(); loadAllTables(); }}
            style={{
              marginLeft: "auto",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            🔄 Yenile
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={downloadAllData}
          style={{
            padding: "12px 24px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 15
          }}
        >
          📥 Tüm Verileri İndir (JSON)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "12px 24px",
            backgroundColor: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 15
          }}
        >
          📤 JSON'dan İçeri Aktar
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".json"
          style={{ display: "none" }}
        />
        <button
          onClick={generateSchema}
          style={{
            padding: "12px 24px",
            backgroundColor: "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 15
          }}
        >
          📋 Schema SQL İndir
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {tables.map((table) => {
          const info = TABLE_INFO[table.name] || { icon: "📄", description: "", color: "#6b7280" };
          return (
            <div
              key={table.name}
              onClick={() => setActiveTab(table.name)}
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: activeTab === table.name ? "#f0f9ff" : "#ffffff",
                border: `2px solid ${activeTab === table.name ? info.color : "#e5e7eb"}`,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: activeTab === table.name ? `0 4px 12px ${info.color}30` : "0 1px 3px rgba(0,0,0,0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{info.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{table.name}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: table.error ? "#ef4444" : info.color }}>
                {table.error ? "!" : table.data.length}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                {table.error ? table.error.slice(0, 30) : info.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Tabs - Scrollable */}
      <div style={{ borderBottom: "2px solid #e5e7eb", marginBottom: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 4, minWidth: "max-content" }}>
          {TABLES.map((name) => {
            const info = TABLE_INFO[name] || { icon: "📄", color: "#6b7280" };
            return (
              <button
                key={name}
                onClick={() => setActiveTab(name)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: activeTab === name ? `3px solid ${info.color}` : "3px solid transparent",
                  backgroundColor: activeTab === name ? "#f9fafb" : "transparent",
                  color: activeTab === name ? info.color : "#6b7280",
                  cursor: "pointer",
                  fontWeight: activeTab === name ? 600 : 400,
                  fontSize: 13,
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span>{info.icon}</span>
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Table Data */}
      {activeTable && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937" }}>
              📊 {activeTable.name} ({activeTable.data.length} kayıt)
            </h2>
            <button
              onClick={() => downloadAsJson(activeTable.data, activeTable.name)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14
              }}
            >
              📥 Bu Tabloyu İndir
            </button>
          </div>

          {activeTable.error ? (
            <div style={{ padding: 24, backgroundColor: "#fee2e2", borderRadius: 8, color: "#991b1b" }}>
              <strong>Hata:</strong> {activeTable.error}
            </div>
          ) : activeTable.data.length === 0 ? (
            <div style={{ padding: 24, backgroundColor: "#fef3c7", borderRadius: 8, color: "#92400e" }}>
              Bu tabloda veri yok.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    {Object.keys(activeTable.data[0]).map((key) => (
                      <th
                        key={key}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#374151",
                          borderBottom: "2px solid #e5e7eb",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTable.data.slice(0, 100).map((row, idx) => (
                    <tr
                      key={idx}
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}
                    >
                      {Object.values(row).map((val: any, i) => (
                        <td
                          key={i}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid #e5e7eb",
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                          title={typeof val === "object" ? JSON.stringify(val) : String(val)}
                        >
                          {typeof val === "object" ? (
                            <code style={{ fontSize: 12, backgroundColor: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                              {JSON.stringify(val).slice(0, 50)}...
                            </code>
                          ) : (
                            String(val)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeTable.data.length > 100 && (
                <div style={{ padding: 12, textAlign: "center", color: "#6b7280", backgroundColor: "#f9fafb" }}>
                  ... ve {activeTable.data.length - 100} kayıt daha (tümünü görmek için JSON indir)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Raw JSON Preview */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1f2937", marginBottom: 12 }}>
          📝 Ham JSON Önizleme
        </h2>
        <pre
          style={{
            backgroundColor: "#1f2937",
            color: "#a5f3fc",
            padding: 20,
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 400,
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          {activeTable ? JSON.stringify(activeTable.data.slice(0, 5), null, 2) : "Tablo seçin..."}
        </pre>
        {activeTable && activeTable.data.length > 5 && (
          <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            (İlk 5 kayıt gösteriliyor, toplam: {activeTable.data.length})
          </p>
        )}
      </div>

      {/* Environment Info */}
      <div style={{
        padding: 16,
        backgroundColor: "#f3f4f6",
        borderRadius: 8,
        marginTop: 24
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#374151" }}>
          ⚙️ Ortam Bilgisi
        </h3>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#4b5563" }}>
          <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "(tanımlı değil)"}</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "***" + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(-8) : "(tanımlı değil)"}</p>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 24,
            width: "90%",
            maxWidth: 600,
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1f2937" }}>
              📤 Verileri İçeri Aktar
            </h2>
            <p style={{ color: "#6b7280", marginBottom: 20 }}>
              JSON yedek dosyasından verileri Supabase'e aktarın.
              <br />
              <strong style={{ color: "#dc2626" }}>⚠️ Dikkat:</strong> Mevcut veriler silinecek!
            </p>

            {/* Tablo listesi */}
            <div style={{ marginBottom: 20 }}>
              {importStatuses.map((s) => {
                const info = TABLE_INFO[s.table] || { icon: "📄", color: "#6b7280" };
                return (
                  <div
                    key={s.table}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      marginBottom: 8,
                      borderRadius: 8,
                      backgroundColor: s.status === "success" ? "#d1fae5" :
                                      s.status === "error" ? "#fee2e2" :
                                      s.status === "importing" ? "#dbeafe" : "#f9fafb",
                      border: `1px solid ${s.status === "success" ? "#10b981" :
                                          s.status === "error" ? "#ef4444" :
                                          s.status === "importing" ? "#3b82f6" : "#e5e7eb"}`
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{info.icon}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.table}</span>
                    <span style={{ 
                      color: s.status === "importing" ? "#1d4ed8" : "#6b7280",
                      fontSize: 14 
                    }}>
                      {s.count} kayıt
                    </span>
                    <span style={{ fontSize: 18 }}>
                      {s.status === "pending" && "⏳"}
                      {s.status === "importing" && "🔄"}
                      {s.status === "success" && "✅"}
                      {s.status === "error" && "❌"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Toplam */}
            <div style={{
              padding: 12,
              backgroundColor: "#f0f9ff",
              borderRadius: 8,
              marginBottom: 20,
              textAlign: "center"
            }}>
              <strong>Toplam: {importStatuses.reduce((acc, s) => acc + s.count, 0)} kayıt</strong>
            </div>

            {/* Butonlar */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData(null);
                  setImportStatuses([]);
                }}
                disabled={isImporting}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: isImporting ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  opacity: isImporting ? 0.5 : 1
                }}
              >
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || importStatuses.every(s => s.status === "success")}
                style={{
                  padding: "10px 20px",
                  backgroundColor: importStatuses.every(s => s.status === "success") ? "#10b981" : "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: isImporting ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  opacity: isImporting ? 0.7 : 1
                }}
              >
                {isImporting ? "İçeri Aktarılıyor..." : 
                 importStatuses.every(s => s.status === "success") ? "✅ Tamamlandı!" : 
                 "🚀 İçeri Aktar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
