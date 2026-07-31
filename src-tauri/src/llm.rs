use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Option<Vec<Choice>>,
}

#[derive(Deserialize)]
struct Choice {
    message: Option<ChatMessage>,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

/// 角色提示词（来自 未命名.txt，编译期嵌入）
const LLM_PROMPT: &str = include_str!("../../未命名.txt");

/// 每次生成的目标条数
const TARGET_COUNT: usize = 60;

/// 去除行首常见编号前缀（"1." "1、" "1)" "1）" "- " "· " "* "），返回纯台词
fn strip_numbering(line: &str) -> String {
    let s = line.trim();
    let bytes = s.as_bytes();
    let mut idx = 0usize;

    // 跳过前导数字
    while idx < bytes.len() && bytes[idx].is_ascii_digit() {
        idx += 1;
    }
    if idx > 0 {
        // 跳过一个编号分隔符
        let rest = &s[idx..];
        let rest = rest.trim_start_matches(|c: char| matches!(c, '.' | '、' | ')' | '）' | '-' | '·' | '*' | ' ' | '\t'));
        return rest.trim().to_string();
    }
    // 无数字编号时，去掉列表符号前缀
    s.trim_start_matches(|c: char| matches!(c, '-' | '·' | '*' | ' '))
        .trim()
        .to_string()
}

/// 调用 LLM 生成一批桌面宠物台词（每次 60 条）
///
/// 使用 `未命名.txt` 中的角色设定作为 system prompt，要求模型严格按设定
/// 输出 60 条独立台词。失败时返回 Err，由前端降级到兜底文案。
pub async fn generate_speeches(endpoint: &str, api_key: &str, model: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("客户端构建失败: {}", e))?;

    let body = ChatRequest {
        model: model.to_string(),
        messages: vec![
            Message {
                role: "system".to_string(),
                content: LLM_PROMPT.to_string(),
            },
            Message {
                role: "user".to_string(),
                content: format!(
                    "请严格按照上述设定生成 {} 条台词，每条一行，独立成句，不编号，不解释，不加任何前后缀。直接输出 {} 行台词。",
                    TARGET_COUNT, TARGET_COUNT
                ),
            },
        ],
        max_tokens: 4096,
        temperature: 0.95,
    };

    let res = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {} {}", status, text));
    }

    let data: ChatResponse = res.json().await.map_err(|e| format!("解析失败: {}", e))?;
    let content = data
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message)
        .and_then(|m| m.content)
        .unwrap_or_default();

    // 按行拆分 → 去编号 → 过滤空行与过长行（>80 字符视为异常）
    let lines: Vec<String> = content
        .lines()
        .map(strip_numbering)
        .filter(|l| {
            let len = l.chars().count();
            len > 0 && len <= 80
        })
        .collect();

    if lines.is_empty() {
        Err("LLM 返回内容为空".into())
    } else {
        Ok(lines)
    }
}
