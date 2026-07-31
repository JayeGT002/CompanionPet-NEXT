use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// 应用数据目录
fn data_dir() -> PathBuf {
    let mut dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    dir.push("companionpet.db");
    dir
}

fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        let mut p = PathBuf::from(home);
        p.push("Library");
        p.push("Application Support");
        p.push("com.companionpet.pet");
        Some(p)
    }
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").ok()?;
        let mut p = PathBuf::from(appdata);
        p.push("CompanionPet");
        Some(p)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::var("HOME").ok()?;
        let mut p = PathBuf::from(home);
        p.push(".companionpet");
        Some(p)
    }
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let dir = data_dir();
        std::fs::create_dir_all(dir.parent().unwrap_or(&dir)).ok();
        let conn = Connection::open(&dir)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS hitokoto_cache (
                text TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL
            );",
        )?;

        Ok(Self { conn })
    }

    pub fn get_config(&self, key: &str) -> Option<String> {
        self.conn
            .query_row(
                "SELECT value FROM config WHERE key = ?1",
                [key],
                |row| row.get(0),
            )
            .ok()
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_all_config(&self) -> Result<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare("SELECT key, value FROM config")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect()
    }

    pub fn add_hitokoto_cache(&self, text: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO hitokoto_cache (text, created_at) VALUES (?1, unixepoch())",
            [text],
        )?;
        Ok(())
    }

    pub fn is_hitokoto_cached(&self, text: &str) -> bool {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM hitokoto_cache WHERE text = ?1",
                [text],
                |row| row.get::<_, i32>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false)
    }

    /// 清理旧缓存，只保留最近 50 条
    pub fn cleanup_hitokoto_cache(&self) -> Result<()> {
        self.conn.execute(
            "DELETE FROM hitokoto_cache WHERE rowid NOT IN (
                SELECT rowid FROM hitokoto_cache ORDER BY created_at DESC LIMIT 50
            )",
            [],
        )?;
        Ok(())
    }
}
