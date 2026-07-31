use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize)]
struct HitokotoResponse {
    hitokoto: Option<String>,
}

/// 兜底文案（来自 兜底文案.txt，编译期嵌入）
const FALLBACK_TEXT: &str = include_str!("../../兜底文案.txt");

/// 从兜底文案中随机取一条
fn random_fallback() -> String {
    let lines: Vec<&str> = FALLBACK_TEXT
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();
    if lines.is_empty() {
        return "今天也是元气满满的一天呢~".to_string();
    }
    let mut rng = rand::thread_rng();
    let idx = rng.gen_range(0..lines.len());
    lines[idx].to_string()
}

/// 从一言 API 获取随机语句（公开，供 command 调用）
pub async fn fetch_from_api(category: &str) -> String {
    let url = if category == "all" || category.is_empty() {
        "https://v1.hitokoto.cn/".to_string()
    } else {
        format!("https://v1.hitokoto.cn/?c={}", category)
    };

    match reqwest::get(&url).await {
        Ok(res) => {
            if let Ok(data) = res.json::<HitokotoResponse>().await {
                data.hitokoto.unwrap_or_else(random_fallback)
            } else {
                random_fallback()
            }
        }
        Err(_) => random_fallback(),
    }
}
