


# AI Scheduler Backend

Bu proje, FastAPI ve SQLModel kullanarak PostgreSQL üzerinde çalışan bir AI Scheduler backend API'sidir.

## 1\. Gereksinimler

- Python \>= 3.11
- PostgreSQL (lokalde çalışan)
- `psql` veya başka bir PostgreSQL istemcisi
- macOS (bu doküman buna göre yazılmıştır)

## 2\. Proje Klasörüne Geçiş

Proje kök klasörüne geç:

```bash
cd /Users/alputar/Desktop/ens492_v3
```

`ls` çıktısında `fastapi_ai_scheduler` klasörünü görmelisin.

## 3\. Sanal Ortam (`.venv`) Oluşturma ve Aktifleştirme

Eğer `.venv` yoksa oluştur:

```bash
cd /Users/alputar/Desktop/ens492_v3
python3 -m venv .venv
```

Aktifleştirme:

```bash
source .venv/bin/activate
```

Her yeni terminal açışında:

```bash
cd /Users/alputar/Desktop/ens492_v3
source .venv/bin/activate
```

## 4\. Python Bağımlılıklarını Kurma

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

`requirements.txt` içinde en az şu paketler olmalı:

- `fastapi`
- `uvicorn[standard]`
- `sqlmodel`
- `pydantic-settings`
- `python-multipart`
- `passlib[bcrypt]`
- `httpx`
- `pytest`, `pytest-cov`
- `python-jose[cryptography]`

## 5\. PostgreSQL Veritabanını Hazırlama

1. PostgreSQL servisinin çalıştığından emin ol.
2. Aşağıdaki parametrelerle bir veritabanı oluştur:

   - Host: `127.0.0.1`
   - Port: `5432`
   - Kullanıcı: `postgres`
   - Şifre: `492database`
   - Veritabanı adı: `492db`

Örnek:

```bash
psql -h 127.0.0.1 -U postgres
-- psql içindeyken:
CREATE DATABASE "492db";
\q
```

## 6\. Ortam Değişkenlerini Ayarlama

Her terminal oturumunda:

```bash
export DATABASE_URL="postgresql://postgres:492database@127.0.0.1:5432/492db"
export PYTHONPATH=/Users/alputar/Desktop/ens492_v3
```

`DATABASE_URL` veritabanı bağlantısını, `PYTHONPATH` ise `fastapi_ai_scheduler` paketinin bulunmasını sağlar.

## 7\. Uygulamayı Uvicorn ile Terminalden Çalıştırma

Aktif sanal ortamdayken:

```bash
cd /Users/alputar/Desktop/ens492_v3
source .venv/bin/activate

export DATABASE_URL="postgresql://postgres:492database@127.0.0.1:5432/492db"
export PYTHONPATH=/Users/alputar/Desktop/ens492_v3

python3 -m uvicorn fastapi_ai_scheduler.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### `Address already in use` hatası alırsan

Portu kullanan süreci bul ve sonlandır:

```bash
lsof -i :8000
kill <PID>        # Gerekirse:
kill -9 <PID>
```

Sonra aynı `uvicorn` komutunu tekrar çalıştır.

## 8\. PyCharm Üzerinden Çalıştırma

1. `Run` \> `Edit Configurations...`
2. `+` \> `Python` yapılandırması ekle.
3. Aşağıdakileri ayarla:

   - `Working directory`: `/Users/alputar/Desktop/ens492_v3`
   - `Module name`: `uvicorn`
   - `Parameters`: `fastapi_ai_scheduler.app.main:app --host 127.0.0.1 --port 8000 --reload`
   - `Python interpreter`: `.venv` içindeki interpreter

4. `Environment variables` kısmına ekle:

   - `DATABASE_URL=postgresql://postgres:492database@127.0.0.1:5432/492db`
   - `PYTHONPATH=/Users/alputar/Desktop/ens492_v3`

Ardından `Run` veya `Debug` ile sunucuyu başlat.

## 9\. Çalıştığını Doğrulama

Sunucu doğru şekilde ayağa kalktığında loglarda:

- `Uvicorn running on http://127.0.0.1:8000`
- `Application startup complete.`

gibi satırlar görünecektir.

Tarayıcıdan:

- Sağlık kontrolü: `http://127.0.0.1:8000/`  
  Beklenen cevap:

  ```json
  {"status": "ok", "message": "AI Scheduler backend active"}
  ```

- Swagger UI: `http://127.0.0.1:8000/docs`

## 10\. Uygulama Yaşam Döngüsü ve Veritabanı Kontrolü

`fastapi_ai_scheduler/app/main.py` içindeki lifespan fonksiyonu:

1. Uygulama başlarken:

   - `DATABASE_URL` kullanarak veritabanına bağlanmayı dener.
   - `SELECT 1` ile bağlantıyı doğrular.
   - Başarılıysa `SQLModel.metadata.create_all(bind=engine)` ile tabloları oluşturur.

2. Bağlantı veya tablo oluşturma başarısız olursa:

   - Loglarda açıklayıcı hata mesajları görülür.
   - Uygulama `RuntimeError` ile başlatılmaz.

Bu yüzden sunucuyu başlatmadan önce:

- `DATABASE_URL` değerinin doğru olduğundan,
- PostgreSQL servisinin çalıştığından,
- Kullanıcı/veritabanı yetkilerinin uygun olduğundan

emin olman gerekir.
```