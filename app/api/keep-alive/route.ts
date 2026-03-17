import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Bu API her çağrıldığında Supabase'e basit bir sorgu atar
// Böylece veritabanı "aktif" kalır ve 7 gün kuralına takılmaz

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Basit bir sorgu yap - sadece 1 kayıt al
    const { data, error } = await supabase
      .from("kullanicilar")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase keep-alive ping başarılı",
      timestamp: new Date().toISOString(),
      recordCount: data?.length || 0
    });
  } catch (err: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
