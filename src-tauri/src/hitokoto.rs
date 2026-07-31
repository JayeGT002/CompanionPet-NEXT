use rand::Rng;
use serde::Deserialize;

#[derive(Deserialize)]
struct HitokotoResponse {
    hitokoto: Option<String>,
}

const FALLBACK_QUOTES: &[&str] = &[
    "今天也是元气满满的一天呢~",
    "主人辛苦了，休息一下吧",
    "别忘了喝水哦",
    "生活不止眼前的代码，还有远方的美食",
    "晚安，愿你好梦",
    "加油，你是最棒的！",
    "窗外天气不错，要不要出去走走？",
    "一个人也要好好吃饭呀",
    "今天的努力，是明天的伏笔",
    "做自己喜欢的事，就是最大的幸福",
    "你若盛开，蝴蝶自来",
    "保持热爱，奔赴山海",
    "星光不问赶路人",
    "慢慢来，比较快",
    "心有猛虎，细嗅蔷薇",
];

fn random_fallback() -> String {
    let mut rng = rand::thread_rng();
    let idx = rng.gen_range(0..FALLBACK_QUOTES.len());
    FALLBACK_QUOTES[idx].to_string()
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
