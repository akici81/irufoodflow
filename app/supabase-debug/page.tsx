"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type TableData = {
  name: string;
  data: any[];
  error: string | null;
  loading: boolean;
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
    </div>
  );
}
